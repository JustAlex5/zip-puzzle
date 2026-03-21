using Microsoft.EntityFrameworkCore;
using Zip.Service.Dal.Interfaces;
using Zip.Service.Data;
using Zip.Service.Models;

namespace Zip.Service.Dal;

public class LevelRepository(AppDbContext ctx,ILogger<LevelRepository> logger) : ILevelRepository
{

    public async Task<List<Level>?> GetAllAsync(CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        try
        {
            return await ctx.Levels.ToListAsync(ct);

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

    public async Task<bool> DeleteAsync(int id, CancellationToken ct)
    {
        try
        {
            var deleted = await ctx.Levels
                .Where(l => l.Id == id)
                .ExecuteDeleteAsync(ct);

            return deleted > 0;
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error deleting level from database. LevelId={LevelId}", id);
            throw;
        }
    }

    public async Task<Level?> IncrementSolveCountAsync(int id, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        try
        {
            var updated = await ctx.Levels
                .Where(l => l.Id == id)
                .ExecuteUpdateAsync(s => 
                    s.SetProperty(l => l.SolveCount, l => l.SolveCount + 1), ct);

            if (updated == 0)
                return null;

            return await GetByIdAsync(id, ct);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error incrementing solve count. LevelId={LevelId}", id);
            throw;
        }
    }
}