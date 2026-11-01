using Finami.DTO.Invitations;

namespace Finami.Domain.Interfaces;

/// <summary>Convites para a família (feature 003, research R-04).</summary>
public interface IInvitationService
{
    Task<GroupInvitationInfo> InviteAsync(long userId, long groupId, GroupInvitationInsertInfo info);
    Task<List<GroupInvitationInfo>> ListByGroupAsync(long userId, long groupId, string? status);
    Task<GroupInvitationInfo> CancelAsync(long userId, long groupId, long invitationId);
    Task<GroupInvitationInfo> AcceptAsync(long userId, long invitationId);
    Task<GroupInvitationInfo> DeclineAsync(long userId, long invitationId);
}
