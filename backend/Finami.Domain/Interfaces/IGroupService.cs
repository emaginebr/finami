using Finami.DTO.Groups;
using Finami.DTO.Invitations;

namespace Finami.Domain.Interfaces;

public interface IGroupService
{
    Task<GroupInfo> CreateAsync(long userId, GroupInsertInfo info);
    Task<List<GroupInfo>> ListMineAsync(long userId);
    Task<GroupInfo> GetAsync(long userId, long groupId);
    Task<GroupInfo> UpdateAsync(long userId, long groupId, GroupUpdateInfo info);
    Task<GroupInfo> AddMemberAsync(long userId, long groupId, AddMemberInfo info);
    Task<GroupInfo> RemoveMemberAsync(long userId, long groupId, long memberUserId);

    /// <summary>Verifica o email no fluxo "Adicionar membro" (apenas o responsável).</summary>
    Task<MemberLookupResult> LookupMemberAsync(long userId, long groupId, MemberLookupInfo info);

    /// <summary>Cria a pessoa (com ou sem email) e a inclui na família na mesma transação.</summary>
    Task<GroupInfo> CreateMemberAsync(long userId, long groupId, NewMemberInfo info);

    /// <summary>
    /// Feature 008: muda "Pode lançar" e "Pode estornar" de um membro (apenas o responsável). Com mudança, grava o
    /// histórico e notifica o membro; sem mudança, só devolve a família.
    /// </summary>
    Task<GroupInfo> SetMemberPermissionsAsync(long userId, long groupId, long memberUserId, MemberPermissionsInfo info);
}
