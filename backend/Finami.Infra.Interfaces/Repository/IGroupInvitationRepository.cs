namespace Finami.Infra.Interfaces.Repository;

public interface IGroupInvitationRepository<TModel> where TModel : class
{
    Task<TModel?> GetByIdAsync(long invitationId);

    /// <summary>Lê e bloqueia a linha do convite (SELECT ... FOR UPDATE); exige transação aberta.</summary>
    Task<TModel?> GetByIdForUpdateAsync(long invitationId);

    /// <summary>Convite pendente da pessoa na família, se houver.</summary>
    Task<TModel?> GetPendingAsync(long groupId, long userId);

    /// <summary>Convites da família no estado informado (valor do enum), mais recentes primeiro.</summary>
    Task<List<TModel>> ListByGroupAsync(long groupId, int status);

    Task<TModel> InsertAsync(TModel invitation);
    Task<TModel> UpdateAsync(TModel invitation);
}
