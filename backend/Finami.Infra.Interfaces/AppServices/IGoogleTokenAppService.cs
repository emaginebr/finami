namespace Finami.Infra.Interfaces.AppServices;

/// <summary>Valida um ID token do Google (research R-04).</summary>
public interface IGoogleTokenAppService<TPayload> where TPayload : class
{
    Task<TPayload> ValidateAsync(string idToken);
}
