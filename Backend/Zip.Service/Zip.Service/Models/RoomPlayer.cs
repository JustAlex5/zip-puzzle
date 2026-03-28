namespace Zip.Service.Models;

public class RoomPlayer
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string ConnectionId { get; set; } = string.Empty;
    public int? TimeSeconds { get; set; }
    public bool Solved { get; set; }
}