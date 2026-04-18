export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export const COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export const COLOR_CLASSES: Record<PlayerColor, string> = {
  red: 'bg-red-500 hover:bg-red-400',
  green: 'bg-green-500 hover:bg-green-400',
  yellow: 'bg-yellow-500 hover:bg-yellow-400',
  blue: 'bg-blue-500 hover:bg-blue-400',
};

export const BORDER_CLASSES: Record<PlayerColor, string> = {
  red: 'border-red-500',
  green: 'border-green-500',
  yellow: 'border-yellow-500',
  blue: 'border-blue-500',
};

export const COLOR_HEX: Record<PlayerColor, string> = {
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6'
};

export const PATH_COORDS: [number, number][] = [
  // Red side to Green side
  [1,6], [2,6], [3,6], [4,6], [5,6], 
  [6,5], [6,4], [6,3], [6,2], [6,1], [6,0],
  [7,0], [8,0],
  // Green side to Yellow side
  [8,1], [8,2], [8,3], [8,4], [8,5],
  [9,6], [10,6], [11,6], [12,6], [13,6], [14,6],
  [14,7], [14,8],
  // Yellow side to Blue side
  [13,8], [12,8], [11,8], [10,8], [9,8],
  [8,9], [8,10], [8,11], [8,12], [8,13], [8,14],
  [7,14], [6,14],
  // Blue side to Red side
  [6,13], [6,12], [6,11], [6,10], [6,9],
  [5,8], [4,8], [3,8], [2,8], [1,8], [0,8],
  [0,7], [0,6]
];

export const HOME_STRETCHES: Record<PlayerColor, [number, number][]> = {
  red: [[1,7], [2,7], [3,7], [4,7], [5,7]],
  green: [[7,1], [7,2], [7,3], [7,4], [7,5]],
  yellow: [[13,7], [12,7], [11,7], [10,7], [9,7]],
  blue: [[7,13], [7,12], [7,11], [7,10], [7,9]],
};

export const YARD_COORDS: Record<PlayerColor, [number, number][]> = {
  red: [[2,2], [3,2], [2,3], [3,3]],
  green: [[11,2], [12,2], [11,3], [12,3]],
  yellow: [[11,11], [12,11], [11,12], [12,12]],
  blue: [[2,11], [3,11], [2,12], [3,12]],
};

export const COLOR_START_OFFSETS: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39
};

export const STAR_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];

// Safelist for dynamic tailwind classes used in template literals
export const PLAYER_STYLE_MAPS: Record<PlayerColor, { bg: string, border: string, bgSoft: string, text: string }> = {
  red: { bg: 'bg-red-500', border: 'border-red-500', bgSoft: 'bg-red-500/10', text: 'text-red-500' },
  green: { bg: 'bg-green-500', border: 'border-green-500', bgSoft: 'bg-green-500/10', text: 'text-green-500' },
  yellow: { bg: 'bg-yellow-500', border: 'border-yellow-500', bgSoft: 'bg-yellow-500/10', text: 'text-yellow-500' },
  blue: { bg: 'bg-blue-500', border: 'border-blue-500', bgSoft: 'bg-blue-500/10', text: 'text-blue-500' }
};
