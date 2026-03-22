using Zip.Service.Models;

namespace Zip.Service.Services.Interfaces;

public interface IRoomService
{
    Task<GameRoom> CreateRoomAsync(int levelId, QueueEntry playerA, QueueEntry playerB);
    Task<GameRoom?> GetRoomAsync(string code);
    Task<GameRoom?> GetRoomByConnectionAsync(string connectionId);
    Task UpdateRoomAsync(GameRoom room);
    Task RemoveRoomAsync(string code);
    Task<SolveResult?> RecordSolveAsync(string code, int userId, int timeSeconds);
}