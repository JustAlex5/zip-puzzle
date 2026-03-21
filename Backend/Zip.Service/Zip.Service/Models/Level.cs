namespace Zip.Service.Models;

public class Level
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int GridSize { get; set; }
    public int SolveCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<NumberCell> Numbers { get; set; } = [];
    public ICollection<WallBarrier> Barriers { get; set; } = []; 
}