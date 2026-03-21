namespace Zip.Service.Models;

public class WallBarrier
{
    public int Id { get; set; }
    public int LevelId { get; set; }
    public int R1 { get; set; }
    public int C1 { get; set; }
    public int R2 { get; set; }
    public int C2 { get; set; }

    public Level Level { get; set; } = null!; 
}