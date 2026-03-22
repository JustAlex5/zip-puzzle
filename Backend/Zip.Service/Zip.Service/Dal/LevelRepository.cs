using Microsoft.EntityFrameworkCore;
using Zip.Service.Dal.Interfaces;
using Zip.Service.Data;
using Zip.Service.Models;

namespace Zip.Service.Dal;

public class LevelRepository(AppDbContext ctx, ILogger<LevelRepository> logger) : ILevelRepository
{
    public async Task<List<Level>?> GetAllAsync(CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        try
        {
            return await ctx.Levels.AsNoTracking()
                .Include(l => l.User)
                .Include(l => l.Numbers)
                .Include(l => l.Barriers)
                .ToListAsync(ct);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error fetching levels from database");
            throw;
        }
    }

    public async Task<Level?> GetByIdAsync(int id, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        try
        {
            return await ctx.Levels
                .AsNoTracking()
                .Include(l => l.User)
                .Include(l => l.Numbers)
                .Include(l => l.Barriers)
                .FirstOrDefaultAsync(l => l.Id == id, ct);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error fetching level from database. LevelId={LevelId}", id);
            throw;
        }
    }

    public async Task<Level> CreateAsync(Level level, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        try
        {
            var entry = await ctx.Levels.AddAsync(level, ct);
            await ctx.SaveChangesAsync(ct);
            return entry.Entity;
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error creating level in database. LevelName={LevelName}", level.Name);
            throw;
        }
    }

    public async Task<bool> DeleteAsync(int id, int userId, CancellationToken ct)
    {
        try
        {
            var deleted = await ctx.Levels
                .Where(l => l.Id == id && l.UserId == userId)
                .ExecuteDeleteAsync(ct);

            return deleted > 0;
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error deleting level from database. LevelId={LevelId}", id);
            throw;
        }
    }

    public async Task<Level?> RecordSolveAsync(int levelId, int userId, int timeSeconds, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        await using var tx = await ctx.Database.BeginTransactionAsync(ct);
        try
        {
            var levelExists = await ctx.Levels.AnyAsync(l => l.Id == levelId, ct);
            if (!levelExists)
            {
                await tx.RollbackAsync(ct);
                return null;
            }

            var existing = await ctx.LevelScores
                .FirstOrDefaultAsync(s => s.LevelId == levelId && s.UserId == userId, ct);

            if (existing == null)
            {
                ctx.LevelScores.Add(new LevelScore
                {
                    LevelId = levelId,
                    UserId = userId,
                    TimeSeconds = timeSeconds,
                });
            }
            else if (timeSeconds < existing.TimeSeconds)
            {
                existing.TimeSeconds = timeSeconds;
                existing.SolvedAt = DateTime.UtcNow;
            }

            await ctx.SaveChangesAsync(ct);

            await ctx.Levels
                .Where(l => l.Id == levelId)
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.SolveCount, l => l.SolveCount + 1), ct);

            await tx.CommitAsync(ct);
        }
        catch (Exception e)
        {
            await tx.RollbackAsync(ct);
            logger.LogError(e, "Error recording solve. LevelId={LevelId} UserId={UserId}", levelId, userId);
            throw;
        }

        return await GetByIdAsync(levelId, ct);
    }

    public async Task<int?> GetBestTimeSecondsAsync(int levelId, int userId, CancellationToken ct)
    {
        var score = await ctx.LevelScores.AsNoTracking()
            .FirstOrDefaultAsync(s => s.LevelId == levelId && s.UserId == userId, ct);
        return score?.TimeSeconds;
    }
}
