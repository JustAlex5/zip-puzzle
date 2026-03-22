using Zip.Service.DTOs;

namespace Zip.Service.Services.Interfaces;

public interface ILevelService
{
    Task<List<LevelDto>> GetAllAsync(int? currentUserId, CancellationToken ct);
    Task<LevelDto?> GetByIdAsync(int id, int? currentUserId, CancellationToken ct);
    Task<int> CreateAsync(LevelDto dto, int userId, CancellationToken ct);
    Task<bool> DeleteAsync(int id, int userId, CancellationToken ct);
    Task<LevelDto?> RecordSolveAsync(int levelId, int userId, int timeSeconds, CancellationToken ct);
}
