using Zip.Service.DTOs;
using Zip.Service.Models;

namespace Zip.Service.Dal.Interfaces;

public interface ILevelRepository
{
    Task<List<Level>?>GetAllAsync(CancellationToken ct);
    Task<Level?> GetByIdAsync(int id, CancellationToken ct);
    Task<Level> CreateAsync(Level level, CancellationToken ct);
    Task<bool> DeleteAsync(int id, CancellationToken ct);
    Task<Level> IncrementSolveCountAsync(int id, CancellationToken ct);
}