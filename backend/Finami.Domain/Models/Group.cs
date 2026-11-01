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
}

public class GroupMember
{
    public long GroupMemberId { get; set; }
    public long GroupId { get; set; }
    public long UserId { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}
