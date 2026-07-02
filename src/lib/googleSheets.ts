const SHEET_RANGE = "'게임종목'!B5:P9";

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

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`구글시트 조회 실패: ${res.status}`);
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
