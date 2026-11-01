using Finami.Domain.Enums;
using Finami.Domain.Exceptions;

namespace Finami.Domain.Models;

/// <summary>Convite para a família; só sai de Pending uma única vez (FR-011).</summary>
public class GroupInvitation
{
    public const string UNAVAILABLE_MESSAGE = "Este convite não está mais disponível.";

    public long GroupInvitationId { get; set; }
    public long GroupId { get; set; }
    public long InvitedUserId { get; set; }
    public long InvitedByUserId { get; set; }
    public GroupInvitationStatus Status { get; set; } = GroupInvitationStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RespondedAt { get; set; }

    public bool IsPending => Status == GroupInvitationStatus.Pending;

    public void Accept(DateTime now) => Transition(GroupInvitationStatus.Accepted, now);

    public void Decline(DateTime now) => Transition(GroupInvitationStatus.Declined, now);

    public void Cancel(DateTime now) => Transition(GroupInvitationStatus.Canceled, now);

    private void Transition(GroupInvitationStatus status, DateTime now)
    {
        if (!IsPending)
            throw new ConflictException(UNAVAILABLE_MESSAGE);
        Status = status;
        RespondedAt = now;
    }
}
