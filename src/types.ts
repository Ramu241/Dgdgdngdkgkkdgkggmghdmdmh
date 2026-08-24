export type NumberSize = 'BIG' | 'SMALL';
export type NumberColor = 'RED' | 'GREEN' | 'VIOLET' | 'RED+VIOLET' | 'GREEN+VIOLET';

export interface PredictionResult {
  periodId: string;           // Target upcoming issue period
  size: NumberSize;           // BIG or SMALL
  n1: number;                 // Primary Hot Number (Strictly 5-9 for BIG, 0-4 for SMALL)
  n2: number;                 // Secondary Hot Number (Strictly 5-9 for BIG, 0-4 for SMALL)
  companionNumbers: number[]; // All numbers corresponding strictly to this size (5-9 or 0-4)
  confidence: number;
  patternName: string;
  levelTarget: 1 | 2 | 3;     // L1 (Standard), L2 (Under 2-Level Recovery), L3 (All Wallet Level)
  level1Score: number;
  level2Score: number;
  bothAgree: boolean;
  algoCount: number;
  last10Trend: NumberSize[];
  analysisBreakdown: {
    streakCount: number;
    alternationRate: number;
    recentRatio: number;
    cycleMatch: boolean;
    harmonicScore: number;
  };
}

export interface GameRecord {
  periodId: string;
  number: number;
  size: NumberSize;
  color: NumberColor;
  predictedSize?: NumberSize;
  predictedN1?: number;
  predictedN2?: number;
  levelPlayed?: 1 | 2 | 3;
  resultStatus?: 'WIN' | 'LOSS' | 'JACKPOT' | 'WAITING';
  isJackpot?: boolean;
  timeStr?: string;
}

export interface LevelStats {
  l1Wins: number;
  l2Wins: number;
  l3Wins: number;
  totalWins: number;
  losses: number;
  under2LevelRate: number;
}
