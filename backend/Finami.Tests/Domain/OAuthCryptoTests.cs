using Finami.Domain.Services;
using FluentAssertions;

namespace Finami.Tests.Domain;

/// <summary>Primitivas do OAuth (feature 004, T011).</summary>
public class OAuthCryptoTests
{
    // RFC 7636, apêndice B.
    private const string RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    private const string RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

    [Fact]
    public void S256_challenge_matches_rfc7636_appendix_b()
    {
        OAuthCrypto.ComputeS256Challenge(RFC_VERIFIER).Should().Be(RFC_CHALLENGE);
        OAuthCrypto.VerifyPkceS256(RFC_VERIFIER, RFC_CHALLENGE).Should().BeTrue();
        OAuthCrypto.IsValidS256Challenge(RFC_CHALLENGE).Should().BeTrue();
    }

    [Theory]
    [InlineData("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXX")] // outro verificador
    [InlineData("curto")]                                        // < 43 caracteres
    [InlineData("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjX+")] // caractere fora do conjunto
    [InlineData(null)]
    public void Pkce_rejects_wrong_or_malformed_verifier(string? verifier)
    {
        OAuthCrypto.VerifyPkceS256(verifier, RFC_CHALLENGE).Should().BeFalse();
    }

    [Fact]
    public void Pkce_rejects_plain_challenge_equal_to_verifier()
    {
        OAuthCrypto.VerifyPkceS256(RFC_VERIFIER, RFC_VERIFIER).Should().BeFalse();
    }

    [Theory]
    [InlineData(OAuthCrypto.CLIENT_ID_PREFIX)]
    [InlineData(OAuthCrypto.ACCESS_TOKEN_PREFIX)]
    [InlineData(OAuthCrypto.REFRESH_TOKEN_PREFIX)]
    public void Generated_tokens_have_prefix_are_base64url_and_unique(string prefix)
    {
        var a = OAuthCrypto.GenerateToken(prefix);
        var b = OAuthCrypto.GenerateToken(prefix);

        a.Should().StartWith(prefix);
        a.Should().NotBe(b);
        var body = a[prefix.Length..];
        body.Should().HaveLength(43); // 32 bytes em base64url sem padding
        body.Should().MatchRegex("^[A-Za-z0-9_-]+$");
    }

    [Fact]
    public void Sha256Hex_is_lowercase_hex_with_64_chars()
    {
        // SHA-256("abc") — FIPS 180-2.
        OAuthCrypto.Sha256Hex("abc").Should()
            .Be("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    [Fact]
    public void FixedTimeEquals_compares_values()
    {
        OAuthCrypto.FixedTimeEquals("abc", "abc").Should().BeTrue();
        OAuthCrypto.FixedTimeEquals("abc", "abd").Should().BeFalse();
        OAuthCrypto.FixedTimeEquals("abc", null).Should().BeFalse();
    }
}
