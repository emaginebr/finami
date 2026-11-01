using Finami.Domain.Exceptions;
using Finami.DTO.Auth;
using Finami.DTO.Settings;
using Finami.Infra.Interfaces.AppServices;
using Google.Apis.Auth;
using Microsoft.Extensions.Options;

namespace Finami.Infra.AppServices;

public class GoogleTokenAppService : IGoogleTokenAppService<GoogleUserPayload>
{
    private readonly GoogleSettings _settings;

    public GoogleTokenAppService(IOptions<GoogleSettings> settings)
    {
        _settings = settings.Value;
    }

    public async Task<GoogleUserPayload> ValidateAsync(string idToken)
    {
        if (string.IsNullOrWhiteSpace(_settings.ClientId))
            throw new InvalidOperationException("Google:ClientId não configurado.");

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(idToken,
                new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { _settings.ClientId } });
        }
        catch (InvalidJwtException)
        {
            throw new UnauthorizedException("Token do Google inválido.");
        }

        if (!payload.EmailVerified || string.IsNullOrWhiteSpace(payload.Email))
            throw new UnauthorizedException("O email da conta Google não está verificado.");

        return new GoogleUserPayload
        {
            Subject = payload.Subject,
            Email = payload.Email,
            EmailVerified = payload.EmailVerified,
            GivenName = payload.GivenName,
            FamilyName = payload.FamilyName
        };
    }
}
