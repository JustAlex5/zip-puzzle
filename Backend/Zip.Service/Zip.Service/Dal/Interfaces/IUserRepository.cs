using Zip.Service.Models;

namespace Zip.Service.Dal.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByUsernameAsync(string username, CancellationToken ct);
    Task<bool> ExistsAsync(string username, CancellationToken ct);
    Task<User> CreateAsync(User user, CancellationToken ct);
}