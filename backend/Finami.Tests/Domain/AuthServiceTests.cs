using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Services;
using Finami.Domain.Validators;
using Finami.DTO.Auth;
using Finami.Infra.Interfaces.AppServices;
using Finami.Infra.Interfaces.Repository;
using FluentAssertions;
using Microsoft.AspNetCore.Identity;
using Moq;

namespace Finami.Tests.Domain;

public class AuthServiceTests
{
    private readonly Mock<IUserRepository<User>> _users = new();
    private readonly Mock<IGoogleTokenAppService<GoogleUserPayload>> _google = new();
    private readonly Mock<ITokenService> _tokens = new();
    private readonly PasswordHasher<User> _hasher = new();
    private readonly AuthService _service;

    public AuthServiceTests()
    {
        _tokens.Setup(t => t.Generate(It.IsAny<User>())).Returns(("token", DateTime.UtcNow.AddHours(8)));
        _users.Setup(r => r.InsertAsync(It.IsAny<User>())).ReturnsAsync((User u) => { u.UserId = 10; return u; });
        _users.Setup(r => r.UpdateAsync(It.IsAny<User>())).ReturnsAsync((User u) => u);
        _service = new AuthService(_users.Object, _google.Object, _hasher, _tokens.Object,
            new RegisterInfoValidator(), new LoginInfoValidator(), new GoogleLoginInfoValidator());
    }

    [Fact]
    public async Task Register_with_existing_email_throws_conflict()
    {
        _users.Setup(r => r.ExistsEmailAsync("ana@ex.com", null)).ReturnsAsync(true);

        var act = () => _service.RegisterAsync(new RegisterInfo
            { FirstName = "Ana", LastName = "Silva", Email = "ana@ex.com", Password = "12345678" });

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Register_hashes_password_and_normalizes_email()
    {
        User? saved = null;
        _users.Setup(r => r.InsertAsync(It.IsAny<User>())).Callback<User>(u => saved = u).ReturnsAsync((User u) => u);

        var result = await _service.RegisterAsync(new RegisterInfo
            { FirstName = " Ana ", LastName = "Silva", Email = "Ana@Ex.com ", Password = "12345678" });

        saved!.Email.Should().Be("ana@ex.com");
        saved.PasswordHash.Should().NotBe("12345678");
        result.IsNewUser.Should().BeTrue();
        result.User.CanLogin.Should().BeTrue();
    }

    [Fact]
    public async Task Register_with_short_password_throws_validation()
    {
        var act = () => _service.RegisterAsync(new RegisterInfo
            { FirstName = "Ana", LastName = "Silva", Email = "ana@ex.com", Password = "123" });

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task Login_with_wrong_password_and_without_password_return_same_generic_error()
    {
        var withPassword = new User { UserId = 1, FirstName = "Ana", LastName = "S", Email = "ana@ex.com" };
        withPassword.PasswordHash = _hasher.HashPassword(withPassword, "correta123");
        var withoutPassword = new User { UserId = 2, FirstName = "Bia", LastName = "S", Email = "bia@ex.com" };
        _users.Setup(r => r.GetByEmailAsync("ana@ex.com")).ReturnsAsync(withPassword);
        _users.Setup(r => r.GetByEmailAsync("bia@ex.com")).ReturnsAsync(withoutPassword);

        var wrong = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            _service.LoginAsync(new LoginInfo { Email = "ana@ex.com", Password = "errada123" }));
        var noPassword = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            _service.LoginAsync(new LoginInfo { Email = "bia@ex.com", Password = "qualquer1" }));
        var unknown = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            _service.LoginAsync(new LoginInfo { Email = "nao@existe.com", Password = "qualquer1" }));

        wrong.Message.Should().Be(AuthService.INVALID_CREDENTIALS);
        noPassword.Message.Should().Be(wrong.Message);
        unknown.Message.Should().Be(wrong.Message);
    }

    [Fact]
    public async Task Login_with_correct_password_returns_token()
    {
        var user = new User { UserId = 1, FirstName = "Ana", LastName = "S", Email = "ana@ex.com" };
        user.PasswordHash = _hasher.HashPassword(user, "correta123");
        _users.Setup(r => r.GetByEmailAsync("ana@ex.com")).ReturnsAsync(user);

        var result = await _service.LoginAsync(new LoginInfo { Email = "ana@ex.com", Password = "correta123" });

        result.Token.Should().Be("token");
        result.User.UserId.Should().Be(1);
    }

    [Fact]
    public async Task Google_first_access_creates_user()
    {
        _google.Setup(g => g.ValidateAsync("idt")).ReturnsAsync(new GoogleUserPayload
            { Subject = "g-1", Email = "novo@ex.com", EmailVerified = true, GivenName = "Novo", FamilyName = "Usuário" });

        var result = await _service.GoogleLoginAsync(new GoogleLoginInfo { IdToken = "idt" });

        result.IsNewUser.Should().BeTrue();
        _users.Verify(r => r.InsertAsync(It.Is<User>(u =>
            u.GoogleSubject == "g-1" && u.Email == "novo@ex.com" && u.FirstName == "Novo")), Times.Once);
    }

    [Fact]
    public async Task Google_with_existing_email_links_without_duplicating()
    {
        var existing = new User { UserId = 5, FirstName = "Ana", LastName = "S", Email = "ana@ex.com" };
        _google.Setup(g => g.ValidateAsync("idt")).ReturnsAsync(new GoogleUserPayload
            { Subject = "g-5", Email = "ana@ex.com", EmailVerified = true });
        _users.Setup(r => r.GetByEmailAsync("ana@ex.com")).ReturnsAsync(existing);

        var result = await _service.GoogleLoginAsync(new GoogleLoginInfo { IdToken = "idt" });

        result.IsNewUser.Should().BeFalse();
        existing.GoogleSubject.Should().Be("g-5");
        _users.Verify(r => r.InsertAsync(It.IsAny<User>()), Times.Never);
        _users.Verify(r => r.UpdateAsync(existing), Times.Once);
    }
}
