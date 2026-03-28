import {
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
  output,
} from '@angular/core';
import { LevelDto } from '../../../core/models/level.model';
import {
  GridPos,
  buildBarrierSet,
  buildNumberMap,
  canExtendPath,
  isSolved,
  barrierKey,
  walkPath,
  maxNumberInLevel,
  levelPlaySignature,
} from './grid-path.util';

@Component({
  selector: 'app-grid-canvas',
  standalone: true,
  imports: [],
  templateUrl: './grid-canvas.component.html',
  styleUrl: './grid-canvas.component.scss',
})
export class GridCanvasComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() level: LevelDto | null = null;
  /** When true, user input is ignored (e.g. PvP countdown before GameStarted). */
  @Input() interactionLocked = false;

  readonly solved = output<{ timeSeconds: number }>();
  /** Fired after path / timer state changes (for play UI: progress + clock). */
  readonly stateChange = output<{
    pathLength: number;
    totalCells: number;
    completed: boolean;
    elapsedSeconds: number;
  }>();

  path: GridPos[] = [];
  completed = false;
  dragging = false;

  private barrierSet = new Set<string>();
  private numberMap = new Map<string, number>();
  private playSignature: string | null = null;
  private lastPointerCell: GridPos | null = null;
  private solveEmitted = false;
  private startedAt: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['level']) {
      if (this.level) {
        const nextSig = levelPlaySignature(this.level);
        if (nextSig !== this.playSignature) {
          this.playSignature = nextSig;
          this.barrierSet = buildBarrierSet(this.level);
          this.numberMap = buildNumberMap(this.level);
          this.resetLocal();
        }
      } else {
        this.playSignature = null;
        this.resetLocal();
      }
    }
    if (changes['interactionLocked']) {
      this.cdr.markForCheck();
    }
  }

  indices(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  numberAt(row: number, col: number): number | null {
    return this.numberMap.get(`${row},${col}`) ?? null;
  }

  pathStepIndex(row: number, col: number): number {
    return this.path.findIndex((p) => p.row === row && p.col === col);
  }

  isPathEnd(row: number, col: number): boolean {
    if (this.path.length === 0) {
      return false;
    }
    const last = this.path[this.path.length - 1];
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
    return this.path.length > 0 && !this.completed;
  }

  undoOne(): void {
    if (!this.canUndo()) {
      return;
    }
    this.path = this.path.slice(0, -1);
    this.emitState();
  }

  reset(): void {
    this.resetLocal();
  }

  private resetLocal(): void {
    this.path = [];
    this.completed = false;
    this.dragging = false;
    this.lastPointerCell = null;
    this.solveEmitted = false;
    this.startedAt = null;
    this.emitState();
  }

  private emitState(): void {
    if (!this.level) {
      return;
    }
    const elapsed =
      this.startedAt != null ? Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000)) : 0;
    this.stateChange.emit({
      pathLength: this.path.length,
      totalCells: this.level.size * this.level.size,
      completed: this.completed,
      elapsedSeconds: elapsed,
    });
  }

  maxNumberOnBoard(): number {
    return this.level ? maxNumberInLevel(this.level) : 0;
  }

  onPointerDown(event: PointerEvent): void {
    if (this.interactionLocked || !this.level || this.completed) {
      return;
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.dragging = true;
    this.lastPointerCell = null;
    const cell = this.cellFromPoint(event.clientX, event.clientY);
    if (cell) {
      this.tryMove(cell);
      this.lastPointerCell = cell;
    }
    event.preventDefault();
  }

  onPointerMove(event: PointerEvent): void {
    if (this.interactionLocked || !this.dragging || !this.level || this.completed) {
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
    this.dragging = false;
    this.lastPointerCell = null;
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      /* noop */
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

  private tryMove(next: GridPos): void {
    if (!this.level) {
      return;
    }
    const p = this.path;

    if (p.length >= 2) {
      const prev = p[p.length - 2];
      if (prev.row === next.row && prev.col === next.col) {
        this.path = p.slice(0, -1);
        this.emitState();
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

    if (this.path.length === 0 && this.startedAt === null) {
      this.startedAt = Date.now();
    }

    this.path = [...p, next];

    if (isSolved(this.path, this.level, this.numberMap)) {
      this.completed = true;
      if (!this.solveEmitted && this.startedAt !== null) {
        this.solveEmitted = true;
        const seconds = Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000));
        this.solved.emit({ timeSeconds: seconds });
      }
    }
    this.emitState();
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
    if (this.interactionLocked || !this.level || this.completed || this.path.length === 0) {
      return;
    }
    const key = event.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      return;
    }
    const last = this.path[this.path.length - 1];
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

  hint(): string {
    const lv = this.level;
    if (!lv) {
      return '';
    }
    const { lastHit } = walkPath(this.path, this.numberMap);
    const total = lv.size * lv.size;
    const len = this.path.length;
    const mx = maxNumberInLevel(lv);
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
}
