using Finami.DTO.Transactions;
using FluentValidation;

namespace Finami.Domain.Validators;

public class TransferInfoValidator : AbstractValidator<TransferInfo>
{
    public TransferInfoValidator()
    {
        RuleFor(x => x.SourceWalletId).GreaterThan(0).WithMessage("Carteira de origem é obrigatória.");
        RuleFor(x => x.DestinationWalletId).GreaterThan(0).WithMessage("Carteira de destino é obrigatória.");
        RuleFor(x => x.DestinationWalletId).NotEqual(x => x.SourceWalletId)
            .WithMessage("A carteira de origem e a de destino devem ser diferentes.");
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("O valor deve ser maior que zero.");
        RuleFor(x => x.Description).MaximumLength(500).WithMessage("Descrição deve ter no máximo 500 caracteres.");
    }
}
