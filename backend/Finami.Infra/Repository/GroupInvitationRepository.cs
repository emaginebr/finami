using Finami.Domain.Enums;
using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

public class GroupInvitationRepository : IGroupInvitationRepository<GroupInvitation>
{
    private readonly FinamiContext _context;

    public GroupInvitationRepository(FinamiContext context)
    {
        _context = context;
    }

    public Task<GroupInvitation?> GetByIdAsync(long invitationId) =>
        _context.GroupInvitations.FirstOrDefaultAsync(i => i.GroupInvitationId == invitationId);

    public async Task<GroupInvitation?> GetByIdForUpdateAsync(long invitationId)
    {
        var invitation = (await _context.GroupInvitations
                .FromSqlInterpolated(
                    $"SELECT * FROM group_invitations WHERE group_invitation_id = {invitationId} FOR UPDATE")
                .ToListAsync())
            .FirstOrDefault();
        // Se a entidade já estava rastreada, o EF devolve a instância antiga: relê após o bloqueio.
        if (invitation != null)
            await _context.Entry(invitation).ReloadAsync();
        return invitation;
    }

    public Task<GroupInvitation?> GetPendingAsync(long groupId, long userId) =>
        _context.GroupInvitations.AsNoTracking()
            .FirstOrDefaultAsync(i => i.GroupId == groupId
                                      && i.InvitedUserId == userId
                                      && i.Status == GroupInvitationStatus.Pending);

    public Task<List<GroupInvitation>> ListByGroupAsync(long groupId, int status)
    {
        var typed = (GroupInvitationStatus)status;
        return _context.GroupInvitations.AsNoTracking()
            .Where(i => i.GroupId == groupId && i.Status == typed)
            .OrderByDescending(i => i.CreatedAt).ThenByDescending(i => i.GroupInvitationId)
            .ToListAsync();
    }

    public async Task<GroupInvitation> InsertAsync(GroupInvitation invitation)
    {
        _context.GroupInvitations.Add(invitation);
        await _context.SaveChangesAsync();
        return invitation;
    }

    public async Task<GroupInvitation> UpdateAsync(GroupInvitation invitation)
    {
        if (_context.Entry(invitation).State == EntityState.Detached)
            _context.GroupInvitations.Update(invitation);
        await _context.SaveChangesAsync();
        return invitation;
    }
}
