using Finami.DTO.Groups;
using Finami.DTO.Users;
using FluentValidation;

namespace Finami.Domain.Validators;

public class GroupInsertInfoValidator : AbstractValidator<GroupInsertInfo>
{
    public GroupInsertInfoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nome do grupo é obrigatório.")
            .MaximumLength(120).WithMessage("Nome deve ter no máximo 120 caracteres.");
    }
}

public class GroupUpdateInfoValidator : AbstractValidator<GroupUpdateInfo>
{
    public static readonly string[] VISIBILITIES = { "ResponsibleOnly", "AllMembers", "MembersSummary" };

    public GroupUpdateInfoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nome do grupo não pode ser vazio.")
            .MaximumLength(120).WithMessage("Nome deve ter no máximo 120 caracteres.")
            .When(x => x.Name != null);
        RuleFor(x => x.StatementVisibility)
            .Must(v => VISIBILITIES.Contains(v, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Visibilidade inválida. Use ResponsibleOnly, AllMembers ou MembersSummary.")
            .When(x => x.StatementVisibility != null);
    }
}

public class UserInsertInfoValidator : AbstractValidator<UserInsertInfo>
{
    public UserInsertInfoValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().WithMessage("Nome é obrigatório.")
            .MaximumLength(120).WithMessage("Nome deve ter no máximo 120 caracteres.");
        RuleFor(x => x.LastName).NotEmpty().WithMessage("Sobrenome é obrigatório.")
            .MaximumLength(120).WithMessage("Sobrenome deve ter no máximo 120 caracteres.");
        RuleFor(x => x.Email).EmailAddress().WithMessage("Email inválido.")
            .MaximumLength(254).WithMessage("Email deve ter no máximo 254 caracteres.")
            .When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Email).NotEmpty().WithMessage("Para definir senha é necessário informar o email.")
            .When(x => !string.IsNullOrEmpty(x.Password));
        RuleFor(x => x.Password).MinimumLength(ValidationRules.MIN_PASSWORD_LENGTH)
            .WithMessage($"Senha deve ter no mínimo {ValidationRules.MIN_PASSWORD_LENGTH} caracteres.")
            .When(x => !string.IsNullOrEmpty(x.Password));
    }
}

public class UserUpdateInfoValidator : AbstractValidator<UserUpdateInfo>
{
    public UserUpdateInfoValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().WithMessage("Nome é obrigatório.")
            .MaximumLength(120).WithMessage("Nome deve ter no máximo 120 caracteres.");
        RuleFor(x => x.LastName).NotEmpty().WithMessage("Sobrenome é obrigatório.")
            .MaximumLength(120).WithMessage("Sobrenome deve ter no máximo 120 caracteres.");
        RuleFor(x => x.Email).EmailAddress().WithMessage("Email inválido.")
            .MaximumLength(254).WithMessage("Email deve ter no máximo 254 caracteres.")
            .When(x => !string.IsNullOrWhiteSpace(x.Email));
    }
}

public class PasswordUpdateInfoValidator : AbstractValidator<PasswordUpdateInfo>
{
    public PasswordUpdateInfoValidator()
    {
        RuleFor(x => x.NewPassword).NotEmpty().WithMessage("Nova senha é obrigatória.")
            .MinimumLength(ValidationRules.MIN_PASSWORD_LENGTH)
            .WithMessage($"Senha deve ter no mínimo {ValidationRules.MIN_PASSWORD_LENGTH} caracteres.");
    }
}
