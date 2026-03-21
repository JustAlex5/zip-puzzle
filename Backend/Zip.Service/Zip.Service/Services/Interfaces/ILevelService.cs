using Zip.Service.DTOs;

namespace Zip.Service.Services.Interfaces;

public interface ILevelService
{
    Task<List<LevelDto>> GetAllAsync(CancellationToken ct);
    Task<LevelDto?> GetByIdAsync(int id, CancellationToken ct);
    Task<int> CreateAsync(LevelDto dto, CancellationToken ct);
    Task<bool> DeleteAsync(int id, CancellationToken ct);
    Task<LevelDto?> IncrementSolveCountAsync(int id, CancellationToken ct);
}