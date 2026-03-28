using Zip.Service.Models.Enums;

namespace Zip.Service.Models;

public class GameRoom
{
    public string Code { get; set; } = string.Empty;
    public int LevelId { get; set; }
    public RoomState State { get; set; } = RoomState.Waiting;
    public DateTime? StartedAt { get; set; }
    public RoomPlayer? PlayerA { get; set; }
    public RoomPlayer? PlayerB { get; set; } 
}