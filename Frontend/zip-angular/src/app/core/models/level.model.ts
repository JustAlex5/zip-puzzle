export interface NumberCellDto {
  row: number;
  col: number;
  number: number;
}

export interface WallBarrierDto {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface LevelDto {
  id: number;
  name: string;
  size: number;
  solveCount: number;
  numbers: NumberCellDto[];
  barriers: WallBarrierDto[];
}
