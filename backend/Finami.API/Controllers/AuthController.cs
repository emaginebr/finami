using Finami.Domain.Interfaces;
using Finami.DTO.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Finami.API.Controllers;

/// <summary>Cadastro, login (email/senha e Google) e usuário autenticado.</summary>
[Route("api/auth")]
[Authorize]
public class AuthController : FinamiControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>Auto-cadastro com nome, sobrenome, email e senha.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public Task<IActionResult> Register([FromBody] RegisterInfo info) =>
        Execute(async () => StatusCode(StatusCodes.Status201Created, await _authService.RegisterAsync(info)));

    /// <summary>Login com email e senha.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public Task<IActionResult> Login([FromBody] LoginInfo info) =>
        Execute(async () => Ok(await _authService.LoginAsync(info)));

    /// <summary>Login com ID token do Google; cria o usuário no primeiro acesso ou vincula pelo email.</summary>
    [HttpPost("google")]
    [AllowAnonymous]
    public Task<IActionResult> Google([FromBody] GoogleLoginInfo info) =>
        Execute(async () => Ok(await _authService.GoogleLoginAsync(info)));

    /// <summary>Dados do usuário autenticado.</summary>
    [HttpGet("me")]
    public Task<IActionResult> Me() =>
        Execute(async () => Ok(await _authService.GetMeAsync(CurrentUserId)));
}
