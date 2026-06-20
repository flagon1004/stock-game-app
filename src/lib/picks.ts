import { Pick } from "./types";
import { MOCK_PICKS } from "./mockData";

// 세션 내 픽 저장소 (새로고침 시 초기화, 단 sessionStorage로 탭 유지)
const PICKS_KEY = "stock_game_picks";

function loadPicks(): Pick[] {
  if (typeof window === "undefined") return [...MOCK_PICKS];
  const raw = sessionStorage.getItem(PICKS_KEY);
  return raw ? JSON.parse(raw) : [...MOCK_PICKS];
}

function savePicks(picks: Pick[]): void {
  sessionStorage.setItem(PICKS_KEY, JSON.stringify(picks));
}

export function submitPick(
  userId: string,
  roundId: string,
  stockCode: string
): { success: boolean; error?: string } {
  const picks = loadPicks();
  // 중복 제출 방지
  if (picks.find((p) => p.userId === userId && p.roundId === roundId)) {
    return { success: false, error: "이미 이번 라운드에 선택하셨습니다." };
  }
  picks.push({ userId, roundId, stockCode, submittedAt: new Date().toISOString() });
  savePicks(picks);
  return { success: true };
}

export function getMyPick(userId: string, roundId: string): Pick | undefined {
  return loadPicks().find((p) => p.userId === userId && p.roundId === roundId);
}

export function getMyPicks(userId: string): Pick[] {
  return loadPicks().filter((p) => p.userId === userId);
}
