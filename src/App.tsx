import React, { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';

// ----- Game constants -----
const GAME_WIDTH = 400; // logical width
const GAME_HEIGHT = 600; // logical height
const GROUND_HEIGHT = 100; // height of ground area at bottom

const BIRD_WIDTH = 34;
const BIRD_HEIGHT = 24;
const BIRD_X = GAME_WIDTH * 0.2; // horizontal position stays constant

const PIPE_WIDTH = 60;
const PIPE_GAP_INITIAL = 150; // initial gap height
const PIPE_SPEED_INITIAL = 120; // pixels per second
const PIPE_SPACING = 200; // horizontal distance between pipe pairs

const GRAVITY = 800; // pixels per second^2
const FLAP_STRENGTH = -300; // initial upward velocity (negative because y down)
const MAX_DROP_SPEED = 500; // terminal velocity

const DIFFICULTY_THRESHOLDS = [5, 10, 20]; // scores at which difficulty steps up
const PIPE_SPEED_INCREMENT = 20; // per difficulty step
const GAP_DECREMENT = 15; // per difficulty step

// ----- Types -----
enum GameState {
  READY = 'READY',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

type Bird = {
  x: number;
  y: number;
  vy: number; // vertical velocity
};

type Pipe = {
  x: number; // left edge
  gapY: number; // top of gap
  gapHeight: number;
  scored: boolean;
};

// ----- Helper functions -----
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const loadHighScore = (): number => {
  try {
    const stored = localStorage.getItem('flappy-bird-high-score');
    const parsed = stored ? Number(stored) : 0;
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
};

const saveHighScore = (score: number) => {
  try {
    localStorage.setItem('flappy-bird-high-score', String(score));
  } catch {}
};

// ----- Main component -----
const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // UI state (React)
  const [gameState, setGameState] = useState<GameState>(GameState.READY);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(loadHighScore());

  // Game data (mutable refs for performance)
  const birdRef = useRef<Bird>({ x: BIRD_X, y: GAME_HEIGHT / 2, vy: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const pipeSpeedRef = useRef<number>(PIPE_SPEED_INITIAL);
  const gapHeightRef = useRef<number>(PIPE_GAP_INITIAL);

  // ----- Input handling -----
  const flap = useCallback(() => {
    const bird = birdRef.current;
    bird.vy = FLAP_STRENGTH;
  }, []);

  const startGame = useCallback(() => {
    // Reset state for a fresh game
    birdRef.current = { x: BIRD_X, y: GAME_HEIGHT / 2, vy: 0 };
    pipesRef.current = [];
    spawnTimerRef.current = 0;
    pipeSpeedRef.current = PIPE_SPEED_INITIAL;
    gapHeightRef.current = PIPE_GAP_INITIAL;
    setScore(0);
    setGameState(GameState.RUNNING);
    // Reset timestamp to avoid large delta on first frame
    lastTimeRef.current = performance.now();
  }, []);

  const pauseGame = useCallback(() => {
    setGameState(GameState.PAUSED);
  }, []);

  const resumeGame = useCallback(() => {
    setGameState(GameState.RUNNING);
    // Reset timestamp to avoid big delta after pause
    lastTimeRef.current = performance.now();
  }, []);

  const gameOver = useCallback(() => {
    setGameState(GameState.GAME_OVER);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (gameState === GameState.READY) {
          startGame();
        } else if (gameState === GameState.RUNNING) {
          flap();
        } else if (gameState === GameState.PAUSED) {
          resumeGame();
        }
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (gameState === GameState.RUNNING) {
          pauseGame();
        } else if (gameState === GameState.PAUSED) {
          resumeGame();
        }
      }
    },
    [gameState, flap, startGame, pauseGame, resumeGame]
  );

  const handlePointerDown = useCallback(
    (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      if (gameState === GameState.READY) {
        startGame();
      } else if (gameState === GameState.RUNNING) {
        flap();
      } else if (gameState === GameState.PAUSED) {
        resumeGame();
      }
    },
    [gameState, flap, startGame, resumeGame]
  );

  // ----- Pipe generation -----
  const generatePipe = () => {
    const gapHeight = gapHeightRef.current;
    const minGapY = 50; // top margin
    const maxGapY = GAME_HEIGHT - GROUND_HEIGHT - gapHeight - 50; // bottom margin
    const gapY = Math.random() * (maxGapY - minGapY) + minGapY;
    const pipe: Pipe = {
      x: GAME_WIDTH,
      gapY,
      gapHeight,
      scored: false,
    };
    pipesRef.current.push(pipe);
  };

  // ----- Collision detection -----
  const checkCollision = () => {
    const bird = birdRef.current;
    // Ground collision
    if (bird.y + BIRD_HEIGHT > GAME_HEIGHT - GROUND_HEIGHT) {
      return true;
    }
    // Ceiling collision
    if (bird.y < 0) {
      return true;
    }
    // Pipe collision
    for (const pipe of pipesRef.current) {
      // Horizontal overlap?
      if (bird.x + BIRD_WIDTH > pipe.x && bird.x < pipe.x + PIPE_WIDTH) {
        // Top pipe
        if (bird.y < pipe.gapY) {
          return true;
        }
        // Bottom pipe
        if (bird.y + BIRD_HEIGHT > pipe.gapY + pipe.gapHeight) {
          return true;
        }
      }
    }
    return false;
  };

  // ----- Game loop -----
  const update = (delta: number) => {
    if (gameState !== GameState.RUNNING) return;
    const bird = birdRef.current;
    // Bird physics
    bird.vy += GRAVITY * delta;
    bird.vy = clamp(bird.vy, -Infinity, MAX_DROP_SPEED);
    bird.y += bird.vy * delta;

    // Pipes movement
    const speed = pipeSpeedRef.current;
    for (const pipe of pipesRef.current) {
      pipe.x -= speed * delta;
    }
    // Remove off-screen pipes
    pipesRef.current = pipesRef.current.filter(p => p.x + PIPE_WIDTH > 0);

    // Spawn new pipes based on horizontal distance travelled
    spawnTimerRef.current += delta * speed; // distance travelled since last spawn
    if (spawnTimerRef.current > PIPE_SPACING) {
      generatePipe();
      spawnTimerRef.current = 0;
    }

    // Scoring
    for (const pipe of pipesRef.current) {
      if (!pipe.scored && bird.x > pipe.x + PIPE_WIDTH) {
        pipe.scored = true;
        setScore(prev => prev + 1);
      }
    }

    // Collision check
    if (checkCollision()) {
      gameOver();
    }
  };

  const render = (ctx: CanvasRenderingContext2D) => {
    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // Scale to logical coordinate system
    const scaleX = ctx.canvas.width / GAME_WIDTH;
    const scaleY = ctx.canvas.height / GAME_HEIGHT;
    ctx.save();
    ctx.scale(scaleX, scaleY);
    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    bg.addColorStop(0, '#70c5ce');
    bg.addColorStop(1, '#1c3b61');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Pipes
    ctx.fillStyle = '#4caf50';
    for (const pipe of pipesRef.current) {
      // top pipe
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.gapY);
      // bottom pipe
      ctx.fillRect(
        pipe.x,
        pipe.gapY + pipe.gapHeight,
        PIPE_WIDTH,
        GAME_HEIGHT - GROUND_HEIGHT - (pipe.gapY + pipe.gapHeight)
      );
    }
    // Ground
    ctx.fillStyle = '#de9748';
    ctx.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);
    // Bird (rectangle with tilt)
    const bird = birdRef.current;
    const rotation = clamp(bird.vy / MAX_DROP_SPEED, -0.5, 0.5); // radians approx
    ctx.save();
    ctx.translate(bird.x + BIRD_WIDTH / 2, bird.y + BIRD_HEIGHT / 2);
    ctx.rotate(rotation);
    ctx.fillStyle = '#ffeb3b';
    ctx.fillRect(-BIRD_WIDTH / 2, -BIRD_HEIGHT / 2, BIRD_WIDTH, BIRD_HEIGHT);
    ctx.restore();
    ctx.restore();
  };

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId: number;
    const loop = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const rawDelta = (time - lastTimeRef.current) / 1000;
      const delta = Math.min(rawDelta, 0.05); // clamp to 50ms
      lastTimeRef.current = time;
      update(delta);
      render(ctx);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [gameState]); // restart loop on state change (pause/resume)

  // Input listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerDown, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('touchstart', handlePointerDown);
    };
  }, [handleKeyDown, handlePointerDown]);

  // Difficulty progression based on score
  useEffect(() => {
    if (DIFFICULTY_THRESHOLDS.includes(score)) {
      pipeSpeedRef.current += PIPE_SPEED_INCREMENT;
      gapHeightRef.current = Math.max(80, gapHeightRef.current - GAP_DECREMENT);
    }
  }, [score]);

  // Update high score after game over
  useEffect(() => {
    if (gameState === GameState.GAME_OVER) {
      setHighScore(prev => {
        if (score > prev) {
          saveHighScore(score);
          return score;
        }
        return prev;
      });
    }
  }, [gameState, score]);

  // UI Overlays
  const overlay = () => {
    switch (gameState) {
      case GameState.READY:
        return (
          <div className="overlay">
            <h1>Flappy Bird</h1>
            <p>Press Space, ArrowUp, W, Click or Tap to Start</p>
            <p>Best: {highScore}</p>
          </div>
        );
      case GameState.PAUSED:
        return (
          <div className="overlay">
            <h1>Paused</h1>
            <button onClick={resumeGame}>Resume</button>
          </div>
        );
      case GameState.GAME_OVER:
        return (
          <div className="overlay">
            <h1>Game Over</h1>
            <p>Score: {score}</p>
            <p>Best: {highScore}</p>
            <button onClick={startGame}>Restart</button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="game-container">
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH * 2}
        height={GAME_HEIGHT * 2}
        style={{ width: '100%', height: '100%' }}
      />
      <div className="ui-top">
        <span className="score">Score: {score}</span>
        {gameState === GameState.RUNNING && (
          <button className="pause-btn" onClick={pauseGame} aria-label="Pause game">
            Pause
          </button>
        )}
        {gameState === GameState.PAUSED && (
          <button className="pause-btn" onClick={resumeGame} aria-label="Resume game">
            Resume
          </button>
        )}
      </div>
      {overlay()}
    </div>
  );
};

export default App;
