using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Finami.API.Controllers;

/// <summary>Extratos por período (datas yyyy-MM-dd no fuso America/Sao_Paulo, inclusivas).</summary>
[Route("api/statements")]
[Authorize]
public class StatementsController : FinamiControllerBase
{
    private readonly IStatementService _statementService;

    public StatementsController(IStatementService statementService)
    {
        _statementService = statementService;
    }

    /// <summary>Extrato de uma carteira.</summary>
    [HttpGet("wallets/{walletId:long}")]
    public Task<IActionResult> ByWallet(long walletId, [FromQuery] DateOnly? start, [FromQuery] DateOnly? end) =>
        Execute(async () =>
        {
            var (from, to) = RequirePeriod(start, end);
            return Ok(await _statementService.GetWalletStatementAsync(CurrentUserId, walletId, from, to));
        });

    /// <summary>Extrato de todas as carteiras de um usuário.</summary>
    [HttpGet("users/{userId:long}")]
    public Task<IActionResult> ByUser(long userId, [FromQuery] DateOnly? start, [FromQuery] DateOnly? end) =>
        Execute(async () =>
        {
            var (from, to) = RequirePeriod(start, end);
            return Ok(await _statementService.GetUserStatementAsync(CurrentUserId, userId, from, to));
        });

    /// <summary>Extrato das carteiras vinculadas a um grupo (conforme a visibilidade do grupo).</summary>
    [HttpGet("groups/{groupId:long}")]
    public Task<IActionResult> ByGroup(long groupId, [FromQuery] DateOnly? start, [FromQuery] DateOnly? end) =>
        Execute(async () =>
        {
            var (from, to) = RequirePeriod(start, end);
            return Ok(await _statementService.GetGroupStatementAsync(CurrentUserId, groupId, from, to));
        });

    private static (DateOnly Start, DateOnly End) RequirePeriod(DateOnly? start, DateOnly? end)
    {
        if (!start.HasValue || !end.HasValue)
            throw new ValidationException("Informe o período: start e end no formato yyyy-MM-dd.");
        return (start.Value, end.Value);
    }
}
