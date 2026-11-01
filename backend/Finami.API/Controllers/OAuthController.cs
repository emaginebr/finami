using System.Net;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Unicode;
using Finami.API.Mcp;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.DTO.OAuth;
using Finami.DTO.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace Finami.API.Controllers;

/// <summary>
/// Servidor de autorização OAuth 2.1 do MCP (contracts/oauth.md): descoberta, registro dinâmico,
/// autorização, token e revogação. Anônimo, CORS aberto sem credenciais (<c>McpPublic</c>) e erros no
/// formato do OAuth <c>{ error, error_description }</c> (Complexity Tracking VII).
/// </summary>
[AllowAnonymous]
[EnableCors(McpServerSetup.CORS_POLICY)]
public class OAuthController : ControllerBase
{
    /// <summary>Escapa HTML mas preserva letras acentuadas do português ("não", não <c>n&amp;#xE3;o</c>).</summary>
    private static readonly HtmlEncoder REASON_ENCODER =
        HtmlEncoder.Create(UnicodeRanges.BasicLatin, UnicodeRanges.Latin1Supplement);

    private const string SERVER_ERROR_DESCRIPTION = "Erro interno. Tente novamente.";
    private const string ERROR_PAGE_RESOURCE = "Finami.API.Resources.oauth-error.html";
    private const string REASON_MARKER = "<b>Motivo</b>{{REASON}}";
    private const string ERROR_PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

    private static readonly Lazy<string> ERROR_PAGE = new(LoadErrorPage);

    private readonly IOAuthService _oauthService;
    private readonly AppSettings _appSettings;
    private readonly ILogger<OAuthController> _logger;

    public OAuthController(IOAuthService oauthService, IOptions<AppSettings> appSettings, ILogger<OAuthController> logger)
    {
        _oauthService = oauthService;
        _appSettings = appSettings.Value;
        _logger = logger;
    }

    /// <summary>Metadados do servidor de autorização (RFC 8414).</summary>
    [HttpGet("/.well-known/oauth-authorization-server")]
    public Task<IActionResult> AuthorizationServerMetadata() =>
        Protocol(() => Task.FromResult<IActionResult>(Ok(_oauthService.GetAuthorizationServerMetadata())));

    /// <summary>Metadados do recurso protegido <c>/mcp</c> (RFC 9728), também no caminho com sufixo.</summary>
    [HttpGet("/.well-known/oauth-protected-resource")]
    [HttpGet("/.well-known/oauth-protected-resource/mcp")]
    public Task<IActionResult> ProtectedResourceMetadata() =>
        Protocol(() => Task.FromResult<IActionResult>(Ok(_oauthService.GetProtectedResourceMetadata())));

    /// <summary>Registro dinâmico de cliente (RFC 7591).</summary>
    /// <response code="201">Cliente registrado; <c>client_secret</c> só para métodos com segredo.</response>
    /// <response code="400"><c>invalid_redirect_uri</c> ou <c>invalid_client_metadata</c>.</response>
    [HttpPost("/oauth/register")]
    [EnableRateLimiting(McpRateLimiting.REGISTER_POLICY)]
    public Task<IActionResult> Register() => Protocol(async () =>
    {
        OAuthClientRegistrationInfo? info;
        try
        {
            info = await JsonSerializer.DeserializeAsync<OAuthClientRegistrationInfo>(Request.Body);
        }
        catch (JsonException)
        {
            throw new OAuthProtocolException(OAuthProtocolException.INVALID_CLIENT_METADATA, "JSON inválido.");
        }
        var result = await _oauthService.RegisterClientAsync(info!);
        NoStore();
        return StatusCode(StatusCodes.Status201Created, result);
    });

    /// <summary>
    /// Início da autorização: redireciona para a tela <c>/autorizar</c> do app; erros depois de confirmar o
    /// <c>redirect_uri</c> voltam ao cliente; cliente/redirect inválidos mostram uma página de erro.
    /// </summary>
    [HttpGet("/oauth/authorize")]
    public async Task<IActionResult> Authorize(
        [FromQuery(Name = "response_type")] string? responseType,
        [FromQuery(Name = "client_id")] string? clientId,
        [FromQuery(Name = "redirect_uri")] string? redirectUri,
        [FromQuery(Name = "code_challenge")] string? codeChallenge,
        [FromQuery(Name = "code_challenge_method")] string? codeChallengeMethod,
        [FromQuery(Name = "scope")] string? scope,
        [FromQuery(Name = "state")] string? state,
        [FromQuery(Name = "resource")] string? resource)
    {
        try
        {
            var result = await _oauthService.StartAuthorizationAsync(new OAuthAuthorizeInfo
            {
                ResponseType = responseType,
                ClientId = clientId,
                RedirectUri = redirectUri,
                CodeChallenge = codeChallenge,
                CodeChallengeMethod = codeChallengeMethod,
                Scope = scope,
                State = state,
                Resource = resource
            });
            if (result.ErrorRedirectUrl != null)
                return Redirect(result.ErrorRedirectUrl);
            var appUrl = (_appSettings.PublicUrl ?? string.Empty).TrimEnd('/');
            return Redirect($"{appUrl}/autorizar?pedido={Uri.EscapeDataString(result.RequestKey!)}");
        }
        catch (OAuthProtocolException ex)
        {
            return ErrorPage(ex.Description);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro interno em /oauth/authorize.");
            return ErrorPage(SERVER_ERROR_DESCRIPTION, StatusCodes.Status500InternalServerError);
        }
    }

    /// <summary>
    /// Endpoint de token (<c>application/x-www-form-urlencoded</c>): <c>authorization_code</c> e
    /// <c>refresh_token</c>. Autenticação do cliente: <c>none</c>, <c>client_secret_post</c> ou
    /// <c>client_secret_basic</c>.
    /// </summary>
    [HttpPost("/oauth/token")]
    [EnableRateLimiting(McpRateLimiting.TOKEN_POLICY)]
    public Task<IActionResult> Token() => Protocol(async () =>
    {
        var info = await ReadTokenFormAsync();
        NoStore();
        return info.GrantType switch
        {
            "authorization_code" => Ok(await _oauthService.ExchangeCodeAsync(info)),
            "refresh_token" => Ok(await _oauthService.RefreshAsync(info)),
            null or "" => throw new OAuthProtocolException(OAuthProtocolException.INVALID_REQUEST, "Informe grant_type."),
            _ => throw new OAuthProtocolException(OAuthProtocolException.UNSUPPORTED_GRANT_TYPE,
                "grant_type aceitos: authorization_code e refresh_token.")
        };
    });

    /// <summary>Revogação (RFC 7009): sempre 200, mesmo para token desconhecido.</summary>
    [HttpPost("/oauth/revoke")]
    public Task<IActionResult> Revoke() => Protocol(async () =>
    {
        var info = await ReadTokenFormAsync();
        await _oauthService.RevokeTokenAsync(info);
        return Ok();
    });

    private async Task<OAuthTokenRequestInfo> ReadTokenFormAsync()
    {
        if (!Request.HasFormContentType)
            throw new OAuthProtocolException(OAuthProtocolException.INVALID_REQUEST,
                "Use Content-Type application/x-www-form-urlencoded.");
        var form = await Request.ReadFormAsync();
        string? Field(string name) => form.TryGetValue(name, out var v) && v.Count > 0 ? v[0] : null;

        var info = new OAuthTokenRequestInfo
        {
            GrantType = Field("grant_type"),
            Code = Field("code"),
            RedirectUri = Field("redirect_uri"),
            CodeVerifier = Field("code_verifier"),
            RefreshToken = Field("refresh_token"),
            Scope = Field("scope"),
            Resource = Field("resource"),
            Token = Field("token"),
            TokenTypeHint = Field("token_type_hint"),
            ClientId = Field("client_id"),
            ClientSecret = Field("client_secret"),
            ClientAuthMethod = "none"
        };
        if (info.ClientSecret != null)
            info.ClientAuthMethod = "client_secret_post";

        // client_secret_basic (RFC 6749 §2.3.1): id e segredo codificados como form-urlencoded.
        string? authorization = Request.Headers.Authorization;
        if (authorization != null && authorization.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
        {
            string decoded;
            try
            {
                decoded = Encoding.UTF8.GetString(Convert.FromBase64String(authorization[6..].Trim()));
            }
            catch (FormatException)
            {
                throw new OAuthProtocolException(OAuthProtocolException.INVALID_CLIENT, "Cabeçalho Basic inválido.", 401);
            }
            var separator = decoded.IndexOf(':');
            if (separator < 0)
                throw new OAuthProtocolException(OAuthProtocolException.INVALID_CLIENT, "Cabeçalho Basic inválido.", 401);
            var basicId = WebUtility.UrlDecode(decoded[..separator]);
            if (info.ClientId != null && info.ClientId != basicId)
                throw new OAuthProtocolException(OAuthProtocolException.INVALID_REQUEST, "client_id divergente.");
            info.ClientId = basicId;
            info.ClientSecret = WebUtility.UrlDecode(decoded[(separator + 1)..]);
            info.ClientAuthMethod = "client_secret_basic";
        }
        return info;
    }

    /// <summary>Converte <see cref="OAuthProtocolException"/> no erro do OAuth; o resto vira <c>server_error</c> 500.</summary>
    private async Task<IActionResult> Protocol(Func<Task<IActionResult>> action)
    {
        try
        {
            return await action();
        }
        catch (OAuthProtocolException ex)
        {
            NoStore();
            if (ex.StatusCode == StatusCodes.Status401Unauthorized)
                Response.Headers.Append(HeaderNames.WWWAuthenticate, "Basic realm=\"finami\"");
            return StatusCode(ex.StatusCode, new OAuthErrorResult { Error = ex.Code, ErrorDescription = ex.Description });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro interno no endpoint OAuth {Path}.", Request.Path);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new OAuthErrorResult { Error = "server_error", ErrorDescription = SERVER_ERROR_DESCRIPTION });
        }
    }

    private void NoStore()
    {
        Response.Headers.CacheControl = "no-store";
        Response.Headers.Pragma = "no-cache";
    }

    private ContentResult ErrorPage(string reason, int status = StatusCodes.Status400BadRequest)
    {
        Response.Headers.ContentSecurityPolicy = ERROR_PAGE_CSP;
        NoStore();
        return new ContentResult
        {
            StatusCode = status,
            ContentType = "text/html; charset=utf-8",
            Content = ERROR_PAGE.Value.Replace(REASON_MARKER, "<b>Motivo</b>" + REASON_ENCODER.Encode(reason))
        };
    }

    private static string LoadErrorPage()
    {
        using var stream = typeof(OAuthController).Assembly.GetManifestResourceStream(ERROR_PAGE_RESOURCE)
            ?? throw new InvalidOperationException($"Recurso {ERROR_PAGE_RESOURCE} não encontrado.");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }
}
