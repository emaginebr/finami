using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Validators;
using Finami.DTO.Auth;
using Finami.DTO.Users;
using Finami.Infra.Interfaces.AppServices;
using Finami.Infra.Interfaces.Repository;
using FluentValidation;
using Microsoft.AspNetCore.Identity;

namespace Finami.Domain.Services;

public class AuthService : IAuthService
{
    public const string INVALID_CREDENTIALS = "Email ou senha inválidos.";

    private readonly IUserRepository<User> _userRepository;
    private readonly IGoogleTokenAppService<GoogleUserPayload> _googleTokenAppService;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly ITokenService _tokenService;
    private readonly IValidator<RegisterInfo> _registerValidator;
    private readonly IValidator<LoginInfo> _loginValidator;
    private readonly IValidator<GoogleLoginInfo> _googleValidator;

    public AuthService(
        IUserRepository<User> userRepository,
        IGoogleTokenAppService<GoogleUserPayload> googleTokenAppService,
        IPasswordHasher<User> passwordHasher,
        ITokenService tokenService,
        IValidator<RegisterInfo> registerValidator,
        IValidator<LoginInfo> loginValidator,
        IValidator<GoogleLoginInfo> googleValidator)
    {
        _userRepository = userRepository;
        _googleTokenAppService = googleTokenAppService;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
        _registerValidator = registerValidator;
        _loginValidator = loginValidator;
        _googleValidator = googleValidator;
    }

    public async Task<AuthResult> RegisterAsync(RegisterInfo info)
    {
        await _registerValidator.ValidateOrThrowAsync(info);
        if (await _userRepository.ExistsEmailAsync(info.Email))
            throw new ConflictException("Este email já está em uso.");

        var user = new User();
        user.UpdateName(info.FirstName, info.LastName);
        user.SetEmail(info.Email);
        user.SetPasswordHash(_passwordHasher.HashPassword(user, info.Password));
        user.UpdatedAt = null;
        await _userRepository.InsertAsync(user);

        return BuildResult(user, isNewUser: true);
    }

    public async Task<AuthResult> LoginAsync(LoginInfo info)
    {
        await _loginValidator.ValidateOrThrowAsync(info);
        var user = await _userRepository.GetByEmailAsync(info.Email);

        // FR-004/005: sem email ou sem senha não há login por senha; mensagem sempre genérica.
        if (user == null || !user.CanLogin || !user.HasPassword)
            throw new UnauthorizedException(INVALID_CREDENTIALS);

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash!, info.Password);
        if (verification == PasswordVerificationResult.Failed)
            throw new UnauthorizedException(INVALID_CREDENTIALS);

        if (verification == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.SetPasswordHash(_passwordHasher.HashPassword(user, info.Password));
            await _userRepository.UpdateAsync(user);
        }

        return BuildResult(user, isNewUser: false);
    }

    public async Task<AuthResult> GoogleLoginAsync(GoogleLoginInfo info)
    {
        await _googleValidator.ValidateOrThrowAsync(info);
        var payload = await _googleTokenAppService.ValidateAsync(info.IdToken);

        var user = await _userRepository.GetByGoogleSubjectAsync(payload.Subject);
        if (user != null)
            return BuildResult(user, isNewUser: false);

        // FR-006: vincula ao usuário existente de mesmo email.
        user = await _userRepository.GetByEmailAsync(payload.Email);
        if (user != null)
        {
            user.LinkGoogle(payload.Subject);
            await _userRepository.UpdateAsync(user);
            return BuildResult(user, isNewUser: false);
        }

        user = new User
        {
            FirstName = Truncate(string.IsNullOrWhiteSpace(payload.GivenName) ? payload.Email.Split('@')[0] : payload.GivenName),
            LastName = Truncate(string.IsNullOrWhiteSpace(payload.FamilyName) ? "-" : payload.FamilyName),
            Email = User.NormalizeEmail(payload.Email),
            GoogleSubject = payload.Subject
        };
        await _userRepository.InsertAsync(user);
        return BuildResult(user, isNewUser: true);
    }

    public async Task<UserInfo> GetMeAsync(long userId)
    {
        var user = await _userRepository.GetByIdAsync(userId)
            ?? throw new UnauthorizedException();
        return user.ToInfo();
    }

    private AuthResult BuildResult(User user, bool isNewUser)
    {
        var (token, expiresAt) = _tokenService.Generate(user);
        return new AuthResult { Token = token, ExpiresAt = expiresAt, IsNewUser = isNewUser, User = user.ToInfo() };
    }

    private static string Truncate(string value) => value.Length <= 120 ? value.Trim() : value[..120].Trim();
}
