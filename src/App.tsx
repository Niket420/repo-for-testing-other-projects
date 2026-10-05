import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRAVITY,
  BOUNCE_VELOCITY,
  HORIZONTAL_ACCEL,
  MAX_HORIZONTAL_SPEED,
  HORIZONTAL_FRICTION,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLATFORM_HEIGHT,
  MIN_PLATFORM_WIDTH,
  MAX_PLATFORM_WIDTH,
  MIN_VERTICAL_GAP,
  MAX_VERTICAL_GAP,
  MAX_HORIZONTAL_GAP,
  CAMERA_THRESHOLD,
  CAMERA_FOLLOW_SPEED,
  DEATH_BOUNDARY_OFFSET,
  DIFFICULTY_INCREASE_SCORE,
  MAX_PLATFORM_SHRINK,
  GameState,
} from './constants';
import { Player, Platform } from './types';

const STORAGE_KEY = 'doodle-jump-high-score';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.READY);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // mutable refs for performance-sensitive data
  const playerRef = useRef<Player>(null as any);
  const platformsRef = useRef<Platform[]>([]);
  const cameraYRef = useRef(0); // world Y that camera bottom aligns to (player bottom relative)
  const lastTimeRef = useRef(0);
  const difficultyLevelRef = useRef(1);
  const nextDifficultyScoreRef = useRef(DIFFICULTY_INCREASE_SCORE);
  const platformIdRef = useRef(0);
  const inputRef = useRef({ left: false, right: false });

  // Load high score once
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const hs = stored ? parseInt(stored, 10) : 0;
      setHighScore(isNaN(hs) ? 0 : hs);
    } catch {
      setHighScore(0);
    }
  }, []);

  // Platform factory
  const createPlatform = useCallback(
    (
      x: number,
      y: number,
      width: number,
      type: Platform['type'] = 'static',
    ): Platform => {
      const id = platformIdRef.current++;
      const p: Platform = { id, x, y, width, height: PLATFORM_HEIGHT, type };
      if (type === 'moving') {
        p.direction = Math.random() < 0.5 ? 1 : -1;
        p.speed = 40 + Math.random() * 30; // px/s
        p.range = 80 + Math.random() * 120; // total horizontal range
        p.baseX = x;
      }
      return p;
    },
    [],
  );

  // Reset game
  const resetGame = useCallback(() => {
    const startX = CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2;
    const startY = PLATFORM_HEIGHT + PLAYER_HEIGHT; // bottom just above starting platform
    playerRef.current = {
      x: startX,
      y: startY,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      vx: 0,
      vy: 0,
    };
    cameraYRef.current = 0;
    difficultyLevelRef.current = 1;
    nextDifficultyScoreRef.current = DIFFICULTY_INCREASE_SCORE;
    platformIdRef.current = 0;

    // Starting platform and some above
    const platforms: Platform[] = [];
    platforms.push(createPlatform(startX - 10, PLATFORM_HEIGHT, CANVAS_WIDTH - 20, 'static'));
    let lastY = PLATFORM_HEIGHT;
    let lastX = startX;
    for (let i = 0; i < 12; i++) {
      const gapY = MIN_VERTICAL_GAP + Math.random() * (MAX_VERTICAL_GAP - MIN_VERTICAL_GAP);
      const y = lastY + gapY;
      const width = MIN_PLATFORM_WIDTH + Math.random() * (MAX_PLATFORM_WIDTH - MIN_PLATFORM_WIDTH);
      const maxX = CANVAS_WIDTH - width;
      const x = Math.max(0, Math.min(maxX, lastX + (Math.random() * 2 - 1) * MAX_HORIZONTAL_GAP));
      platforms.push(createPlatform(x, y, width, 'static'));
      lastY = y;
      lastX = x;
    }
    platformsRef.current = platforms;
    setScore(0);
    setGameState(GameState.READY);
  }, [createPlatform]);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  // Keyboard handling
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        inputRef.current.left = true;
        e.preventDefault();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        inputRef.current.right = true;
        e.preventDefault();
      } else if (e.code === 'Space' || e.code === 'Enter') {
        if (gameState === GameState.READY) setGameState(GameState.RUNNING);
        else if (gameState === GameState.GAME_OVER) resetGame();
        e.preventDefault();
      } else if (e.code === 'KeyP') {
        if (gameState === GameState.RUNNING) setGameState(GameState.PAUSED);
        else if (gameState === GameState.PAUSED) setGameState(GameState.RUNNING);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        inputRef.current.left = false;
        e.preventDefault();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        inputRef.current.right = false;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [gameState, resetGame]);

  // Touch controls (simple halves)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const start = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      if (x < rect.width / 2) inputRef.current.left = true; else inputRef.current.right = true;
    };
    const end = () => {
      inputRef.current.left = false;
      inputRef.current.right = false;
    };
    canvas.addEventListener('touchstart', start);
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
    return () => {
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchend', end);
      canvas.removeEventListener('touchcancel', end);
    };
  }, []);

  // Game loop
  useEffect(() => {
    let animId: number;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const clampDt = (dt: number) => Math.min(dt, 0.033); // cap ~30 FPS step

    const updateDifficulty = (curScore: number) => {
      if (curScore >= nextDifficultyScoreRef.current) {
        difficultyLevelRef.current += 1;
        nextDifficultyScoreRef.current += DIFFICULTY_INCREASE_SCORE;
      }
    };

    const generatePlatforms = () => {
      const platforms = platformsRef.current;
      let highest = platforms.reduce((m, p) => (p.y > m ? p.y : m), 0);
      while (highest < cameraYRef.current + CANVAS_HEIGHT + 200) {
        const last = platforms[platforms.length - 1];
        const baseY = last ? last.y : cameraYRef.current;
        const gapY = MIN_VERTICAL_GAP + Math.random() * (MAX_VERTICAL_GAP - MIN_VERTICAL_GAP);
        const y = baseY + gapY;
        const shrink = 1 - Math.min(difficultyLevelRef.current * 0.05, MAX_PLATFORM_SHRINK);
        const minW = MIN_PLATFORM_WIDTH * shrink;
        const maxW = MAX_PLATFORM_WIDTH * shrink;
        const width = minW + Math.random() * (maxW - minW);
        const maxX = CANVAS_WIDTH - width;
        const prevX = last ? last.x : CANVAS_WIDTH / 2;
        const x = Math.max(0, Math.min(maxX, prevX + (Math.random() * 2 - 1) * MAX_HORIZONTAL_GAP));
        let type: Platform['type'] = 'static';
        if (difficultyLevelRef.current >= 3 && Math.random() < 0.1) type = 'moving';
        else if (difficultyLevelRef.current >= 5 && Math.random() < 0.08) type = 'disappearing';
        platforms.push(createPlatform(x, y, width, type));
        highest = y;
      }
      // Remove far below platforms
      const minY = cameraYRef.current - DEATH_BOUNDARY_OFFSET - 200;
      platformsRef.current = platforms.filter(p => p.y >= minY);
    };

    const loop = (time: number) => {
      const dt = clampDt((time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;

      if (gameState === GameState.RUNNING) {
        const player = playerRef.current;
        // Horizontal input
        if (inputRef.current.left) {
          player.vx -= HORIZONTAL_ACCEL * dt;
        } else if (inputRef.current.right) {
          player.vx += HORIZONTAL_ACCEL * dt;
        } else {
          // friction
          if (player.vx > 0) player.vx = Math.max(0, player.vx - HORIZONTAL_FRICTION * dt);
          else if (player.vx < 0) player.vx = Math.min(0, player.vx + HORIZONTAL_FRICTION * dt);
        }
        // clamp horizontal speed
        if (player.vx > MAX_HORIZONTAL_SPEED) player.vx = MAX_HORIZONTAL_SPEED;
        if (player.vx < -MAX_HORIZONTAL_SPEED) player.vx = -MAX_HORIZONTAL_SPEED;

        // Gravity (downward is negative)
        player.vy -= GRAVITY * dt;

        const prevY = player.y;
        // Apply velocities
        player.x += player.vx * dt;
        player.y += player.vy * dt;

        // Horizontal wrapping
        if (player.x + player.width < 0) player.x = CANVAS_WIDTH;
        else if (player.x > CANVAS_WIDTH) player.x = -player.width;

        // Update moving platforms
        platformsRef.current.forEach(p => {
          if (p.type === 'moving' && p.baseX !== undefined && p.direction !== undefined && p.speed !== undefined && p.range !== undefined) {
            const delta = p.speed * dt * p.direction;
            p.x += delta;
            const offset = p.x - p.baseX;
            if (Math.abs(offset) > p.range / 2) {
              p.direction = (p.direction as 1 | -1) * -1 as any;
              p.x = p.baseX + (p.range / 2) * (p.direction as 1 | -1);
            }
          }
        });

        // Collision detection while falling (player.vy < 0)
        if (player.vy < 0) {
          // Find platforms where player crossed from above
          const landingPlatforms = platformsRef.current.filter(p => {
            const withinX = player.x + player.width > p.x && player.x < p.x + p.width;
            const crossed = prevY >= p.y && player.y <= p.y; // crossed platform top
            return withinX && crossed;
          });
          if (landingPlatforms.length) {
            // pick highest (largest y) platform crossed
            const plat = landingPlatforms.reduce((a, b) => (a.y > b.y ? a : b));
            // place player on top
            player.y = plat.y;
            player.vy = BOUNCE_VELOCITY;
            if (plat.type === 'disappearing') {
              plat.landedTimestamp = performance.now();
            }
          }
        }

        // Remove disappearing platforms after short delay
        const now = performance.now();
        platformsRef.current = platformsRef.current.filter(p => {
          if (p.type === 'disappearing' && p.landedTimestamp) {
            return now - p.landedTimestamp < 500; // 0.5s
          }
          return true;
        });

        // Camera follow
        if (player.y - cameraYRef.current > CAMERA_THRESHOLD) {
          const target = player.y - CAMERA_THRESHOLD;
          cameraYRef.current += (target - cameraYRef.current) * CAMERA_FOLLOW_SPEED;
        }

        // Score based on max height reached (world y)
        const newScore = Math.max(score, Math.floor(player.y));
        if (newScore !== score) {
          setScore(newScore);
          if (newScore > highScore) {
            setHighScore(newScore);
            try {
              localStorage.setItem(STORAGE_KEY, String(newScore));
            } catch {}
          }
        }

        // Difficulty
        updateDifficulty(newScore);

        // Platform generation & cleanup
        generatePlatforms();

        // Death check
        if (player.y < cameraYRef.current - DEATH_BOUNDARY_OFFSET) {
          setGameState(GameState.GAME_OVER);
        }
      }

      // Rendering
      ctx.fillStyle = '#0d0d25';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const camY = cameraYRef.current;
      // Platforms
      platformsRef.current.forEach(p => {
        const screenY = CANVAS_HEIGHT - (p.y - camY);
        const screenX = p.x;
        if (screenY < -PLATFORM_HEIGHT || screenY > CANVAS_HEIGHT) return;
        if (p.type === 'moving') ctx.fillStyle = '#ffcc00';
        else if (p.type === 'disappearing') ctx.fillStyle = '#ff66aa';
        else ctx.fillStyle = '#66ccff';
        ctx.fillRect(screenX, screenY, p.width, p.height);
      });

      // Player
      const player = playerRef.current;
      const playerScreenY = CANVAS_HEIGHT - (player.y - camY);
      const playerScreenX = player.x;
      ctx.save();
      const tilt = (player.vx / MAX_HORIZONTAL_SPEED) * 0.2; // radians
      ctx.translate(playerScreenX + player.width / 2, playerScreenY - player.height / 2);
      ctx.rotate(tilt);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
      ctx.restore();

      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, score, highScore]);

  // UI overlays
  const overlay = () => {
    if (gameState === GameState.READY) {
      return (
        <div className="overlay">
          <h1>Doodle Jump Clone</h1>
          <p>← / → or A / D to move.</p>
          <p>Space / Enter / Tap to start.</p>
          <p>P to pause.</p>
        </div>
      );
    }
    if (gameState === GameState.PAUSED) {
      return (
        <div className="overlay">
          <h2>Paused</h2>
          <button onClick={() => setGameState(GameState.RUNNING)}>Resume</button>
        </div>
      );
    }
    if (gameState === GameState.GAME_OVER) {
      return (
        <div className="overlay">
          <h2>Game Over</h2>
          <p>Score: {score}</p>
          <p>High Score: {highScore}</p>
          <button onClick={resetGame}>Restart</button>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: CANVAS_WIDTH, margin: '0 auto', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="game-canvas"
      />
      <div style={{ position: 'absolute', top: 10, left: 10, color: '#fff' }}>
        <div>Score: {score}</div>
        <div>High: {highScore}</div>
      </div>
      <button
        style={{ position: 'absolute', top: 10, right: 10 }}
        onClick={() =>
          setGameState(prev => (prev === GameState.RUNNING ? GameState.PAUSED : GameState.RUNNING))
        }
      >
        {gameState === GameState.PAUSED ? 'Resume' : 'Pause'}
      </button>
      {overlay()}
    </div>
  );
};

export default App;
