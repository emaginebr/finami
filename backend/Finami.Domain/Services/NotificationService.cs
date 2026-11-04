using Finami.Domain.Enums;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Validators;
using Finami.DTO.Groups;
using Finami.DTO.Notifications;
using Finami.DTO.Users;
using Finami.Infra.Interfaces.Repository;
using FluentValidation;
using ValidationException = Finami.Domain.Exceptions.ValidationException;

namespace Finami.Domain.Services;

/// <summary>Notificações do próprio usuário (research R-05, FR-020/021/024).</summary>
public class NotificationService : INotificationService
{
    public const int DEFAULT_LIMIT = 20;
    public const int MAX_LIMIT = 50;

    private readonly INotificationRepository<Notification> _notificationRepository;
    private readonly IValidator<MarkReadInfo> _markReadValidator;
    private readonly IAccountRepository<Account> _accountRepository;

    public NotificationService(
        INotificationRepository<Notification> notificationRepository,
        IValidator<MarkReadInfo> markReadValidator,
        IAccountRepository<Account> accountRepository)
    {
        _notificationRepository = notificationRepository;
        _markReadValidator = markReadValidator;
        _accountRepository = accountRepository;
    }

    public async Task<NotificationPage> ListAsync(long userId, long? beforeId, int? limit)
    {
        var size = limit ?? DEFAULT_LIMIT;
        if (size < 1 || size > MAX_LIMIT)
            throw new ValidationException($"limit deve estar entre 1 e {MAX_LIMIT}.");

        // Busca um item a mais para saber se existe próxima página.
        var notifications = await _notificationRepository.ListAsync(userId, beforeId, size + 1);
        var hasMore = notifications.Count > size;
        var page = notifications.Take(size).ToList();

        // Feature 008: carteiras dos estornos da página, lidas de uma vez (nome da carteira do destinatário).
        var accountIds = page.Where(n => n.Transaction != null)
            .SelectMany(n => new[] { n.Transaction!.SourceAccountId, n.Transaction.DestinationAccountId })
            .Distinct()
            .ToList();
        var accounts = accountIds.Count == 0
            ? new Dictionary<long, Account>()
            : (await _accountRepository.GetByIdsAsync(accountIds)).ToDictionary(a => a.AccountId);

        var items = page.Select(n => ToInfo(n, accounts)).ToList();
        return new NotificationPage
        {
            Items = items,
            NextBeforeId = hasMore ? items[^1].NotificationId : null
        };
    }

    public async Task<UnreadCountResult> CountUnreadAsync(long userId) =>
        new() { Unread = await _notificationRepository.CountUnreadAsync(userId) };

    public async Task MarkReadAsync(long userId, MarkReadInfo info)
    {
        await _markReadValidator.ValidateOrThrowAsync(info);
        // FR-024: o repositório só altera notificações do próprio usuário; as demais são ignoradas.
        await _notificationRepository.MarkReadAsync(userId, info.NotificationIds.Distinct().ToList(), DateTime.UtcNow);
    }

    /// <summary>
    /// O estado do convite vem da navegação (join), nunca de uma cópia gravada na notificação. As permissões
    /// (feature 008) vêm do registro do histórico, não do estado atual do membro.
    /// </summary>
    private static NotificationInfo ToInfo(Notification notification, IReadOnlyDictionary<long, Account> accounts)
    {
        var wallet = notification.Type == NotificationType.TransactionReversed
            ? RecipientWallet(notification, accounts)
            : null;
        return new NotificationInfo
        {
            NotificationId = notification.NotificationId,
            Type = notification.Type.ToString(),
            CreatedAt = notification.CreatedAt,
            IsRead = notification.IsRead,
            Group = notification.Group == null
                ? null
                : new NotificationGroupInfo { GroupId = notification.Group.GroupId, Name = notification.Group.Name },
            Actor = notification.Actor == null
                ? null
                : new UserSummaryInfo
                {
                    UserId = notification.Actor.UserId,
                    FirstName = notification.Actor.FirstName,
                    LastName = notification.Actor.LastName
                },
            Invitation = notification.Invitation == null
                ? null
                : new NotificationInvitationInfo
                {
                    InvitationId = notification.Invitation.GroupInvitationId,
                    Status = notification.Invitation.Status.ToString()
                },
            Permissions = notification.PermissionChange == null
                ? null
                : new MemberPermissionsResult
                {
                    CanCreateTransactions = notification.PermissionChange.AfterCanCreateTransactions,
                    CanReverse = notification.PermissionChange.AfterCanReverse
                },
            TransactionId = notification.TransactionId,
            WalletId = wallet?.AccountId,
            WalletName = wallet?.Name
        };
    }

    /// <summary>Carteira do destinatário entre as do estorno (a de origem primeiro).</summary>
    private static Account? RecipientWallet(Notification notification, IReadOnlyDictionary<long, Account> accounts)
    {
        var transaction = notification.Transaction;
        if (transaction == null)
            return null;
        foreach (var accountId in new[] { transaction.SourceAccountId, transaction.DestinationAccountId })
        {
            if (accounts.TryGetValue(accountId, out var account) && account.IsWallet
                && account.UserId == notification.UserId)
                return account;
        }
        return null;
    }
}
