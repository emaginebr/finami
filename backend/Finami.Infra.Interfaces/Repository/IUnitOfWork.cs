namespace Finami.Infra.Interfaces.Repository;

/// <summary>Transação de banco e bloqueio pessimista de contas (research R-07).</summary>
public interface IUnitOfWork
{
    Task BeginTransactionAsync();
    Task CommitAsync();
    Task RollbackAsync();

    /// <summary>Bloqueia as linhas das contas (SELECT ... FOR UPDATE), em ordem crescente de id.</summary>
    Task LockAccountsAsync(IEnumerable<long> accountIds);
}
