using Finami.Domain.Enums;
using Finami.Domain.Exceptions;

namespace Finami.Domain.Models;

/// <summary>Grupo familiar; UserId é o responsável, único que gerencia membros (FR-013).</summary>
public class Group
{
    public long GroupId { get; set; }
    public string Name { get; set; } = string.Empty;
    public long UserId { get; set; }
    public StatementVisibility StatementVisibility { get; set; } = StatementVisibility.ResponsibleOnly;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<GroupMember> Members { get; set; } = new();

    public bool IsResponsible(long userId) => UserId == userId;

    public bool IsMember(long userId) => UserId == userId || Members.Any(m => m.UserId == userId);

    public void Rename(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ValidationException("Nome do grupo é obrigatório.");
        Name = name.Trim();
    }

    public void SetVisibility(StatementVisibility visibility)
    {
        if (!Enum.IsDefined(visibility))
            throw new ValidationException("Visibilidade do extrato inválida.");
        StatementVisibility = visibility;
    }

    public void EnsureResponsible(long userId)
    {
        if (!IsResponsible(userId))
            throw new ForbiddenException("Apenas o responsável pelo grupo pode realizar esta operação.");
    }

    public const string RESPONSIBLE_PERMISSIONS_MESSAGE = "As permissões do responsável não podem ser alteradas.";
    public const string MEMBER_NOT_FOUND_MESSAGE = "Membro não encontrado.";

    /// <summary>Linha do membro em group_members (null se não é membro).</summary>
    public GroupMember? FindMember(long userId) => Members.FirstOrDefault(m => m.UserId == userId);

    /// <summary>Feature 008 (R-01): o responsável sempre pode; o membro, conforme a permissão dele.</summary>
    public bool CanCreateTransactions(long userId) =>
        IsResponsible(userId) || FindMember(userId)?.CanCreateTransactions == true;

    /// <summary>Feature 008 (R-01): o responsável sempre pode; o membro, conforme a permissão dele.</summary>
    public bool CanReverse(long userId) =>
        IsResponsible(userId) || FindMember(userId)?.CanReverse == true;

    /// <summary>
    /// Feature 008: muda as permissões do membro (só o responsável). Devolve o registro do histórico, ou null quando
    /// nada mudou (sem histórico nem notificação).
    /// </summary>
    public GroupMemberPermissionChange? SetMemberPermissions(long actorUserId, long memberUserId,
        bool canCreateTransactions, bool canReverse)
    {
        EnsureResponsible(actorUserId);
        if (IsResponsible(memberUserId))
            throw new BusinessRuleException(RESPONSIBLE_PERMISSIONS_MESSAGE);
        var member = FindMember(memberUserId) ?? throw new NotFoundException(MEMBER_NOT_FOUND_MESSAGE);
        if (member.CanCreateTransactions == canCreateTransactions && member.CanReverse == canReverse)
            return null;

        var change = new GroupMemberPermissionChange
        {
            GroupId = GroupId,
            MemberUserId = memberUserId,
            ChangedByUserId = actorUserId,
            ChangedAt = DateTime.UtcNow,
            BeforeCanCreateTransactions = member.CanCreateTransactions,
            BeforeCanReverse = member.CanReverse,
            AfterCanCreateTransactions = canCreateTransactions,
            AfterCanReverse = canReverse
        };
        member.CanCreateTransactions = canCreateTransactions;
        member.CanReverse = canReverse;
        return change;
    }
}

public class GroupMember
{
    public long GroupMemberId { get; set; }
    public long GroupId { get; set; }
    public long UserId { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Feature 008: pode registrar lançamentos com origem nas carteiras da família (padrão ligada).</summary>
    public bool CanCreateTransactions { get; set; } = true;

    /// <summary>Feature 008: pode estornar lançamentos das carteiras da família (padrão desligada, Q2).</summary>
    public bool CanReverse { get; set; }
}
