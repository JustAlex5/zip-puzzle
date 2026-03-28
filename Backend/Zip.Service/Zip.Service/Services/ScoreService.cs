using AutoMapper;
using Zip.Service.Dal.Interfaces;
using Zip.Service.DTOs;
using Zip.Service.Models;
using Zip.Service.Services.Interfaces;

namespace Zip.Service.Services;

public class ScoreService( 
    IScoreRepository scoreRepo,
    ILevelRepository levelRepo,
    IMapper mapper,
    ILogger<ScoreService> logger) : IScoreService
{
    public async Task<LevelLeaderboardDto?> GetLeaderboardAsync(int levelId, CancellationToken ct)
    {
        var level = await levelRepo.GetByIdAsync(levelId, ct);
        if (level is null) return null;

        var topScores = await scoreRepo.GetTopScoresAsync(levelId, 10, ct);

        return new LevelLeaderboardDto
        {
            LevelId = levelId,
            LevelName = level.Name,
            TopScores = topScores.Select((s, i) => new LeaderboardEntryDto
            {
                Username = s.User.Username,
                TimeSeconds = s.TimeSeconds,
                SolvedAt = s.SolvedAt,
                Rank = i + 1
            }).ToList()
        };
    }

    public async Task<(bool, string?)> SubmitScoreAsync(int userId, SubmitScoreDto dto, CancellationToken ct)
    {
        if (dto.TimeSeconds <= 0)
            return (false, "Invalid time.");

        var level = await levelRepo.GetByIdAsync(dto.LevelId, ct);
        if (level is null)
            return (false, "Level not found.");

        await scoreRepo.UpsertScoreAsync(new LevelScore
        {
            LevelId = dto.LevelId,
            UserId = userId,
            TimeSeconds = dto.TimeSeconds
        }, ct);

        return (true, null);
    }
}