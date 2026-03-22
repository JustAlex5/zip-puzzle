using Zip.Service.Models;

namespace Zip.Service.Dal.Interfaces;

public interface IScoreRepository
{
    Task<LevelScore?> GetUserScoreAsync(int levelId, int userId, CancellationToken ct);
    Task<List<LevelScore>> GetTopScoresAsync(int levelId, int count, CancellationToken ct);
    Task UpsertScoreAsync(LevelScore score, CancellationToken ct);
}