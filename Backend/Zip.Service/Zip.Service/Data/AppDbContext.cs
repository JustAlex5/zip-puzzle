using Microsoft.EntityFrameworkCore;
using Zip.Service.Models;

namespace Zip.Service.Data;

// Data/AppDbContext.cs
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Level> Levels => Set<Level>();
    public DbSet<NumberCell> NumberCells => Set<NumberCell>();
    public DbSet<WallBarrier> Barriers => Set<WallBarrier>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Level>(e =>
        {
            e.ToTable("levels");
            e.Property(l => l.Name).HasMaxLength(100).IsRequired();
            e.Property(l => l.CreatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<NumberCell>(e =>
        {
            e.ToTable("number_cells");
            e.HasOne(nc => nc.Level)
                .WithMany(l => l.Numbers)
                .HasForeignKey(nc => nc.LevelId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WallBarrier>(e =>
        {
            e.ToTable("barriers");
            e.HasOne(b => b.Level)
                .WithMany(l => l.Barriers)
                .HasForeignKey(b => b.LevelId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}