using Finami.Domain.Models;
using Finami.DTO.Users;

namespace Finami.Domain.Services;

/// <summary>Mapeamento manual Model → DTO compartilhado entre serviços.</summary>
public static class Mapping
{
    public static UserInfo ToInfo(this User user) => new()
    {
        UserId = user.UserId,
        FirstName = user.FirstName,
        LastName = user.LastName,
        Email = user.Email,
        HasPassword = user.HasPassword,
        HasGoogle = user.HasGoogle,
        CanLogin = user.CanLogin,
        CreatedByUserId = user.CreatedByUserId,
        CreatedAt = user.CreatedAt
    };
}
