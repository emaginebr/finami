namespace Finami.Domain.Interfaces;

/// <summary>Repetição segura das ferramentas de escrita do MCP (research R-08).</summary>
public interface IMcpIdempotencyService
{
    /// <summary>
    /// Sem <paramref name="idempotencyKey"/>, só executa <paramref name="action"/>. Com chave: a primeira chamada
    /// executa e grava o resultado; repetições devolvem o resultado gravado sem executar de novo; repetição
    /// durante a execução → <see cref="Exceptions.ConflictException"/>; se a ação falhar, a chave é apagada.
    /// </summary>
    Task<T> ExecuteAsync<T>(long userId, string toolName, string? idempotencyKey, Func<Task<T>> action);
}
