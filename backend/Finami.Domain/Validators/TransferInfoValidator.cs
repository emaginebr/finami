using Finami.Domain.Enums;
using Finami.Domain.Services;
using Finami.DTO.Transactions;
using FluentValidation;

namespace Finami.Domain.Validators;

public class TransferInfoValidator : AbstractValidator<TransferInfo>
{
    public const string AMOUNT_REQUIRED_MESSAGE = "Informe o valor em bitcoin ou em reais.";

    public TransferInfoValidator()
    {
        RuleFor(x => x.SourceWalletId).GreaterThan(0).WithMessage("Carteira de origem é obrigatória.");
        RuleFor(x => x.DestinationWalletId).GreaterThan(0).WithMessage("Carteira de destino é obrigatória.");
        RuleFor(x => x.DestinationWalletId).NotEqual(x => x.SourceWalletId)
            .WithMessage("A carteira de origem e a de destino devem ser diferentes.");

        // Exatamente um entre amount e amountBrl (feature 006, R-07).
        RuleFor(x => x).Must(x => x.Amount.HasValue != x.AmountBrl.HasValue)
            .WithName("amount")
            .WithMessage(AMOUNT_REQUIRED_MESSAGE);
        RuleFor(x => x.Amount!.Value).GreaterThan(0).WithName("amount")
            .WithMessage("O valor deve ser maior que zero.")
            .When(x => x.Amount.HasValue);
        RuleFor(x => x.AmountBrl!.Value).GreaterThan(0).WithName("amountBrl")
            .WithMessage("O valor em reais deve ser maior que zero.")
            .When(x => x.AmountBrl.HasValue);
        RuleFor(x => x.AmountBrl!.Value).Must(v => Money.HasValidScale(v, Currency.Brl)).WithName("amountBrl")
            .WithMessage($"O valor em reais deve ter no máximo {Money.BRL_PRECISION} casas decimais.")
            .When(x => x.AmountBrl.HasValue);

        RuleFor(x => x.Description).MaximumLength(500).WithMessage("Descrição deve ter no máximo 500 caracteres.");
    }
}
