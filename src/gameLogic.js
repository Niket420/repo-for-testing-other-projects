// gameLogic.js
// Contains pure game logic functions and data structures.

export const COLS = 10;
export const ROWS = 20;

// Define tetromino shapes as arrays of rotations.
// Each rotation is an array of [x, y] coordinates relative to a reference point.
// Colors for rendering.
export const TETROMINOES = {
  I: {
    color: "#00f0f0",
    rotations: [
      [ [0,1], [1,1], [2,1], [3,1] ],
      [ [2,0], [2,1], [2,2], [2,3] ],
      [ [0,2], [1,2], [2,2], [3,2] ],
      [ [1,0], [1,1], [1,2], [1,3] ],
    ],
  },
  O: {
    color: "#f0f000",
    rotations: [
      [ [1,0], [2,0], [1,1], [2,1] ],
      [ [1,0], [2,0], [1,1], [2,1] ],
      [ [1,0], [2,0], [1,1], [2,1] ],
      [ [1,0], [2,0], [1,1], [2,1] ],
    ],
  },
  T: {
    color: "#a000f0",
    rotations: [
      [ [1,0], [0,1], [1,1], [2,1] ],
      [ [1,0], [1,1], [2,1], [1,2] ],
      [ [0,1], [1,1], [2,1], [1,2] ],
      [ [1,0], [0,1], [1,1], [1,2] ],
    ],
  },
  S: {
    color: "#00f000",
    rotations: [
      [ [1,0], [2,0], [0,1], [1,1] ],
      [ [1,0], [1,1], [2,1], [2,2] ],
      [ [1,1], [2,1], [0,2], [1,2] ],
      [ [0,0], [0,1], [1,1], [1,2] ],
    ],
  },
  Z: {
    color: "#f00000",
    rotations: [
      [ [0,0], [1,0], [1,1], [2,1] ],
      [ [2,0], [1,1], [2,1], [1,2] ],
      [ [0,1], [1,1], [1,2], [2,2] ],
      [ [1,0], [0,1], [1,1], [0,2] ],
    ],
  },
  J: {
    color: "#0000f0",
    rotations: [
      [ [0,0], [0,1], [1,1], [2,1] ],
      [ [1,0], [2,0], [1,1], [1,2] ],
      [ [0,1], [1,1], [2,1], [2,2] ],
      [ [1,0], [1,1], [0,2], [1,2] ],
    ],
  },
  L: {
    color: "#f08000",
    rotations: [
      [ [2,0], [0,1], [1,1], [2,1] ],
      [ [1,0], [1,1], [1,2], [2,2] ],
      [ [0,1], [1,1], [2,1], [0,2] ],
      [ [0,0], [1,0], [1,1], [1,2] ],
    ],
  },
};

// Helper to create a bag of 7 pieces shuffled (modern randomizer).
export function createBag() {
  const pieces = Object.keys(TETROMINOES);
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  return pieces;
}

export function getInitialPiece(bag) {
  const type = bag.shift();
  if (bag.length === 0) {
    // refill bag
    bag.push(...createBag());
  }
  return { type, rotation: 0, x: 3, y: -2 }; // spawn near top middle
}

export function rotate(piece, board) {
  const { type, rotation, x, y } = piece;
  const nextRotation = (rotation + 1) % 4;
  const newPiece = { ...piece, rotation: nextRotation };
  if (isValidPosition(newPiece, board)) {
    return newPiece;
  }
  // simple wall kick: try shifting left or right by one
  const kicks = [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 2, y: 0 },
  ];
  for (const k of kicks) {
    const kicked = { ...newPiece, x: x + k.x, y: y + k.y };
    if (isValidPosition(kicked, board)) {
      return kicked;
    }
  }
  return piece; // rotation rejected
}

export function move(piece, dx, dy, board) {
  const moved = { ...piece, x: piece.x + dx, y: piece.y + dy };
  if (isValidPosition(moved, board)) {
    return moved;
  }
  return piece;
}

export function isValidPosition(piece, board) {
  const { type, rotation, x, y } = piece;
  const shape = TETROMINOES[type].rotations[rotation];
  for (const [cx, cy] of shape) {
    const nx = x + cx;
    const ny = y + cy;
    if (nx < 0 || nx >= COLS || ny >= ROWS) return false; // out of bounds (bottom included)
    if (ny >= 0 && board[ny][nx] !== 0) return false; // collision with existing block
  }
  return true;
}

export function lockPiece(piece, board) {
  const newBoard = board.map(row => row.slice());
  const { type, rotation, x, y } = piece;
  const colorIdx = type; // use type as identifier for color rendering
  const shape = TETROMINOES[type].rotations[rotation];
  for (const [cx, cy] of shape) {
    const nx = x + cx;
    const ny = y + cy;
    if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
      newBoard[ny][nx] = colorIdx;
    }
  }
  return newBoard;
}

export function clearLines(board) {
  const newBoard = [];
  let cleared = 0;
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every(cell => cell !== 0)) {
      cleared++;
    } else {
      newBoard.push(board[r]);
    }
  }
  // add empty rows on top
  while (newBoard.length < ROWS) {
    newBoard.unshift(Array(COLS).fill(0));
  }
  return { board: newBoard, cleared };
}

export function calculateScore(clearedLines, level) {
  const lineScores = { 1: 40, 2: 100, 3: 300, 4: 1200 };
  const base = lineScores[clearedLines] || 0;
  return base * level;
}
