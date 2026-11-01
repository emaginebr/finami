namespace Finami.Infra.Interfaces.AppServices;

/// <summary>Busca a cotação do bitcoin em fontes externas; retorna null se todas falharem.</summary>
public interface IBtcQuoteAppService<TQuote> where TQuote : class
{
    Task<TQuote?> FetchAsync(CancellationToken cancellationToken = default);
}
