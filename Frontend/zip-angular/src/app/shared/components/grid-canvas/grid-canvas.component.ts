import {
  Component,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { LevelDto } from '../../../core/models/level.model';
import { LevelService } from '../../../core/services/level.service';
import {
  GridPos,
  buildBarrierSet,
  buildNumberMap,
  canExtendPath,
  isSolved,
  barrierKey,
  walkPath,
} from './grid-path.util';

@Component({
  selector: 'app-grid-canvas',
  standalone: true,
  imports: [],
  templateUrl: './grid-canvas.component.html',
  styleUrl: './grid-canvas.component.scss',
})
export class GridCanvasComponent implements OnChanges {
  private readonly levelService = inject(LevelService);

  @Input() level: LevelDto | null = null;

  readonly path = signal<GridPos[]>([]);
  readonly completed = signal(false);
  readonly dragging = signal(false);
  private solvePosted = false;

  private barrierSet = new Set<string>();
  private numberMap = new Map<string, number>();

  /** Last cell processed during this drag (avoid duplicate events on same cell). */
  private lastPointerCell: GridPos | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['level']) {
      this.path.set([]);
      this.completed.set(false);
      this.solvePosted = false;
      this.dragging.set(false);
      this.lastPointerCell = null;
      if (this.level) {
        this.barrierSet = buildBarrierSet(this.level);
        this.numberMap = buildNumberMap(this.level);
      }
    }
  }

  indices(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  numberAt(row: number, col: number): number | null {
    return this.numberMap.get(`${row},${col}`) ?? null;
  }

  pathStepIndex(row: number, col: number): number {
    return this.path().findIndex((p) => p.row === row && p.col === col);
  }

  isPathEnd(row: number, col: number): boolean {
    const p = this.path();
    if (p.length === 0) {
      return false;
    }
    const last = p[p.length - 1];
    return last.row === row && last.col === col;
  }

  hasBarrierBottom(row: number, col: number): boolean {
    const n = this.level?.size ?? 0;
    if (row >= n - 1) {
      return false;
    }
    return this.barrierSet.has(barrierKey(row, col, row + 1, col));
  }

  hasBarrierRight(row: number, col: number): boolean {
    const n = this.level?.size ?? 0;
    if (col >= n - 1) {
      return false;
    }
    return this.barrierSet.has(barrierKey(row, col, row, col + 1));
  }

  canUndo(): boolean {
    return this.path().length > 0 && !this.completed();
  }

  undoOne(): void {
    if (!this.canUndo()) {
      return;
    }
    this.path.update((p) => p.slice(0, -1));
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.level || this.completed()) {
      return;
    }
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    this.dragging.set(true);
    this.lastPointerCell = null;
    const cell = this.cellFromPoint(event.clientX, event.clientY);
    if (cell) {
      this.tryMove(cell);
      this.lastPointerCell = cell;
    }
    event.preventDefault();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging() || !this.level || this.completed()) {
      return;
    }
    const cell = this.cellFromPoint(event.clientX, event.clientY);
    if (!cell) {
      return;
    }
    if (this.sameCell(cell, this.lastPointerCell)) {
      return;
    }
    this.lastPointerCell = cell;
    this.tryMove(cell);
  }

  onPointerUp(event: PointerEvent): void {
    this.endDrag(event.currentTarget as HTMLElement, event.pointerId);
  }

  onPointerCancel(event: PointerEvent): void {
    this.endDrag(event.currentTarget as HTMLElement, event.pointerId);
  }

  private endDrag(target: HTMLElement, pointerId: number): void {
    this.dragging.set(false);
    this.lastPointerCell = null;
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      /* already released */
    }
  }

  private cellFromPoint(clientX: number, clientY: number): GridPos | null {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) {
      return null;
    }
    const cellEl = el.closest('[data-row][data-col]') as HTMLElement | null;
    if (!cellEl?.dataset['row'] || !cellEl.dataset['col']) {
      return null;
    }
    const row = Number.parseInt(cellEl.dataset['row'], 10);
    const col = Number.parseInt(cellEl.dataset['col'], 10);
    if (Number.isNaN(row) || Number.isNaN(col)) {
      return null;
    }
    return { row, col };
  }

  private sameCell(a: GridPos | null, b: GridPos | null): boolean {
    if (!a || !b) {
      return false;
    }
    return a.row === b.row && a.col === b.col;
  }

  /**
   * Extend path, backtrack one step when dragging onto the previous cell, or ignore invalid moves.
   */
  private tryMove(next: GridPos): void {
    if (!this.level) {
      return;
    }
    const p = this.path();

    if (p.length >= 2) {
      const prev = p[p.length - 2];
      if (prev.row === next.row && prev.col === next.col) {
        this.path.set(p.slice(0, -1));
        return;
      }
    }

    if (p.length > 0) {
      const last = p[p.length - 1];
      if (last.row === next.row && last.col === next.col) {
        return;
      }
    }

    if (!canExtendPath(p, next, this.level, this.barrierSet, this.numberMap)) {
      return;
    }

    const nextPath = [...p, next];
    this.path.set(nextPath);
    if (isSolved(nextPath, this.level, this.numberMap)) {
      this.completed.set(true);
      this.postSolveOnce();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }
    if (!this.level || this.completed() || this.path().length === 0) {
      return;
    }
    const key = event.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      return;
    }
    const last = this.path()[this.path().length - 1];
    let dr = 0;
    let dc = 0;
    if (key === 'ArrowUp') {
      dr = -1;
    }
    if (key === 'ArrowDown') {
      dr = 1;
    }
    if (key === 'ArrowLeft') {
      dc = -1;
    }
    if (key === 'ArrowRight') {
      dc = 1;
    }
    const next: GridPos = { row: last.row + dr, col: last.col + dc };
    event.preventDefault();
    this.tryMove(next);
    this.lastPointerCell = next;
  }

  private postSolveOnce(): void {
    if (this.solvePosted || !this.level) {
      return;
    }
    this.solvePosted = true;
    this.levelService.incrementSolveCount(this.level.id).subscribe({
      error: () => {
        this.solvePosted = false;
      },
    });
  }

  reset(): void {
    this.path.set([]);
    this.completed.set(false);
    this.solvePosted = false;
    this.dragging.set(false);
    this.lastPointerCell = null;
  }

  hint(): string {
    const lv = this.level;
    if (!lv) {
      return '';
    }
    const { lastHit } = walkPath(this.path(), this.numberMap);
    const total = lv.size * lv.size;
    const len = this.path().length;
    const mx = this.maxNum();
    if (lastHit >= mx) {
      return `Steps: ${len} / ${total}. All numbers visited — cover the remaining empty cells.`;
    }
    return `Steps: ${len} / ${total}. Next numbered cell to step on: ${lastHit + 1}.`;
  }

  cellAriaLabel(row: number, col: number): string {
    const num = this.numberAt(row, col);
    const step = this.pathStepIndex(row, col);
    const parts: string[] = [`Row ${row + 1}, column ${col + 1}`];
    if (num !== null) {
      parts.push(`number ${num}`);
    }
    if (step >= 0) {
      parts.push(`step ${step + 1} on path`);
    }
    return parts.join(', ');
  }

  maxNum(): number {
    if (!this.level || this.level.numbers.length === 0) {
      return 0;
    }
    return Math.max(...this.level.numbers.map((x) => x.number));
  }
}
