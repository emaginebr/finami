using Finami.Domain.Enums;
using Finami.Domain.Models;

namespace Finami.Domain.Interfaces;

/// <summary>Regras de permissão sobre recursos (research R-10).</summary>
public interface IAccessPolicy
{
    /// <summary>Titular, ou responsável pelo grupo ao qual a carteira está vinculada (FR-019b).</summary>
    Task<bool> CanControlWalletAsync(long userId, Account wallet);

    Task EnsureCanControlWalletAsync(long userId, Account wallet);

    /// <summary>O próprio usuário ou quem o cadastrou (FR-010/011).</summary>
    bool CanEditUserProfile(long userId, User target);

    void EnsureCanEditUserProfile(long userId, User target);

    /// <summary>O próprio, quem o cadastrou ou alguém com grupo em comum.</summary>
    Task<bool> CanViewUserAsync(long userId, User target);

    /// <summary>Responsável: completo; membro: conforme a visibilidade do grupo; demais: negado.</summary>
    StatementAccess GroupStatementAccess(long userId, Group group);

    /// <summary>
    /// Titulares "da mesma família" (feature 006, R-03): o mesmo usuário ou duas pessoas com ao menos uma
    /// família em comum. Decide se uma transferência entre os titulares é permitida.
    /// </summary>
    Task<bool> AreFamilyAsync(long ownerUserId, long otherUserId);

    /// <summary>Quem controla a carteira, ou membro do grupo vinculado com visibilidade AllMembers.</summary>
    Task<bool> CanViewWalletStatementAsync(long userId, Account wallet);

    /// <summary>
    /// Feature 008 (R-03): controla a carteira e, se ela é de uma família, é o responsável ou um membro com
    /// "Pode lançar" naquela família. Vale para depósito, saque e a origem de toda transferência.
    /// </summary>
    Task<bool> CanCreateTransactionsAsync(long userId, Account wallet);

    /// <summary>
    /// 403 "Você não tem permissão sobre esta carteira." sem controle; 403 "Você não tem permissão para criar
    /// lançamentos na família {nome}." sem a permissão da família.
    /// </summary>
    Task EnsureCanCreateTransactionsAsync(long userId, Account wallet);

    /// <summary>Feature 008 (R-05): pode ver o extrato de alguma das carteiras do lançamento.</summary>
    Task<bool> CanViewTransactionAsync(long userId, IEnumerable<Account> accounts);

    /// <summary>
    /// Feature 008 (R-04): o lançamento não é um estorno, não foi estornado e o usuário tem permissão de estorno
    /// em alguma das carteiras (<see cref="EnsureCanReverseAsync"/>).
    /// </summary>
    Task<bool> CanReverseAsync(long userId, Transaction transaction, IEnumerable<Account> accounts, bool alreadyReversed);

    /// <summary>
    /// Feature 008 (R-04), só a permissão: para alguma carteira do lançamento, sem família → controla a carteira;
    /// com família → é o responsável, ou membro com "Pode estornar" que vê o extrato da carteira. Sem permissão:
    /// 403 "Você não tem permissão para estornar lançamentos na família {nome}." (família da primeira carteira de
    /// família) ou "Você não tem permissão sobre esta transação." quando não há carteira de família.
    /// </summary>
    Task EnsureCanReverseAsync(long userId, IEnumerable<Account> accounts);
}
