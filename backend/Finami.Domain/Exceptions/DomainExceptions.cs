namespace Finami.Domain.Exceptions;

public abstract class DomainException : Exception
{
    protected DomainException(string message, IEnumerable<string>? errors = null) : base(message)
    {
        Errors = errors?.ToList() ?? new List<string>();
    }

    public List<string> Errors { get; }
}

public class ValidationException : DomainException
{
    public ValidationException(string message, IEnumerable<string>? errors = null) : base(message, errors) { }
}

public class UnauthorizedException : DomainException
{
    public UnauthorizedException(string message = "Não autenticado.") : base(message) { }
}

public class ForbiddenException : DomainException
{
    public ForbiddenException(string message = "Você não tem permissão para esta operação.") : base(message) { }
}

public class NotFoundException : DomainException
{
    public NotFoundException(string message) : base(message) { }
}

public class ConflictException : DomainException
{
    public ConflictException(string message) : base(message) { }
}

public class BusinessRuleException : DomainException
{
    public BusinessRuleException(string message) : base(message) { }
}

public class QuoteUnavailableException : DomainException
{
    public QuoteUnavailableException(string message = "Cotação do bitcoin indisponível no momento.") : base(message) { }
}
