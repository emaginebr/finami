using Finami.Domain.Exceptions;
using Finami.Domain.Models;
using Finami.DTO.OAuth;
using FluentValidation;

namespace Finami.Domain.Validators;

/// <summary>Regras de URI de retorno do registro dinâmico (research R-05, RFC 8252).</summary>
public static class OAuthRedirectUriRules
{
    public const int MAX_URIS = 5;
    public const int MAX_URI_LENGTH = 500;
    public const int MAX_TOTAL_LENGTH = 2000;

    /// <summary>
    /// <c>https://</c>; <c>http://</c> só em loopback (localhost, 127.0.0.1, [::1]); esquema próprio de
    /// app nativo só se tiver ponto (ex.: <c>com.exemplo.app:/cb</c>). Nunca com fragmento.
    /// </summary>
    public static bool IsAcceptable(string? uri)
    {
        if (string.IsNullOrWhiteSpace(uri) || uri.Length > MAX_URI_LENGTH || uri.Contains('#'))
            return false;
        if (!Uri.TryCreate(uri, UriKind.Absolute, out var parsed))
            return false;
        if (parsed.Scheme == Uri.UriSchemeHttps)
            return !string.IsNullOrEmpty(parsed.Host);
        if (parsed.Scheme == Uri.UriSchemeHttp)
            return OAuthClient.IsLoopback(parsed);
        return parsed.Scheme.Contains('.');
    }
}

/// <summary>
/// Registro dinâmico (RFC 7591). O <c>ErrorCode</c> de cada regra é o código OAuth devolvido
/// (<c>invalid_redirect_uri</c> ou <c>invalid_client_metadata</c>).
/// </summary>
public class OAuthClientRegistrationInfoValidator : AbstractValidator<OAuthClientRegistrationInfo>
{
    public const int MAX_CLIENT_NAME_LENGTH = 120;

    public static readonly string[] SUPPORTED_GRANT_TYPES = { "authorization_code", "refresh_token" };
    public static readonly string[] SUPPORTED_RESPONSE_TYPES = { "code" };
    public static readonly string[] SUPPORTED_AUTH_METHODS = { "none", "client_secret_post", "client_secret_basic" };

    public OAuthClientRegistrationInfoValidator()
    {
        RuleFor(x => x.ClientName)
            .Must(n => !string.IsNullOrWhiteSpace(n))
            .WithMessage("Informe o nome do assistente (client_name).")
            .WithErrorCode(OAuthProtocolException.INVALID_CLIENT_METADATA)
            .Must(n => (n ?? string.Empty).Trim().Length <= MAX_CLIENT_NAME_LENGTH)
            .WithMessage($"O nome do assistente deve ter no máximo {MAX_CLIENT_NAME_LENGTH} caracteres.")
            .WithErrorCode(OAuthProtocolException.INVALID_CLIENT_METADATA);

        RuleFor(x => x.RedirectUris)
            .Must(u => u != null && u.Count >= 1 && u.Count <= OAuthRedirectUriRules.MAX_URIS)
            .WithMessage($"Informe de 1 a {OAuthRedirectUriRules.MAX_URIS} endereços de retorno (redirect_uris).")
            .WithErrorCode(OAuthProtocolException.INVALID_REDIRECT_URI)
            .Must(u => u == null || u.All(OAuthRedirectUriRules.IsAcceptable))
            .WithMessage("Endereço de retorno inválido: use https, http apenas em localhost, sem fragmento.")
            .WithErrorCode(OAuthProtocolException.INVALID_REDIRECT_URI)
            .Must(u => u == null || u.Sum(x => x.Length + 3) + 2 <= OAuthRedirectUriRules.MAX_TOTAL_LENGTH)
            .WithMessage("Endereços de retorno longos demais.")
            .WithErrorCode(OAuthProtocolException.INVALID_REDIRECT_URI);

        RuleFor(x => x.GrantTypes)
            .Must(g => g == null || (g.Count > 0 && g.All(SUPPORTED_GRANT_TYPES.Contains)))
            .WithMessage("grant_types aceitos: authorization_code e refresh_token.")
            .WithErrorCode(OAuthProtocolException.INVALID_CLIENT_METADATA);

        RuleFor(x => x.ResponseTypes)
            .Must(r => r == null || (r.Count > 0 && r.All(SUPPORTED_RESPONSE_TYPES.Contains)))
            .WithMessage("response_types aceito: code.")
            .WithErrorCode(OAuthProtocolException.INVALID_CLIENT_METADATA);

        RuleFor(x => x.TokenEndpointAuthMethod)
            .Must(m => m == null || SUPPORTED_AUTH_METHODS.Contains(m))
            .WithMessage("token_endpoint_auth_method aceitos: none, client_secret_post e client_secret_basic.")
            .WithErrorCode(OAuthProtocolException.INVALID_CLIENT_METADATA);

        RuleFor(x => x.Scope)
            .Must(s => OAuthScopes.AreKnown(OAuthScopes.Parse(s)))
            .WithMessage("Escopos aceitos: finami:read e finami:write.")
            .WithErrorCode(OAuthProtocolException.INVALID_CLIENT_METADATA);
    }
}

/// <summary>Aprovação na tela <c>/autorizar</c>: ao menos um escopo, todos conhecidos.</summary>
public class OAuthApproveInfoValidator : AbstractValidator<OAuthApproveInfo>
{
    public OAuthApproveInfoValidator()
    {
        RuleFor(x => x.Scopes)
            .Must(s => s != null && s.Count > 0)
            .WithMessage("Escolha ao menos uma permissão.")
            .Must(s => s == null || OAuthScopes.AreKnown(s))
            .WithMessage("Permissão inválida. Use finami:read ou finami:write.");
    }
}
