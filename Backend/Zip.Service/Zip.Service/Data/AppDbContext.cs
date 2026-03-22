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
    public DbSet<User> Users => Set<User>();
    public DbSet<LevelScore> LevelScores => Set<LevelScore>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Level>(e =>
        {
            e.ToTable("levels");
            e.Property(l => l.Name).HasMaxLength(100).IsRequired();
            e.Property(l => l.CreatedAt).HasDefaultValueSql("now()");
            e.HasOne(l => l.User)
                .WithMany(u => u.Levels)
                .HasForeignKey(l => l.UserId)
                .OnDelete(DeleteBehavior.SetNull);
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
        
        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("users");
            e.Property(u => u.Username).HasMaxLength(50).IsRequired();
            e.Property(u => u.PasswordHash).IsRequired();
            e.Property(u => u.CreatedAt).HasDefaultValueSql("now()");
            e.HasIndex(u => u.Username).IsUnique();
        });
        
        modelBuilder.Entity<LevelScore>(e =>
        {
            e.ToTable("level_scores");
            e.Property(s => s.SolvedAt).HasDefaultValueSql("now()");
            e.HasOne(s => s.Level)
                .WithMany(l => l.Scores)
                .HasForeignKey(s => s.LevelId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(s => s.User)
                .WithMany(u => u.Scores)
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => new { s.LevelId, s.UserId }).IsUnique();
        });
    }
}