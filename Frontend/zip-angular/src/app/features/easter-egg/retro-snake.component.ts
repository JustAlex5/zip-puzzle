import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

const COLS = 20;
const ROWS = 15;
const CELL = 16;

@Component({
  selector: 'app-retro-snake',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './retro-snake.component.html',
  styleUrl: './retro-snake.component.scss',
})
export class RetroSnakeComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private timer: ReturnType<typeof setInterval> | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private snake: { x: number; y: number }[] = [];
  private dir = { x: 1, y: 0 };
  private pendingDir = { x: 1, y: 0 };
  private food = { x: 0, y: 0 };
  score = 0;
  gameOver = false;
  paused = false;

  ngOnInit(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;
    this.ctx = canvas.getContext('2d');
    this.reset();
    this.timer = setInterval(() => this.tick(), 135);
  }

  ngOnDestroy(): void {
    if (this.timer != null) {
      clearInterval(this.timer);
    }
  }

  private reset(): void {
    const mx = Math.floor(COLS / 2);
    const my = Math.floor(ROWS / 2);
    this.snake = [
      { x: mx - 1, y: my },
      { x: mx, y: my },
      { x: mx + 1, y: my },
    ];
    this.dir = { x: -1, y: 0 };
    this.pendingDir = { x: -1, y: 0 };
    this.score = 0;
    this.gameOver = false;
    this.paused = false;
    this.spawnFood();
    this.draw();
  }

  private spawnFood(): void {
    let x = 0;
    let y = 0;
    let ok = false;
    while (!ok) {
      x = Math.floor(Math.random() * COLS);
      y = Math.floor(Math.random() * ROWS);
      ok = !this.snake.some((s) => s.x === x && s.y === y);
    }
    this.food = { x, y };
  }

  private tick(): void {
    if (this.gameOver || this.paused) {
      return;
    }
    this.dir = { ...this.pendingDir };
    const head = this.snake[0];
    const nx = head.x + this.dir.x;
    const ny = head.y + this.dir.y;

    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      this.endGame();
      return;
    }
    if (this.snake.some((s) => s.x === nx && s.y === ny)) {
      this.endGame();
      return;
    }

    this.snake.unshift({ x: nx, y: ny });

    if (nx === this.food.x && ny === this.food.y) {
      this.score += 10;
      this.spawnFood();
    } else {
      this.snake.pop();
    }

    this.draw();
  }

  private endGame(): void {
    this.gameOver = true;
    this.draw();
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    ctx.fillStyle = '#1a3d2e';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    ctx.strokeStyle = '#0f2a1f';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, ROWS * CELL);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(COLS * CELL, y * CELL + 0.5);
      ctx.stroke();
    }

    ctx.fillStyle = '#8fe8a8';
    for (const s of this.snake) {
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    }

    ctx.fillStyle = '#c4334e';
    ctx.fillRect(this.food.x * CELL + 2, this.food.y * CELL + 2, CELL - 4, CELL - 4);

    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
      ctx.fillStyle = '#b8ffc8';
      ctx.font = 'bold 14px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', (COLS * CELL) / 2, ROWS * CELL * 0.42);
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(`score ${this.score}`, (COLS * CELL) / 2, ROWS * CELL * 0.52);
      ctx.fillText('space · again', (COLS * CELL) / 2, ROWS * CELL * 0.62);
    }

    if (this.paused && !this.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
      ctx.fillStyle = '#b8ffc8';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', (COLS * CELL) / 2, (ROWS * CELL) / 2);
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || (e.target as HTMLElement).isContentEditable) {
      return;
    }
    if (this.gameOver && e.code === 'Space') {
      e.preventDefault();
      this.reset();
      return;
    }
    if (e.code === 'KeyP') {
      e.preventDefault();
      if (!this.gameOver) {
        this.paused = !this.paused;
        this.draw();
      }
      return;
    }

    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowUp') {
      dy = -1;
    } else if (e.key === 'ArrowDown') {
      dy = 1;
    } else if (e.key === 'ArrowLeft') {
      dx = -1;
    } else if (e.key === 'ArrowRight') {
      dx = 1;
    } else {
      return;
    }
    e.preventDefault();

    if (this.dir.x === -dx && this.dir.y === -dy) {
      return;
    }
    this.pendingDir = { x: dx, y: dy };
  }
}
