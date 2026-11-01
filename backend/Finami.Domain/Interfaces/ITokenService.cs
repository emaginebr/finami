using Finami.Domain.Models;

namespace Finami.Domain.Interfaces;

public interface ITokenService
{
    (string Token, DateTime ExpiresAt) Generate(User user);
}
