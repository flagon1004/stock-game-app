const SHEET_RANGE = "'게임종목'!B5:P9";

/** 다음 KST 16:15까지 남은 초(최소 60초) — 캐시 TTL 계산용 */
function secondsUntilNextUpdate(): number {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const target = new Date(kstNow);
  target.setUTCHours(7, 15, 0, 0); // KST 16:15 = UTC 07:15
  if (kstNow.getUTCHours() * 60 + kstNow.getUTCMinutes() >= 7 * 60 + 15) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  const diff = Math.floor((target.getTime() - now.getTime()) / 1000);
  return Math.max(diff, 60);
}

function parseRate(raw: string): number | null {
  const cleaned = raw.replace(/[%,+\s]/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isNaN(value) ? null : value;
}

/** 구글시트 "게임종목" 시트 B~P열(종목코드, 대비)에서 종목코드별 현재 등락률을 가져온다 */
export async function fetchCurrentRates(): Promise<Record<string, number>> {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!apiKey || !spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_API_KEY / GOOGLE_SHEETS_SPREADSHEET_ID 환경변수가 설정되지 않았습니다.");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    SHEET_RANGE
  )}?key=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: secondsUntilNextUpdate() } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`구글시트 조회 실패: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { values?: string[][] };
  const rates: Record<string, number> = {};

  for (const row of data.values ?? []) {
    const stockCode = row[0]?.trim();
    const rate = parseRate(row[14] ?? ""); // B열 기준 P열은 14번째 오프셋
    if (stockCode && rate !== null) {
      rates[stockCode] = rate;
    }
  }

  return rates;
}
