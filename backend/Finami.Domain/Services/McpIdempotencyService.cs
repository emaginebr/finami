using System.Text.Json;
using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Infra.Interfaces.Repository;

namespace Finami.Domain.Services;

/// <summary>
/// Repetição segura (research R-08): a chave entra como <c>InProgress</c> (índice único
/// <c>(user_id, tool_name, idempotency_key)</c> resolve corridas sem trava em memória), a ação roda e o
/// resultado serializado é gravado. Chaves valem 24 h.
/// </summary>
public class McpIdempotencyService : IMcpIdempotencyService
{
    public const int MAX_KEY_LENGTH = 64;
    public static readonly TimeSpan KEY_LIFETIME = TimeSpan.FromHours(24);

    public const string IN_PROGRESS_MESSAGE = "Operação em andamento, tente em instantes.";
    public const string KEY_TOO_LONG_MESSAGE = "A chave de repetição deve ter no máximo 64 caracteres.";

    private static readonly JsonSerializerOptions JSON_OPTIONS = new(JsonSerializerDefaults.Web);

    private readonly IMcpIdempotencyRepository<McpIdempotencyKey> _repository;
    private readonly TimeProvider _time;

    public McpIdempotencyService(IMcpIdempotencyRepository<McpIdempotencyKey> repository, TimeProvider? time = null)
    {
        _repository = repository;
        _time = time ?? TimeProvider.System;
    }

    private DateTime Now => _time.GetUtcNow().UtcDateTime;

    public async Task<T> ExecuteAsync<T>(long userId, string toolName, string? idempotencyKey, Func<Task<T>> action)
    {
        var key = idempotencyKey?.Trim();
        if (string.IsNullOrEmpty(key))
            return await action();
        if (key.Length > MAX_KEY_LENGTH)
            throw new ValidationException(KEY_TOO_LONG_MESSAGE);

        var existing = await _repository.GetAsync(userId, toolName, key);
        if (existing != null)
        {
            if (Now - existing.CreatedAt < KEY_LIFETIME)
                return Replay<T>(existing);
            // Vencida (a limpeza ainda não passou): vale como chave nova.
            await _repository.DeleteAsync(existing);
        }

        var entry = new McpIdempotencyKey
        {
            UserId = userId,
            ToolName = toolName,
            IdempotencyKey = key,
            Status = IdempotencyStatus.InProgress,
            CreatedAt = Now
        };
        try
        {
            await _repository.InsertAsync(entry);
        }
        catch (Exception ex) when (UniqueViolation.Is(ex, UniqueViolation.MCP_IDEMPOTENCY_KEYS_UNIQUE_INDEX))
        {
            // Outra chamada com a mesma chave chegou primeiro.
            var winner = await _repository.GetAsync(userId, toolName, key);
            if (winner == null)
                throw new ConflictException(IN_PROGRESS_MESSAGE);
            return Replay<T>(winner);
        }

        T result;
        try
        {
            result = await action();
        }
        catch
        {
            await _repository.DeleteAsync(entry);
            throw;
        }

        entry.Complete(JsonSerializer.Serialize(result, JSON_OPTIONS));
        await _repository.UpdateAsync(entry);
        return result;
    }

    private static T Replay<T>(McpIdempotencyKey key)
    {
        if (key.Status != IdempotencyStatus.Completed || key.ResultJson == null)
            throw new ConflictException(IN_PROGRESS_MESSAGE);
        return JsonSerializer.Deserialize<T>(key.ResultJson, JSON_OPTIONS)!;
    }
}
