namespace Finami.Domain.Exceptions;

/// <summary>
/// Erro do protocolo OAuth (RFC 6749 §5.2, RFC 7591 §3.2.2): os endpoints <c>/oauth/*</c> devolvem
/// <c>{ "error": Code, "error_description": Description }</c> com <see cref="StatusCode"/> (Complexity Tracking VII).
/// </summary>
public class OAuthProtocolException : Exception
{
    public const string INVALID_REQUEST = "invalid_request";
    public const string INVALID_CLIENT = "invalid_client";
    public const string INVALID_GRANT = "invalid_grant";
    public const string UNAUTHORIZED_CLIENT = "unauthorized_client";
    public const string UNSUPPORTED_GRANT_TYPE = "unsupported_grant_type";
    public const string UNSUPPORTED_RESPONSE_TYPE = "unsupported_response_type";
    public const string INVALID_SCOPE = "invalid_scope";
    public const string INVALID_TARGET = "invalid_target";
    public const string ACCESS_DENIED = "access_denied";
    public const string INVALID_REDIRECT_URI = "invalid_redirect_uri";
    public const string INVALID_CLIENT_METADATA = "invalid_client_metadata";

    public OAuthProtocolException(string code, string description, int statusCode = 400) : base(description)
    {
        Code = code;
        Description = description;
        StatusCode = statusCode;
    }

    public string Code { get; }
    public string Description { get; }
    public int StatusCode { get; }
}
