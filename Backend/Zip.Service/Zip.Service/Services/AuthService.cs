using Zip.Service.Dal.Interfaces;
using Zip.Service.DTOs;
using Zip.Service.Models;
using Zip.Service.Services.Interfaces;

namespace Zip.Service.Services;

public class AuthService(IUserRepository repo, TokenService tokenService, ILogger<AuthService> logger) : IAuthService
{
    public async Task<AuthResponseDto?> RegisterAsync(RegisterDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) || dto.Username.Length < 3)
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 6)
        {
            return null;
        }

        if (await repo.ExistsAsync(dto.Username, ct))
        {
            return null;
        }

        var user = new User
        {
            Username = dto.Username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
        };

        var created = await repo.CreateAsync(user, ct);
        var (token, expiresAt) = tokenService.GenerateToken(created);

        return new AuthResponseDto
        {
            UserId = created.Id,
            Token = token,
            Username = created.Username,
            ExpiresAt = expiresAt,
        };
    }

    public async Task<AuthResponseDto?> LoginAsync(LoginDto dto, CancellationToken ct)
    {
        var user = await repo.GetByUsernameAsync(dto.Username, ct);
        if (user == null)
        {
            return null;
        }

        if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
        {
            return null;
        }

        var (token, expiresAt) = tokenService.GenerateToken(user);

        return new AuthResponseDto
        {
            UserId = user.Id,
            Token = token,
            Username = user.Username,
            ExpiresAt = expiresAt,
        };
    }
}
