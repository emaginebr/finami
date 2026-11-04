namespace Finami.Infra.Interfaces.Repository;

public interface IGroupRepository<TModel> where TModel : class
{
    /// <summary>Grupo com membros.</summary>
    Task<TModel?> GetByIdAsync(long groupId);

    /// <summary>Grupos (com membros) dos quais o usuário é membro ou responsável.</summary>
    Task<List<TModel>> ListByMemberAsync(long userId);

    Task<List<long>> ListResponsibleGroupIdsAsync(long userId);
    Task<long?> GetResponsibleUserIdAsync(long groupId);
    Task<bool> IsMemberAsync(long groupId, long userId);
    Task<bool> ShareGroupAsync(long userId, long otherUserId);
    Task<TModel> InsertAsync(TModel group);
    Task<TModel> UpdateAsync(TModel group);
    Task AddMemberAsync(long groupId, long userId);
    Task RemoveMemberAsync(long groupId, long userId);

    /// <summary>
    /// Feature 008 (R-02): grava um registro do histórico de permissões (só inserção). O id gerado fica no próprio
    /// objeto, para a notificação apontar para ele.
    /// </summary>
    Task InsertPermissionChangeAsync<TChange>(TChange change) where TChange : class;
}
