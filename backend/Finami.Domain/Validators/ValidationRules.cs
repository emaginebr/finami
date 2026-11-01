using FluentValidation;
using DomainValidationException = Finami.Domain.Exceptions.ValidationException;

namespace Finami.Domain.Validators;

public static class ValidationRules
{
    public const int MIN_PASSWORD_LENGTH = 8;

    /// <summary>Valida e lança a ValidationException de domínio (400) com a lista de erros.</summary>
    public static async Task ValidateOrThrowAsync<T>(this IValidator<T> validator, T instance)
    {
        if (instance == null)
            throw new DomainValidationException("Requisição inválida.");
        var result = await validator.ValidateAsync(instance);
        if (!result.IsValid)
            throw new DomainValidationException("Dados inválidos.", result.Errors.Select(e => e.ErrorMessage));
    }
}
