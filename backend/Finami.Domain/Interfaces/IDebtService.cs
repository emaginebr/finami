using Finami.DTO.Debts;

namespace Finami.Domain.Interfaces;

/// <summary>Dívidas entre pessoas, derivadas do razão (feature 006, R-01/R-10).</summary>
public interface IDebtService
{
    /// <summary>
    /// Dívidas líquidas de <paramref name="targetUserId"/> com cada contraparte, por moeda, sem pares quites.
    /// Quem não pode ver a pessoa recebe 404.
    /// </summary>
    Task<PersonDebtsResult> GetPersonDebtsAsync(long userId, long targetUserId);
}
