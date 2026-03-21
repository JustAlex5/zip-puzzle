namespace Zip.Service.Models;

public class NumberCell
{
    public int Id { get; set; }
    public int LevelId { get; set; }
    public int Row { get; set; }
    public int Col { get; set; }
    public int Number { get; set; }

    public Level Level { get; set; } = null!;
}