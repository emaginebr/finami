using Finami.API.Mcp.Tools;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.DTO.Users;
using Finami.DTO.Wallets;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using static Finami.Tests.API.McpToolTestKit;

namespace Finami.Tests.API;

/// <summary>T053 — carteiras e perfil pelo MCP (US6).</summary>
public class McpWalletToolsTests
{
    private readonly McpToolTestKit _kit = new();
    private readonly Mock<IWalletService> _wallets = new();
    private readonly Mock<IAuthService> _auth = new();
    private readonly Mock<IUserService> _users = new();

    private WalletWriteTools Wallets() => new(_wallets.Object, _kit.Idempotency, _kit.Audit.Object, NullLogger<WalletWriteTools>.Instance);
    private ProfileTools Profile() => new(_auth.Object, _users.Object, _kit.Idempotency, _kit.Audit.Object, NullLogger<ProfileTools>.Instance);

    private static WalletInfo Wallet(long? groupId = null, bool active = true) => new()
    {
        WalletId = 5, Name = "Nubank", Description = "Conta", Currency = "BTC", IsVirtual = false, IsActive = active,
        GroupId = groupId, OwnerUserId = USER, OwnerName = "Ana Silva"
    };

    [Fact]
    public async Task Create_wallet_normalizes_currency_and_uses_token_user()
    {
        _wallets.Setup(w => w.CreateAsync(USER, It.Is<WalletInsertInfo>(i =>
                i.Name == "Reserva" && i.Currency == "BTC" && i.GroupId == 3 && i.OwnerUserId == null && i.IsVirtual)))
            .ReturnsAsync(Wallet(3));

        var result = await Wallets().CriarCarteira(Principal(), "Reserva", " btc ", familia_id: 3, @virtual: true);

        result.IsError.Should().NotBe(true);
        Text(result).Should().Be("Carteira Nubank (BTC, id 5) criada para Ana Silva.");
        _kit.AuditLog.Single().TargetId.Should().Be(5);
    }

    [Fact]
    public async Task Update_keeps_fields_not_informed()
    {
        _wallets.Setup(w => w.GetAsync(USER, 5)).ReturnsAsync(Wallet());
        _wallets.Setup(w => w.UpdateAsync(USER, 5, It.IsAny<WalletUpdateInfo>())).ReturnsAsync(Wallet());

        await Wallets().AtualizarCarteira(Principal(), 5, nome: "Nubank PJ");

        _wallets.Verify(w => w.UpdateAsync(USER, 5, It.Is<WalletUpdateInfo>(u =>
            u.Name == "Nubank PJ" && u.Description == "Conta" && !u.IsVirtual)));
    }

    [Fact]
    public async Task Move_and_deactivate_call_the_service()
    {
        _wallets.Setup(w => w.SetGroupAsync(USER, 5, It.Is<WalletGroupInfo>(g => g.GroupId == null))).ReturnsAsync(Wallet());
        _wallets.Setup(w => w.DeactivateAsync(USER, 5)).ReturnsAsync(Wallet(active: false));

        Text(await Wallets().MoverCarteiraDeFamilia(Principal(), 5)).Should().Be("Carteira Nubank agora é pessoal.");
        Text(await Wallets().DesativarCarteira(Principal(), 5)).Should().Be("Carteira Nubank desativada.");
    }

    [Fact]
    public async Task Moving_to_another_group_keeps_the_app_rule_message()
    {
        const string message = "A carteira já está vinculada a outro grupo; peça ao responsável para desvinculá-la.";
        _wallets.Setup(w => w.SetGroupAsync(USER, 5, It.IsAny<WalletGroupInfo>())).ThrowsAsync(new BusinessRuleException(message));

        var result = await Wallets().MoverCarteiraDeFamilia(Principal(), 5, 4);

        Code(result).Should().Be("regra_de_negocio");
        Text(result).Should().Be(message);
    }

    [Fact]
    public async Task Delete_with_transactions_gets_the_same_refusal_as_the_app()
    {
        const string message = "A carteira possui transações e não pode ser excluída; desative-a.";
        _wallets.Setup(w => w.GetAsync(USER, 5)).ReturnsAsync(Wallet());
        _wallets.Setup(w => w.DeleteAsync(USER, 5)).ThrowsAsync(new BusinessRuleException(message));

        var result = await Wallets().ExcluirCarteira(Principal(), 5);

        Code(result).Should().Be("regra_de_negocio");
        Text(result).Should().Be(message);
    }

    [Fact]
    public async Task Delete_without_transactions_confirms()
    {
        _wallets.Setup(w => w.GetAsync(USER, 5)).ReturnsAsync(Wallet());

        var result = await Wallets().ExcluirCarteira(Principal(), 5);

        Text(result).Should().Be("Carteira Nubank excluída.");
        Structured(result).GetProperty("deleted").GetBoolean().Should().BeTrue();
        _wallets.Verify(w => w.DeleteAsync(USER, 5), Times.Once);
    }

    [Fact]
    public async Task Someone_elses_wallet_is_not_found()
    {
        _wallets.Setup(w => w.GetAsync(USER, 77)).ThrowsAsync(new NotFoundException("Carteira não encontrada."));

        var result = await Wallets().ExcluirCarteira(Principal(), 77);

        Code(result).Should().Be("nao_encontrado");
        _wallets.Verify(w => w.DeleteAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task Update_profile_only_changes_the_token_user_and_keeps_email()
    {
        _auth.Setup(a => a.GetMeAsync(USER)).ReturnsAsync(new UserInfo { UserId = USER, Email = "ana@exemplo.com" });
        _users.Setup(u => u.UpdateAsync(USER, USER, It.IsAny<UserUpdateInfo>()))
            .ReturnsAsync(new UserInfo { UserId = USER, FirstName = "Ana", LastName = "Souza" });

        var result = await Profile().AtualizarPerfil(Principal(), "Ana", "Souza");

        Text(result).Should().Be("Perfil atualizado: Ana Souza.");
        _users.Verify(u => u.UpdateAsync(USER, USER, It.Is<UserUpdateInfo>(i =>
            i.FirstName == "Ana" && i.LastName == "Souza" && i.Email == "ana@exemplo.com")), Times.Once);
        _users.Verify(u => u.UpdateAsync(It.IsAny<long>(), It.Is<long>(id => id != USER), It.IsAny<UserUpdateInfo>()), Times.Never);
    }

    [Fact]
    public async Task Write_tools_require_write_scope()
    {
        var principal = Principal(READ_ONLY);

        var results = new[]
        {
            await Wallets().CriarCarteira(principal, "X", "BRL"),
            await Wallets().AtualizarCarteira(principal, 5, "Y"),
            await Wallets().MoverCarteiraDeFamilia(principal, 5, 3),
            await Wallets().DesativarCarteira(principal, 5),
            await Wallets().ExcluirCarteira(principal, 5),
            await Profile().AtualizarPerfil(principal, "Ana", "Souza")
        };

        results.Should().OnlyContain(r => Code(r) == "permissao_insuficiente");
        _wallets.VerifyNoOtherCalls();
        _users.VerifyNoOtherCalls();
    }
}
