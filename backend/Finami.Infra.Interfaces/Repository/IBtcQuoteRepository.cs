namespace Finami.Infra.Interfaces.Repository;

public interface IBtcQuoteRepository<TModel> where TModel : class
{
    Task<TModel> InsertAsync(TModel quote);
    Task<TModel?> GetLatestAsync();
    Task<TModel?> GetByIdAsync(long btcQuoteId);
}
