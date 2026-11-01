using Finami.API.Mcp.Tools;
using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.DTO.Groups;
using Finami.DTO.Invitations;
using Finami.DTO.Notifications;
using Finami.DTO.Users;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using static Finami.Tests.API.McpToolTestKit;

namespace Finami.Tests.API;

/// <summary>T049 — família, convites e notificações pelo MCP (US5), com as regras da feature 003.</summary>
public class McpGroupToolsTests
{
    private readonly McpToolTestKit _kit = new();
    private readonly Mock<IGroupService> _groups = new();
    private readonly Mock<IInvitationService> _invitations = new();
    private readonly Mock<INotificationService> _notifications = new();

    private GroupWriteTools Groups() => new(_groups.Object, _kit.Idempotency, _kit.Audit.Object, NullLogger<GroupWriteTools>.Instance);
    private InvitationTools Invitations() => new(_invitations.Object, _kit.Idempotency, _kit.Audit.Object, NullLogger<InvitationTools>.Instance);
    private NotificationTools Notifications() => new(_notifications.Object, _kit.Idempotency, _kit.Audit.Object, NullLogger<NotificationTools>.Instance);

    private static GroupInvitationInfo Invitation(string status) => new()
    {
        InvitationId = 9, GroupId = 3, GroupName = "Família Silva", Status = status,
        InvitedUser = new UserSummaryInfo { UserId = USER, FirstName = "Ana", LastName = "Silva" },
        InvitedBy = new UserSummaryInfo { UserId = 2, FirstName = "Bruno", LastName = "Silva" }
    };

    [Fact]
    public async Task Accept_and_decline_invitation_use_the_token_user()
    {
        _invitations.Setup(i => i.AcceptAsync(USER, 9)).ReturnsAsync(Invitation("Accepted"));
        _invitations.Setup(i => i.DeclineAsync(USER, 9)).ReturnsAsync(Invitation("Declined"));

        var accepted = await Invitations().AceitarConvite(Principal(), 9);
        var declined = await Invitations().RecusarConvite(Principal(), 9);

        Text(accepted).Should().Be("Convite aceito: agora você faz parte da família Família Silva.");
        Structured(accepted).GetProperty("status").GetString().Should().Be("Accepted");
        Text(declined).Should().Be("Convite para a família Família Silva recusado.");
        _kit.AuditLog.Select(a => (a.Tool, a.Outcome, a.TargetId)).Should().Equal(
            ("aceitar_convite", "sucesso", 9L), ("recusar_convite", "sucesso", 9L));
    }

    [Fact]
    public async Task Invitation_no_longer_available_is_a_conflict_with_the_app_message()
    {
        _invitations.Setup(i => i.AcceptAsync(USER, 9)).ThrowsAsync(new ConflictException("Este convite não está mais disponível."));

        var result = await Invitations().AceitarConvite(Principal(), 9);

        Code(result).Should().Be("conflito");
        Text(result).Should().Be("Este convite não está mais disponível.");
    }

    [Fact]
    public async Task Non_responsible_inviting_or_removing_gets_sem_permissao()
    {
        const string message = "Apenas o responsável pelo grupo pode fazer isso.";
        _invitations.Setup(i => i.InviteAsync(USER, 3, It.IsAny<GroupInvitationInsertInfo>())).ThrowsAsync(new ForbiddenException(message));
        _groups.Setup(g => g.RemoveMemberAsync(USER, 3, 12)).ThrowsAsync(new ForbiddenException(message));

        var invite = await Invitations().ConvidarParaFamilia(Principal(), 3, "bruno@exemplo.com");
        var remove = await Groups().RetirarMembro(Principal(), 3, 12);

        Code(invite).Should().Be("sem_permissao");
        Text(invite).Should().Be(message);
        Code(remove).Should().Be("sem_permissao");
        _kit.AuditLog.Should().OnlyContain(a => a.Outcome == "sem_permissao");
    }

    [Theory]
    [InlineData("Available")]
    [InlineData("Registered")]
    [InlineData("AlreadyMember")]
    [InlineData("PendingInvite")]
    public async Task Email_lookup_returns_each_status(string status)
    {
        _groups.Setup(g => g.LookupMemberAsync(USER, 3, It.Is<MemberLookupInfo>(m => m.Email == "x@exemplo.com")))
            .ReturnsAsync(new MemberLookupResult
            {
                Status = status, Email = "x@exemplo.com",
                User = status == "Available" ? null : new UserSummaryInfo { FirstName = "Xavier", LastName = "Lima" },
                InvitationId = status == "PendingInvite" ? 9 : null
            });

        var result = await Groups().VerificarEmailParaFamilia(Principal(READ_ONLY), 3, "x@exemplo.com");

        result.IsError.Should().NotBe(true);
        Structured(result).GetProperty("status").GetString().Should().Be(status);
        Text(result).Should().NotStartWith("Status:");
        _kit.AuditLog.Should().BeEmpty("verificar_email_para_familia é leitura");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public async Task Mark_read_with_0_or_more_than_100_ids_is_a_validation_error(int count)
    {
        var ids = Enumerable.Range(1, count).Select(i => (long)i).ToArray();

        var result = await Notifications().MarcarNotificacoesComoLidas(Principal(), ids);

        Code(result).Should().Be("validacao");
        Text(result).Should().Be("Informe de 1 a 100 ids de notificação.");
        _notifications.Verify(n => n.MarkReadAsync(It.IsAny<long>(), It.IsAny<MarkReadInfo>()), Times.Never);
    }

    [Fact]
    public async Task Mark_read_returns_the_remaining_unread_count()
    {
        _notifications.Setup(n => n.CountUnreadAsync(USER)).ReturnsAsync(new UnreadCountResult { Unread = 2 });

        var result = await Notifications().MarcarNotificacoesComoLidas(Principal(), new long[] { 41, 42 });

        Text(result).Should().Be("Notificações marcadas como lidas. Não lidas agora: 2.");
        _notifications.Verify(n => n.MarkReadAsync(USER, It.Is<MarkReadInfo>(m => m.NotificationIds.SequenceEqual(new long[] { 41, 42 }))));
    }

    [Fact]
    public async Task Notifications_are_paged_with_before_id_cursor()
    {
        _notifications.Setup(n => n.ListAsync(USER, 50, 10)).ReturnsAsync(new NotificationPage
        {
            Items = new List<NotificationInfo>
            {
                new()
                {
                    NotificationId = 49, Type = "GroupInvitationReceived",
                    Actor = new UserSummaryInfo { FirstName = "Bruno", LastName = "Silva" },
                    Group = new NotificationGroupInfo { GroupId = 3, Name = "Família Silva" },
                    Invitation = new NotificationInvitationInfo { InvitationId = 9, Status = "Pending" }
                }
            },
            NextBeforeId = 49
        });

        var result = await Notifications().ListarNotificacoes(Principal(READ_ONLY), 10, "50");

        Structured(result).GetProperty("proximoCursor").GetString().Should().Be("49");
        Text(result).Should().Contain("Bruno Silva convidou você para a família Família Silva (convite 9, Pending)");
        Code(await Notifications().ListarNotificacoes(Principal(READ_ONLY), 10, "abc")).Should().Be("validacao");
    }

    [Fact]
    public async Task Write_tools_require_write_scope()
    {
        var principal = Principal(READ_ONLY);

        var results = new[]
        {
            await Groups().CriarFamilia(principal, "Família"),
            await Groups().RenomearFamilia(principal, 3, "Outra"),
            await Groups().CriarPessoaNaFamilia(principal, 3, "Pedro", "Silva"),
            await Groups().RetirarMembro(principal, 3, 12),
            await Invitations().ConvidarParaFamilia(principal, 3, "x@exemplo.com"),
            await Invitations().CancelarConvite(principal, 3, 9),
            await Invitations().AceitarConvite(principal, 9),
            await Invitations().RecusarConvite(principal, 9),
            await Notifications().MarcarNotificacoesComoLidas(principal, new long[] { 1 })
        };

        results.Should().OnlyContain(r => Code(r) == "permissao_insuficiente");
        _groups.VerifyNoOtherCalls();
        _invitations.VerifyNoOtherCalls();
        _notifications.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Create_member_and_group_pass_the_arguments()
    {
        _groups.Setup(g => g.CreateAsync(USER, It.Is<GroupInsertInfo>(i => i.Name == "Família Silva")))
            .ReturnsAsync(new GroupInfo { GroupId = 3, Name = "Família Silva", IsResponsible = true });
        _groups.Setup(g => g.CreateMemberAsync(USER, 3, It.Is<NewMemberInfo>(m => m.FirstName == "Pedro" && m.Email == null)))
            .ReturnsAsync(new GroupInfo { GroupId = 3, Name = "Família Silva" });

        Text(await Groups().CriarFamilia(Principal(), "Família Silva")).Should().Contain("você é o responsável");
        Text(await Groups().CriarPessoaNaFamilia(Principal(), 3, "Pedro", "Silva")).Should().Contain("Pedro Silva");
    }
}
