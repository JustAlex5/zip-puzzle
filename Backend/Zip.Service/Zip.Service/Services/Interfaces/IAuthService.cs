using Zip.Service.DTOs;

namespace Zip.Service.Services.Interfaces;

public interface IAuthService
{
    Task<AuthResponseDto?> RegisterAsync(RegisterDto dto, CancellationToken ct);
    Task<AuthResponseDto?> LoginAsync(LoginDto dto, CancellationToken ct);
}