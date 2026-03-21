using Zip.Service.Models;

namespace Zip.Service.Services;

public static class LevelValidator
{
    private static readonly (int dr, int dc)[] Directions = [(-1,0),(1,0),(0,-1),(0,1)];

    public static bool IsSolvable(Level level)
    {
        int n = level.GridSize;
        var numberIndex = level.Numbers
            .ToDictionary(nc => (nc.Row, nc.Col), nc => nc.Number);

        var barrierSet = level.Barriers
            .Select(b => BarrierKey(b.R1, b.C1, b.R2, b.C2))
            .ToHashSet();

        // find the cell with number 1 — path must start there
        var start = level.Numbers
            .OrderBy(nc => nc.Number)
            .First();

        bool[,] visited = new bool[n, n];
        visited[start.Row, start.Col] = true;

        return Backtrack(
            row: start.Row,
            col: start.Col,
            visitedCount: 1,
            lastNumberHit: 1,
            totalCells: n * n,
            totalNumbers: level.Numbers.Count,
            n: n,
            visited: visited,
            numberIndex: numberIndex,
            barrierSet: barrierSet
        );
    }

    private static bool Backtrack(
        int row, int col,
        int visitedCount, int lastNumberHit,
        int totalCells, int totalNumbers,
        int n, bool[,] visited,
        Dictionary<(int, int), int> numberIndex,
        HashSet<string> barrierSet)
    {
        // success: visited every cell and hit all numbers in order
        if (visitedCount == totalCells && lastNumberHit == totalNumbers)
            return true;

        foreach (var (dr, dc) in Directions)
        {
            int nr = row + dr, nc = col + dc;

            if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
            if (visited[nr, nc]) continue;
            if (barrierSet.Contains(BarrierKey(row, col, nr, nc))) continue;

            // if next cell is a number, it must be the next expected one
            if (numberIndex.TryGetValue((nr, nc), out int num))
            {
                if (num != lastNumberHit + 1) continue;
            }

            visited[nr, nc] = true;
            int nextNum = numberIndex.ContainsKey((nr, nc)) ? lastNumberHit + 1 : lastNumberHit;

            if (Backtrack(nr, nc, visitedCount + 1, nextNum, totalCells, totalNumbers, n, visited, numberIndex, barrierSet))
                return true;

            visited[nr, nc] = false;
        }

        return false;
    }

    private static string BarrierKey(int r1, int c1, int r2, int c2) =>
        r1 > r2 || (r1 == r2 && c1 > c2)
            ? $"{r2},{c2},{r1},{c1}"
            : $"{r1},{c1},{r2},{c2}";
}