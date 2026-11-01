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

    /// <summary>Quem controla a carteira, ou membro do grupo vinculado com visibilidade AllMembers.</summary>
    Task<bool> CanViewWalletStatementAsync(long userId, Account wallet);
}
