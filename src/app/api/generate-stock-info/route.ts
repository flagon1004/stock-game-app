import { NextResponse } from "next/server";

const DART_API_KEY    = process.env.DART_API_KEY!;
const GITHUB_TOKEN    = process.env.GITHUB_TOKEN_STOCK!;
const GITHUB_REPO     = "flagon1004/stock-list";
const GOOGLE_API_KEY  = process.env.GOOGLE_SHEETS_API_KEY!;
const SPREADSHEET_ID  = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
const CRON_SECRET     = process.env.CRON_SECRET!;

async function fetchSheet(range: string): Promise<string[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${GOOGLE_API_KEY}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  return (data.values ?? []).map((r: string[]) => r[0]?.trim()).filter(Boolean);
}

async function fetchDart(stockCode: string) {
  const end = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
  const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&stock_code=${stockCode}&bgn_de=${start}&end_de=${end}&page_count=5`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return data.status === "000" ? (data.list ?? []).slice(0, 5) : [];
  } catch { return []; }
}

function buildHtml(code: string, name: string, disclosures: {rcept_no:string; rcept_dt:string; report_nm:string}[]): string {
  const discRows = disclosures.length
    ? disclosures.map((d) => {
        const dt = d.rcept_dt;
        const dateStr = dt.length === 8 ? `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6)}` : dt;
        return `<a class="disc-row" href="https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}" target="_blank">
          <span class="disc-title">${d.report_nm}</span>
          <span class="disc-date">${dateStr}</span>
        </a>`;
      }).join("")
    : '<p class="no-data">최근 30일 공시 없음</p>';

  const naverUrl = `https://finance.naver.com/item/main.naver?code=${code}`;
  const dartUrl  = `https://dart.fss.or.kr/dsab001/search.ax?textCrpNm=${encodeURIComponent(name)}`;
  const generated = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} 종목 정보</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f9fc;color:#1a202c;padding:16px}
  .header{background:#1a365d;color:white;border-radius:12px;padding:16px 20px;margin-bottom:16px}
  .header h1{font-size:1.2rem;font-weight:700}
  .header .code{font-size:.8rem;opacity:.7;margin-top:2px}
  .card{background:white;border-radius:12px;border:1px solid #e2e8f0;padding:16px;margin-bottom:12px}
  .card h2{font-size:.75rem;font-weight:600;color:#718096;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}
  .disc-row{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid #f0f0f0;text-decoration:none;color:inherit;gap:8px}
  .disc-row:last-child{border-bottom:none}
  .disc-title{font-size:.85rem;color:#2d3748;flex:1;line-height:1.4}
  .disc-date{font-size:.75rem;color:#a0aec0;white-space:nowrap}
  .disc-row:hover .disc-title{color:#2b6cb0;text-decoration:underline}
  .links{display:flex;gap:8px}
  .link-btn{flex:1;text-align:center;padding:10px;border-radius:8px;font-size:.85rem;font-weight:600;text-decoration:none}
  .btn-naver{background:#03c75a;color:white}
  .btn-dart{background:#4a5568;color:white}
  .no-data{font-size:.85rem;color:#a0aec0;padding:8px 0}
  .footer{text-align:center;font-size:.72rem;color:#a0aec0;margin-top:16px}
  .close-btn{display:block;width:100%;background:#1a365d;color:white;border:none;border-radius:8px;padding:12px;font-size:.9rem;font-weight:600;cursor:pointer;margin-top:12px}
</style>
</head>
<body>
  <div class="header"><h1>${name}</h1><div class="code">${code} · KRX</div></div>
  <div class="card"><h2>최근 공시 (30일)</h2>${discRows}</div>
  <div class="card"><h2>더 보기</h2>
    <div class="links">
      <a class="link-btn btn-naver" href="${naverUrl}" target="_blank">네이버 금융</a>
      <a class="link-btn btn-dart"  href="${dartUrl}"  target="_blank">DART 공시</a>
    </div>
  </div>
  <button class="close-btn" onclick="window.close()">창 닫기</button>
  <div class="footer">자동 생성 · ${generated}</div>
</body>
</html>`;
}

async function uploadToGithub(filename: string, content: string) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filename}`;
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
  const shaRes = await fetch(url, { headers, cache: "no-store" });
  const sha = shaRes.ok ? (await shaRes.json()).sha : undefined;
  const body: Record<string, string> = {
    message: `update ${filename} (${new Date().toISOString().slice(0, 10)})`,
    content: Buffer.from(content, "utf-8").toString("base64"),
  };
  if (sha) body.sha = sha;
  await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
}

export async function GET(req: Request) {
  // 인증 확인 (외부 무단 호출 방지)
  const auth = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (auth !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const codes = await fetchSheet("'게임종목'!B5:B9");
  const names = await fetchSheet("'게임종목'!D5:D9");

  const results: string[] = [];

  await Promise.all(
    codes.map(async (code, idx) => {
      const name = names[idx] ?? code;
      const disclosures = await fetchDart(code);
      const html = buildHtml(code, name, disclosures);
      await uploadToGithub(`stock-1${idx + 1}.html`, html);
      results.push(`stock-1${idx + 1}.html (${name})`);
    })
  );

  return NextResponse.json({ ok: true, generated: results });
}
