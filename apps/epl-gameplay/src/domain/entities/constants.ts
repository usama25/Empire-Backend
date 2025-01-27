// ../entities/constants.ts

/**
 * The number of seconds before the game starts after players are matched.
 */
export const START_TIMEOUT_IN_SECONDS = 5;

/**
 * The number of seconds allowed for each turn (for a player to make their move).
 */
export const TURN_TIMEOUT_IN_SECONDS = 5;

export const TOTAL_NUMBER_OF_TURNS = 6;
/**
 * The delay in seconds before turn timeout response is given
 */
export const TURN_TIMEOUT_DELAY = 1;
/**
 * The number of seconds after matching table
 */
export const TABLE_TIMEOUT_IN_SECONDS = 3;

/**
 * The amount awarded for winning a free game.
 */
export const WIN_AMOUNT_FOR_FREE_GAME = '10'; // Assuming this is in the smallest currency unit

/**
 * The number of balls in an innings for each player.
 */
export const BALLS_PER_INNINGS = 6;

/**
 * The maximum number of runs a player can score or guess in a single ball.
 */
export const MAX_RUNS_PER_BALL = 6;

/**
 * The number of players in an EPL game.
 */
export const PLAYERS_PER_GAME = 2;

/**
 * The maximum number of innings in a game.
 */
export const MAX_INNINGS = 2;

/**
 * The minimum join fee for a paid game (in the smallest currency unit).
 */
export const MIN_JOIN_FEE = '100'; // e.g., 1.00 in currency

/**
 * The maximum join fee for a paid game (in the smallest currency unit).
 */
export const MAX_JOIN_FEE = '10000'; // e.g., 100.00 in currency

/**
 * The default commission percentage for the platform.
 */
export const DEFAULT_COMMISSION_PERCENTAGE = 10;

/**
 * The maximum time allowed for a complete game in seconds.
 */
export const MAX_GAME_DURATION_SECONDS = 300; // 5 minutes

/**
 * The number of free games allowed per user per day.
 */
export const FREE_GAMES_PER_DAY = 3;

export const TABLE_ID_LENGTH = 8;
