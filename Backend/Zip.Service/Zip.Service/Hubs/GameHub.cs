using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Zip.Service.Models;
using Zip.Service.Models.Enums;
using Zip.Service.Services.Interfaces;

namespace Zip.Service.Hubs;
[Authorize]
public class GameHub(IMatchmakingService matchmaking,
    IRoomService roomService,
    ILogger<GameHub> logger) :Hub
{
 public async Task FindMatchRandom()
    {
        var user = GetUser();
        if (await matchmaking.IsInQueueAsync(Context.ConnectionId))
        {
            await Clients.Caller.SendAsync("Error", "Already in queue.");
            return;
        }

        await matchmaking.EnqueueAsync(new QueueEntry
        {
            UserId = user.UserId,
            Username = user.Username,
            ConnectionId = Context.ConnectionId,
            Mode = MatchMode.Random
        });

        await Clients.Caller.SendAsync("Queued", "Searching for any opponent...");
        await TryMatchPlayers();
    }

    public async Task FindMatchByLevel(int levelId)
    {
        var user = GetUser();
        if (await matchmaking.IsInQueueAsync(Context.ConnectionId))
        {
            await Clients.Caller.SendAsync("Error", "Already in queue.");
            return;
        }

        await matchmaking.EnqueueAsync(new QueueEntry
        {
            UserId = user.UserId,
            Username = user.Username,
            ConnectionId = Context.ConnectionId,
            LevelId = levelId,
            Mode = MatchMode.ByLevel
        });

        await Clients.Caller.SendAsync("Queued", $"Searching for opponent on level {levelId}...");
        await TryMatchPlayers();
    }

    public async Task CreatePrivateRoom(int levelId)
    {
        var user = GetUser();
        if (await matchmaking.IsInQueueAsync(Context.ConnectionId))
        {
            await Clients.Caller.SendAsync("Error", "Already in queue.");
            return;
        }

        var code = GenerateRoomCode();

        await matchmaking.EnqueueByCodeAsync(new QueueEntry
        {
            UserId = user.UserId,
            Username = user.Username,
            ConnectionId = Context.ConnectionId,
            LevelId = levelId,
            RoomCode = code,
            Mode = MatchMode.ByCode
        });

        await Clients.Caller.SendAsync("PrivateRoomCreated", code);

        logger.LogInformation(
            "Private room created by {Username}. Code={Code} LevelId={LevelId}",
            user.Username, code, levelId);
    }

    public async Task JoinPrivateRoom(string code)
    {
        var user = GetUser();
        if (await matchmaking.IsInQueueAsync(Context.ConnectionId))
        {
            await Clients.Caller.SendAsync("Error", "Already in queue.");
            return;
        }

        await matchmaking.EnqueueByCodeAsync(new QueueEntry
        {
            UserId = user.UserId,
            Username = user.Username,
            ConnectionId = Context.ConnectionId,
            RoomCode = code,
            Mode = MatchMode.ByCode
        });

        var match = await matchmaking.TryDequeueByCodeAsync(code);
        if (match is null)
        {
            await matchmaking.DequeueAsync(Context.ConnectionId);
            await Clients.Caller.SendAsync("Error", "Room not found or code expired.");
            return;
        }

        await StartMatch(match.Value);
    }

    public async Task CancelSearch()
    {
        await matchmaking.DequeueAsync(Context.ConnectionId);
        await Clients.Caller.SendAsync("SearchCancelled");
    }

    public async Task SolvePuzzle(string roomCode)
    {
        var user = GetUser();
        var room = await roomService.GetRoomAsync(roomCode);

        if (room is null || room.State != RoomState.Playing) return;
        if (room.StartedAt is null) return;

        var timeSeconds = (int)(DateTime.UtcNow - room.StartedAt.Value).TotalSeconds;
        var result = await roomService.RecordSolveAsync(roomCode, user.UserId, timeSeconds);
        if (result is null) return;

        if (result.IsFirstSolve)
        {
            await Clients.Client(Context.ConnectionId)
                .SendAsync("YouWon", timeSeconds);

            var loserConnId = room.PlayerA!.UserId == user.UserId
                ? room.PlayerB!.ConnectionId
                : room.PlayerA!.ConnectionId;

            await Clients.Client(loserConnId)
                .SendAsync("OpponentSolved", user.Username, timeSeconds);
        }
        else
        {
            await Clients.Caller.SendAsync("YouFinished", timeSeconds);
        }

        logger.LogInformation(
            "Room {Code} — {Username} solved in {Time}s",
            roomCode, user.Username, timeSeconds);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await matchmaking.DequeueAsync(Context.ConnectionId);

        var room = await roomService.GetRoomByConnectionAsync(Context.ConnectionId);
        if (room is not null)
        {
            await Clients.Group(room.Code)
                .SendAsync("OpponentDisconnected", "Opponent disconnected.");
            await roomService.RemoveRoomAsync(room.Code);
        }

        await base.OnDisconnectedAsync(exception);
    }

    private async Task TryMatchPlayers()
    {
        var match = await matchmaking.TryDequeueMatchAsync();
        if (match is null) return;
        await StartMatch(match.Value);
    }

    private async Task StartMatch((QueueEntry playerA, QueueEntry playerB, int levelId) match)
    {
        var (playerA, playerB, levelId) = match;
        var room = await roomService.CreateRoomAsync(levelId, playerA, playerB);

        await Groups.AddToGroupAsync(playerA.ConnectionId, room.Code);
        await Groups.AddToGroupAsync(playerB.ConnectionId, room.Code);

        await Clients.Group(room.Code).SendAsync("MatchFound", new
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
            await Clients.Group(room.Code).SendAsync("GameStarted");
        });
    }

    private static string GenerateRoomCode() =>
        Guid.NewGuid().ToString("N")[..6].ToUpper();

    private (int UserId, string Username) GetUser() => (
        int.Parse(Context.User!.FindFirst(ClaimTypes.NameIdentifier)!.Value),
        Context.User!.FindFirst(ClaimTypes.Name)!.Value
    );
}