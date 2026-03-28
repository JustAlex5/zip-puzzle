using System.Text.Json;
using StackExchange.Redis;
using Zip.Service.Models;
using Zip.Service.Models.Enums;
using Zip.Service.Services.Interfaces;

namespace Zip.Service.Services;

public class RoomService(
    IConnectionMultiplexer redis,
    ILogger<RoomService> logger): IRoomService
{
     private readonly IDatabase _db = redis.GetDatabase();
    private const int RoomTtlMinutes = 30;

    public async Task<GameRoom> CreateRoomAsync(int levelId, QueueEntry playerA, QueueEntry playerB)
    {
        var code = GenerateCode();
        var room = new GameRoom
        {
            Code = code,
            LevelId = levelId,
            State = RoomState.Waiting,
            PlayerA = new RoomPlayer
            {
                UserId = playerA.UserId,
                Username = playerA.Username,
                ConnectionId = playerA.ConnectionId
            },
            PlayerB = new RoomPlayer
            {
                UserId = playerB.UserId,
                Username = playerB.Username,
                ConnectionId = playerB.ConnectionId
            }
        };
        await SaveRoomAsync(room);
        return room;
    }

    public async Task<GameRoom?> GetRoomAsync(string code)
    {
        var json = await _db.StringGetAsync($"room:{code}");
        return json.IsNull ? null : JsonSerializer.Deserialize<GameRoom>(json!);
    }

    public async Task<GameRoom?> GetRoomByConnectionAsync(string connectionId)
    {
        var key = await _db.StringGetAsync($"conn:{connectionId}");
        return key.IsNull ? null : await GetRoomAsync(key!);
    }

    public async Task UpdateRoomAsync(GameRoom room) => await SaveRoomAsync(room);

    public async Task RemoveRoomAsync(string code)
    {
        var room = await GetRoomAsync(code);
        if (room is null) return;
        await _db.KeyDeleteAsync($"room:{code}");
        if (room.PlayerA is not null)
            await _db.KeyDeleteAsync($"conn:{room.PlayerA.ConnectionId}");
        if (room.PlayerB is not null)
            await _db.KeyDeleteAsync($"conn:{room.PlayerB.ConnectionId}");
    }

    public async Task<SolveResult?> RecordSolveAsync(string code, int userId, int timeSeconds)
    {
        var room = await GetRoomAsync(code);
        if (room is null) return null;

        if (room.PlayerA?.UserId != userId && room.PlayerB?.UserId != userId)
            return null;

        var player = room.PlayerA!.UserId == userId ? room.PlayerA : room.PlayerB;
        if (player is null || player.Solved) return null;

        var isFirst = !room.PlayerA!.Solved && !(room.PlayerB?.Solved ?? false);
        player.Solved = true;
        player.TimeSeconds = timeSeconds;

        if (room.PlayerA.Solved && (room.PlayerB?.Solved ?? false))
            room.State = RoomState.Finished;

        await SaveRoomAsync(room);
        return new SolveResult { IsFirstSolve = isFirst, TimeSeconds = timeSeconds };
    }

    private async Task SaveRoomAsync(GameRoom room)
    {
        var json = JsonSerializer.Serialize(room);
        var ttl = TimeSpan.FromMinutes(RoomTtlMinutes);
        await _db.StringSetAsync($"room:{room.Code}", json, ttl);

        if (room.PlayerA?.ConnectionId is not null)
            await _db.StringSetAsync($"conn:{room.PlayerA.ConnectionId}", room.Code, ttl);
        if (room.PlayerB?.ConnectionId is not null)
            await _db.StringSetAsync($"conn:{room.PlayerB.ConnectionId}", room.Code, ttl);
    }

    private static string GenerateCode() =>
        Guid.NewGuid().ToString("N")[..6].ToUpper();
}