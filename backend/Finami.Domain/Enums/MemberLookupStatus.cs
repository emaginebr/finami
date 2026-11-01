namespace Finami.Domain.Enums;

/// <summary>Resultado da verificação de email no fluxo "Adicionar membro" (research R-01).</summary>
public enum MemberLookupStatus
{
    /// <summary>Email não cadastrado: criar a pessoa e incluí-la.</summary>
    Available = 1,

    /// <summary>Email de uma pessoa cadastrada que não é membro: oferecer convite.</summary>
    Registered = 2,

    /// <summary>A pessoa já é membro da família (inclusive o responsável).</summary>
    AlreadyMember = 3,

    /// <summary>Já existe convite pendente para a pessoa nesta família.</summary>
    PendingInvite = 4
}
