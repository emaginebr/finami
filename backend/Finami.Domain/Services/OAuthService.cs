using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Validators;
using Finami.DTO.OAuth;
using Finami.DTO.Settings;
using Finami.Infra.Interfaces.Repository;
using FluentValidation;
using Microsoft.Extensions.Options;
using ValidationException = Finami.Domain.Exceptions.ValidationException;

namespace Finami.Domain.Services;

/// <summary>
/// Servidor de autorização OAuth 2.1 mínimo do MCP (research R-02..R-06). Toda troca de estado roda em
/// transação com a linha do pedido/token bloqueada; códigos e tokens existem no banco só como SHA-256.
/// </summary>
public class OAuthService : IOAuthService
{
    public const string REQUEST_NOT_FOUND_MESSAGE = "Pedido de autorização não encontrado.";
    public const string INVALID_SCOPES_MESSAGE = "Permissões inválidas para este pedido.";
    public const string CONCURRENT_APPROVAL_MESSAGE = "Este pedido já está sendo processado. Tente novamente.";
    public const string UNKNOWN_CLIENT_MESSAGE = "Assistente não registrado.";
    public const string INVALID_REDIRECT_MESSAGE = "Endereço de retorno não autorizado.";
    public const string ACCESS_DENIED_MESSAGE = "A pessoa negou o acesso ao Finami.";

    private const string AUTHORIZATION_CODE = "authorization_code";
    private const string REFRESH_TOKEN = "refresh_token";
    private const string S256 = "S256";

    private readonly IOAuthClientRepository<OAuthClient> _clientRepository;
    private readonly IOAuthGrantRepository<OAuthGrant> _grantRepository;
    private readonly IOAuthRequestRepository<OAuthAuthorizationRequest> _requestRepository;
    private readonly IOAuthTokenRepository<OAuthToken> _tokenRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IValidator<OAuthClientRegistrationInfo> _registrationValidator;
    private readonly IValidator<OAuthApproveInfo> _approveValidator;
    private readonly McpSettings _settings;
    private readonly TimeProvider _time;

    public OAuthService(
        IOAuthClientRepository<OAuthClient> clientRepository,
        IOAuthGrantRepository<OAuthGrant> grantRepository,
        IOAuthRequestRepository<OAuthAuthorizationRequest> requestRepository,
        IOAuthTokenRepository<OAuthToken> tokenRepository,
        IUnitOfWork unitOfWork,
        IValidator<OAuthClientRegistrationInfo> registrationValidator,
        IValidator<OAuthApproveInfo> approveValidator,
        IOptions<McpSettings> settings,
        TimeProvider? time = null)
    {
        _clientRepository = clientRepository;
        _grantRepository = grantRepository;
        _requestRepository = requestRepository;
        _tokenRepository = tokenRepository;
        _unitOfWork = unitOfWork;
        _registrationValidator = registrationValidator;
        _approveValidator = approveValidator;
        _settings = settings.Value;
        _time = time ?? TimeProvider.System;
    }

    public string Issuer
    {
        get
        {
            var url = (_settings.PublicUrl ?? string.Empty).Trim().TrimEnd('/');
            if (url.Length == 0)
                throw new InvalidOperationException("Mcp:PublicUrl não configurado. Defina a variável Mcp__PublicUrl.");
            return url;
        }
    }

    public string ResourceUrl => $"{Issuer}/mcp";

    private DateTime Now => _time.GetUtcNow().UtcDateTime;

    // ---------------- Descoberta ----------------

    public AuthorizationServerMetadata GetAuthorizationServerMetadata() => new()
    {
        Issuer = Issuer,
        AuthorizationEndpoint = $"{Issuer}/oauth/authorize",
        TokenEndpoint = $"{Issuer}/oauth/token",
        RegistrationEndpoint = $"{Issuer}/oauth/register",
        RevocationEndpoint = $"{Issuer}/oauth/revoke",
        ResponseTypesSupported = new() { "code" },
        GrantTypesSupported = new() { AUTHORIZATION_CODE, REFRESH_TOKEN },
        CodeChallengeMethodsSupported = new() { S256 },
        TokenEndpointAuthMethodsSupported = OAuthClientRegistrationInfoValidator.SUPPORTED_AUTH_METHODS.ToList(),
        RevocationEndpointAuthMethodsSupported = OAuthClientRegistrationInfoValidator.SUPPORTED_AUTH_METHODS.ToList(),
        ScopesSupported = OAuthScopes.All.ToList()
    };

    public ProtectedResourceMetadata GetProtectedResourceMetadata() => new()
    {
        Resource = ResourceUrl,
        AuthorizationServers = new() { Issuer },
        ScopesSupported = OAuthScopes.All.ToList(),
        BearerMethodsSupported = new() { "header" },
        ResourceName = "Finami"
    };

    // ---------------- Registro dinâmico ----------------

    public async Task<OAuthClientRegistrationResult> RegisterClientAsync(OAuthClientRegistrationInfo info)
    {
        if (info == null)
            throw new OAuthProtocolException(OAuthProtocolException.INVALID_CLIENT_METADATA, "Requisição inválida.");
        var validation = await _registrationValidator.ValidateAsync(info);
        if (!validation.IsValid)
        {
            var first = validation.Errors[0];
            throw new OAuthProtocolException(first.ErrorCode, first.ErrorMessage);
        }

        // RFC 7591 §2: sem método informado, o padrão é client_secret_basic.
        var methodName = info.TokenEndpointAuthMethod ?? "client_secret_basic";
        var method = ParseAuthMethod(methodName);
        var now = Now;
        string? secret = method == OAuthClientAuthMethod.None ? null : OAuthCrypto.GenerateToken(OAuthCrypto.CLIENT_SECRET_PREFIX);

        var client = new OAuthClient
        {
            ClientId = OAuthCrypto.GenerateToken(OAuthCrypto.CLIENT_ID_PREFIX),
            ClientSecretHash = secret == null ? null : OAuthCrypto.Sha256Hex(secret),
            ClientName = info.ClientName!.Trim(),
            AuthMethod = method,
            IsDynamic = true,
            CreatedAt = now
        };
        client.SetRedirectUris(info.RedirectUris!);
        await _clientRepository.InsertAsync(client);

        return new OAuthClientRegistrationResult
        {
            ClientId = client.ClientId,
            ClientIdIssuedAt = new DateTimeOffset(now).ToUnixTimeSeconds(),
            ClientSecret = secret,
            ClientSecretExpiresAt = secret == null ? null : 0,
            ClientName = client.ClientName,
            RedirectUris = client.GetRedirectUris(),
            GrantTypes = info.GrantTypes ?? new List<string> { AUTHORIZATION_CODE, REFRESH_TOKEN },
            ResponseTypes = info.ResponseTypes ?? new List<string> { "code" },
            TokenEndpointAuthMethod = methodName,
            Scope = string.IsNullOrWhiteSpace(info.Scope) ? null : OAuthScopes.Join(OAuthScopes.Parse(info.Scope))
        };
    }

    // ---------------- Autorização ----------------

    public async Task<OAuthAuthorizeResult> StartAuthorizationAsync(OAuthAuthorizeInfo info)
    {
        // Antes de confirmar o redirect_uri, nenhum erro volta ao cliente (página de erro, R-04).
        var client = string.IsNullOrWhiteSpace(info.ClientId) ? null : await _clientRepository.GetByClientIdAsync(info.ClientId);
        if (client == null)
            throw new OAuthProtocolException(OAuthProtocolException.INVALID_CLIENT, UNKNOWN_CLIENT_MESSAGE);

        var redirectUri = info.RedirectUri;
        if (string.IsNullOrWhiteSpace(redirectUri))
        {
            var registered = client.GetRedirectUris();
            redirectUri = registered.Count == 1 ? registered[0] : null;
        }
        if (redirectUri == null || !client.IsRedirectUriAllowed(redirectUri))
            throw new OAuthProtocolException(OAuthProtocolException.INVALID_REQUEST, INVALID_REDIRECT_MESSAGE);

        OAuthAuthorizeResult Fail(string code, string description) => new()
        {
            ErrorRedirectUrl = BuildRedirect(redirectUri, ("error", code), ("error_description", description), ("state", info.State))
        };

        if (info.ResponseType != "code")
            return Fail(OAuthProtocolException.INVALID_REQUEST, "response_type deve ser code.");
        if (string.IsNullOrEmpty(info.CodeChallenge))
            return Fail(OAuthProtocolException.INVALID_REQUEST, "PKCE é obrigatório: informe code_challenge.");
        if (info.CodeChallengeMethod != S256)
            return Fail(OAuthProtocolException.INVALID_REQUEST, "code_challenge_method deve ser S256.");
        if (!OAuthCrypto.IsValidS256Challenge(info.CodeChallenge))
            return Fail(OAuthProtocolException.INVALID_REQUEST, "code_challenge inválido.");
        if (info.State != null && info.State.Length > 500)
            return Fail(OAuthProtocolException.INVALID_REQUEST, "state longo demais.");

        var scopes = OAuthScopes.Parse(info.Scope);
        if (!OAuthScopes.AreKnown(scopes))
            return Fail(OAuthProtocolException.INVALID_SCOPE, "Escopos aceitos: finami:read e finami:write.");
        if (scopes.Count == 0)
            scopes = OAuthScopes.All.ToList(); // R-06: padrão leitura e escrita; a pessoa pode reduzir.

        if (!string.IsNullOrWhiteSpace(info.Resource) && !IsOurResource(info.Resource))
            return Fail(OAuthProtocolException.INVALID_TARGET, $"resource deve ser {ResourceUrl}.");

        var now = Now;
        var request = new OAuthAuthorizationRequest
        {
            RequestKey = OAuthCrypto.GenerateToken(),
            OAuthClientId = client.OAuthClientId,
            RedirectUri = redirectUri,
            ScopesRequested = OAuthScopes.Join(scopes),
            State = info.State,
            CodeChallenge = info.CodeChallenge,
            Resource = ResourceUrl,
            Status = OAuthRequestStatus.Pending,
            CreatedAt = now,
            ExpiresAt = now.AddMinutes(_settings.CodeMinutes)
        };
        await _requestRepository.InsertAsync(request);
        return new OAuthAuthorizeResult { RequestKey = request.RequestKey };
    }

    public async Task<OAuthRequestInfo> GetRequestAsync(long userId, string requestKey)
    {
        var request = await _requestRepository.GetByRequestKeyAsync(requestKey ?? string.Empty)
            ?? throw new NotFoundException(REQUEST_NOT_FOUND_MESSAGE);
        if (!request.IsAnswerable(Now))
            throw new GoneException(OAuthAuthorizationRequest.EXPIRED_MESSAGE);

        return new OAuthRequestInfo
        {
            RequestKey = request.RequestKey,
            ClientName = request.Client?.ClientName ?? string.Empty,
            RedirectHost = RedirectHost(request.RedirectUri),
            ScopesRequested = request.ScopeList,
            ExpiresAt = request.ExpiresAt
        };
    }

    public async Task<OAuthRedirectResult> ApproveAsync(long userId, string requestKey, OAuthApproveInfo info)
    {
        await _approveValidator.ValidateOrThrowAsync(info);
        var scopes = OAuthScopes.Normalize(info.Scopes);

        string code;
        OAuthAuthorizationRequest request;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            request = await _requestRepository.GetByRequestKeyForUpdateAsync(requestKey ?? string.Empty)
                ?? throw new NotFoundException(REQUEST_NOT_FOUND_MESSAGE);
            var now = Now;
            if (!request.IsAnswerable(now))
                throw new GoneException(OAuthAuthorizationRequest.EXPIRED_MESSAGE);
            var requested = OAuthScopes.Normalize(request.ScopeList);
            if (scopes.Any(s => !requested.Contains(s)))
                throw new ValidationException(INVALID_SCOPES_MESSAGE);

            // Reautorizar o mesmo assistente substitui os escopos e derruba os tokens anteriores (R-06).
            var grant = await _grantRepository.GetActiveAsync(userId, request.OAuthClientId);
            if (grant != null)
            {
                grant.ReplaceScopes(scopes, now);
                await _grantRepository.UpdateAsync(grant);
                await _tokenRepository.RevokeByGrantAsync(grant.OAuthGrantId, now);
            }
            else
            {
                grant = new OAuthGrant
                {
                    UserId = userId,
                    OAuthClientId = request.OAuthClientId,
                    Scopes = OAuthScopes.Join(scopes),
                    Status = OAuthGrantStatus.Active,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                await _grantRepository.InsertAsync(grant);
            }

            code = OAuthCrypto.GenerateToken();
            request.Approve(userId, grant.OAuthGrantId, OAuthCrypto.Sha256Hex(code), now,
                TimeSpan.FromMinutes(_settings.CodeMinutes));
            await _requestRepository.UpdateAsync(request);
            await _unitOfWork.CommitAsync();
        }
        catch (Exception ex)
        {
            await _unitOfWork.RollbackAsync();
            // Duas aprovações simultâneas criando a mesma conexão: o índice único parcial barra a segunda.
            if (UniqueViolation.Is(ex, UniqueViolation.OAUTH_GRANTS_ACTIVE_INDEX))
                throw new ConflictException(CONCURRENT_APPROVAL_MESSAGE);
            throw;
        }

        return new OAuthRedirectResult
        {
            RedirectUrl = BuildRedirect(request.RedirectUri, ("code", code), ("state", request.State))
        };
    }

    public async Task<OAuthRedirectResult> DenyAsync(long userId, string requestKey)
    {
        OAuthAuthorizationRequest request;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            request = await _requestRepository.GetByRequestKeyForUpdateAsync(requestKey ?? string.Empty)
                ?? throw new NotFoundException(REQUEST_NOT_FOUND_MESSAGE);
            request.Deny(userId, Now);
            await _requestRepository.UpdateAsync(request);
            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        return new OAuthRedirectResult
        {
            RedirectUrl = BuildRedirect(request.RedirectUri,
                ("error", OAuthProtocolException.ACCESS_DENIED),
                ("error_description", ACCESS_DENIED_MESSAGE),
                ("state", request.State))
        };
    }

    // ---------------- Token ----------------

    public async Task<OAuthTokenResult> ExchangeCodeAsync(OAuthTokenRequestInfo info)
    {
        var client = await AuthenticateClientAsync(info);
        if (string.IsNullOrEmpty(info.Code))
            throw new OAuthProtocolException(OAuthProtocolException.INVALID_REQUEST, "Informe code.");

        OAuthProtocolException? failure = null;
        OAuthTokenResult? result = null;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            var now = Now;
            var request = await _requestRepository.GetByCodeHashForUpdateAsync(OAuthCrypto.Sha256Hex(info.Code));
            if (request == null || request.OAuthClientId != client.OAuthClientId)
            {
                failure = InvalidGrant("Código de autorização inválido.");
            }
            else if (request.Status == OAuthRequestStatus.CodeRedeemed)
            {
                // Código reapresentado: possível vazamento, derruba a conexão (RFC 6749 §4.1.2).
                if (request.OAuthGrantId.HasValue)
                    await RevokeGrantAsync(request.OAuthGrantId.Value, OAuthRevokeReason.AuthorizationCodeReuse, now);
                failure = InvalidGrant("Código de autorização já utilizado.");
            }
            else if (request.Status != OAuthRequestStatus.Approved || request.IsExpired(now))
            {
                failure = InvalidGrant("Código de autorização vencido.");
            }
            else if (!string.Equals(info.RedirectUri, request.RedirectUri, StringComparison.Ordinal))
            {
                failure = InvalidGrant("redirect_uri diferente do usado na autorização.");
            }
            else if (!OAuthCrypto.VerifyPkceS256(info.CodeVerifier, request.CodeChallenge))
            {
                failure = InvalidGrant("code_verifier não confere (PKCE).");
            }
            else if (!string.IsNullOrWhiteSpace(info.Resource) && !IsOurResource(info.Resource))
            {
                failure = new OAuthProtocolException(OAuthProtocolException.INVALID_TARGET, $"resource deve ser {ResourceUrl}.");
            }
            else
            {
                var grant = request.OAuthGrantId.HasValue ? await _grantRepository.GetByIdAsync(request.OAuthGrantId.Value) : null;
                if (grant == null || !grant.IsActive)
                {
                    failure = InvalidGrant("A conexão foi revogada.");
                }
                else
                {
                    request.Redeem(now);
                    await _requestRepository.UpdateAsync(request);
                    result = await IssueTokensAsync(grant.OAuthGrantId, grant.ScopeList, parentTokenId: null, now);
                }
            }
            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        if (failure != null)
            throw failure;
        return result!;
    }

    public async Task<OAuthTokenResult> RefreshAsync(OAuthTokenRequestInfo info)
    {
        var client = await AuthenticateClientAsync(info);
        if (string.IsNullOrEmpty(info.RefreshToken))
            throw new OAuthProtocolException(OAuthProtocolException.INVALID_REQUEST, "Informe refresh_token.");

        OAuthProtocolException? failure = null;
        OAuthTokenResult? result = null;
        await _unitOfWork.BeginTransactionAsync();
        try
        {
            var now = Now;
            var token = await _tokenRepository.GetByHashForUpdateAsync(OAuthCrypto.Sha256Hex(info.RefreshToken));
            if (token == null || token.TokenType != OAuthTokenType.Refresh || token.Grant == null
                || token.Grant.OAuthClientId != client.OAuthClientId)
            {
                failure = InvalidGrant("Token de renovação inválido.");
            }
            else if (token.IsUsed)
            {
                // Renovação já trocada reapresentada: rotação detectou reuso, derruba a conexão (R-03).
                await RevokeGrantAsync(token.OAuthGrantId, OAuthRevokeReason.RefreshTokenReuse, now);
                failure = InvalidGrant("Token de renovação já utilizado. A conexão foi encerrada por segurança.");
            }
            else if (token.IsRevoked || token.IsExpired(now) || !token.Grant.IsActive)
            {
                failure = InvalidGrant("Token de renovação vencido ou revogado.");
            }
            else
            {
                var current = OAuthScopes.Parse(token.Scopes);
                var scopes = current;
                if (!string.IsNullOrWhiteSpace(info.Scope))
                {
                    var asked = OAuthScopes.Parse(info.Scope);
                    if (!OAuthScopes.AreKnown(asked) || asked.Any(s => !current.Contains(s)))
                        failure = new OAuthProtocolException(OAuthProtocolException.INVALID_SCOPE,
                            "Na renovação só é possível reduzir os escopos.");
                    scopes = asked;
                }

                if (failure == null)
                {
                    token.MarkUsed(now);
                    await _tokenRepository.UpdateAsync(token);
                    result = await IssueTokensAsync(token.OAuthGrantId, scopes, token.OAuthTokenId, now);
                }
            }
            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }

        if (failure != null)
            throw failure;
        return result!;
    }

    public async Task RevokeTokenAsync(OAuthTokenRequestInfo info)
    {
        var client = await AuthenticateClientAsync(info);
        if (string.IsNullOrEmpty(info.Token))
            throw new OAuthProtocolException(OAuthProtocolException.INVALID_REQUEST, "Informe token.");

        await _unitOfWork.BeginTransactionAsync();
        try
        {
            var now = Now;
            var token = await _tokenRepository.GetByHashForUpdateAsync(OAuthCrypto.Sha256Hex(info.Token));
            // RFC 7009 §2.2: token desconhecido ou de outro cliente responde 200 sem efeito.
            if (token?.Grant != null && token.Grant.OAuthClientId == client.OAuthClientId)
            {
                if (token.TokenType == OAuthTokenType.Refresh)
                {
                    await RevokeGrantAsync(token.OAuthGrantId, OAuthRevokeReason.ClientRevoked, now);
                }
                else
                {
                    token.Revoke(now);
                    await _tokenRepository.UpdateAsync(token);
                }
            }
            await _unitOfWork.CommitAsync();
        }
        catch
        {
            await _unitOfWork.RollbackAsync();
            throw;
        }
    }

    public async Task<OAuthAccessTokenInfo?> ValidateAccessTokenAsync(string accessToken)
    {
        if (string.IsNullOrEmpty(accessToken) || !accessToken.StartsWith(OAuthCrypto.ACCESS_TOKEN_PREFIX, StringComparison.Ordinal))
            return null;
        var token = await _tokenRepository.GetByHashAsync(OAuthCrypto.Sha256Hex(accessToken));
        var now = Now;
        if (token == null || token.TokenType != OAuthTokenType.Access || token.IsRevoked || token.IsExpired(now)
            || token.Grant == null || !token.Grant.IsActive)
            return null;

        return new OAuthAccessTokenInfo
        {
            UserId = token.Grant.UserId,
            GrantId = token.OAuthGrantId,
            ClientId = token.Grant.Client?.ClientId ?? string.Empty,
            ClientName = token.Grant.Client?.ClientName ?? string.Empty,
            Scopes = OAuthScopes.Parse(token.Scopes),
            ExpiresAt = token.ExpiresAt,
            GrantLastUsedAt = token.Grant.LastUsedAt
        };
    }

    // ---------------- Auxiliares ----------------

    private async Task<OAuthClient> AuthenticateClientAsync(OAuthTokenRequestInfo info)
    {
        var client = string.IsNullOrWhiteSpace(info.ClientId) ? null : await _clientRepository.GetByClientIdAsync(info.ClientId);
        if (client == null)
            throw new OAuthProtocolException(OAuthProtocolException.INVALID_CLIENT, "Cliente desconhecido.", 401);
        if (client.RequiresSecret
            && (string.IsNullOrEmpty(info.ClientSecret)
                || !OAuthCrypto.FixedTimeEquals(OAuthCrypto.Sha256Hex(info.ClientSecret), client.ClientSecretHash)))
            throw new OAuthProtocolException(OAuthProtocolException.INVALID_CLIENT, "Falha na autenticação do cliente.", 401);
        return client;
    }

    private async Task<OAuthTokenResult> IssueTokensAsync(long grantId, IEnumerable<string> scopes, long? parentTokenId, DateTime now)
    {
        var scopeText = OAuthScopes.Join(scopes);
        var accessToken = OAuthCrypto.GenerateToken(OAuthCrypto.ACCESS_TOKEN_PREFIX);
        var refreshToken = OAuthCrypto.GenerateToken(OAuthCrypto.REFRESH_TOKEN_PREFIX);

        await _tokenRepository.InsertAsync(new OAuthToken
        {
            OAuthGrantId = grantId,
            TokenType = OAuthTokenType.Access,
            TokenHash = OAuthCrypto.Sha256Hex(accessToken),
            Scopes = scopeText,
            CreatedAt = now,
            ExpiresAt = now.AddMinutes(_settings.AccessTokenMinutes)
        });
        await _tokenRepository.InsertAsync(new OAuthToken
        {
            OAuthGrantId = grantId,
            TokenType = OAuthTokenType.Refresh,
            TokenHash = OAuthCrypto.Sha256Hex(refreshToken),
            Scopes = scopeText,
            ParentTokenId = parentTokenId,
            CreatedAt = now,
            ExpiresAt = now.AddDays(_settings.RefreshTokenDays)
        });

        return new OAuthTokenResult
        {
            AccessToken = accessToken,
            TokenType = "Bearer",
            ExpiresIn = _settings.AccessTokenMinutes * 60,
            RefreshToken = refreshToken,
            Scope = scopeText
        };
    }

    /// <summary>Revoga a conexão e todos os tokens dela na transação corrente.</summary>
    private async Task RevokeGrantAsync(long grantId, OAuthRevokeReason reason, DateTime now)
    {
        var grant = await _grantRepository.GetByIdAsync(grantId);
        if (grant != null && grant.IsActive)
        {
            grant.Revoke(reason, now);
            await _grantRepository.UpdateAsync(grant);
        }
        await _tokenRepository.RevokeByGrantAsync(grantId, now);
    }

    private bool IsOurResource(string resource) =>
        string.Equals(resource.Trim().TrimEnd('/'), ResourceUrl, StringComparison.OrdinalIgnoreCase);

    private static OAuthProtocolException InvalidGrant(string description) =>
        new(OAuthProtocolException.INVALID_GRANT, description);

    private static OAuthClientAuthMethod ParseAuthMethod(string method) => method switch
    {
        "none" => OAuthClientAuthMethod.None,
        "client_secret_post" => OAuthClientAuthMethod.ClientSecretPost,
        _ => OAuthClientAuthMethod.ClientSecretBasic
    };

    private static string RedirectHost(string redirectUri) =>
        Uri.TryCreate(redirectUri, UriKind.Absolute, out var uri)
            ? (string.IsNullOrEmpty(uri.Host) ? uri.Scheme : uri.Host)
            : redirectUri;

    /// <summary>Acrescenta parâmetros (ignorando nulos) à URI de retorno, preservando a query existente.</summary>
    public static string BuildRedirect(string redirectUri, params (string Name, string? Value)[] parameters)
    {
        var query = string.Join('&', parameters
            .Where(p => p.Value != null)
            .Select(p => $"{Uri.EscapeDataString(p.Name)}={Uri.EscapeDataString(p.Value!)}"));
        if (query.Length == 0)
            return redirectUri;
        return redirectUri + (redirectUri.Contains('?') ? "&" : "?") + query;
    }
}
