
using Microsoft.AspNetCore.SignalR;
using Zip.Service.Dal.Interfaces;
using Zip.Service.Hubs;
using Zip.Service.Services.Interfaces;

namespace Zip.Service.BackgroundServices;

public class MatchmakingTimeoutService(
    IMatchmakingService matchmaking,
    IHubContext<GameHub> hubContext,
    ILogger<MatchmakingTimeoutService> logger) : BackgroundService
{
    private const int CheckIntervalSeconds = 5;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        logger.LogInformation("Matchmaking timeout service started.");

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await matchmaking.PromoteStaleRandomPlayersAsync();
                await matchmaking.TryMatchAllAsync(hubContext);
            }
            catch (Exception e)
            {
                logger.LogError(e, "Error in matchmaking timeout service.");
            }

            await Task.Delay(
                TimeSpan.FromSeconds(CheckIntervalSeconds), ct);
        }
    }
}