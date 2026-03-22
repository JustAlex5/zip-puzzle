using Microsoft.EntityFrameworkCore;
using Zip.Service.Dal.Interfaces;
using Zip.Service.Data;
using Zip.Service.Models;

namespace Zip.Service.Dal;

public class UserRepository(AppDbContext ctx , ILogger<UserRepository> logger) : IUserRepository
{
    public async Task<User?> GetByUsernameAsync(string username, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        try
        {
            return await ctx.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower(), ct);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error fetching user from database. Username={Username}", username);
            throw;
        }
    }

    public async Task<bool> ExistsAsync(string username, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        try
        {
            return await ctx.Users.AsNoTracking()
                .AnyAsync(u => u.Username.ToLower() == username.ToLower(), ct);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error checking if user exists in database. Username={Username}", username);
            throw;
        }
    }

    public async Task<User> CreateAsync(User user, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        try
        {
            var entry = await ctx.Users.AddAsync(user, ct);
            await ctx.SaveChangesAsync(ct);
            return entry.Entity;
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error creating user in database. Username={Username}", user.Username);
            throw;
        }
    }
}