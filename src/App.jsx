import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// Grid size
const COLS = 20;
const ROWS = 20;
const CELL_SIZE = 20; // px (handled via CSS)

// Directions
const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

const getOpposite = (dir) => ({ x: -dir.x, y: -dir.y });

export default function App() {
  const [snake, setSnake] = useState([]); // array of {x,y}
  const [direction, setDirection] = useState({ x: 1, y: 0 }); // initial right
  const directionRef = useRef(direction);
  const [nextDirection, setNextDirection] = useState(null);
  const [food, setFood] = useState(null);
  const [status, setStatus] = useState('ready'); // ready, running, paused, over, won
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const stored = localStorage.getItem('snake-high-score');
    return stored ? Number(stored) : 0;
  });
  const [intervalMs, setIntervalMs] = useState(200);
  const intervalRef = useRef(null);

  // ------------------- Helpers -------------------
  const initGame = useCallback(() => {
    // start roughly middle left side horizontally
    const startX = Math.floor(COLS / 2) - 2; // ensure space for 3 segments
    const startY = Math.floor(ROWS / 2);
    const initialSnake = [
      { x: startX + 2, y: startY }, // head (rightmost)
      { x: startX + 1, y: startY },
      { x: startX, y: startY },
    ];
    setSnake(initialSnake);
    setDirection({ x: 1, y: 0 });
    directionRef.current = { x: 1, y: 0 };
    setNextDirection(null);
    setScore(0);
    setIntervalMs(200);
    placeFood(initialSnake);
    setStatus('ready');
  }, []);

  const placeFood = useCallback((snakeBody) => {
    const occupied = new Set(snakeBody.map((seg) => `${seg.x},${seg.y}`));
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    if (free.length === 0) {
      // board full -> win
      setStatus('won');
      return;
    }
    const idx = Math.floor(Math.random() * free.length);
    setFood(free[idx]);
  }, []);

  // ------------------- Movement -------------------
  const move = useCallback(() => {
    setSnake((prev) => {
      const currentDir = directionRef.current;
      const head = prev[0];
      const newHead = { x: head.x + currentDir.x, y: head.y + currentDir.y };

      // wall collision
      if (
        newHead.x < 0 ||
        newHead.x >= COLS ||
        newHead.y < 0 ||
        newHead.y >= ROWS
      ) {
        setStatus('over');
        return prev;
      }

      const eating = food && newHead.x === food.x && newHead.y === food.y;

      // self collision
      // If eating, tail does NOT move, so check against full body.
      // If not eating, tail will move away, so exclude last segment.
      const bodyToCheck = eating ? prev : prev.slice(0, -1);
      const hitSelf = bodyToCheck.some((seg) => seg.x === newHead.x && seg.y === newHead.y);
      if (hitSelf) {
        setStatus('over');
        return prev;
      }

      let newSnake;
      if (eating) {
        // grow: keep tail
        newSnake = [newHead, ...prev];
        // update score and speed
        setScore((s) => {
          const newScore = s + 1;
          setHighScore((hs) => {
            if (newScore > hs) {
              localStorage.setItem('snake-high-score', newScore);
              return newScore;
            }
            return hs;
          });
          return newScore;
        });
        setIntervalMs((ms) => {
          const newMs = ms - 10;
          return newMs < 80 ? 80 : newMs;
        });
        // place new food after state update
        setTimeout(() => placeFood(newSnake), 0);
      } else {
        // normal move: drop tail
        newSnake = [newHead, ...prev.slice(0, -1)];
      }
      return newSnake;
    });
  }, [food, placeFood]);

  // ------------------- Interval handling -------------------
  useEffect(() => {
    if (status === 'running') {
      intervalRef.current && clearInterval(intervalRef.current);
      intervalRef.current = setInterval(move, intervalMs);
    } else {
      intervalRef.current && clearInterval(intervalRef.current);
    }
    return () => {
      intervalRef.current && clearInterval(intervalRef.current);
    };
  }, [status, intervalMs, move]);

  // ------------------- Keyboard handling -------------------
  useEffect(() => {
    const handler = (e) => {
      const key = e.key;
      if (!DIRECTIONS[key]) return;
      e.preventDefault(); // prevent scrolling
      const newDir = DIRECTIONS[key];
      // ignore if opposite
      if (newDir.x === -directionRef.current.x && newDir.y === -directionRef.current.y) {
        return;
      }
      setNextDirection(newDir);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Apply buffered direction before each move tick
  useEffect(() => {
    if (nextDirection) {
      directionRef.current = nextDirection;
      setDirection(nextDirection);
      setNextDirection(null);
    }
  }, [nextDirection]);

  // ------------------- Button actions -------------------
  const startGame = () => {
    if (status === 'running') return; // already running
    if (status === 'ready' || status === 'over' || status === 'won') {
      // ensure fresh init if over/won
      if (status !== 'ready') initGame();
      setStatus('running');
    }
  };

  const pauseGame = () => {
    if (status === 'running') setStatus('paused');
  };

  const resumeGame = () => {
    if (status === 'paused') setStatus('running');
  };

  const restartGame = () => {
    initGame();
    setStatus('ready');
  };

  // Initialize on mount
  useEffect(() => {
    initGame();
  }, [initGame]);

  // ------------------- Rendering -------------------
  const renderBoard = () => {
    const cells = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        let className = 'cell';
        if (snake.some((seg) => seg.x === x && seg.y === y)) {
          const isHead = snake[0].x === x && snake[0].y === y;
          className = isHead ? 'cell snake-head' : 'cell snake-body';
        } else if (food && food.x === x && food.y === y) {
          className = 'cell food';
        }
        cells.push(<div key={`${x},${y}`} className={className} style={{ width: CELL_SIZE, height: CELL_SIZE }} />);
      }
    }
    return <div className="grid" style={{ width: COLS * CELL_SIZE, height: ROWS * CELL_SIZE }}>{cells}</div>;
  };

  // Mobile controls component
  const MobileControls = () => {
    const handlePress = (dir) => {
      if (dir.x === -directionRef.current.x && dir.y === -directionRef.current.y) return;
      setNextDirection(dir);
    };
    return (
      <div className="mobile-controls">
        <button onClick={() => handlePress({ x: 0, y: -1 })}>↑</button>
        <div>
          <button onClick={() => handlePress({ x: -1, y: 0 })}>←</button>
          <button onClick={() => handlePress({ x: 1, y: 0 })}>→</button>
        </div>
        <button onClick={() => handlePress({ x: 0, y: 1 })}>↓</button>
      </div>
    );
  };

  return (
    <div className="app-container">
      <div className="card">
        <h1>Snake Game</h1>
        <div className="info-bar">
          <span>Score: {score}</span>
          <span>High Score: {highScore}</span>
          <span>Status: {status}</span>
        </div>
        {renderBoard()}
        <div className="controls">
          {(status === 'ready' || status === 'over' || status === 'won') && (
            <button onClick={startGame} disabled={status === 'running'}>Start</button>
          )}
          {status === 'running' && <button onClick={pauseGame}>Pause</button>}
          {status === 'paused' && <button onClick={resumeGame}>Resume</button>}
          {(status === 'over' || status === 'won' || status === 'paused') && (
            <button onClick={restartGame}>Restart</button>
          )}
        </div>
        <MobileControls />
      </div>
    </div>
  );
}
