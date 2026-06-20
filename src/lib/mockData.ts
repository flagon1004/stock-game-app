import { Round, Pick } from "./types";

export const MOCK_ROUNDS: Round[] = [
  {
    id: "round-2",
    startDate: "2026-06-15",
    endDate: "2026-06-20",
    stocks: [
      { code: "005930", name: "삼성전자" },
      { code: "000660", name: "SK하이닉스" },
      { code: "035420", name: "NAVER" },
      { code: "005380", name: "현대차" },
      { code: "051910", name: "LG화학" },
    ],
    isFinalized: false,
  },
  {
    id: "round-1",
    startDate: "2026-06-08",
    endDate: "2026-06-13",
    stocks: [
      { code: "005930", name: "삼성전자" },
      { code: "000660", name: "SK하이닉스" },
      { code: "035720", name: "카카오" },
      { code: "035420", name: "NAVER" },
      { code: "207940", name: "삼성바이오로직스" },
    ],
    isFinalized: true,
    result: {
      rank1Stock: "000660",
      rank2Stock: "207940",
      changeRates: {
        "005930": 1.2,
        "000660": 8.4,
        "035720": -2.1,
        "035420": 3.5,
        "207940": 5.7,
      },
    },
  },
];

export const CURRENT_ROUND = MOCK_ROUNDS[0];

export const MOCK_PICKS: Pick[] = [
  {
    userId: "mock-user",
    roundId: "round-1",
    stockCode: "000660",
    submittedAt: "2026-06-09T10:30:00",
  },
];
