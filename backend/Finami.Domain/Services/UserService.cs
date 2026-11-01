using Finami.Domain.Exceptions;
using Finami.Domain.Interfaces;
using Finami.Domain.Models;
using Finami.Domain.Validators;
using Finami.DTO.Users;
using Finami.Infra.Interfaces.Repository;
using FluentValidation;
using Microsoft.AspNetCore.Identity;
using ValidationException = Finami.Domain.Exceptions.ValidationException;

namespace Finami.Domain.Services;

public class UserService : IUserService
{
    private readonly IUserRepository<User> _userRepository;
    private readonly IAccessPolicy _accessPolicy;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly IValidator<UserInsertInfo> _insertValidator;
    private readonly IValidator<UserUpdateInfo> _updateValidator;
    private readonly IValidator<PasswordUpdateInfo> _passwordValidator;

    public UserService(
        IUserRepository<User> userRepository,
        IAccessPolicy accessPolicy,
        IPasswordHasher<User> passwordHasher,
        IValidator<UserInsertInfo> insertValidator,
        IValidator<UserUpdateInfo> updateValidator,
        IValidator<PasswordUpdateInfo> passwordValidator)
    {
        _userRepository = userRepository;
        _accessPolicy = accessPolicy;
        _passwordHasher = passwordHasher;
        _insertValidator = insertValidator;
        _updateValidator = updateValidator;
        _passwordValidator = passwordValidator;
    }

    public async Task<UserInfo> CreateAsync(long userId, UserInsertInfo info)
    {
        await _insertValidator.ValidateOrThrowAsync(info);
        if (!string.IsNullOrWhiteSpace(info.Email) && await _userRepository.ExistsEmailAsync(info.Email))
            throw new ConflictException("Este email já está em uso.");

        var user = new User { CreatedByUserId = userId };
        user.UpdateName(info.FirstName, info.LastName);
        user.SetEmail(info.Email);
        if (!string.IsNullOrEmpty(info.Password))
            user.SetPasswordHash(_passwordHasher.HashPassword(user, info.Password));
        user.UpdatedAt = null;

        await _userRepository.InsertAsync(user);
        return user.ToInfo();
    }

    public async Task<UserInfo> GetAsync(long userId, long targetUserId)
    {
        var target = await LoadAsync(targetUserId);
        if (!await _accessPolicy.CanViewUserAsync(userId, target))
            throw new ForbiddenException("Você não tem permissão para ver este usuário.");
        return target.ToInfo();
    }

    public async Task<UserInfo> UpdateAsync(long userId, long targetUserId, UserUpdateInfo info)
    {
        await _updateValidator.ValidateOrThrowAsync(info);
        var target = await LoadAsync(targetUserId);
        _accessPolicy.EnsureCanEditUserProfile(userId, target);

        var newEmail = User.NormalizeEmail(info.Email);
        if (newEmail != null && newEmail != target.Email && await _userRepository.ExistsEmailAsync(newEmail, target.UserId))
            throw new ConflictException("Este email já está em uso.");
        if (newEmail == null && target.HasGoogle)
            throw new BusinessRuleException("Usuários vinculados ao Google precisam manter um email.");

        target.UpdateName(info.FirstName, info.LastName);
        target.SetEmail(newEmail);
        await _userRepository.UpdateAsync(target);
        return target.ToInfo();
    }

    public async Task ChangePasswordAsync(long userId, long targetUserId, PasswordUpdateInfo info)
    {
        await _passwordValidator.ValidateOrThrowAsync(info);
        var target = await LoadAsync(targetUserId);
        _accessPolicy.EnsureCanEditUserProfile(userId, target);

        if (!target.CanLogin)
            throw new BusinessRuleException("Cadastre um email antes de definir a senha.");

        // Quem troca a própria senha precisa informar a atual (se já tiver uma).
        if (target.UserId == userId && target.HasPassword)
        {
            if (string.IsNullOrEmpty(info.CurrentPassword)
                || _passwordHasher.VerifyHashedPassword(target, target.PasswordHash!, info.CurrentPassword)
                == PasswordVerificationResult.Failed)
                throw new ValidationException("Senha atual incorreta.");
        }

        target.SetPasswordHash(_passwordHasher.HashPassword(target, info.NewPassword));
        await _userRepository.UpdateAsync(target);
    }

    public async Task<List<UserInfo>> ListCreatedByMeAsync(long userId) =>
        (await _userRepository.ListCreatedByAsync(userId)).Select(u => u.ToInfo()).ToList();

    public async Task<UserSummaryInfo> SearchByEmailAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ValidationException("Informe o email.");
        var user = await _userRepository.GetByEmailAsync(email)
            ?? throw new NotFoundException("Usuário não encontrado.");
        return new UserSummaryInfo { UserId = user.UserId, FirstName = user.FirstName, LastName = user.LastName };
    }

    private async Task<User> LoadAsync(long userId) =>
        await _userRepository.GetByIdAsync(userId) ?? throw new NotFoundException("Usuário não encontrado.");
}
