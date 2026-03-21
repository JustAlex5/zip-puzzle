using AutoMapper;
using Zip.Service.Dal.Interfaces;
using Zip.Service.DTOs;
using Zip.Service.Services.Interfaces;

namespace Zip.Service.Services;

public class LevelService(ILevelRepository repository, ILogger<LevelService> logger,IMapper mapper) :ILevelService
{
    
    public async Task<List<LevelDto>> GetAllAsync(CancellationToken ct)
    {
        var levels = await repository.GetAllAsync(ct);
        return mapper.Map<List<LevelDto>>(levels);
    }

    public async Task<LevelDto?> GetByIdAsync(int id, CancellationToken ct)
    {
        var level = await repository.GetByIdAsync(id, ct);
        return level is null ? null : mapper.Map<LevelDto>(level);
    }

    public async Task<int> CreateAsync(LevelDto dto, CancellationToken ct)
    {
        var newLevel = mapper.Map<Models.Level>(dto);
        if(!LevelValidator.IsSolvable(newLevel))
            throw new ArgumentException($"Level {newLevel.Name} is not solvable");
        var createdLevel = await repository.CreateAsync(newLevel,  ct);
        return createdLevel.Id;
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct)
    {
        return await repository.DeleteAsync(id, ct);
    }

    public async Task<LevelDto?> IncrementSolveCountAsync(int id, CancellationToken ct)
    {
        var incrementedLevel = await repository.IncrementSolveCountAsync(id, ct);
        return incrementedLevel is null ? null : mapper.Map<LevelDto>(incrementedLevel);
    }
}