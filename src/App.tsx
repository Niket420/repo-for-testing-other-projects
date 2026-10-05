import React, { useEffect, useRef, useState, useCallback } from 'react';
import './style.css';

// ---------- Game constants ----------
const LOGICAL_WIDTH = 400; // logical canvas width
const LOGICAL_HEIGHT = 600; // logical canvas height
const GROUND_HEIGHT = 80;

const BIRD_WIDTH = 34;
const BIRD_HEIGHT = 24;
const BIRD_X = LOGICAL_WIDTH * 0.2; // horizontal position of the bird

const GRAVITY = 1500; // pixels per second^2
const FLAP_STRENGTH = -350; // initial upward velocity (pixels per second)
const MAX_DOWNWARD_VELOCITY = 800;

const PIPE_WIDTH = 60;
const PIPE_GAP_INITIAL = 150; // vertical gap size
const PIPE_SPEED_INITIAL = 200; // pixels per second
const PIPE_SPACING = 200; // distance between pipes (logical units)

const DIFFICULTY_THRESHOLDS = [
  { score: 0, speed: 200, gap: 150 },
  { score: 5, speed: 230, gap: 130 },
  { score: 10, speed: 260, gap: 110 },
  { score: 20, speed: 300, gap: 95 },
];

enum GameState {
  READY = 'READY',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

// ---------- Types ----------
interface Bird {
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number; // vertical velocity (px/s)
}

interface Pipe {
  x: number;
  gapY: number; // Y coordinate of top of gap
  gapHeight: number;
  width: number;
  scored: boolean;
}

// ---------- Helper functions ----------
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getDifficulty(score: number) {
  // Return the last threshold that is <= score
  let result = DIFFICULTY_THRESHOLDS[0];
  for (const t of DIFFICULTY_THRESHOLDS) {
    if (score >= t.score) result = t;
    else break;
  }
  return result;
}

function loadHighScore(): number {
  if (typeof localStorage === 'undefined') return 0;
  const stored = localStorage.getItem('flappy-bird-high-score');
  const n = stored ? parseInt(stored, 10) : 0;
  return isNaN(n) ? 0 : n;
}

function saveHighScore(score: number) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('flappy-bird-high-score', String(score));
  } catch (e) {
    // ignore storage errors
  }
}

// ---------- Main App component ----------
const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.READY);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(loadHighScore());

  // Mutable game objects – not in React state to avoid re-renders each frame
  const birdRef = useRef<Bird>({
    x: BIRD_X,
    y: LOGICAL_HEIGHT / 2,
    width: BIRD_WIDTH,
    height: BIRD_HEIGHT,
    vy: 0,
  });
  const pipesRef = useRef<Pipe[]>([]);
  const lastPipeSpawnXRef = useRef<number>(LOGICAL_WIDTH);
  const pipeSpeedRef = useRef<number>(PIPE_SPEED_INITIAL);
  const pipeGapRef = useRef<number>(PIPE_GAP_INITIAL);
  const lastTimestampRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);

  // ---------- Game Loop ----------
  const gameLoop = useCallback((timestamp: number) => {
    if (gameState !== GameState.RUNNING) {
      lastTimestampRef.current = timestamp;
      requestAnimationFrame(gameLoop);
      return;
    }
    const dt = (timestamp - lastTimestampRef.current) / 1000; // seconds
    lastTimestampRef.current = timestamp;
    const delta = Math.min(dt, 0.05); // clamp to avoid huge jumps
    // Update bird physics
    const bird = birdRef.current;
    bird.vy += GRAVITY * delta;
    bird.vy = Math.min(bird.vy, MAX_DOWNWARD_VELOCITY);
    bird.y += bird.vy * delta;

    // Collision with ground
    const groundY = LOGICAL_HEIGHT - GROUND_HEIGHT - bird.height;
    if (bird.y > groundY) {
      bird.y = groundY;
      handleGameOver();
    }
    // Collision with ceiling
    if (bird.y < 0) {
      bird.y = 0;
      handleGameOver(); // treat ceiling hit as game over
    }

    // Update pipes
    const pipeSpeed = pipeSpeedRef.current;
    const pipes = pipesRef.current;
    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      p.x -= pipeSpeed * delta;
    }
    // Remove off-screen pipes
    while (pipes.length && pipes[0].x + PIPE_WIDTH < 0) {
      pipes.shift();
    }

    // Spawn new pipes based on spacing
    spawnTimerRef.current += pipeSpeed * delta;
    if (spawnTimerRef.current >= PIPE_SPACING) {
      spawnTimerRef.current -= PIPE_SPACING;
      const gapHeight = pipeGapRef.current;
      const minGapY = 20;
      const maxGapY = LOGICAL_HEIGHT - GROUND_HEIGHT - gapHeight - 20;
      const gapY = minGapY + Math.random() * (maxGapY - minGapY);
      const newPipe: Pipe = {
        x: LOGICAL_WIDTH,
        gapY,
        gapHeight,
        width: PIPE_WIDTH,
        scored: false,
      };
      pipes.push(newPipe);
    }

    // Scoring
    for (const p of pipes) {
      if (!p.scored && p.x + PIPE_WIDTH < bird.x) {
        p.scored = true;
        setScore((s) => {
          const newScore = s + 1;
          // update difficulty based on newScore
          const diff = getDifficulty(newScore);
          pipeSpeedRef.current = diff.speed;
          pipeGapRef.current = diff.gap;
          // high score handling
          if (newScore > highScore) {
            setHighScore(newScore);
            saveHighScore(newScore);
          }
          return newScore;
        });
      }
    }

    // Collision with pipes
    for (const p of pipes) {
      const birdRect = {
        left: bird.x,
        right: bird.x + bird.width,
        top: bird.y,
        bottom: bird.y + bird.height,
      };
      const pipeRectTop = {
        left: p.x,
        right: p.x + p.width,
        top: 0,
        bottom: p.gapY,
      };
      const pipeRectBottom = {
        left: p.x,
        right: p.x + p.width,
        top: p.gapY + p.gapHeight,
        bottom: LOGICAL_HEIGHT - GROUND_HEIGHT,
      };
      const intersect =
        !(birdRect.right < pipeRectTop.left ||
          birdRect.left > pipeRectTop.right ||
          birdRect.bottom < pipeRectTop.top ||
          birdRect.top > pipeRectTop.bottom) ||
        !(birdRect.right < pipeRectBottom.left ||
          birdRect.left > pipeRectBottom.right ||
          birdRect.bottom < pipeRectBottom.top ||
          birdRect.top > pipeRectBottom.bottom);
      if (intersect) {
        handleGameOver();
        break;
      }
    }

    // Render
    draw();
    requestAnimationFrame(gameLoop);
  }, [gameState, highScore]);

  // ---------- Rendering ----------
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Clear
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    grad.addColorStop(0, '#70c5ce');
    grad.addColorStop(1, '#4a90e2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    // Pipes
    ctx.fillStyle = '#4caf50';
    const pipes = pipesRef.current;
    for (const p of pipes) {
      // top pipe
      ctx.fillRect(p.x, 0, p.width, p.gapY);
      // bottom pipe
      ctx.fillRect(p.x, p.gapY + p.gapHeight, p.width, LOGICAL_HEIGHT - GROUND_HEIGHT - (p.gapY + p.gapHeight));
    }
    // Ground
    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, LOGICAL_HEIGHT - GROUND_HEIGHT, LOGICAL_WIDTH, GROUND_HEIGHT);
    // Bird
    const bird = birdRef.current;
    ctx.save();
    // Rotate based on velocity (max +/- 45deg)
    const maxTilt = Math.PI / 6; // 30deg
    const tilt = clamp(bird.vy / 400, -1, 1) * maxTilt;
    ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
    ctx.rotate(tilt);
    ctx.translate(-(bird.x + bird.width / 2), -(bird.y + bird.height / 2));
    ctx.fillStyle = '#ffdd57';
    ctx.fillRect(bird.x, bird.y, bird.width, bird.height);
    ctx.restore();
  };

  // ---------- Game state helpers ----------
  const resetGame = () => {
    // Reset mutable objects
    birdRef.current = {
      x: BIRD_X,
      y: LOGICAL_HEIGHT / 2,
      width: BIRD_WIDTH,
      height: BIRD_HEIGHT,
      vy: 0,
    };
    pipesRef.current = [];
    spawnTimerRef.current = 0;
    pipeSpeedRef.current = PIPE_SPEED_INITIAL;
    pipeGapRef.current = PIPE_GAP_INITIAL;
    setScore(0);
    setGameState(GameState.READY);
    // Ensure we have a fresh timestamp for the loop
    lastTimestampRef.current = 0;
    // Redraw initial frame
    draw();
  };

  const startGame = () => {
    if (gameState !== GameState.READY) return;
    // Start bird with small upward velocity so it doesn't sit still
    birdRef.current.vy = 0;
    setGameState(GameState.RUNNING);
    // Reset timestamp to avoid large dt on first frame
    lastTimestampRef.current = performance.now();
    requestAnimationFrame(gameLoop);
  };

  const pauseGame = () => {
    if (gameState === GameState.RUNNING) setGameState(GameState.PAUSED);
    else if (gameState === GameState.PAUSED) setGameState(GameState.RUNNING);
  };

  const handleGameOver = () => {
    if (gameState !== GameState.RUNNING) return;
    setGameState(GameState.GAME_OVER);
  };

  // ---------- Input handling ----------
  const handleFlap = useCallback(() => {
    if (gameState === GameState.READY) {
      startGame();
      return;
    }
    if (gameState !== GameState.RUNNING) return;
    const bird = birdRef.current;
    bird.vy = FLAP_STRENGTH;
  }, [gameState]);

  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        handleFlap();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        pauseGame();
      }
    };
    const mouseDown = (e: MouseEvent) => {
      e.preventDefault();
      handleFlap();
    };
    const touchStart = (e: TouchEvent) => {
      e.preventDefault();
      handleFlap();
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('mousedown', mouseDown);
    window.addEventListener('touchstart', touchStart, { passive: false });
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('mousedown', mouseDown);
      window.removeEventListener('touchstart', touchStart);
    };
  }, [handleFlap]);

  // ---------- Resize handling ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const scale = Math.min(rect.width / LOGICAL_WIDTH, rect.height / LOGICAL_HEIGHT);
      canvas.style.width = `${LOGICAL_WIDTH * scale}px`;
      canvas.style.height = `${LOGICAL_HEIGHT * scale}px`;
      canvas.width = LOGICAL_WIDTH;
      canvas.height = LOGICAL_HEIGHT;
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Initial draw
  useEffect(() => {
    draw();
  }, []);

  // ---------- UI rendering ----------
  return (
    <div className="game-container">
      <canvas ref={canvasRef} className="game-canvas" />
      {/* Score display */}
      {gameState !== GameState.READY && (
        <div className="score">Score: {score}</div>
      )}
      {/* High score display */}
      <div className="high-score">Best: {highScore}</div>
      {/* Overlays */}
      {gameState === GameState.READY && (
        <div className="overlay overlay-center">
          <h1>FLAPPY BIRD</h1>
          <p>Press Space, Arrow Up, W, Click or Tap to Start</p>
          <p>Press P to Pause</p>
        </div>
      )}
      {gameState === GameState.PAUSED && (
        <div className="overlay overlay-center">
          <h1>PAUSED</h1>
          <button onClick={pauseGame} className="btn">
            Resume
          </button>
        </div>
      )}
      {gameState === GameState.GAME_OVER && (
        <div className="overlay overlay-center">
          <h1>GAME OVER</h1>
          <p>Your Score: {score}</p>
          <p>Best: {highScore}</p>
          <button onClick={resetGame} className="btn">
            Restart
          </button>
        </div>
      )}
      {/* Pause button */}
      {gameState === GameState.RUNNING && (
        <button onClick={pauseGame} className="pause-btn btn">
          Pause
        </button>
      )}
    </div>
  );
};

export default App;
