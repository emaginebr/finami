using Finami.Domain.Models;
using Finami.Infra.Context;
using Finami.Infra.Interfaces.Repository;
using Microsoft.EntityFrameworkCore;

namespace Finami.Infra.Repository;

public class UserRepository : IUserRepository<User>
{
    private readonly FinamiContext _context;

    public UserRepository(FinamiContext context)
    {
        _context = context;
    }

    public Task<User?> GetByIdAsync(long userId) =>
        _context.Users.FirstOrDefaultAsync(u => u.UserId == userId);

    public Task<List<User>> GetByIdsAsync(IEnumerable<long> userIds)
    {
        var ids = userIds.Distinct().ToList();
        return _context.Users.AsNoTracking().Where(u => ids.Contains(u.UserId)).ToListAsync();
    }

    public Task<User?> GetByEmailAsync(string email)
    {
        var normalized = User.NormalizeEmail(email);
        return _context.Users.FirstOrDefaultAsync(u => u.Email == normalized);
    }

    public Task<User?> GetByGoogleSubjectAsync(string subject) =>
        _context.Users.FirstOrDefaultAsync(u => u.GoogleSubject == subject);

    public Task<bool> ExistsEmailAsync(string email, long? exceptUserId = null)
    {
        var normalized = User.NormalizeEmail(email);
        return _context.Users.AnyAsync(u => u.Email == normalized && (exceptUserId == null || u.UserId != exceptUserId));
    }

    public async Task<User> InsertAsync(User user)
    {
        _context.Users.Add(user);
        await _context.SaveChangesAsync();
        return user;
    }

    public async Task<User> UpdateAsync(User user)
    {
        if (_context.Entry(user).State == EntityState.Detached)
            _context.Users.Update(user);
        await _context.SaveChangesAsync();
        return user;
    }

    public Task<List<User>> ListCreatedByAsync(long userId) =>
        _context.Users.AsNoTracking()
            .Where(u => u.CreatedByUserId == userId)
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .ToListAsync();
}
