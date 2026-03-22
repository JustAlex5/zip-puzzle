using Zip.Service.DTOs;

namespace Zip.Service.Services.Interfaces;

public interface IScoreService
{
    Task<LevelLeaderboardDto?> GetLeaderboardAsync(int levelId, CancellationToken ct);
    Task<(bool success, string? error)> SubmitScoreAsync(int userId, SubmitScoreDto dto, CancellationToken ct);
}