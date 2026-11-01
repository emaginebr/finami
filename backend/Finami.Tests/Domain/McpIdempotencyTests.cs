using Finami.Domain.Enums;
using Finami.Domain.Exceptions;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.DTO.Transactions;
using Finami.Tests.API;
using FluentAssertions;

namespace Finami.Tests.Domain;

/// <summary>T037 — repetição segura (research R-08).</summary>
public class McpIdempotencyTests
{
    private const long USER = 1;
    private const string TOOL = "registrar_despesa";

    private readonly InMemoryIdempotencyRepository _repository = new();
    private readonly TestTimeProvider _time = new(new DateTimeOffset(2026, 11, 1, 12, 0, 0, TimeSpan.Zero));
    private readonly McpIdempotencyService _service;
    private int _executions;

    public McpIdempotencyTests()
    {
        _service = new McpIdempotencyService(_repository, _time);
    }

    private Task<TransactionInfo> Expense()
    {
        _executions++;
        return Task.FromResult(new TransactionInfo
        {
            TransactionId = 100 + _executions, Type = "Expense", SourceAmount = 80m, Description = "Mercado",
            Source = new TransactionAccountInfo { Name = "Nubank", Currency = "BRL" }
        });
    }

    [Fact]
    public async Task First_execution_stores_the_serialized_result()
    {
        var result = await _service.ExecuteAsync(USER, TOOL, "k1", Expense);

        result.TransactionId.Should().Be(101);
        var key = _repository.Keys.Single();
        key.Status.Should().Be(IdempotencyStatus.Completed);
        key.ResultJson.Should().Contain("\"transactionId\":101").And.Contain("Nubank");
        key.CreatedAt.Should().Be(_time.GetUtcNow().UtcDateTime);
    }

    [Fact]
    public async Task Repetition_returns_the_same_result_without_executing()
    {
        var first = await _service.ExecuteAsync(USER, TOOL, "k1", Expense);
        var second = await _service.ExecuteAsync(USER, TOOL, "k1", Expense);

        _executions.Should().Be(1);
        second.Should().BeEquivalentTo(first);
    }

    [Fact]
    public async Task Hundred_repetitions_execute_the_service_once()
    {
        for (var i = 0; i < 100; i++)
            (await _service.ExecuteAsync(USER, TOOL, "mesma-chave", Expense)).TransactionId.Should().Be(101);

        _executions.Should().Be(1);
        _repository.Keys.Should().HaveCount(1);
    }

    [Fact]
    public async Task Repetition_while_in_progress_is_a_conflict()
    {
        _repository.Keys.Add(new McpIdempotencyKey
        {
            UserId = USER, ToolName = TOOL, IdempotencyKey = "k1", Status = IdempotencyStatus.InProgress,
            CreatedAt = _time.GetUtcNow().UtcDateTime
        });

        var act = () => _service.ExecuteAsync(USER, TOOL, "k1", Expense);

        (await act.Should().ThrowAsync<ConflictException>()).WithMessage("Operação em andamento, tente em instantes.");
        _executions.Should().Be(0);
    }

    [Fact]
    public async Task Concurrent_insert_returns_the_winner_result()
    {
        // Simula a corrida: a outra chamada grava entre a leitura e o insert desta.
        var racing = new RacingRepository(_repository, new McpIdempotencyKey
        {
            UserId = USER, ToolName = TOOL, IdempotencyKey = "k1", Status = IdempotencyStatus.Completed,
            ResultJson = """{"transactionId":555}""", CreatedAt = _time.GetUtcNow().UtcDateTime
        });
        var service = new McpIdempotencyService(racing, _time);

        var result = await service.ExecuteAsync(USER, TOOL, "k1", Expense);

        result.TransactionId.Should().Be(555);
        _executions.Should().Be(0);
    }

    [Fact]
    public async Task Failure_deletes_the_key_so_it_can_be_retried()
    {
        var act = () => _service.ExecuteAsync<TransactionInfo>(USER, TOOL, "k1",
            () => throw new BusinessRuleException("Saldo insuficiente."));

        await act.Should().ThrowAsync<BusinessRuleException>();
        _repository.Keys.Should().BeEmpty();

        (await _service.ExecuteAsync(USER, TOOL, "k1", Expense)).TransactionId.Should().Be(101);
    }

    [Fact]
    public async Task Without_key_always_executes_and_stores_nothing()
    {
        await _service.ExecuteAsync(USER, TOOL, null, Expense);
        await _service.ExecuteAsync(USER, TOOL, "  ", Expense);

        _executions.Should().Be(2);
        _repository.Keys.Should().BeEmpty();
    }

    [Fact]
    public async Task Keys_are_scoped_by_user_and_tool()
    {
        await _service.ExecuteAsync(USER, TOOL, "k1", Expense);
        await _service.ExecuteAsync(USER + 1, TOOL, "k1", Expense);
        await _service.ExecuteAsync(USER, "registrar_receita", "k1", Expense);

        _executions.Should().Be(3);
    }

    [Fact]
    public async Task Key_older_than_24h_counts_as_new()
    {
        await _service.ExecuteAsync(USER, TOOL, "k1", Expense);
        _time.Advance(TimeSpan.FromHours(25));

        (await _service.ExecuteAsync(USER, TOOL, "k1", Expense)).TransactionId.Should().Be(102);
        _repository.Keys.Should().ContainSingle();
    }

    [Fact]
    public async Task Key_longer_than_64_is_a_validation_error()
    {
        var act = () => _service.ExecuteAsync(USER, TOOL, new string('x', 65), Expense);

        (await act.Should().ThrowAsync<ValidationException>())
            .WithMessage("A chave de repetição deve ter no máximo 64 caracteres.");
        _executions.Should().Be(0);
    }

    /// <summary>Esconde a chave na primeira leitura e a revela no insert (violação do índice único).</summary>
    private sealed class RacingRepository : Finami.Infra.Interfaces.Repository.IMcpIdempotencyRepository<McpIdempotencyKey>
    {
        private readonly InMemoryIdempotencyRepository _inner;
        private readonly McpIdempotencyKey _winner;
        private bool _inserted;

        public RacingRepository(InMemoryIdempotencyRepository inner, McpIdempotencyKey winner)
        {
            _inner = inner;
            _winner = winner;
        }

        public Task<McpIdempotencyKey?> GetAsync(long userId, string toolName, string idempotencyKey) =>
            _inserted ? _inner.GetAsync(userId, toolName, idempotencyKey) : Task.FromResult<McpIdempotencyKey?>(null);

        public Task<McpIdempotencyKey> InsertAsync(McpIdempotencyKey key)
        {
            _inserted = true;
            _inner.Keys.Add(_winner);
            return _inner.InsertAsync(key);
        }

        public Task<McpIdempotencyKey> UpdateAsync(McpIdempotencyKey key) => _inner.UpdateAsync(key);
        public Task DeleteAsync(McpIdempotencyKey key) => _inner.DeleteAsync(key);
    }
}
