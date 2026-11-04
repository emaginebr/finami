using Finami.DTO.Groups;
using FluentValidation;

namespace Finami.Domain.Validators;

/// <summary>Feature 008: corpo do PUT de permissões; as duas permissões são obrigatórias (contracts/api.md).</summary>
public class MemberPermissionsInfoValidator : AbstractValidator<MemberPermissionsInfo>
{
    public const string REQUIRED_MESSAGE = "Informe as duas permissões.";

    public MemberPermissionsInfoValidator()
    {
        // Uma regra só, para a mensagem sair uma vez mesmo com os dois campos ausentes.
        RuleFor(x => x)
            .Must(x => x.CanCreateTransactions.HasValue && x.CanReverse.HasValue)
            .WithName("permissions")
            .WithMessage(REQUIRED_MESSAGE);
    }
}
