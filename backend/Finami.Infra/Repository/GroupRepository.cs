using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

public class GroupRepository : IGroupRepository<Group>
{
    private readonly FinamiContext _context;

    public GroupRepository(FinamiContext context)
    {
        _context = context;
    }

    public Task<Group?> GetByIdAsync(long groupId) =>
        _context.Groups.Include(g => g.Members).FirstOrDefaultAsync(g => g.GroupId == groupId);

    public Task<List<Group>> ListByMemberAsync(long userId) =>
        _context.Groups.AsNoTracking()
            .Include(g => g.Members)
            .Where(g => g.UserId == userId || g.Members.Any(m => m.UserId == userId))
            .OrderBy(g => g.Name)
            .ToListAsync();

    public Task<List<long>> ListResponsibleGroupIdsAsync(long userId) =>
        _context.Groups.Where(g => g.UserId == userId).Select(g => g.GroupId).ToListAsync();

    public Task<long?> GetResponsibleUserIdAsync(long groupId) =>
        _context.Groups.Where(g => g.GroupId == groupId).Select(g => (long?)g.UserId).FirstOrDefaultAsync();

    public Task<bool> IsMemberAsync(long groupId, long userId) =>
        _context.Groups.AnyAsync(g => g.GroupId == groupId
                                      && (g.UserId == userId || g.Members.Any(m => m.UserId == userId)));

    public Task<bool> ShareGroupAsync(long userId, long otherUserId) =>
        _context.GroupMembers.AnyAsync(m => m.UserId == userId
            && _context.GroupMembers.Any(o => o.GroupId == m.GroupId && o.UserId == otherUserId));

    public async Task<Group> InsertAsync(Group group)
    {
        _context.Groups.Add(group);
        await _context.SaveChangesAsync();
        return group;
    }

    public async Task<Group> UpdateAsync(Group group)
    {
        if (_context.Entry(group).State == EntityState.Detached)
            _context.Groups.Update(group);
        await _context.SaveChangesAsync();
        return group;
    }

    public async Task AddMemberAsync(long groupId, long userId)
    {
        _context.GroupMembers.Add(new GroupMember { GroupId = groupId, UserId = userId, JoinedAt = DateTime.UtcNow });
        await _context.SaveChangesAsync();
    }

    public async Task RemoveMemberAsync(long groupId, long userId)
    {
        await _context.GroupMembers
            .Where(m => m.GroupId == groupId && m.UserId == userId)
            .ExecuteDeleteAsync();
        foreach (var tracked in _context.ChangeTracker.Entries<GroupMember>()
                     .Where(e => e.Entity.GroupId == groupId && e.Entity.UserId == userId).ToList())
            tracked.State = EntityState.Detached;
    }
}
