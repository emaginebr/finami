using Finami.DTO.Auth;
using Finami.DTO.Users;

namespace Finami.Domain.Interfaces;

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(RegisterInfo info);
    Task<AuthResult> LoginAsync(LoginInfo info);
    Task<AuthResult> GoogleLoginAsync(GoogleLoginInfo info);
    Task<UserInfo> GetMeAsync(long userId);
}
