using Finami.Domain.Interfaces;
using Finami.DTO.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Finami.API.Controllers;

/// <summary>Usuários: cadastro de outros usuários (com ou sem login), perfil e senha.</summary>
[Route("api/users")]
[Authorize]
public class UsersController : FinamiControllerBase
{
    private readonly IUserService _userService;
    private readonly IBalanceService _balanceService;

    public UsersController(IUserService userService, IBalanceService balanceService)
    {
        _userService = userService;
        _balanceService = balanceService;
    }

    /// <summary>Cadastra outro usuário; email e senha são opcionais (sem email ele não faz login).</summary>
    [HttpPost]
    public Task<IActionResult> Create([FromBody] UserInsertInfo info) =>
        Execute(async () => StatusCode(StatusCodes.Status201Created, await _userService.CreateAsync(CurrentUserId, info)));

    /// <summary>Usuários cadastrados por você.</summary>
    [HttpGet("created-by-me")]
    public Task<IActionResult> CreatedByMe() =>
        Execute(async () => Ok(await _userService.ListCreatedByMeAsync(CurrentUserId)));

    /// <summary>Busca exata por email (para incluir em grupo ou escolher destino de transferência).</summary>
    [HttpGet("search")]
    public Task<IActionResult> Search([FromQuery] string email) =>
        Execute(async () => Ok(await _userService.SearchByEmailAsync(email)));

    /// <summary>Dados de um usuário (o próprio, cadastrado por você ou com grupo em comum).</summary>
    [HttpGet("{id:long}")]
    public Task<IActionResult> Get(long id) =>
        Execute(async () => Ok(await _userService.GetAsync(CurrentUserId, id)));

    /// <summary>Atualiza nome, sobrenome e email (o próprio ou quem o cadastrou).</summary>
    [HttpPut("{id:long}")]
    public Task<IActionResult> Update(long id, [FromBody] UserUpdateInfo info) =>
        Execute(async () => Ok(await _userService.UpdateAsync(CurrentUserId, id, info)));

    /// <summary>Define ou troca a senha (o próprio ou quem o cadastrou).</summary>
    [HttpPut("{id:long}/password")]
    public Task<IActionResult> ChangePassword(long id, [FromBody] PasswordUpdateInfo info) =>
        Execute(async () =>
        {
            await _userService.ChangePasswordAsync(CurrentUserId, id, info);
            return NoContent();
        });

    /// <summary>
    /// Carteiras do usuário em cada família (FR-030): o próprio vê todos os grupos; outro membro vê só os
    /// grupos cujo nível de detalhe não é Hidden. Sem grupo visível → 404. Detalhes em
    /// specs/002-finami-frontend-mobile/contracts/api-additions.md §3.
    /// </summary>
    /// <param name="userId">Identificador do usuário consultado.</param>
    [HttpGet("{userId:long}/group-balances")]
    public Task<IActionResult> GroupBalances(long userId) =>
        Execute(async () => Ok(await _balanceService.GetUserGroupBalancesAsync(CurrentUserId, userId)));
}
