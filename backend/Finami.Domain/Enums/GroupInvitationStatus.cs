namespace Finami.Domain.Enums;

/// <summary>Estado do convite para a família (gravado como integer em group_invitations.status).</summary>
public enum GroupInvitationStatus
{
    Pending = 1,
    Accepted = 2,
    Declined = 3,
    Canceled = 4
}
