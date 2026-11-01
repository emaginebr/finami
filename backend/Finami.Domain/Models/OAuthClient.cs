using System.Text.Json;
using Finami.Domain.Enums;

namespace Finami.Domain.Models;

/// <summary>Cliente OAuth (assistente) registrado, normalmente via registro dinâmico (research R-05).</summary>
public class OAuthClient
{
    public long OAuthClientId { get; set; }
    public string ClientId { get; set; } = string.Empty;
    public string? ClientSecretHash { get; set; }
    public string ClientName { get; set; } = string.Empty;

    /// <summary>JSON array com 1–5 URIs de retorno (coluna <c>redirect_uris</c>).</summary>
    public string RedirectUris { get; set; } = "[]";

    public OAuthClientAuthMethod AuthMethod { get; set; } = OAuthClientAuthMethod.None;
    public bool IsDynamic { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool RequiresSecret => AuthMethod != OAuthClientAuthMethod.None;

    public List<string> GetRedirectUris() =>
        JsonSerializer.Deserialize<List<string>>(RedirectUris) ?? new List<string>();

    public void SetRedirectUris(IEnumerable<string> uris) => RedirectUris = JsonSerializer.Serialize(uris.ToList());

    /// <summary>
    /// Igualdade exata com uma URI registrada; para loopback HTTP (localhost, 127.0.0.1, [::1]) só a
    /// porta pode variar (RFC 8252 §7.3).
    /// </summary>
    public bool IsRedirectUriAllowed(string? redirectUri)
    {
        if (string.IsNullOrWhiteSpace(redirectUri))
            return false;
        var registered = GetRedirectUris();
        if (registered.Contains(redirectUri, StringComparer.Ordinal))
            return true;
        if (!Uri.TryCreate(redirectUri, UriKind.Absolute, out var requested) || !IsLoopback(requested))
            return false;
        return registered.Any(r => Uri.TryCreate(r, UriKind.Absolute, out var uri)
                                   && IsLoopback(uri)
                                   && string.Equals(uri.Host, requested.Host, StringComparison.OrdinalIgnoreCase)
                                   && uri.AbsolutePath == requested.AbsolutePath
                                   && uri.Query == requested.Query);
    }

    /// <summary>HTTP em localhost, 127.0.0.1 ou [::1].</summary>
    public static bool IsLoopback(Uri uri) =>
        uri.Scheme == Uri.UriSchemeHttp
        && (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
            || uri.Host == "127.0.0.1"
            || uri.Host == "[::1]");
}
