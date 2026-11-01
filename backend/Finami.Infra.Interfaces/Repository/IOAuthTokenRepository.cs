namespace Finami.Infra.Interfaces.Repository;

/// <summary>Tokens de acesso e de renovação (só hash) — feature 004.</summary>
public interface IOAuthTokenRepository<TModel> where TModel : class
{
    /// <summary>Token pelo hash, com conexão e cliente carregados, sem rastreamento (validação de acesso).</summary>
    Task<TModel?> GetByHashAsync(string tokenHash);

    /// <summary>Lê e bloqueia o token pelo hash (SELECT ... FOR UPDATE), com a conexão; exige transação aberta.</summary>
    Task<TModel?> GetByHashForUpdateAsync(string tokenHash);

    Task<TModel> InsertAsync(TModel token);
    Task<TModel> UpdateAsync(TModel token);

    /// <summary>Marca como revogados todos os tokens ainda válidos da conexão; devolve quantos mudaram.</summary>
    Task<int> RevokeByGrantAsync(long grantId, DateTime now);
}
