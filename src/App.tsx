import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  COLORS,
  TETROMINO_SHAPES,
  KICK_DATA,
  KICK_DATA_I,
  LINE_CLEAR_SCORES,
  GRAVITY_TABLE,
} from './constants';
import { Cell, Piece, PieceType, GameState } from './types';

const LOCAL_STORAGE_KEY = 'tetris-high-score';

// Helper: create empty board
const createEmptyBoard = (): Cell[][] =>
  Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));

// Shuffle utility (Fisher-Yates)
const shuffle = (arr: any[]) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// 7-bag generator
const getNewBag = (): PieceType[] => shuffle(['I','O','T','S','Z','J','L'] as PieceType[]);

// Get cells for piece based on rotation (relative to piece.x, piece.y)
const getCells = (piece: Piece): [number, number][] => {
  const shape = TETROMINO_SHAPES[piece.type][piece.rotation % 4];
  return shape.map(([dx, dy]) => [piece.x + dx, piece.y + dy]);
};

// Collision check
const isValidPosition = (board: Cell[][], piece: Piece, x: number, y: number, rotation: number): boolean => {
  const shape = TETROMINO_SHAPES[piece.type][rotation % 4];
  for (const [dx, dy] of shape) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= BOARD_WIDTH || ny < 0 || ny >= BOARD_HEIGHT) return false;
    if (board[ny][nx]) return false;
  }
  return true;
};

// Wall kick handling (SRS simplified)
const tryRotate = (board: Cell[][], piece: Piece, dir: 1 | -1): Piece | null => {
  const from = piece.rotation % 4;
  const to = (from + dir + 4) % 4;
  const key = `${from}-${to}`;
  const kicks = piece.type === 'I' ? KICK_DATA_I[key] : KICK_DATA[key];
  if (!kicks) return null;
  for (const [dx, dy] of kicks) {
    const nx = piece.x + dx;
    const ny = piece.y + dy;
    if (isValidPosition(board, piece, nx, ny, to)) {
      return { ...piece, x: nx, y: ny, rotation: to };
    }
  }
  return null;
};

// Merge piece into board
const lockPiece = (board: Cell[][], piece: Piece): Cell[][] => {
  const newBoard = board.map(row => row.slice());
  for (const [x, y] of getCells(piece)) {
    if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
      newBoard[y][x] = piece.type;
    }
  }
  return newBoard;
};

// Clear complete lines
const clearLines = (board: Cell[][]): { board: Cell[][]; linesCleared: number } => {
  const newBoard: Cell[][] = [];
  let linesCleared = 0;
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    if (board[y].every(cell => cell !== null)) {
      linesCleared++;
    } else {
      newBoard.push(board[y]);
    }
  }
  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array(BOARD_WIDTH).fill(null));
  }
  return { board: newBoard, linesCleared };
};

// Compute ghost Y position (lowest valid)
const getGhostY = (board: Cell[][], piece: Piece): number => {
  let y = piece.y;
  while (isValidPosition(board, piece, piece.x, y + 1, piece.rotation)) {
    y++;
  }
  return y;
};

const App: React.FC = () => {
  // --- React state (UI) ----------------------------------------------------
  const [board, setBoard] = useState<Cell[][]>(createEmptyBoard);
  const [active, setActive] = useState<Piece | null>(null);
  const [nextQueue, setNextQueue] = useState<PieceType[]>(() => {
    const bag = getNewBag();
    return bag.slice(0, 3);
  });
  const bagRef = useRef<PieceType[]>(getNewBag().slice(3)); // remaining pieces in current bag
  const [hold, setHold] = useState<PieceType | null>(null);
  const [canHold, setCanHold] = useState<boolean>(true);
  const [score, setScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [lines, setLines] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? Number(saved) : 0;
    }
    return 0;
  });
  const [status, setStatus] = useState<'READY' | 'RUNNING' | 'PAUSED' | 'GAME_OVER'>('READY');

  const animationRef = useRef<number>(0);
  const lastDropTime = useRef<number>(0);

  // --- Piece spawning ------------------------------------------------------
  const spawnPiece = useCallback((currentBoard: Cell[][]) => {
    // Ensure queue has at least 3 upcoming pieces
    let queue = [...nextQueue];
    let bag = bagRef.current;
    while (queue.length < 3) {
      if (bag.length === 0) bag = getNewBag();
      queue.push(bag.shift() as PieceType);
    }
    const type = queue.shift() as PieceType;
    setNextQueue(queue);
    bagRef.current = bag;
    const newPiece: Piece = { type, rotation: 0, x: 3, y: 0 };
    // Validate spawn; if invalid -> game over
    if (!isValidPosition(currentBoard, newPiece, newPiece.x, newPiece.y, newPiece.rotation)) {
      setStatus('GAME_OVER');
      setActive(null);
    } else {
      setActive(newPiece);
      setCanHold(true);
    }
  }, [nextQueue]);

  // --- Main game loop (gravity) ------------------------------------------
  useEffect(() => {
    if (status !== 'RUNNING') return;
    const gravityDelay = GRAVITY_TABLE[Math.min(level - 1, GRAVITY_TABLE.length - 1)];
    const tick = (timestamp: number) => {
      if (lastDropTime.current === 0) lastDropTime.current = timestamp;
      const delta = timestamp - lastDropTime.current;
      if (delta >= gravityDelay) {
        if (active) {
          const canMoveDown = isValidPosition(board, active, active.x, active.y + 1, active.rotation);
          if (canMoveDown) {
            setActive({ ...active, y: active.y + 1 });
          } else {
            // lock piece
            const lockedBoard = lockPiece(board, active);
            const { board: clearedBoard, linesCleared } = clearLines(lockedBoard);
            // scoring for line clears
            if (linesCleared > 0) {
              const added = LINE_CLEAR_SCORES[linesCleared] * level;
              setScore(prev => prev + added);
            }
            const newLines = lines + linesCleared;
            setLines(newLines);
            const newLevel = Math.floor(newLines / 10) + 1;
            if (newLevel !== level) setLevel(newLevel);
            setBoard(clearedBoard);
            setActive(null);
            // spawn using the *cleared* board to reflect removed lines
            spawnPiece(clearedBoard);
          }
        }
        lastDropTime.current = timestamp;
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationRef.current);
  }, [status, active, board, level, lines, spawnPiece]);

  // --- Start / Restart -----------------------------------------------------
  const startGame = () => {
    const empty = createEmptyBoard();
    setBoard(empty);
    setScore(0);
    setLevel(1);
    setLines(0);
    setHold(null);
    setCanHold(true);
    const bag = getNewBag();
    setNextQueue(bag.slice(0, 3));
    bagRef.current = bag.slice(3);
    setStatus('RUNNING');
    setActive(null);
    // spawn after state is set
    setTimeout(() => spawnPiece(empty), 0);
  };

  const pauseGame = () => {
    if (status === 'RUNNING') setStatus('PAUSED');
    else if (status === 'PAUSED') setStatus('RUNNING');
  };

  const restartGame = () => startGame();

  // --- Keyboard handling ---------------------------------------------------
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (status !== 'RUNNING') {
        if (e.key === 'Enter' || e.key === ' ') startGame();
        return;
      }
      if (!active) return;
      const key = e.key;
      if (['ArrowLeft', 'a', 'A'].includes(key)) {
        if (isValidPosition(board, active, active.x - 1, active.y, active.rotation))
          setActive({ ...active, x: active.x - 1 });
      } else if (['ArrowRight', 'd', 'D'].includes(key)) {
        if (isValidPosition(board, active, active.x + 1, active.y, active.rotation))
          setActive({ ...active, x: active.x + 1 });
      } else if (['ArrowDown', 's', 'S'].includes(key)) {
        if (isValidPosition(board, active, active.x, active.y + 1, active.rotation)) {
          setActive({ ...active, y: active.y + 1 });
          setScore(prev => prev + 1); // soft drop point
        }
      } else if (['ArrowUp', 'w', 'W', 'x', 'X'].includes(key)) {
        const rotated = tryRotate(board, active, 1);
        if (rotated) setActive(rotated);
      } else if (['z', 'Z'].includes(key)) {
        const rotated = tryRotate(board, active, -1);
        if (rotated) setActive(rotated);
      } else if (key === ' ') {
        // Hard drop
        const dropY = getGhostY(board, active);
        const rows = dropY - active.y;
        if (rows > 0) setScore(prev => prev + rows * 2);
        const landed = { ...active, y: dropY };
        const lockedBoard = lockPiece(board, landed);
        const { board: clearedBoard, linesCleared } = clearLines(lockedBoard);
        if (linesCleared > 0) setScore(prev => prev + LINE_CLEAR_SCORES[linesCleared] * level);
        const newLines = lines + linesCleared;
        setLines(newLines);
        const newLevel = Math.floor(newLines / 10) + 1;
        if (newLevel !== level) setLevel(newLevel);
        setBoard(clearedBoard);
        setActive(null);
        spawnPiece(clearedBoard);
      } else if (['c', 'C', 'Shift'].includes(key)) {
        if (!canHold) return;
        if (hold === null) {
          setHold(active.type);
          setActive(null);
          spawnPiece(board);
        } else {
          const swapped: Piece = { type: hold, rotation: 0, x: 3, y: 0 };
          setHold(active.type);
          setActive(swapped);
        }
        setCanHold(false);
      } else if (['p', 'P'].includes(key)) {
        pauseGame();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [status, active, board, hold, canHold, level, lines, spawnPiece]);

  // --- High score persistence ------------------------------------------------
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY, String(score));
      }
    }
  }, [score, highScore]);

  // --- Rendering helpers ----------------------------------------------------
  const renderCell = (x: number, y: number) => {
    const cell = board[y][x];
    let className = 'cell';
    const style: React.CSSProperties = {};
    if (cell) {
      className += ' filled';
      style.background = COLORS[cell];
    }
    // active piece overlay
    if (active) {
      const activeCells = getCells(active);
      if (activeCells.some(([ax, ay]) => ax === x && ay === y)) {
        className += ' active';
        style.background = COLORS[active.type];
      } else {
        // ghost piece
        const ghostY = getGhostY(board, active);
        const ghostPiece = { ...active, y: ghostY };
        const ghostCells = getCells(ghostPiece);
        if (ghostCells.some(([gx, gy]) => gx === x && gy === y)) {
          className += ' ghost';
          style.background = COLORS.GHOST;
        }
      }
    }
    return <div key={`${x}-${y}`} className={className} style={style}></div>;
  };

  const renderBoard = () => {
    const rows = [];
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      const cols = [];
      for (let x = 0; x < BOARD_WIDTH; x++) {
        cols.push(renderCell(x, y));
      }
      rows.push(
        <React.Fragment key={y}>
          {cols}
        </React.Fragment>
      );
    }
    return rows;
  };

  const renderPreview = (type: PieceType | null) => {
    const size = 4;
    const grid = Array.from({ length: size }, () => Array(size).fill(null));
    if (type) {
      const shape = TETROMINO_SHAPES[type][0]; // default rotation
      for (const [dx, dy] of shape) {
        if (dx < size && dy < size) grid[dy][dx] = type;
      }
    }
    return (
      <div className="preview">
        {grid.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${x}-${y}`}
              className="cell"
              style={{
                background: cell ? COLORS[cell] : undefined,
                border: '1px solid #333',
              }}
            ></div>
          ))
        )}
      </div>
    );
  };

  // --- Touch controls -------------------------------------------------------
  const handleTouch = (action: string) => {
    if (!active) return;
    if (action === 'left') {
      if (isValidPosition(board, active, active.x - 1, active.y, active.rotation))
        setActive({ ...active, x: active.x - 1 });
    } else if (action === 'right') {
      if (isValidPosition(board, active, active.x + 1, active.y, active.rotation))
        setActive({ ...active, x: active.x + 1 });
    } else if (action === 'soft') {
      if (isValidPosition(board, active, active.x, active.y + 1, active.rotation)) {
        setActive({ ...active, y: active.y + 1 });
        setScore(prev => prev + 1);
      }
    } else if (action === 'rotate') {
      const rotated = tryRotate(board, active, 1);
      if (rotated) setActive(rotated);
    } else if (action === 'hard') {
      const dropY = getGhostY(board, active);
      const rows = dropY - active.y;
      if (rows > 0) setScore(prev => prev + rows * 2);
      const landed = { ...active, y: dropY };
      const lockedBoard = lockPiece(board, landed);
      const { board: clearedBoard, linesCleared } = clearLines(lockedBoard);
      if (linesCleared > 0) setScore(prev => prev + LINE_CLEAR_SCORES[linesCleared] * level);
      const newLines = lines + linesCleared;
      setLines(newLines);
      const newLevel = Math.floor(newLines / 10) + 1;
      if (newLevel !== level) setLevel(newLevel);
      setBoard(clearedBoard);
      setActive(null);
      spawnPiece(clearedBoard);
    } else if (action === 'hold') {
      if (!canHold) return;
      if (hold === null) {
        setHold(active.type);
        setActive(null);
        spawnPiece(board);
      } else {
        const swapped: Piece = { type: hold, rotation: 0, x: 3, y: 0 };
        setHold(active.type);
        setActive(swapped);
      }
      setCanHold(false);
    }
  };

  return (
    <div className="app">
      <h1>Tetris</h1>
      <div className="info-panel">
        <div>Score: {score}</div>
        <div>Level: {level}</div>
        <div>Lines: {lines}</div>
        <div>High Score: {highScore}</div>
      </div>
      <div className="game-container">
        <div className="info-panel">
          <div>Hold</div>
          {renderPreview(hold)}
          <button onClick={restartGame}>Restart</button>
          <button onClick={pauseGame}>{status === 'PAUSED' ? 'Resume' : 'Pause'}</button>
        </div>
        <div className="board">
          {renderBoard()}
          {status !== 'RUNNING' && (
            <div className="overlay">
              {status === 'READY' && <div>Press Enter or Click Start</div>}
              {status === 'PAUSED' && <div>Paused</div>}
              {status === 'GAME_OVER' && (
                <div>
                  Game Over<br />
                  Final Score: {score}<br />
                  <button onClick={restartGame}>Restart</button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="info-panel">
          <div>Next</div>
          {renderPreview(nextQueue[0] || null)}
        </div>
      </div>
      {status === 'READY' && (
        <div className="controls">
          <button onClick={startGame}>Start</button>
        </div>
      )}
      {status === 'RUNNING' && (
        <div className="controls">
          <button onClick={() => handleTouch('left')}>←</button>
          <button onClick={() => handleTouch('right')}>→</button>
          <button onClick={() => handleTouch('soft')}>↓</button>
          <button onClick={() => handleTouch('rotate')}>⤾</button>
          <button onClick={() => handleTouch('hard')}>␣</button>
          <button onClick={() => handleTouch('hold')}>Hold</button>
          <button onClick={pauseGame}>Pause</button>
        </div>
      )}
    </div>
  );
};

export default App;
