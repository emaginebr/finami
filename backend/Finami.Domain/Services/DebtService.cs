using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Validators;
using Finami.DTO.Debts;
using Finami.Infra.Interfaces.Repository;

namespace Finami.Domain.Services;

/// <summary>
/// Dívidas entre pessoas (feature 006, data-model.md §PersonDebt): calculadas na leitura a partir das transações
/// entre carteiras de titulares diferentes e mesma moeda. Saldo &gt; 0 = a pessoa deve à contraparte.
/// </summary>
public class DebtService : IDebtService
{
    private const string USER_NOT_FOUND = "Usuário não encontrado.";

    private readonly ITransactionRepository<Transaction> _transactionRepository;
    private readonly IUserRepository<User> _userRepository;
    private readonly IAccessPolicy _accessPolicy;

    public DebtService(
        ITransactionRepository<Transaction> transactionRepository,
        IUserRepository<User> userRepository,
        IAccessPolicy accessPolicy)
    {
        _transactionRepository = transactionRepository;
        _userRepository = userRepository;
        _accessPolicy = accessPolicy;
    }

    public async Task<PersonDebtsResult> GetPersonDebtsAsync(long userId, long targetUserId)
    {
        var target = await _userRepository.GetByIdAsync(targetUserId)
            ?? throw new NotFoundException(USER_NOT_FOUND);
        // Mesmo comportamento de GET /api/users/{id}: quem não pode ver a pessoa não sabe que ela existe.
        if (!await _accessPolicy.CanViewUserAsync(userId, target))
            throw new NotFoundException(USER_NOT_FOUND);

        var balances = (await _transactionRepository.GetPersonDebtsAsync(target.UserId))
            .Select(row =>
            {
                var currency = (Currency)row.Currency;
                return (row.CounterpartUserId, Currency: currency,
                    Balance: Math.Round(row.Balance, Money.Precision(currency), MidpointRounding.ToZero));
            })
            .Where(row => row.Balance != 0m)
            .ToList();

        var result = new PersonDebtsResult { UserId = target.UserId };
        if (balances.Count == 0)
            return result;

        var counterparts = (await _userRepository.GetByIdsAsync(balances.Select(b => b.CounterpartUserId).Distinct()))
            .ToDictionary(u => u.UserId);

        result.Debts = balances
            .Select(row =>
            {
                counterparts.TryGetValue(row.CounterpartUserId, out var counterpart);
                return new PersonDebtInfo
                {
                    CounterpartUserId = row.CounterpartUserId,
                    CounterpartName = counterpart?.FullName ?? string.Empty,
                    CounterpartFirstName = counterpart?.FirstName ?? string.Empty,
                    Currency = row.Currency.ToCode(),
                    Amount = Math.Abs(row.Balance),
                    Direction = row.Balance > 0 ? DebtDirections.OWES : DebtDirections.OWED
                };
            })
            .OrderBy(d => d.CounterpartName, StringComparer.CurrentCultureIgnoreCase)
            .ThenBy(d => d.CounterpartUserId)
            .ThenBy(d => d.Currency == "BRL" ? 0 : 1)
            .ToList();
        return result;
    }
}
