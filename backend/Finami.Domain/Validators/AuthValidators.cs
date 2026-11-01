using Finami.DTO.Auth;
using FluentValidation;

namespace Finami.Domain.Validators;

public class RegisterInfoValidator : AbstractValidator<RegisterInfo>
{
    public RegisterInfoValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().WithMessage("Nome é obrigatório.")
            .MaximumLength(120).WithMessage("Nome deve ter no máximo 120 caracteres.");
        RuleFor(x => x.LastName).NotEmpty().WithMessage("Sobrenome é obrigatório.")
            .MaximumLength(120).WithMessage("Sobrenome deve ter no máximo 120 caracteres.");
        RuleFor(x => x.Email).NotEmpty().WithMessage("Email é obrigatório.")
            .EmailAddress().WithMessage("Email inválido.")
            .MaximumLength(254).WithMessage("Email deve ter no máximo 254 caracteres.");
        RuleFor(x => x.Password).NotEmpty().WithMessage("Senha é obrigatória.")
            .MinimumLength(ValidationRules.MIN_PASSWORD_LENGTH)
            .WithMessage($"Senha deve ter no mínimo {ValidationRules.MIN_PASSWORD_LENGTH} caracteres.");
    }
}

public class LoginInfoValidator : AbstractValidator<LoginInfo>
{
    public LoginInfoValidator()
    {
        RuleFor(x => x.Email).NotEmpty().WithMessage("Email é obrigatório.");
        RuleFor(x => x.Password).NotEmpty().WithMessage("Senha é obrigatória.");
    }
}

public class GoogleLoginInfoValidator : AbstractValidator<GoogleLoginInfo>
{
    public GoogleLoginInfoValidator()
    {
        RuleFor(x => x.IdToken).NotEmpty().WithMessage("Token do Google é obrigatório.");
    }
}
