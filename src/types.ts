export type NumberSize = 'BIG' | 'SMALL';
export type NumberColor = 'RED' | 'GREEN' | 'VIOLET' | 'RED+VIOLET' | 'GREEN+VIOLET';

export interface PredictionResult {
  periodId: string;          // Target upcoming issue period (e.g. 2026082310000891)
  size: NumberSize;          // BIG or SMALL
  primaryNumber: number;     // 5..9 for BIG, 0..4 for SMALL
  companionNumbers: number[]; // Other numbers strictly corresponding to size
  color: NumberColor;
  confidence: number;
  patternName: string;
}

export interface GameRecord {
  periodId: string;
  number: number;
  size: NumberSize;
  color: NumberColor;
  predictedSize?: NumberSize;
  predictedNum?: number;
  resultStatus?: 'WIN' | 'LOSS' | 'WAITING' | 'PASS';
  timeStr?: string;
}

export interface LiveStats {
  totalRounds: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
}
