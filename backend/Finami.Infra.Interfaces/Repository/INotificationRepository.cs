namespace Finami.Infra.Interfaces.Repository;

public interface INotificationRepository<TModel> where TModel : class
{
    Task<TModel> InsertAsync(TModel notification);

    /// <summary>
    /// Notificações do usuário, da mais recente para a mais antiga, com convite (estado atual),
    /// família, ator, registro do histórico de permissões e lançamento (feature 008) carregados. <paramref name="beforeId"/> é o cursor (exclusivo).
    /// </summary>
    Task<List<TModel>> ListAsync(long userId, long? beforeId, int limit);

    Task<int> CountUnreadAsync(long userId);

    /// <summary>Marca como lidas as notificações informadas que pertencem ao usuário; devolve quantas mudaram.</summary>
    Task<int> MarkReadAsync(long userId, IEnumerable<long> notificationIds, DateTime now);
}
