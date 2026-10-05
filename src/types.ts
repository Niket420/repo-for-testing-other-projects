export type Cell = null | PieceType;

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export interface Piece {
  type: PieceType;
  rotation: number; // 0,1,2,3 representing 0,90,180,270
  x: number; // column index of the piece's origin (top-left of its 4x4 matrix)
  y: number; // row index of the piece's origin
}

export interface GameState {
  board: Cell[][]; // [row][col]
  active: Piece | null;
  nextQueue: PieceType[]; // at least 1 piece for preview
  hold: PieceType | null;
  canHold: boolean;
  score: number;
  level: number;
  lines: number;
  highScore: number;
  status: 'READY' | 'RUNNING' | 'PAUSED' | 'GAME_OVER';
}
