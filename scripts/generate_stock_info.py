"""
주식 종목 정보 HTML 자동 생성 스크립트
- 구글 시트 '게임종목' 탭 B5:B9 에서 종목코드 읽기
- DART API 로 공시정보 조회
- FinanceDataReader 로 주가 데이터 조회
- stock-11~15.html 생성 후 GitHub 업로드
"""

import os
import json
import base64
import requests
from datetime import datetime, timedelta
import FinanceDataReader as fdr

# ── 환경변수 또는 직접 입력 ───────────────────────────────────────
DART_API_KEY        = os.environ["DART_API_KEY"]
GITHUB_TOKEN        = os.environ["GITHUB_TOKEN"]
GITHUB_REPO         = "flagon1004/stock-list"
GOOGLE_API_KEY      = os.environ["GOOGLE_SHEETS_API_KEY"]
SPREADSHEET_ID      = os.environ.get("GOOGLE_SHEETS_SPREADSHEET_ID", "1OCcoBs9PossywYWrdCKt8DW1cq6MHqYhYDHvCZJbF4c")
SHEET_RANGE         = "'게임종목'!B5:B9"   # 종목코드 열
NAME_RANGE          = "'게임종목'!D5:D9"   # 종목명 열


# ── 구글 시트에서 종목코드/종목명 읽기 ─────────────────────────────
def fetch_from_sheet(cell_range: str) -> list[str]:
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET_ID}"
        f"/values/{requests.utils.quote(cell_range)}?key={GOOGLE_API_KEY}"
    )
    res = requests.get(url, timeout=10)
    res.raise_for_status()
    values = res.json().get("values", [])
    return [row[0].strip() for row in values if row and row[0].strip()]


# ── DART 공시 조회 ──────────────────────────────────────────────
def fetch_dart_disclosures(stock_code: str) -> list[dict]:
    end_date   = datetime.today().strftime("%Y%m%d")
    start_date = (datetime.today() - timedelta(days=30)).strftime("%Y%m%d")
    url = "https://opendart.fss.or.kr/api/list.json"
    params = {
        "crtfc_key": DART_API_KEY,
        "stock_code": stock_code,
        "bgn_de": start_date,
        "end_de": end_date,
        "page_count": 5,
    }
    try:
        res = requests.get(url, params=params, timeout=10)
        data = res.json()
        if data.get("status") == "000":
            return data.get("list", [])[:5]
    except Exception:
        pass
    return []


# ── 주가 데이터 조회 (FinanceDataReader) ───────────────────────────
def fetch_price_data(stock_code: str) -> dict:
    try:
        start = (datetime.today() - timedelta(days=10)).strftime("%Y-%m-%d")
        df = fdr.DataReader(stock_code, start)
        if len(df) < 2:
            return {}
        today    = df.iloc[-1]
        prev     = df.iloc[-2]
        close    = int(today["Close"])
        prev_c   = int(prev["Close"])
        change   = close - prev_c
        change_p = round((change / prev_c) * 100, 2)
        volume   = int(today.get("Volume", 0))
        return {
            "close": f"{close:,}",
            "change": f"{'+' if change >= 0 else ''}{change:,}",
            "change_pct": f"{'+' if change_p >= 0 else ''}{change_p}%",
            "is_up": change >= 0,
            "volume": f"{volume:,}",
            "date": df.index[-1].strftime("%Y-%m-%d"),
        }
    except Exception:
        return {}


# ── HTML 생성 ────────────────────────────────────────────────────
def build_html(stock_code: str, stock_name: str, price: dict, disclosures: list[dict]) -> str:
    price_color = "#e53e3e" if price.get("is_up", True) else "#3182ce"
    price_html = f"""
        <div class="price-card">
          <div class="price-main" style="color:{price_color}">
            {price.get('close', '-')}원
            <span class="price-change">{price.get('change', '')} ({price.get('change_pct', '')})</span>
          </div>
          <div class="price-sub">거래량 {price.get('volume', '-')} · {price.get('date', '')}</div>
        </div>
    """ if price else '<div class="price-card">주가 정보를 불러올 수 없습니다.</div>'

    disc_rows = ""
    if disclosures:
        for d in disclosures:
            rcept_dt = d.get("rcept_dt", "")
            date_str = f"{rcept_dt[:4]}-{rcept_dt[4:6]}-{rcept_dt[6:]}" if len(rcept_dt) == 8 else rcept_dt
            disc_rows += f"""
            <a class="disc-row" href="https://dart.fss.or.kr/dsaf001/main.do?rcpNo={d.get('rcept_no','')}" target="_blank">
              <span class="disc-title">{d.get('report_nm', '')}</span>
              <span class="disc-date">{date_str}</span>
            </a>"""
    else:
        disc_rows = '<p class="no-data">최근 30일 공시 없음</p>'

    naver_url = f"https://finance.naver.com/item/main.naver?code={stock_code}"
    dart_url  = f"https://dart.fss.or.kr/dsab001/search.ax?textCrpNm={requests.utils.quote(stock_name)}"
    generated = datetime.now().strftime("%Y-%m-%d %H:%M")

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{stock_name} 종목 정보</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f7f9fc; color: #1a202c; padding: 16px; }}
  .header {{ background: #1a365d; color: white; border-radius: 12px;
             padding: 16px 20px; margin-bottom: 16px; }}
  .header h1 {{ font-size: 1.2rem; font-weight: 700; }}
  .header .code {{ font-size: 0.8rem; opacity: 0.7; margin-top: 2px; }}
  .card {{ background: white; border-radius: 12px; border: 1px solid #e2e8f0;
           padding: 16px; margin-bottom: 12px; }}
  .card h2 {{ font-size: 0.75rem; font-weight: 600; color: #718096;
              text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }}
  .price-main {{ font-size: 1.6rem; font-weight: 700; }}
  .price-change {{ font-size: 0.95rem; font-weight: 600; margin-left: 8px; }}
  .price-sub {{ font-size: 0.78rem; color: #718096; margin-top: 6px; }}
  .disc-row {{ display: flex; justify-content: space-between; align-items: flex-start;
               padding: 10px 0; border-bottom: 1px solid #f0f0f0;
               text-decoration: none; color: inherit; gap: 8px; }}
  .disc-row:last-child {{ border-bottom: none; }}
  .disc-title {{ font-size: 0.85rem; color: #2d3748; flex: 1; line-height: 1.4; }}
  .disc-date {{ font-size: 0.75rem; color: #a0aec0; white-space: nowrap; }}
  .disc-row:hover .disc-title {{ color: #2b6cb0; text-decoration: underline; }}
  .links {{ display: flex; gap: 8px; }}
  .link-btn {{ flex: 1; text-align: center; padding: 10px;
               border-radius: 8px; font-size: 0.85rem; font-weight: 600;
               text-decoration: none; transition: opacity 0.2s; }}
  .link-btn:hover {{ opacity: 0.85; }}
  .btn-naver {{ background: #03c75a; color: white; }}
  .btn-dart  {{ background: #4a5568; color: white; }}
  .no-data {{ font-size: 0.85rem; color: #a0aec0; padding: 8px 0; }}
  .footer {{ text-align: center; font-size: 0.72rem; color: #a0aec0; margin-top: 16px; }}
  .close-btn {{ display: block; width: 100%; background: #1a365d; color: white;
                border: none; border-radius: 8px; padding: 12px;
                font-size: 0.9rem; font-weight: 600; cursor: pointer;
                margin-top: 12px; }}
</style>
</head>
<body>
  <div class="header">
    <h1>{stock_name}</h1>
    <div class="code">{stock_code} · KRX</div>
  </div>

  <div class="card">
    <h2>오늘의 주가</h2>
    {price_html}
  </div>

  <div class="card">
    <h2>최근 공시 (30일)</h2>
    {disc_rows}
  </div>

  <div class="card">
    <h2>더 보기</h2>
    <div class="links">
      <a class="link-btn btn-naver" href="{naver_url}" target="_blank">네이버 금융</a>
      <a class="link-btn btn-dart"  href="{dart_url}"  target="_blank">DART 공시</a>
    </div>
  </div>

  <button class="close-btn" onclick="window.close()">창 닫기</button>
  <div class="footer">자동 생성 · {generated} KST</div>
</body>
</html>"""


# ── GitHub 파일 업로드 ────────────────────────────────────────────
def upload_to_github(filename: str, content: str):
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{filename}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    }
    # 기존 파일 SHA 조회 (업데이트 시 필요)
    sha = None
    res = requests.get(url, headers=headers, timeout=10)
    if res.status_code == 200:
        sha = res.json().get("sha")

    payload = {
        "message": f"update {filename} ({datetime.today().strftime('%Y-%m-%d')})",
        "content": base64.b64encode(content.encode("utf-8")).decode("utf-8"),
    }
    if sha:
        payload["sha"] = sha

    res = requests.put(url, headers=headers, json=payload, timeout=15)
    res.raise_for_status()
    print(f"  ✅ {filename} 업로드 완료")


# ── 메인 ────────────────────────────────────────────────────────
def main():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 종목 정보 생성 시작")

    # 1. 구글 시트에서 종목코드·종목명 읽기
    print("구글 시트 조회 중...")
    stock_codes = fetch_from_sheet(SHEET_RANGE)
    stock_names = fetch_from_sheet(NAME_RANGE)

    # 종목명 열 위치가 다르면 위 NAME_RANGE 수정 필요
    # 없으면 종목코드로 대체
    if not stock_names or len(stock_names) < len(stock_codes):
        stock_names = stock_codes

    print(f"  종목코드: {stock_codes}")

    for idx, (code, name) in enumerate(zip(stock_codes, stock_names), start=1):
        file_num = 10 + idx          # 11, 12, 13, 14, 15
        filename = f"stock-{file_num}.html"
        print(f"\n[{idx}/5] {name} ({code}) → {filename}")

        # 2. 주가 데이터
        price = fetch_price_data(code)
        print(f"  주가: {price.get('close', '조회실패')} ({price.get('change_pct', '')})")

        # 3. DART 공시
        disclosures = fetch_dart_disclosures(code)
        print(f"  공시: {len(disclosures)}건")

        # 4. HTML 생성
        html = build_html(code, name, price, disclosures)

        # 5. GitHub 업로드
        upload_to_github(filename, html)

    print(f"\n✅ 완료 ({datetime.now().strftime('%H:%M:%S')})")


if __name__ == "__main__":
    main()
