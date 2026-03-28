using Microsoft.EntityFrameworkCore;
using Zip.Service.Dal.Interfaces;
using Zip.Service.Data;
using Zip.Service.Models;

namespace Zip.Service.Dal;

public class ScoreRepository(AppDbContext ctx, ILogger<ScoreRepository> logger):IScoreRepository
{
     public async Task<LevelScore?> GetUserScoreAsync(int levelId, int userId, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        try
        {
            return await ctx.LevelScores
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.LevelId == levelId && s.UserId == userId, ct);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error fetching user score. LevelId={LevelId} UserId={UserId}", levelId, userId);
            throw;
        }
    }

    public async Task<List<LevelScore>> GetTopScoresAsync(int levelId, int count, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        try
        {
            return await ctx.LevelScores
                .Include(s => s.User)
                .Where(s => s.LevelId == levelId)
                .OrderBy(s => s.TimeSeconds)
                .Take(count)
                .AsNoTracking()
                .ToListAsync(ct);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error fetching leaderboard. LevelId={LevelId}", levelId);
            throw;
        }
    }

    public async Task UpsertScoreAsync(LevelScore score, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        try
        {
            var existing = await ctx.LevelScores
                .FirstOrDefaultAsync(s => s.LevelId == score.LevelId && s.UserId == score.UserId, ct);

            if (existing is null)
            {
                await ctx.LevelScores.AddAsync(score, ct);
            }
            else if (score.TimeSeconds < existing.TimeSeconds)
            {
                // only update if it's a better time
                existing.TimeSeconds = score.TimeSeconds;
                existing.SolvedAt = score.SolvedAt;
            }

            await ctx.SaveChangesAsync(ct);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error upserting score. LevelId={LevelId} UserId={UserId}", score.LevelId, score.UserId);
            throw;
        }
    }
}