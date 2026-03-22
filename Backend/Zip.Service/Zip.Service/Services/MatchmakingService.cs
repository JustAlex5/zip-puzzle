using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;
using Zip.Service.Dal.Interfaces;
using Zip.Service.Hubs;
using Zip.Service.Models;
using Zip.Service.Models.Enums;
using Zip.Service.Services.Interfaces;

namespace Zip.Service.Services;

public class MatchmakingService(
    IConnectionMultiplexer redis,
    IRoomService roomService,
    IServiceScopeFactory scopeFactory,
    ILogger<MatchmakingService> logger) : IMatchmakingService
{
    private readonly IDatabase _db = redis.GetDatabase();
    private const string RandomQueueKey = "matchmaking:random";
    private const string LevelQueuePrefix = "matchmaking:level:";
    private const string CodeQueuePrefix = "matchmaking:code:";
    private const int RandomTimeoutSeconds = 30;

    public async Task EnqueueAsync(QueueEntry entry)
    {
        var json = JsonSerializer.Serialize(entry);
        var queueKey = entry.Mode == MatchMode.Random
            ? RandomQueueKey
            : $"{LevelQueuePrefix}{entry.LevelId}";

        await _db.ListRightPushAsync(queueKey, json);
        await _db.StringSetAsync(
            $"queue:conn:{entry.ConnectionId}",
            JsonSerializer.Serialize(new { queueKey, json }),
            TimeSpan.FromMinutes(10));

        logger.LogInformation(
            "Player {Username} joined {Mode} queue. LevelId={LevelId}",
            entry.Username, entry.Mode, entry.LevelId);
    }

    public async Task EnqueueByCodeAsync(QueueEntry entry)
    {
        var json = JsonSerializer.Serialize(entry);
        var queueKey = $"{CodeQueuePrefix}{entry.RoomCode}";

        await _db.ListRightPushAsync(queueKey, json);
        await _db.KeyExpireAsync(queueKey, TimeSpan.FromMinutes(10));
        await _db.StringSetAsync(
            $"queue:conn:{entry.ConnectionId}",
            JsonSerializer.Serialize(new { queueKey, json }),
            TimeSpan.FromMinutes(10));

        logger.LogInformation(
            "Player {Username} joined code queue. Code={Code}",
            entry.Username, entry.RoomCode);
    }

    public async Task<(QueueEntry, QueueEntry, int)?> TryDequeueMatchAsync()
    {
        var randomMatch = await TryDequeueRandomAsync();
        if (randomMatch is not null) return randomMatch;
        return await TryDequeueLevelAsync();
    }

    public async Task<(QueueEntry, QueueEntry, int)?> TryDequeueByCodeAsync(string code)
    {
        var queueKey = $"{CodeQueuePrefix}{code}";
        var length = await _db.ListLengthAsync(queueKey);
        if (length < 2) return null;

        var jsonA = await _db.ListLeftPopAsync(queueKey);
        var jsonB = await _db.ListLeftPopAsync(queueKey);
        if (jsonA.IsNull || jsonB.IsNull) return null;

        var playerA = JsonSerializer.Deserialize<QueueEntry>(jsonA!)!;
        var playerB = JsonSerializer.Deserialize<QueueEntry>(jsonB!)!;

        await CleanupConnectionIndex(playerA.ConnectionId);
        await CleanupConnectionIndex(playerB.ConnectionId);

        var levelId = playerA.LevelId ?? await PickRandomLevelAsync();

        logger.LogInformation(
            "Code match: {A} vs {B} on Level {LevelId} Code={Code}",
            playerA.Username, playerB.Username, levelId, code);

        return (playerA, playerB, levelId);
    }

    public async Task DequeueAsync(string connectionId)
    {
        var meta = await _db.StringGetAsync($"queue:conn:{connectionId}");
        if (meta.IsNull) return;

        var data = JsonSerializer.Deserialize<JsonElement>(meta!);
        var queueKey = data.GetProperty("queueKey").GetString()!;
        var json = data.GetProperty("json").GetString()!;

        await _db.ListRemoveAsync(queueKey, json);
        await CleanupConnectionIndex(connectionId);

        var entry = JsonSerializer.Deserialize<QueueEntry>(json);
        logger.LogInformation("Player {Username} left queue", entry?.Username);
    }

    public async Task<bool> IsInQueueAsync(string connectionId) =>
        await _db.KeyExistsAsync($"queue:conn:{connectionId}");

    public async Task PromoteStaleRandomPlayersAsync()
    {
        var length = await _db.ListLengthAsync(RandomQueueKey);
        if (length == 0) return;

        var allJson = await _db.ListRangeAsync(RandomQueueKey, 0, -1);

        foreach (var json in allJson)
        {
            var entry = JsonSerializer.Deserialize<QueueEntry>(json!);
            if (entry is null) continue;

            var waitSeconds = (DateTime.UtcNow - entry.EnqueuedAt).TotalSeconds;
            if (waitSeconds < RandomTimeoutSeconds) continue;

            await _db.ListRemoveAsync(RandomQueueKey, json);

            var levelId = await PickRandomLevelAsync();
            if (levelId == 0) continue;

            entry.LevelId = levelId;
            entry.Mode = MatchMode.ByLevel;

            var levelKey = $"{LevelQueuePrefix}{levelId}";
            var newJson = JsonSerializer.Serialize(entry);

            await _db.ListRightPushAsync(levelKey, newJson);
            await _db.StringSetAsync(
                $"queue:conn:{entry.ConnectionId}",
                JsonSerializer.Serialize(new { queueKey = levelKey, json = newJson }),
                TimeSpan.FromMinutes(10));

            logger.LogInformation(
                "Player {Username} promoted from random to level {LevelId} queue.",
                entry.Username, levelId);
        }
    }

    public async Task TryMatchAllAsync(IHubContext<GameHub> hubContext)
    {
        while (true)
        {
            var match = await TryDequeueMatchAsync();
            if (match is null) break;

            var (playerA, playerB, levelId) = match.Value;
            var room = await roomService.CreateRoomAsync(levelId, playerA, playerB);

            await hubContext.Groups.AddToGroupAsync(playerA.ConnectionId, room.Code);
            await hubContext.Groups.AddToGroupAsync(playerB.ConnectionId, room.Code);

            await hubContext.Clients.Group(room.Code).SendAsync("MatchFound", new
            {
                RoomCode = room.Code,
                LevelId = levelId,
                PlayerA = playerA.Username,
                PlayerB = playerB.Username,
                StartsInSeconds = 3
            });

            _ = Task.Run(async () =>
            {
                await Task.Delay(3000);
                room.StartedAt = DateTime.UtcNow;
                room.State = RoomState.Playing;
                await roomService.UpdateRoomAsync(room);
                await hubContext.Clients.Group(room.Code).SendAsync("GameStarted");
            });

            logger.LogInformation(
                "Background matched {A} vs {B} on Level {LevelId}",
                playerA.Username, playerB.Username, levelId);
        }
    }

    private async Task<(QueueEntry, QueueEntry, int)?> TryDequeueRandomAsync()
    {
        var length = await _db.ListLengthAsync(RandomQueueKey);
        if (length < 2) return null;

        var jsonA = await _db.ListLeftPopAsync(RandomQueueKey);
        var jsonB = await _db.ListLeftPopAsync(RandomQueueKey);
        if (jsonA.IsNull || jsonB.IsNull) return null;

        var playerA = JsonSerializer.Deserialize<QueueEntry>(jsonA!)!;
        var playerB = JsonSerializer.Deserialize<QueueEntry>(jsonB!)!;

        await CleanupConnectionIndex(playerA.ConnectionId);
        await CleanupConnectionIndex(playerB.ConnectionId);

        var levelId = await PickRandomLevelAsync();
        if (levelId == 0)
        {
            await _db.ListRightPushAsync(RandomQueueKey, jsonA!);
            await _db.ListRightPushAsync(RandomQueueKey, jsonB!);
            await RestoreQueueConnIndex(RandomQueueKey, jsonA!);
            await RestoreQueueConnIndex(RandomQueueKey, jsonB!);
            return null;
        }

        return (playerA, playerB, levelId);
    }

    private async Task<(QueueEntry, QueueEntry, int)?> TryDequeueLevelAsync()
    {
        var server = redis.GetServer(redis.GetEndPoints().First());
        var keys = server.Keys(pattern: $"{LevelQueuePrefix}*").ToList();

        foreach (var key in keys)
        {
            var length = await _db.ListLengthAsync(key);
            if (length < 2) continue;

            var jsonA = await _db.ListLeftPopAsync(key);
            var jsonB = await _db.ListLeftPopAsync(key);
            if (jsonA.IsNull || jsonB.IsNull) continue;

            var playerA = JsonSerializer.Deserialize<QueueEntry>(jsonA!)!;
            var playerB = JsonSerializer.Deserialize<QueueEntry>(jsonB!)!;

            await CleanupConnectionIndex(playerA.ConnectionId);
            await CleanupConnectionIndex(playerB.ConnectionId);

            return (playerA, playerB, playerA.LevelId!.Value);
        }

        return null;
    }

    private async Task CleanupConnectionIndex(string connectionId) =>
        await _db.KeyDeleteAsync($"queue:conn:{connectionId}");

    private async Task RestoreQueueConnIndex(string queueKey, string entryJson)
    {
        var entry = JsonSerializer.Deserialize<QueueEntry>(entryJson)!;
        await _db.StringSetAsync(
            $"queue:conn:{entry.ConnectionId}",
            JsonSerializer.Serialize(new { queueKey, json = entryJson }),
            TimeSpan.FromMinutes(10));
    }

    private async Task<int> PickRandomLevelAsync()
    {
        using var scope = scopeFactory.CreateScope();
        var levelRepo = scope.ServiceProvider.GetRequiredService<ILevelRepository>();
        var levels = await levelRepo.GetAllAsync(CancellationToken.None);
        if (levels is null || levels.Count == 0) return 0;
        return levels[Random.Shared.Next(levels.Count)].Id;
    }
}