using AutoMapper;
using Zip.Service.Dal.Interfaces;
using Zip.Service.DTOs;
using Zip.Service.Services.Interfaces;

namespace Zip.Service.Services;

public class LevelService(ILevelRepository repository, ILogger<LevelService> logger, IMapper mapper)
    : ILevelService
{
    public async Task<List<LevelDto>> GetAllAsync(int? currentUserId, CancellationToken ct)
    {
        var levels = await repository.GetAllAsync(ct);
        var list = mapper.Map<List<LevelDto>>(levels);
        if (currentUserId.HasValue)
        {
            foreach (var dto in list)
            {
                dto.MyBestTimeSeconds = await repository.GetBestTimeSecondsAsync(dto.Id, currentUserId.Value, ct);
            }
        }

        return list;
    }

    public async Task<LevelDto?> GetByIdAsync(int id, int? currentUserId, CancellationToken ct)
    {
        var level = await repository.GetByIdAsync(id, ct);
        if (level is null)
        {
            return null;
        }

        var dto = mapper.Map<LevelDto>(level);
        if (currentUserId.HasValue)
        {
            dto.MyBestTimeSeconds = await repository.GetBestTimeSecondsAsync(id, currentUserId.Value, ct);
        }

        return dto;
    }

    public async Task<int> CreateAsync(LevelDto dto, int userId, CancellationToken ct)
    {
        var newLevel = mapper.Map<Models.Level>(dto);
        newLevel.UserId = userId;
        if (!LevelValidator.IsSolvable(newLevel))
        {
            throw new ArgumentException($"Level {newLevel.Name} is not solvable");
        }

        var createdLevel = await repository.CreateAsync(newLevel, ct);
        return createdLevel.Id;
    }

    public async Task<bool> DeleteAsync(int id, int userId, CancellationToken ct)
    {
        return await repository.DeleteAsync(id, userId, ct);
    }

    public async Task<LevelDto?> RecordSolveAsync(int levelId, int userId, int timeSeconds, CancellationToken ct)
    {
        var level = await repository.RecordSolveAsync(levelId, userId, timeSeconds, ct);
        if (level is null)
        {
            return null;
        }

        return await GetByIdAsync(levelId, userId, ct);
    }
}
