using Finami.API.Extensions;
using Finami.Domain.Exceptions;
using Finami.DTO;
using Microsoft.AspNetCore.Mvc;

namespace Finami.API.Controllers;

/// <summary>Base dos controllers: mapeia exceções de domínio e aplica o Princípio VII (500 com a mensagem).</summary>
[ApiController]
public abstract class FinamiControllerBase : ControllerBase
{
    protected long CurrentUserId => User.GetUserId();

    protected async Task<IActionResult> Execute(Func<Task<IActionResult>> action)
    {
        try
        {
            return await action();
        }
        catch (ValidationException ex) { return Error(StatusCodes.Status400BadRequest, ex); }
        catch (UnauthorizedException ex) { return Error(StatusCodes.Status401Unauthorized, ex); }
        catch (ForbiddenException ex) { return Error(StatusCodes.Status403Forbidden, ex); }
        catch (NotFoundException ex) { return Error(StatusCodes.Status404NotFound, ex); }
        catch (ConflictException ex) { return Error(StatusCodes.Status409Conflict, ex); }
        catch (GoneException ex) { return Error(StatusCodes.Status410Gone, ex); }
        catch (BusinessRuleException ex) { return Error(StatusCodes.Status422UnprocessableEntity, ex); }
        catch (QuoteUnavailableException ex) { return Error(StatusCodes.Status503ServiceUnavailable, ex); }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    private ObjectResult Error(int status, DomainException ex) =>
        StatusCode(status, new ErrorResult { Sucesso = false, Mensagem = ex.Message, Erros = ex.Errors });
}
