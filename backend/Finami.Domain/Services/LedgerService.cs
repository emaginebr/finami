using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Validators;
using Finami.DTO.Transactions;
using Finami.Infra.Interfaces.Repository;
using FluentValidation;
using ValidationException = Finami.Domain.Exceptions.ValidationException;

namespace Finami.Domain.Services;

/// <summary>Livro-razão de partidas dobradas (research R-06/R-07).</summary>
public class LedgerService : ILedgerService
{

    private readonly IAccountRepository<Account> _accountRepository;
    private readonly ITransactionRepository<Transaction> _transactionRepository;
    private readonly IUserRepository<User> _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAccessPolicy _accessPolicy;
    public const string REVERSAL_UNIQUE_INDEX = "ix_transactions_reversed_transaction_id";

    private readonly IValidator<WalletMovementInfo> _movementValidator;
    private readonly IValidator<TransferInfo> _transferValidator;
    private readonly IQuoteService _quoteService;
    private readonly IBtcQuoteRepository<BtcQuote> _quoteRepository;

    public LedgerService(
        IAccountRepository<Account> accountRepository,
        ITransactionRepository<Transaction> transactionRepository,
        IUserRepository<User> userRepository,
        IUnitOfWork unitOfWork,
        IAccessPolicy accessPolicy,
        IValidator<WalletMovementInfo> movementValidator,
        IValidator<TransferInfo> transferValidator,
        IQuoteService quoteService,
        IBtcQuoteRepository<BtcQuote> quoteRepository)
    {
        _accountRepository = accountRepository;
        _transactionRepository = transactionRepository;
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _accessPolicy = accessPolicy;
        _movementValidator = movementValidator;
        _transferValidator = transferValidator;
        _quoteService = quoteService;
        _quoteRepository = quoteRepository;
    }

    public async Task<TransactionInfo> IncomeAsync(long userId, IncomeInfo info)
    {
        await _movementValidator.ValidateOrThrowAsync(info);
        var wallet = await LoadWalletAsync(info.WalletId);
        await _accessPolicy.EnsureCanControlWalletAsync(userId, wallet);
        var source = await _accountRepository.GetSystemAccountAsync((int)AccountKind.ExternalSource, (int)wallet.Currency);

        var transaction = await PostAsync(new PostingRequest(TransactionType.ExternalIncome, source, wallet,
            info.Amount, info.Amount, userId, info.Description));
        return await ToInfoAsync(transaction);
    }

    public async Task<TransactionInfo> ExpenseAsync(long userId, ExpenseInfo info)
    {
        await _movementValidator.ValidateOrThrowAsync(info);
        var wallet = await LoadWalletAsync(info.WalletId);
        await _accessPolicy.EnsureCanControlWalletAsync(userId, wallet);
        var destination = await _accountRepository.GetSystemAccountAsync((int)AccountKind.ExternalSink, (int)wallet.Currency);

        var transaction = await PostAsync(new PostingRequest(TransactionType.ExternalExpense, wallet, destination,
            info.Amount, info.Amount, userId, info.Description));
        return await ToInfoAsync(transaction);
    }

    public async Task<TransactionInfo> TransferAsync(long userId, TransferInfo info)
    {
        var plan = await PlanTransferAsync(userId, info);
        var transaction = await PostAsync(new PostingRequest(plan.Type, plan.Source, plan.Destination,
            plan.SourceAmount, plan.DestinationAmount, userId, info.Description,
            plan.Quote?.BtcQuoteId, plan.Quote?.PriceBrl));
        return await ToInfoAsync(transaction);
    }

    public async Task<TransferPreviewResult> PreviewTransferAsync(long userId, TransferInfo info)
    {
        var plan = await PlanTransferAsync(userId, info);
        return new TransferPreviewResult
        {
            Type = plan.Type.ToString(),
            SourceAmount = plan.SourceAmount,
            DestinationAmount = plan.DestinationAmount,
            Quote = plan.Quote == null ? null : ToQuoteRef(plan.Quote)
        };
    }

    public const string CONVERSION_SAME_OWNER_MESSAGE = "Conversão entre real e bitcoin só entre carteiras da mesma pessoa.";
    public const string FAMILY_ONLY_MESSAGE = "Só é possível transferir para pessoas da sua família.";
    public const string AMOUNT_BRL_BTC_ONLY_MESSAGE = "Valor em reais só vale para transferência entre carteiras de bitcoin.";
    public const string AMOUNT_TOO_SMALL_MESSAGE = "Valor pequeno demais para conversão.";

    public async Task<TransactionInfo> ReverseAsync(long userId, long transactionId, ReverseInfo? info)
    {
        var original = await _transactionRepository.GetByIdAsync(transactionId)
            ?? throw new NotFoundException("Transação não encontrada.");
        if (original.Type == TransactionType.Reversal)
            throw new BusinessRuleException("Um estorno não pode ser estornado.");
        if (await _transactionRepository.GetReversalOfAsync(transactionId) != null)
            throw new ConflictException("Esta transação já foi estornada.");

        // O estorno inverte o fluxo: sai da conta de entrada original e volta para a de saída original.
        var source = await _accountRepository.GetByIdAsync(original.DestinationAccountId)
            ?? throw new NotFoundException("Conta da transação não encontrada.");
        var destination = await _accountRepository.GetByIdAsync(original.SourceAccountId)
            ?? throw new NotFoundException("Conta da transação não encontrada.");
        var accountToControl = source.IsWallet ? source : destination;
        await _accessPolicy.EnsureCanControlWalletAsync(userId, accountToControl);

        var description = string.IsNullOrWhiteSpace(info?.Description)
            ? $"Estorno da transação {original.TransactionId}"
            : info.Description;

        try
        {
            var reversal = await PostAsync(new PostingRequest(TransactionType.Reversal, source, destination,
                original.DestinationAmount, original.SourceAmount, userId, description,
                original.BtcQuoteId, original.QuotePriceBrl, original.TransactionId));
            return await ToInfoAsync(reversal);
        }
        catch (Exception ex) when (IsReversalUniqueViolation(ex))
        {
            throw new ConflictException("Esta transação já foi estornada.");
        }
    }

    private static bool IsReversalUniqueViolation(Exception ex)
    {
        for (var current = ex; current != null; current = current.InnerException)
        {
            if (current.Message.Contains(REVERSAL_UNIQUE_INDEX, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private sealed record TransferPlan(TransactionType Type, Account Source, Account Destination,
        decimal SourceAmount, decimal DestinationAmount, BtcQuote? Quote);

    /// <summary>
    /// Valida a transferência e decide tipo e valores (FR-026/027/028; feature 006: data-model.md §Regras).
    /// Vale para o registro e para a prévia, logo para app, API e MCP.
    /// </summary>
    private async Task<TransferPlan> PlanTransferAsync(long userId, TransferInfo info)
    {
        // Mensagem do contrato (400) no lugar do genérico "Dados inválidos.".
        if (info != null && info.Amount.HasValue == info.AmountBrl.HasValue)
            throw new ValidationException(TransferInfoValidator.AMOUNT_REQUIRED_MESSAGE,
                new[] { TransferInfoValidator.AMOUNT_REQUIRED_MESSAGE });
        await _transferValidator.ValidateOrThrowAsync(info!);
        var source = await LoadWalletAsync(info!.SourceWalletId);
        await _accessPolicy.EnsureCanControlWalletAsync(userId, source);
        var destination = await LoadWalletAsync(info.DestinationWalletId);
        source.EnsureActive();
        destination.EnsureActive();

        // As regras são sobre os titulares das carteiras, não sobre quem lança (R-02/R-03).
        var sourceOwner = source.UserId!.Value;
        var destinationOwner = destination.UserId!.Value;
        if (sourceOwner != destinationOwner)
        {
            // R-04: antes de buscar a cotação, para não consultá-la à toa.
            if (source.Currency != destination.Currency)
                throw new BusinessRuleException(CONVERSION_SAME_OWNER_MESSAGE);
            if (!await _accessPolicy.AreFamilyAsync(sourceOwner, destinationOwner))
                throw new BusinessRuleException(FAMILY_ONLY_MESSAGE);
        }

        if (info.AmountBrl.HasValue)
            return await PlanBtcTransferInBrlAsync(source, destination, info.AmountBrl.Value);

        var amount = info.Amount!.Value;
        Money.EnsurePositive(amount, source.Currency);

        if (source.Currency == destination.Currency)
            return new TransferPlan(TransactionType.Transfer, source, destination, amount, amount, null);

        var quote = await _quoteService.GetForConversionAsync();
        var isPurchase = source.Currency == Currency.Brl && destination.Currency == Currency.Btc;
        var converted = isPurchase ? amount / quote.PriceBrl : amount * quote.PriceBrl;
        var destinationAmount = Money.Truncate(converted, destination.Currency);
        if (destinationAmount <= 0)
            throw new BusinessRuleException(AMOUNT_TOO_SMALL_MESSAGE);

        return new TransferPlan(isPurchase ? TransactionType.BtcPurchase : TransactionType.BtcSale,
            source, destination, amount, destinationAmount, quote);
    }

    /// <summary>R-07: BTC → BTC informado em reais; converte pela cotação atual, truncando em 8 casas.</summary>
    private async Task<TransferPlan> PlanBtcTransferInBrlAsync(Account source, Account destination, decimal amountBrl)
    {
        if (source.Currency != Currency.Btc || destination.Currency != Currency.Btc)
            throw new ValidationException(AMOUNT_BRL_BTC_ONLY_MESSAGE, new[] { AMOUNT_BRL_BTC_ONLY_MESSAGE });

        var quote = await _quoteService.GetForConversionAsync();
        var amount = Money.Truncate(amountBrl / quote.PriceBrl, Currency.Btc);
        if (amount <= 0)
            throw new BusinessRuleException(AMOUNT_TOO_SMALL_MESSAGE);
        return new TransferPlan(TransactionType.Transfer, source, destination, amount, amount, quote);
    }

    private static QuoteRefInfo ToQuoteRef(BtcQuote quote) => new()
    {
        PriceBrl = quote.PriceBrl,
        QuotedAt = quote.QuotedAt,
        Source = quote.Source
    };

    public async Task<TransactionInfo> GetAsync(long userId, long transactionId)
    {
        var transaction = await _transactionRepository.GetByIdAsync(transactionId)
            ?? throw new NotFoundException("Transação não encontrada.");
        await EnsureCanViewAsync(userId, transaction);
        return await ToInfoAsync(transaction);
    }

    /// <summary>Dados para gravar uma transação.</summary>
    protected internal sealed record PostingRequest(
        TransactionType Type,
        Account Source,
        Account Destination,
        decimal SourceAmount,
        decimal DestinationAmount,
        long UserId,
        string? Description,
        long? BtcQuoteId = null,
        decimal? QuotePriceBrl = null,
        long? ReversedTransactionId = null);

    /// <summary>
    /// Grava cabeçalho + lançamentos de forma atômica (FR-031): bloqueia as carteiras envolvidas,
    /// revalida o saldo da origem e gera 2 lançamentos (mesma moeda) ou 4 (com câmbio).
    /// </summary>
    protected internal async Task<Transaction> PostAsync(PostingRequest request)
    {
        var source = request.Source;
        var destination = request.Destination;

        if (source.AccountId == destination.AccountId)
            throw new ValidationException("A conta de origem e a de destino devem ser diferentes.");
        Money.EnsurePositive(request.SourceAmount, source.Currency);
        if (request.DestinationAmount <= 0 || !Money.HasValidScale(request.DestinationAmount, destination.Currency))
            throw new BusinessRuleException("Valor pequeno demais para conversão.");
        if (source.IsWallet) source.EnsureActive();
        if (destination.IsWallet) destination.EnsureActive();

        var occurredAt = DateTime.UtcNow;
        var transaction = new Transaction
        {
            Type = request.Type,
            SourceAccountId = source.AccountId,
            DestinationAccountId = destination.AccountId,
            SourceAmount = request.SourceAmount,
            DestinationAmount = request.DestinationAmount,
            BtcQuoteId = request.BtcQuoteId,
            QuotePriceBrl = request.QuotePriceBrl,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            OccurredAt = occurredAt,
            CreatedByUserId = request.UserId,
            ReversedTransactionId = request.ReversedTransactionId
        };
        transaction.Entries = await BuildEntriesAsync(transaction, source, destination, occurredAt);

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            var walletIds = new[] { source, destination }.Where(a => a.IsWallet).Select(a => a.AccountId);
            await _unitOfWork.LockAccountsAsync(walletIds);

            // Saldo de carteira pode ficar negativo: não há checagem de saldo disponível.

            await _transactionRepository.InsertWithEntriesAsync(transaction);
            await _unitOfWork.CommitAsync();
            return transaction;
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }
    }

    private async Task<List<LedgerEntry>> BuildEntriesAsync(Transaction transaction, Account source,
        Account destination, DateTime occurredAt)
    {
        var entries = new List<LedgerEntry>
        {
            Entry(source.AccountId, -transaction.SourceAmount, source.Currency, occurredAt)
        };

        if (source.Currency != destination.Currency)
        {
            // Conversão: passa pelas contas de câmbio para que cada moeda feche em zero (SC-002).
            var exchangeSource = await _accountRepository.GetSystemAccountAsync((int)AccountKind.Exchange, (int)source.Currency);
            var exchangeDestination = await _accountRepository.GetSystemAccountAsync((int)AccountKind.Exchange, (int)destination.Currency);
            entries.Add(Entry(exchangeSource.AccountId, transaction.SourceAmount, source.Currency, occurredAt));
            entries.Add(Entry(exchangeDestination.AccountId, -transaction.DestinationAmount, destination.Currency, occurredAt));
        }

        entries.Add(Entry(destination.AccountId, transaction.DestinationAmount, destination.Currency, occurredAt));
        return entries;
    }

    private static LedgerEntry Entry(long accountId, decimal amount, Currency currency, DateTime occurredAt) => new()
    {
        AccountId = accountId,
        Amount = amount,
        Currency = currency,
        OccurredAt = occurredAt
    };

    protected internal async Task<Account> LoadWalletAsync(long walletId)
    {
        var wallet = await _accountRepository.GetByIdAsync(walletId);
        if (wallet == null || !wallet.IsWallet)
            throw new NotFoundException("Carteira não encontrada.");
        return wallet;
    }

    private async Task EnsureCanViewAsync(long userId, Transaction transaction)
    {
        var accounts = await _accountRepository.GetByIdsAsync(new[] { transaction.SourceAccountId, transaction.DestinationAccountId });
        foreach (var account in accounts)
        {
            if (await _accessPolicy.CanControlWalletAsync(userId, account))
                return;
        }
        throw new ForbiddenException("Você não tem permissão sobre esta transação.");
    }

    protected internal async Task<TransactionInfo> ToInfoAsync(Transaction transaction)
    {
        var accounts = (await _accountRepository.GetByIdsAsync(new[] { transaction.SourceAccountId, transaction.DestinationAccountId }))
            .ToDictionary(a => a.AccountId);
        var ownerIds = accounts.Values.Where(a => a.UserId.HasValue).Select(a => a.UserId!.Value);
        var owners = (await _userRepository.GetByIdsAsync(ownerIds)).ToDictionary(u => u.UserId);
        var reversal = await _transactionRepository.GetReversalOfAsync(transaction.TransactionId);
        var quote = transaction.BtcQuoteId.HasValue
            ? await _quoteRepository.GetByIdAsync(transaction.BtcQuoteId.Value)
            : null;

        TransactionAccountInfo AccountInfo(long accountId)
        {
            if (!accounts.TryGetValue(accountId, out var account))
                return new TransactionAccountInfo { AccountId = accountId };
            return new TransactionAccountInfo
            {
                AccountId = account.AccountId,
                Name = account.Name,
                Kind = account.Kind.ToString(),
                Currency = account.Currency.ToCode(),
                OwnerName = account.UserId.HasValue && owners.TryGetValue(account.UserId.Value, out var owner)
                    ? owner.FullName
                    : null
            };
        }

        return new TransactionInfo
        {
            TransactionId = transaction.TransactionId,
            Type = transaction.Type.ToString(),
            Source = AccountInfo(transaction.SourceAccountId),
            Destination = AccountInfo(transaction.DestinationAccountId),
            SourceAmount = transaction.SourceAmount,
            DestinationAmount = transaction.DestinationAmount,
            Quote = transaction.QuotePriceBrl.HasValue
                ? new QuoteRefInfo
                {
                    PriceBrl = transaction.QuotePriceBrl.Value,
                    QuotedAt = quote?.QuotedAt,
                    Source = quote?.Source
                }
                : null,
            Description = transaction.Description,
            OccurredAt = transaction.OccurredAt,
            CreatedByUserId = transaction.CreatedByUserId,
            ReversedTransactionId = transaction.ReversedTransactionId,
            ReversedByTransactionId = reversal?.TransactionId
        };
    }
}
