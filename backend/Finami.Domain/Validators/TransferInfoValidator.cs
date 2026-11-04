using Finami.Domain.Enums;
using Finami.Domain.Services;
using Finami.DTO.Transactions;
using FluentValidation;

namespace Finami.Domain.Validators;

public class TransferInfoValidator : AbstractValidator<TransferInfo>
{
    /// <summary>Feature 007: exatamente um entre amount e amountBrl, ou nenhum com settleAll.</summary>
    public const string AMOUNT_REQUIRED_MESSAGE = "Informe o valor em bitcoin ou em reais, ou quite tudo.";
    public const string INVALID_KIND_MESSAGE = "Tipo de transferência inválido.";
    public const string SETTLEMENT_ONLY_MESSAGE = "Moeda da dívida e quitar tudo só valem para quitação.";
    public const string INVALID_DEBT_CURRENCY_MESSAGE = "Moeda da dívida inválida. Use BRL ou BTC.";

    public TransferInfoValidator()
    {
        RuleFor(x => x.SourceWalletId).GreaterThan(0).WithMessage("Carteira de origem é obrigatória.");
        RuleFor(x => x.DestinationWalletId).GreaterThan(0).WithMessage("Carteira de destino é obrigatória.");
        RuleFor(x => x.DestinationWalletId).NotEqual(x => x.SourceWalletId)
            .WithMessage("A carteira de origem e a de destino devem ser diferentes.");

        // Feature 007: tipo e campos da quitação (contracts/api.md §Erros novos).
        RuleFor(x => x.Kind).Must(kind => TransferKindCodes.TryParse(kind, out _))
            .WithName("kind")
            .WithMessage(INVALID_KIND_MESSAGE)
            .When(x => x.Kind != null);
        RuleFor(x => x).Must(x => !UsesSettlementFields(x) || IsSettlement(x))
            .WithName("kind")
            .WithMessage(SETTLEMENT_ONLY_MESSAGE)
            .When(x => x.Kind == null || TransferKindCodes.TryParse(x.Kind, out _));
        RuleFor(x => x.DebtCurrency).Must(code => CurrencyCodes.TryParse(code, out _))
            .WithName("debtCurrency")
            .WithMessage(INVALID_DEBT_CURRENCY_MESSAGE)
            .When(x => x.DebtCurrency != null);

        // Exatamente um entre amount e amountBrl (feature 006, R-07), ou nenhum com settleAll (feature 007).
        RuleFor(x => x).Must(HasValidAmountCombination)
            .WithName("amount")
            .WithMessage(AMOUNT_REQUIRED_MESSAGE);
        RuleFor(x => x.Amount!.Value).GreaterThan(0).WithName("amount")
            .WithMessage("O valor deve ser maior que zero.")
            .When(x => x.Amount.HasValue);
        RuleFor(x => x.AmountBrl!.Value).GreaterThan(0).WithName("amountBrl")
            .WithMessage("O valor em reais deve ser maior que zero.")
            .When(x => x.AmountBrl.HasValue);
        RuleFor(x => x.AmountBrl!.Value).Must(v => Money.HasValidScale(v, Currency.Brl)).WithName("amountBrl")
            .WithMessage($"O valor em reais deve ter no máximo {Money.BRL_PRECISION} casas decimais.")
            .When(x => x.AmountBrl.HasValue);

        RuleFor(x => x.Description).MaximumLength(500).WithMessage("Descrição deve ter no máximo 500 caracteres.");
    }

    public static bool HasValidAmountCombination(TransferInfo info) => info.SettleAll
        ? !info.Amount.HasValue && !info.AmountBrl.HasValue
        : info.Amount.HasValue != info.AmountBrl.HasValue;

    public static bool UsesSettlementFields(TransferInfo info) => info.DebtCurrency != null || info.SettleAll;

    public static bool IsSettlement(TransferInfo info) =>
        TransferKindCodes.TryParse(info.Kind, out var kind) && kind == TransferKind.Settlement;
}
