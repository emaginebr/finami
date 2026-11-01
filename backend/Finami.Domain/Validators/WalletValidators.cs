using Finami.DTO.Transactions;
using Finami.DTO.Wallets;
using FluentValidation;

namespace Finami.Domain.Validators;

public class WalletInsertInfoValidator : AbstractValidator<WalletInsertInfo>
{
    public WalletInsertInfoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nome da carteira é obrigatório.")
            .MaximumLength(120).WithMessage("Nome deve ter no máximo 120 caracteres.");
        RuleFor(x => x.Description).MaximumLength(500).WithMessage("Descrição deve ter no máximo 500 caracteres.");
        RuleFor(x => x.Currency).Must(c => CurrencyCodes.TryParse(c, out _))
            .WithMessage("Moeda inválida. Use \"BRL\" ou \"BTC\".");
    }
}

public class WalletUpdateInfoValidator : AbstractValidator<WalletUpdateInfo>
{
    public WalletUpdateInfoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nome da carteira é obrigatório.")
            .MaximumLength(120).WithMessage("Nome deve ter no máximo 120 caracteres.");
        RuleFor(x => x.Description).MaximumLength(500).WithMessage("Descrição deve ter no máximo 500 caracteres.");
    }
}

public class AmountInfoValidator : AbstractValidator<WalletMovementInfo>
{
    public AmountInfoValidator()
    {
        RuleFor(x => x.WalletId).GreaterThan(0).WithMessage("Carteira é obrigatória.");
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("O valor deve ser maior que zero.");
        RuleFor(x => x.Description).MaximumLength(500).WithMessage("Descrição deve ter no máximo 500 caracteres.");
    }
}
