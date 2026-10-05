export const CANVAS_WIDTH = 400; // px
export const CANVAS_HEIGHT = 600; // px

// Physics
export const GRAVITY = 2000; // px/s^2
export const BOUNCE_VELOCITY = 800; // initial upward speed after bounce
export const HORIZONTAL_ACCEL = 2000; // px/s^2
export const MAX_HORIZONTAL_SPEED = 400; // px/s
export const HORIZONTAL_FRICTION = 1500; // px/s^2

// Player
export const PLAYER_WIDTH = 40;
export const PLAYER_HEIGHT = 50;

// Platform
export const PLATFORM_HEIGHT = 20;
export const MIN_PLATFORM_WIDTH = 80;
export const MAX_PLATFORM_WIDTH = 150;
export const MIN_VERTICAL_GAP = 80; // minimum distance between platforms
export const MAX_VERTICAL_GAP = 200; // maximum distance based on bounce
export const MAX_HORIZONTAL_GAP = 200; // max horizontal distance reachable

// Camera
export const CAMERA_FOLLOW_SPEED = 0.1; // lerp factor
export const CAMERA_THRESHOLD = 200; // when player passes this from top of screen, camera moves up

// Scoring & difficulty
export const DIFFICULTY_INCREASE_SCORE = 500; // increase difficulty every 500 pts
export const MAX_PLATFORM_SHRINK = 0.5; // shrink factor at max difficulty

export const DEATH_BOUNDARY_OFFSET = 100; // below lowest platform

export enum GameState {
  READY = 'READY',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}
