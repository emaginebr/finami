using Finami.Domain.Interfaces;
using Finami.DTO.Transactions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Finami.API.Controllers;

/// <summary>Transações: entradas e saídas externas, transferências e estornos.</summary>
[Route("api/transactions")]
[Authorize]
public class TransactionsController : FinamiControllerBase
{
    private readonly ILedgerService _ledgerService;

    public TransactionsController(ILedgerService ledgerService)
    {
        _ledgerService = ledgerService;
    }

    /// <summary>Entrada de fundos vinda de fora do sistema.</summary>
    [HttpPost("income")]
    public Task<IActionResult> Income([FromBody] IncomeInfo info) =>
        Execute(async () => StatusCode(StatusCodes.Status201Created, await _ledgerService.IncomeAsync(CurrentUserId, info)));

    /// <summary>Saída de fundos para fora do sistema.</summary>
    [HttpPost("expense")]
    public Task<IActionResult> Expense([FromBody] ExpenseInfo info) =>
        Execute(async () => StatusCode(StatusCodes.Status201Created, await _ledgerService.ExpenseAsync(CurrentUserId, info)));

    /// <summary>
    /// Transfere entre carteiras. O valor é na moeda da origem (<c>amount</c>) ou, entre carteiras de bitcoin, em
    /// reais (<c>amountBrl</c>, convertido pela cotação atual). BRL→BTC vira compra e BTC→BRL vira venda na
    /// cotação atual, só entre carteiras do mesmo titular. O destino deve ser do próprio titular da origem ou de
    /// alguém com família em comum com ele (feature 006). Entre pessoas diferentes, <c>kind</c> diz o tipo
    /// (feature 007): <c>loan</c> (padrão; quem recebe passa a dever), <c>settlement</c> (abate a dívida de quem envia,
    /// com <c>debtCurrency</c> e <c>settleAll</c>) ou <c>payment</c> (sem dívida).
    /// </summary>
    [HttpPost("transfer")]
    public Task<IActionResult> Transfer([FromBody] TransferInfo info) =>
        Execute(async () => StatusCode(StatusCodes.Status201Created, await _ledgerService.TransferAsync(CurrentUserId, info)));

    /// <summary>Simula a transferência (tipo, valor convertido, cotação e efeito na dívida) sem gravar.</summary>
    [HttpPost("transfer/preview")]
    public Task<IActionResult> PreviewTransfer([FromBody] TransferInfo info) =>
        Execute(async () => Ok(await _ledgerService.PreviewTransferAsync(CurrentUserId, info)));

    /// <summary>Estorna uma transação (nova transação inversa; a original nunca é alterada).</summary>
    [HttpPost("{id:long}/reverse")]
    public Task<IActionResult> Reverse(long id, [FromBody] ReverseInfo? info) =>
        Execute(async () => StatusCode(StatusCodes.Status201Created, await _ledgerService.ReverseAsync(CurrentUserId, id, info)));

    /// <summary>Detalhes de uma transação.</summary>
    [HttpGet("{id:long}")]
    public Task<IActionResult> Get(long id) =>
        Execute(async () => Ok(await _ledgerService.GetAsync(CurrentUserId, id)));
}
