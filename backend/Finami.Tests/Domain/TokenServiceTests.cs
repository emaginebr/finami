using System.IdentityModel.Tokens.Jwt;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.DTO.Settings;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace Finami.Tests.Domain;

public class TokenServiceTests
{
    [Fact]
    public void Generated_token_contains_sub_email_and_expires_in_configured_minutes()
    {
        var settings = new JwtSettings
        {
            Secret = "chave-de-teste-com-mais-de-32-bytes-123456",
            Issuer = "finami",
            Audience = "finami",
            ExpirationMinutes = 60
        };
        var service = new TokenService(Options.Create(settings));
        var user = new User { UserId = 42, FirstName = "Ana", LastName = "Silva", Email = "ana@ex.com" };

        var (token, expiresAt) = service.Generate(user);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        jwt.Subject.Should().Be("42");
        jwt.Claims.Should().Contain(c => c.Type == JwtRegisteredClaimNames.Email && c.Value == "ana@ex.com");
        jwt.Issuer.Should().Be("finami");
        expiresAt.Should().BeCloseTo(DateTime.UtcNow.AddMinutes(60), TimeSpan.FromSeconds(10));
        jwt.ValidTo.Should().BeCloseTo(expiresAt, TimeSpan.FromSeconds(1));
    }
}
