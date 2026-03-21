import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LevelService } from '../../core/services/level.service';
import { NumberCellDto, WallBarrierDto } from '../../core/models/level.model';
import { barrierKey } from '../../shared/components/grid-canvas/grid-path.util';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
})
export class EditorComponent {
  private readonly levelService = inject(LevelService);

  levelName = 'New level';
  size = 5;
  /** 0 = erase cell */
  selectedNumber = 1;

  readonly sizeOptions = [4, 5, 6, 7, 8, 9, 10, 12];

  readonly cellNumbers = signal<Map<string, number>>(new Map());
  readonly barriers = signal<Set<string>>(new Set());

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);

  numberOptions(): number[] {
    const max = Math.min(this.size * this.size, 36);
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  indices(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  numberAt(row: number, col: number): number | null {
    return this.cellNumbers().get(`${row},${col}`) ?? null;
  }

  hasBarrierRight(row: number, col: number): boolean {
    if (col >= this.size - 1) {
      return false;
    }
    return this.barriers().has(barrierKey(row, col, row, col + 1));
  }

  hasBarrierBottom(row: number, col: number): boolean {
    if (row >= this.size - 1) {
      return false;
    }
    return this.barriers().has(barrierKey(row, col, row + 1, col));
  }

  onSizeChange(newSize: number): void {
    this.size = Number(newSize);
    this.cellNumbers.set(new Map());
    this.barriers.set(new Set());
    this.error.set(null);
    this.success.set(false);
    if (this.selectedNumber > this.size * this.size) {
      this.selectedNumber = 1;
    }
  }

  onCellClick(row: number, col: number): void {
    const key = `${row},${col}`;
    const m = new Map(this.cellNumbers());
    const n = this.selectedNumber;

    if (n === 0) {
      m.delete(key);
      this.cellNumbers.set(m);
      return;
    }

    for (const [k, v] of m) {
      if (v === n) {
        m.delete(k);
      }
    }
    m.set(key, n);
    this.cellNumbers.set(m);
    this.error.set(null);
    this.success.set(false);
  }

  onEdgeClick(event: MouseEvent, kind: 'v' | 'h', row: number, col: number): void {
    event.preventDefault();
    event.stopPropagation();
    if (kind === 'v') {
      this.toggleBarrierKey(barrierKey(row, col, row, col + 1));
    } else {
      this.toggleBarrierKey(barrierKey(row, col, row + 1, col));
    }
    this.error.set(null);
    this.success.set(false);
  }

  private toggleBarrierKey(k: string): void {
    const s = new Set(this.barriers());
    if (s.has(k)) {
      s.delete(k);
    } else {
      s.add(k);
    }
    this.barriers.set(s);
  }

  clearGrid(): void {
    this.cellNumbers.set(new Map());
    this.barriers.set(new Set());
    this.error.set(null);
    this.success.set(false);
  }

  validateNumbers(): string | null {
    const nums = [...new Set(this.cellNumbers().values())].sort((a, b) => a - b);
    if (nums.length === 0) {
      return 'Place number 1 (and further numbers) on the grid.';
    }
    if (nums[0] !== 1) {
      return 'The smallest number on the board must be 1.';
    }
    for (let i = 0; i < nums.length; i++) {
      if (nums[i] !== i + 1) {
        return 'Numbers must be consecutive: 1, 2, 3, … with no gaps.';
      }
    }
    return null;
  }

  buildPayload(): {
    name: string;
    size: number;
    numbers: NumberCellDto[];
    barriers: WallBarrierDto[];
  } {
    const numbers: NumberCellDto[] = [];
    for (const [key, num] of this.cellNumbers()) {
      const [row, col] = key.split(',').map(Number);
      numbers.push({ row, col, number: num });
    }
    numbers.sort((a, b) => a.number - b.number);

    const barrierList: WallBarrierDto[] = [];
    for (const k of this.barriers()) {
      const parts = k.split(',').map(Number);
      if (parts.length === 4) {
        barrierList.push({
          r1: parts[0],
          c1: parts[1],
          r2: parts[2],
          c2: parts[3],
        });
      }
    }

    return {
      name: this.levelName.trim() || 'Untitled',
      size: this.size,
      numbers,
      barriers: barrierList,
    };
  }

  save(): void {
    const validationError = this.validateNumbers();
    if (validationError) {
      this.error.set(validationError);
      this.success.set(false);
      return;
    }

    this.error.set(null);
    this.success.set(false);
    this.saving.set(true);

    const payload = this.buildPayload();
    this.levelService.createLevel(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(true);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.success.set(false);
        this.error.set(e instanceof Error ? e.message : 'Save failed');
      },
    });
  }
}
