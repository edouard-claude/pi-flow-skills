// ANSI codes, color helpers, terminal size, sticky-header primitives.
// Pure Node, zero dependency.

const isTTY = (): boolean =>
  process.stderr.isTTY === true && !process.env['NO_COLOR'];

export interface Colors {
  RESET: string;
  BOLD: string;
  DIM: string;
  RED: string;
  GREEN: string;
  YELLOW: string;
  BLUE: string;
  MAGENTA: string;
  CYAN: string;
  GRAY: string;
}

const ON: Colors = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  GRAY: '\x1b[90m',
};

const OFF: Colors = {
  RESET: '', BOLD: '', DIM: '', RED: '', GREEN: '',
  YELLOW: '', BLUE: '', MAGENTA: '', CYAN: '', GRAY: '',
};

export const colors: Colors = isTTY() ? ON : OFF;

export const termSize = (): { rows: number; cols: number } => {
  return {
    rows: process.stderr.rows ?? 24,
    cols: process.stderr.columns ?? 80,
  };
};

// DECSC / DECRC — save / restore cursor (more portable than [s/[u).
export const SAVE_CURSOR = '\x1b7';
export const RESTORE_CURSOR = '\x1b8';
export const HIDE_CURSOR = '\x1b[?25l';
export const SHOW_CURSOR = '\x1b[?25h';
export const CLEAR_SCREEN_HOME = '\x1b[2J\x1b[1;1H';
export const CLEAR_LINE = '\x1b[2K';

export const cursorAt = (row: number, col: number): string =>
  `\x1b[${row};${col}H`;

// DECSTBM — set scrolling region.
export const setScrollingRegion = (top: number, bottom: number): string =>
  `\x1b[${top};${bottom}r`;

export const RESET_SCROLLING_REGION = '\x1b[r';

export const writeErr = (s: string): void => {
  process.stderr.write(s);
};
