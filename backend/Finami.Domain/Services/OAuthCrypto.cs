using System.Security.Cryptography;
using System.Text;

namespace Finami.Domain.Services;

/// <summary>
/// Primitivas do OAuth do Finami (research R-02/R-03): valores aleatórios base64url com prefixo,
/// SHA-256 em hexadecimal (o que vai para o banco) e PKCE S256 com comparação em tempo constante.
/// </summary>
public static class OAuthCrypto
{
    public const string CLIENT_ID_PREFIX = "fmc_";
    public const string CLIENT_SECRET_PREFIX = "fms_";
    public const string ACCESS_TOKEN_PREFIX = "fma_";
    public const string REFRESH_TOKEN_PREFIX = "fmr_";

    public const int DEFAULT_BYTES = 32;
    public const int MIN_VERIFIER_LENGTH = 43;
    public const int MAX_VERIFIER_LENGTH = 128;

    /// <summary>Valor aleatório criptograficamente seguro em base64url (sem padding), com prefixo opcional.</summary>
    public static string GenerateToken(string prefix = "", int bytes = DEFAULT_BYTES) =>
        prefix + Base64UrlEncode(RandomNumberGenerator.GetBytes(bytes));

    /// <summary>SHA-256 do texto (UTF-8) em hexadecimal minúsculo (64 caracteres).</summary>
    public static string Sha256Hex(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    /// <summary>Compara dois hashes/segredos em tempo constante.</summary>
    public static bool FixedTimeEquals(string? a, string? b)
    {
        if (a == null || b == null)
            return false;
        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
    }

    /// <summary>Desafio S256: BASE64URL(SHA256(ASCII(code_verifier))) — RFC 7636 §4.2.</summary>
    public static string ComputeS256Challenge(string codeVerifier) =>
        Base64UrlEncode(SHA256.HashData(Encoding.ASCII.GetBytes(codeVerifier)));

    /// <summary>Confere o <c>code_verifier</c> contra o <c>code_challenge</c> S256 gravado.</summary>
    public static bool VerifyPkceS256(string? codeVerifier, string? codeChallenge)
    {
        if (!IsValidCodeVerifier(codeVerifier) || string.IsNullOrEmpty(codeChallenge))
            return false;
        return FixedTimeEquals(ComputeS256Challenge(codeVerifier!), codeChallenge);
    }

    /// <summary>RFC 7636 §4.1: 43–128 caracteres de [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~".</summary>
    public static bool IsValidCodeVerifier(string? value) =>
        value != null
        && value.Length is >= MIN_VERIFIER_LENGTH and <= MAX_VERIFIER_LENGTH
        && value.All(IsUnreserved);

    /// <summary>Desafio S256 bem formado: 43 caracteres base64url (SHA-256 sem padding).</summary>
    public static bool IsValidS256Challenge(string? value) =>
        value is { Length: 43 } && value.All(c => char.IsAsciiLetterOrDigit(c) || c == '-' || c == '_');

    public static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static bool IsUnreserved(char c) =>
        char.IsAsciiLetterOrDigit(c) || c == '-' || c == '.' || c == '_' || c == '~';
}
