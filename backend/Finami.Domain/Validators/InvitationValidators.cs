using Finami.DTO.Invitations;
using Finami.DTO.Notifications;
using FluentValidation;

namespace Finami.Domain.Validators;

/// <summary>Regras de email do fluxo de adicionar/convidar: validam o valor sem espaços nas pontas.</summary>
internal static class InvitationEmailRules
{
    public const int MAX_EMAIL_LENGTH = 254;

    /// <summary>Formato e tamanho do email sem espaços nas pontas (formato como o EmailAddress() do FluentValidation).</summary>
    public static IRuleBuilderOptions<T, string?> ValidEmail<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(e => HasEmailFormat(Trimmed(e))).WithMessage("Email inválido.")
            .Must(e => Trimmed(e).Length <= MAX_EMAIL_LENGTH)
            .WithMessage($"Email deve ter no máximo {MAX_EMAIL_LENGTH} caracteres.");

    public static IRuleBuilderOptions<T, string?> RequiredEmail<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(e => !string.IsNullOrWhiteSpace(e)).WithMessage("Email é obrigatório.")
            .ValidEmail();

    private static string Trimmed(string? email) => (email ?? string.Empty).Trim();

    private static bool HasEmailFormat(string email)
    {
        var at = email.IndexOf('@');
        return at > 0 && at != email.Length - 1 && at == email.LastIndexOf('@') && !email.Any(char.IsWhiteSpace);
    }
}

public class MemberLookupInfoValidator : AbstractValidator<MemberLookupInfo>
{
    public MemberLookupInfoValidator()
    {
        RuleFor(x => x.Email).Cascade(CascadeMode.Stop).RequiredEmail();
    }
}

public class GroupInvitationInsertInfoValidator : AbstractValidator<GroupInvitationInsertInfo>
{
    public GroupInvitationInsertInfoValidator()
    {
        RuleFor(x => x.Email).Cascade(CascadeMode.Stop).RequiredEmail();
    }
}

/// <summary>Mesmas regras do cadastro de usuário: nome/sobrenome até 120 e email opcional.</summary>
public class NewMemberInfoValidator : AbstractValidator<NewMemberInfo>
{
    public NewMemberInfoValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().WithMessage("Nome é obrigatório.")
            .MaximumLength(120).WithMessage("Nome deve ter no máximo 120 caracteres.");
        RuleFor(x => x.LastName).NotEmpty().WithMessage("Sobrenome é obrigatório.")
            .MaximumLength(120).WithMessage("Sobrenome deve ter no máximo 120 caracteres.");
        RuleFor(x => x.Email).Cascade(CascadeMode.Stop).ValidEmail()
            .When(x => !string.IsNullOrWhiteSpace(x.Email));
    }
}

public class MarkReadInfoValidator : AbstractValidator<MarkReadInfo>
{
    public const int MAX_IDS = 100;

    public MarkReadInfoValidator()
    {
        RuleFor(x => x.NotificationIds)
            .Must(ids => ids != null && ids.Count >= 1 && ids.Count <= MAX_IDS)
            .WithMessage($"Informe de 1 a {MAX_IDS} notificações.");
    }
}
