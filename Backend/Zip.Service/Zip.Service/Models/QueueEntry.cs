using Zip.Service.Models.Enums;

namespace Zip.Service.Models;

public class QueueEntry
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string ConnectionId { get; set; } = string.Empty;
    public int? LevelId { get; set; }
    public string? RoomCode { get; set; }
    public MatchMode Mode { get; set; }
    public DateTime EnqueuedAt { get; set; } = DateTime.UtcNow;
}