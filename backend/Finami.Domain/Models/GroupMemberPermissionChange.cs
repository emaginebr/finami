namespace Finami.Domain.Models;

/// <summary>
/// Feature 008 (R-02): histórico imutável das mudanças de permissão de um membro numa família. Só recebe inserções,
/// na mesma transação da mudança; uma chamada que não muda nada não gera linha.
/// </summary>
public class GroupMemberPermissionChange
{
    public long GroupMemberPermissionChangeId { get; set; }
    public long GroupId { get; set; }
    public long MemberUserId { get; set; }
    public long ChangedByUserId { get; set; }
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public bool BeforeCanCreateTransactions { get; set; }
    public bool BeforeCanReverse { get; set; }
    public bool AfterCanCreateTransactions { get; set; }
    public bool AfterCanReverse { get; set; }
}
