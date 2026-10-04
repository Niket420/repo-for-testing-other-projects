import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  COLS,
  ROWS,
  TETROMINOES,
  createBag,
  getInitialPiece,
  move,
  rotate,
  isValidPosition,
  lockPiece,
  clearLines,
  calculateScore,
} from "./gameLogic";

const EMPTY_BOARD = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

const getDropInterval = (level) => {
  const base = 800; // ms at level 1
  const interval = base - (level - 1) * 70;
  return Math.max(100, interval);
};

export default function App() {
  // ----- State -----
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [bag, setBag] = useState([]);
  const [current, setCurrent] = useState(null);
  const [next, setNext] = useState(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [status, setStatus] = useState("ready"); // ready | running | paused | gameover

  const timerRef = useRef(null);

  // ----- High Score Persistence -----
  useEffect(() => {
    const stored = localStorage.getItem("tetris-highscore");
    if (stored) setHighScore(parseInt(stored, 10));
  }, []);
  useEffect(() => {
    localStorage.setItem("tetris-highscore", highScore);
  }, [highScore]);

  // ----- Timer helpers -----
  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // ----- Core game tick -----
  const tick = useCallback(() => {
    if (status !== "running" || !current) return;
    const moved = move(current, 0, 1, board);
    if (moved !== current) {
      setCurrent(moved);
      timerRef.current = setTimeout(tick, getDropInterval(level));
    } else {
      lockAndProceed(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, current, board, level]);

  // ----- Game Reset (used for start & restart) -----
  const resetGame = useCallback(() => {
    clearTimer();
    const newBag = createBag();
    const first = getInitialPiece(newBag);
    const upcoming = getInitialPiece(newBag);
    setBag(newBag);
    setCurrent(first);
    setNext(upcoming);
    setBoard(EMPTY_BOARD);
    setScore(0);
    setLines(0);
    setLevel(1);
    setStatus("ready");
  }, []);

  const startGame = useCallback(() => {
    if (status === "running") return;
    resetGame();
    setStatus("running");
  }, [status, resetGame]);

  const pauseGame = useCallback(() => {
    if (status !== "running") return;
    setStatus("paused");
    clearTimer();
  }, [status]);

  const resumeGame = useCallback(() => {
    if (status !== "paused") return;
    setStatus("running");
  }, [status]);

  const restartGame = useCallback(() => {
    resetGame();
    // user must press Start again
  }, [resetGame]);

  // ----- Lock piece, clear lines, spawn next -----
  function lockAndProceed(piece) {
    const newBoard = lockPiece(piece, board);
    const { board: clearedBoard, cleared } = clearLines(newBoard);
    const added = calculateScore(cleared, level);
    const newScore = score + added;
    const newLines = lines + cleared;
    const newLevel = Math.floor(newLines / 10) + 1;

    if (newScore > highScore) setHighScore(newScore);
    setBoard(clearedBoard);
    setScore(newScore);
    setLines(newLines);
    if (newLevel !== level) setLevel(newLevel);

    // spawn next piece
    const upcoming = next;
    const fresh = getInitialPiece(bag); // mutates bag
    setBag([...bag]); // trigger re-render
    const newPiece = { ...upcoming, rotation: 0, x: 3, y: -2 };
    setCurrent(newPiece);
    setNext(fresh);

    // check for game over
    if (!isValidPosition(newPiece, clearedBoard)) {
      setStatus("gameover");
      clearTimer();
      return;
    }

    // continue falling if still running
    if (status === "running") {
      timerRef.current = setTimeout(tick, getDropInterval(newLevel));
    }
  }

  // ----- Effect to start timer when game becomes running -----
  useEffect(() => {
    if (status === "running" && current) {
      timerRef.current = setTimeout(tick, getDropInterval(level));
    }
    return clearTimer;
  }, [status, current, level, tick]);

  // ----- Keyboard handling -----
  const handleKeyDown = useCallback(
    (e) => {
      const key = e.key.toLowerCase();
      // Global shortcuts
      if (key === "p") {
        if (status === "running") pauseGame();
        else if (status === "paused") resumeGame();
        else if (status === "ready") startGame();
        e.preventDefault();
        return;
      }
      // Action keys only when running
      if (status !== "running" || !current) return;

      let handled = false;
      if (key === "arrowleft" || key === "a") {
        const moved = move(current, -1, 0, board);
        if (moved !== current) setCurrent(moved);
        handled = true;
      } else if (key === "arrowright" || key === "d") {
        const moved = move(current, 1, 0, board);
        if (moved !== current) setCurrent(moved);
        handled = true;
      } else if (key === "arrowdown" || key === "s") {
        const moved = move(current, 0, 1, board);
        if (moved !== current) setCurrent(moved);
        handled = true;
      } else if (key === "arrowup" || key === "w") {
        const rotated = rotate(current, board);
        if (rotated !== current) setCurrent(rotated);
        handled = true;
      } else if (key === " " || key === "spacebar") {
        // hard drop
        let drop = current;
        while (true) {
          const nextDrop = move(drop, 0, 1, board);
          if (nextDrop === drop) break;
          drop = nextDrop;
        }
        setCurrent(drop);
        lockAndProceed(drop);
        handled = true;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [status, current, board, pauseGame, resumeGame, startGame]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ----- Mobile button helper -----
  const mobileButton = (label, onClick) => (
    <button
      onClick={() => {
        if (status === "running" && current) onClick();
      }}
      style={{ flex: 1, margin: "4px", padding: "12px" }}
    >
      {label}
    </button>
  );

  // ----- Rendering helpers -----
  const cellColor = (x, y) => {
    const filled = board[y][x];
    if (filled) return TETROMINOES[filled].color;
    if (current) {
      const { type, rotation, x: px, y: py } = current;
      const shape = TETROMINOES[type].rotations[rotation];
      for (const [cx, cy] of shape) {
        if (px + cx === x && py + cy === y) return TETROMINOES[type].color;
      }
    }
    return "transparent";
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0d0d0d, #1a1a2e)",
        color: "#fff",
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <h1>React Tetris</h1>
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", justifyContent: "center" }}>
        {/* Game board */}
        <div
          style={{
            background: "#111",
            padding: "4px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, 30px)`,
              gridTemplateRows: `repeat(${ROWS}, 30px)`,
              gap: "1px",
            }}
          >
            {Array.from({ length: ROWS }).map((_, y) =>
              Array.from({ length: COLS }).map((_, x) => (
                <div
                  key={`${x}-${y}`}
                  style={{
                    width: "30px",
                    height: "30px",
                    background: cellColor(x, y),
                    borderRadius: "2px",
                    border: "1px solid #333",
                  }}
                />
              ))
            )}
          </div>
        </div>
        {/* Side panel */}
        <div style={{ minWidth: "200px" }}>
          <div>Score: {score}</div>
          <div>High Score: {highScore}</div>
          <div>Level: {level}</div>
          <div>Lines: {lines}</div>
          <div style={{ marginTop: "12px" }}>Next:</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(4, 20px)`,
              gridTemplateRows: `repeat(4, 20px)`,
              gap: "1px",
              background: "#111",
              padding: "4px",
              borderRadius: "4px",
            }}
          >
            {Array.from({ length: 4 }).map((_, ry) =>
              Array.from({ length: 4 }).map((_, rx) => {
                let color = "transparent";
                if (next) {
                  const shape = TETROMINOES[next.type].rotations[0];
                  for (const [cx, cy] of shape) {
                    if (cx === rx && cy === ry) color = TETROMINOES[next.type].color;
                  }
                }
                return (
                  <div
                    key={`next-${rx}-${ry}`}
                    style={{
                      width: "20px",
                      height: "20px",
                      background: color,
                      borderRadius: "2px",
                      border: "1px solid #333",
                    }}
                  />
                );
              })
            )}
          </div>
          {/* Controls */}
          <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {status === "ready" && (
              <button onClick={startGame} style={{ padding: "8px" }}>Start</button>
            )}
            {status === "running" && (
              <button onClick={pauseGame} style={{ padding: "8px" }}>Pause</button>
            )}
            {status === "paused" && (
              <button onClick={resumeGame} style={{ padding: "8px" }}>Resume</button>
            )}
            <button onClick={restartGame} style={{ padding: "8px" }}>Restart</button>
          </div>
          {/* Mobile controls */}
          <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap" }}>
            {mobileButton("←", () => {
              const moved = move(current, -1, 0, board);
              if (moved !== current) setCurrent(moved);
            })}
            {mobileButton("→", () => {
              const moved = move(current, 1, 0, board);
              if (moved !== current) setCurrent(moved);
            })}
            {mobileButton("↓", () => {
              const moved = move(current, 0, 1, board);
              if (moved !== current) setCurrent(moved);
            })}
            {mobileButton("⟳", () => {
              const rot = rotate(current, board);
              if (rot !== current) setCurrent(rot);
            })}
            {mobileButton("␣", () => {
              let drop = current;
              while (true) {
                const nextDrop = move(drop, 0, 1, board);
                if (nextDrop === drop) break;
                drop = nextDrop;
              }
              setCurrent(drop);
              lockAndProceed(drop);
            })}
          </div>
        </div>
      </div>
      {/* Game Over overlay */}
      {status === "gameover" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <h2>Game Over</h2>
          <p>Score: {score}</p>
          <p>Level: {level}</p>
          <p>Lines cleared: {lines}</p>
          <button onClick={restartGame} style={{ padding: "8px", marginTop: "12px" }}>
            Restart
          </button>
        </div>
      )}
    </div>
  );
}
