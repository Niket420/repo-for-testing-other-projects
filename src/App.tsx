import React, { useEffect, useState, useCallback, useRef } from 'react';
import './App.css';

type Board = number[][]; // 4x4 matrix

type GameStatus = 'playing' | 'won' | 'over';

interface GameState {
  board: Board;
  score: number;
}

const EMPTY_BOARD: Board = [
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
];

const BOARD_SIZE = 4;
const BEST_SCORE_KEY = '2048-best-score';

const App: React.FC = () => {
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [history, setHistory] = useState<GameState[]>([]);
  const [newTilePos, setNewTilePos] = useState<{ r: number; c: number } | null>(null);

  // Load best score on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_SCORE_KEY);
      const val = stored ? parseInt(stored, 10) : 0;
      if (!isNaN(val) && val > 0) setBestScore(val);
    } catch {
      // ignore
    }
    newGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist best score
  useEffect(() => {
    try {
      localStorage.setItem(BEST_SCORE_KEY, bestScore.toString());
    } catch {}
  }, [bestScore]);

  const emptyCells = (brd: Board) => {
    const cells: { r: number; c: number }[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (brd[r][c] === 0) cells.push({ r, c });
      }
    }
    return cells;
  };

  const spawnTile = (brd: Board): { board: Board; pos: { r: number; c: number } | null } => {
    const empties = emptyCells(brd);
    if (empties.length === 0) return { board: brd, pos: null };
    const idx = Math.floor(Math.random() * empties.length);
    const { r, c } = empties[idx];
    const value = Math.random() < 0.9 ? 2 : 4;
    const newBoard = brd.map(row => row.slice());
    newBoard[r][c] = value;
    return { board: newBoard, pos: { r, c } };
  };

  const initEmptyBoard = (): Board => {
    return EMPTY_BOARD.map(row => row.slice());
  };

  const newGame = () => {
    let b = initEmptyBoard();
    const first = spawnTile(b);
    b = first.board;
    const second = spawnTile(b);
    b = second.board;
    setBoard(b);
    setScore(0);
    setStatus('playing');
    setHistory([]);
    setNewTilePos(second.pos);
  };

  const addHistory = (prev: GameState) => {
    setHistory(prevHist => {
      const newHist = [prev, ...prevHist];
      return newHist.slice(0, 10);
    });
  };

  // --- movement helpers ---------------------------------------------------
  const compressLine = (line: number[]) => {
    const filtered = line.filter(v => v !== 0);
    const newLine: number[] = [];
    let scoreDelta = 0;
    let i = 0;
    while (i < filtered.length) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        const merged = filtered[i] * 2;
        newLine.push(merged);
        scoreDelta += merged;
        i += 2;
      } else {
        newLine.push(filtered[i]);
        i += 1;
      }
    }
    while (newLine.length < BOARD_SIZE) newLine.push(0);
    const moved = !newLine.every((v, idx) => v === line[idx]);
    return { newLine, scoreDelta, moved };
  };

  const rotateClockwise = (brd: Board): Board => {
    const newB: Board = initEmptyBoard();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        newB[c][BOARD_SIZE - 1 - r] = brd[r][c];
      }
    }
    return newB;
  };

  const rotateTimes = (board: Board, times: number): Board => {
    let b = board;
    for (let i = 0; i < times; i++) {
      b = rotateClockwise(b);
    }
    return b;
  };

  const move = (direction: 'left' | 'right' | 'up' | 'down') => {
    if (status !== 'playing') return;
    // Determine how many clockwise rotations are needed to align the move with a left compress
    const rotMap: Record<typeof direction, number> = {
      left: 0,
      up: 1,
      right: 2,
      down: 3,
    };
    const rotations = rotMap[direction];
    // Rotate board to simplify processing
    const rotated = rotateTimes(board, rotations);
    // Process each row as a left move
    let moved = false;
    let scoreInc = 0;
    const newRows: Board = initEmptyBoard();
    for (let r = 0; r < BOARD_SIZE; r++) {
      const { newLine, scoreDelta, moved: lineMoved } = compressLine(rotated[r]);
      newRows[r] = newLine;
      if (lineMoved) moved = true;
      scoreInc += scoreDelta;
    }
    if (!moved) return; // No changes, ignore input
    // Rotate back to original orientation
    const finalBoard = rotateTimes(newRows, (4 - rotations) % 4);
    // Save history before mutating state
    addHistory({ board, score });
    // Spawn a new tile after applying move
    const { board: afterSpawn, pos } = spawnTile(finalBoard);
    setBoard(afterSpawn);
    setScore(prev => prev + scoreInc);
    setNewTilePos(pos);
    // Update best score
    setBestScore(prev => {
      const newScore = score + scoreInc;
      return newScore > prev ? newScore : prev;
    });
    // Check win condition
    const has2048 = afterSpawn.some(row => row.includes(2048));
    if (has2048 && status !== 'won') {
      setStatus('won');
    }
    // Check game over
    if (checkGameOver(afterSpawn)) {
      setStatus('over');
    }
  };

  const checkGameOver = (brd: Board): boolean => {
    if (emptyCells(brd).length > 0) return false;
    // Horizontal possible merges
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE - 1; c++) {
        if (brd[r][c] === brd[r][c + 1]) return false;
      }
    }
    // Vertical merges
    for (let c = 0; c < BOARD_SIZE; c++) {
      for (let r = 0; r < BOARD_SIZE - 1; r++) {
        if (brd[r][c] === brd[r + 1][c]) return false;
      }
    }
    return true;
  };

  // --- input handling -----------------------------------------------------
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (status !== 'playing') return;
      const key = e.key;
      if (['ArrowUp', 'w', 'W'].includes(key)) {
        e.preventDefault();
        move('up');
      } else if (['ArrowDown', 's', 'S'].includes(key)) {
        e.preventDefault();
        move('down');
      } else if (['ArrowLeft', 'a', 'A'].includes(key)) {
        e.preventDefault();
        move('left');
      } else if (['ArrowRight', 'd', 'D'].includes(key)) {
        e.preventDefault();
        move('right');
      }
    },
    [move, status]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const undo = () => {
    if (history.length === 0) return;
    const [prev, ...rest] = history;
    setBoard(prev.board);
    setScore(prev.score);
    setHistory(rest);
    setStatus('playing');
    setNewTilePos(null);
  };

  // --- touch / swipe handling --------------------------------------------
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 30;
    if (Math.max(absX, absY) < threshold) return;
    if (absX > absY) {
      if (dx > 0) move('right'); else move('left');
    } else {
      if (dy > 0) move('down'); else move('up');
    }
    touchStart.current = null;
  };

  // --- rendering helpers ---------------------------------------------------
  const tileClass = (value: number) => {
    if (value === 0) return '';
    const base = `tile tile-${value}`;
    if (value > 2048) return `${base} tile-super`;
    return base;
  };

  const renderTiles = () => {
    const tiles: JSX.Element[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const val = board[r][c];
        if (val === 0) continue;
        const isNew = newTilePos && newTilePos.r === r && newTilePos.c === c;
        const classes = `${tileClass(val)} ${isNew ? 'tile-new' : ''}`;
        const style: React.CSSProperties = {
          top: `${r * 25}%`,
          left: `${c * 25}%`,
        };
        tiles.push(
          <div key={`t-${r}-${c}-${val}`} className={classes} style={style}>
            {val}
          </div>
        );
      }
    }
    return tiles;
  };

  return (
    <div className="app">
      <header>
        <div className="title">2048</div>
        <div className="stats">
          <div>Score: {score}</div>
          <div>Best: {bestScore}</div>
        </div>
        <div className="buttons">
          <button onClick={undo} disabled={history.length === 0}>
            Undo
          </button>
          <button onClick={newGame}>New Game</button>
        </div>
      </header>
      <div
        className="board-container"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* background cells */}
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, i) => (
          <div key={i} className="cell" />
        ))}
        {/* tiles */}
        {renderTiles()}
        {status === 'won' && (
          <div className="overlay">
            <div>YOU WIN!</div>
            <button onClick={() => setStatus('playing')}>Continue</button>
            <button onClick={newGame}>New Game</button>
          </div>
        )}
        {status === "over" && (
          <div className="overlay">
            <div>GAME OVER</div>
            <button onClick={newGame}>Try Again</button>
          </div>
        )}
      </div>
      {/* Mobile directional controls */}
      <div className="controls">
        <button onClick={() => move('up')}>↑</button>
        <button onClick={() => move('left')}>←</button>
        <button onClick={() => move('down')}>↓</button>
        <button onClick={() => move('right')}>→</button>
      </div>
    </div>
  );
};

export default App;
