using Finami.Domain.Exceptions;

namespace Finami.Domain.Models;

public class User
{
    public long UserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? PasswordHash { get; set; }
    public string? GoogleSubject { get; set; }
    public long? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    /// <summary>FR-004: só pode se autenticar quem tem ao menos o email preenchido.</summary>
    public bool CanLogin => !string.IsNullOrWhiteSpace(Email);

    public bool HasPassword => !string.IsNullOrEmpty(PasswordHash);

    public bool HasGoogle => !string.IsNullOrEmpty(GoogleSubject);

    public string FullName => $"{FirstName} {LastName}".Trim();

    public static string? NormalizeEmail(string? email) =>
        string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();

    public void SetEmail(string? email)
    {
        Email = NormalizeEmail(email);
        Touch();
    }

    public void LinkGoogle(string subject)
    {
        if (string.IsNullOrWhiteSpace(subject))
            throw new ValidationException("Identificador do Google inválido.");
        GoogleSubject = subject;
        Touch();
    }

    public void UpdateName(string firstName, string lastName)
    {
        if (string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName))
            throw new ValidationException("Nome e sobrenome são obrigatórios.");
        FirstName = firstName.Trim();
        LastName = lastName.Trim();
        Touch();
    }

    public void SetPasswordHash(string hash)
    {
        PasswordHash = hash;
        Touch();
    }

    private void Touch() => UpdatedAt = DateTime.UtcNow;
}
