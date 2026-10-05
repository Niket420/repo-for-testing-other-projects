export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
}

export interface Platform {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'static' | 'moving' | 'disappearing';
  // For moving platforms
  direction?: 1 | -1;
  range?: number; // total horizontal range
  speed?: number; // px/s
  baseX?: number; // initial x
  // For disappearing platforms
  landedTimestamp?: number; // when landed
}
