using Microsoft.AspNetCore.SignalR;
using Zip.Service.Hubs;
using Zip.Service.Models;

namespace Zip.Service.Services.Interfaces;

public interface IMatchmakingService
{
    Task EnqueueAsync(QueueEntry entry);
    Task EnqueueByCodeAsync(QueueEntry entry);
    Task<(QueueEntry playerA, QueueEntry playerB, int levelId)?> TryDequeueMatchAsync();
    Task<(QueueEntry playerA, QueueEntry playerB, int levelId)?> TryDequeueByCodeAsync(string code);
    Task DequeueAsync(string connectionId);
    Task<bool> IsInQueueAsync(string connectionId);
    Task PromoteStaleRandomPlayersAsync();
    Task TryMatchAllAsync(IHubContext<GameHub> hubContext);
}