using Zip.Service.Models;

namespace Zip.Service.Dal.Interfaces;

public interface ILevelRepository
{
    Task<List<Level>?> GetAllAsync(CancellationToken ct);
    Task<Level?> GetByIdAsync(int id, CancellationToken ct);
    Task<Level> CreateAsync(Level level, CancellationToken ct);
    Task<bool> DeleteAsync(int id, int userId, CancellationToken ct);
    Task<Level?> RecordSolveAsync(int levelId, int userId, int timeSeconds, CancellationToken ct);
    Task<int?> GetBestTimeSecondsAsync(int levelId, int userId, CancellationToken ct);
}
