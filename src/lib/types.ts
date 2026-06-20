export interface User {
  id: string;
  nickname: string;
  username: string;
  points: number;
}

export interface Stock {
  code: string;
  name: string;
}

export interface Round {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD (금요일)
  stocks: Stock[];
  isFinalized: boolean;
  result?: RoundResult;
}

export interface RoundResult {
  rank1Stock: string; // stock code
  rank2Stock: string;
  changeRates: Record<string, number>; // code -> %
}

export interface Pick {
  userId: string;
  roundId: string;
  stockCode: string;
  submittedAt: string;
}

export interface RoundWithPick extends Round {
  myPick?: Pick;
  earnedPoints?: number;
}
