using System.Security.Claims;
using Finami.Domain.Exceptions;

namespace Finami.API.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static long GetUserId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirstValue("sub") ?? principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(value) || !long.TryParse(value, out var userId))
            throw new UnauthorizedException();
        return userId;
    }
}
