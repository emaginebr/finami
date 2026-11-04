namespace Finami.Infra.Interfaces.Repository;

/// <summary>Transação de banco e bloqueio pessimista de contas (research R-07).</summary>
public interface IUnitOfWork
{
    Task BeginTransactionAsync();
    Task CommitAsync();
    Task RollbackAsync();

    /// <summary>Bloqueia as linhas das contas (SELECT ... FOR UPDATE), em ordem crescente de id.</summary>
    Task LockAccountsAsync(IEnumerable<long> accountIds);

    /// <summary>
    /// Feature 007 (R-03): bloqueio consultivo do par de pessoas até o fim da transação aberta, para serializar
    /// lançamentos que mexem na dívida entre elas (a ordem dos ids não importa).
    /// </summary>
    Task LockDebtPairAsync(long userA, long userB);
}
