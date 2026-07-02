import { NextResponse } from "next/server";
import { fetchCurrentRates } from "@/lib/googleSheets";

export async function GET() {
  try {
    const rates = await fetchCurrentRates();
    return NextResponse.json({ rates });
  } catch (error) {
    console.error("현재 등락률 조회 실패:", error);
    // TODO: 원인 확인 후 error 필드 제거
    return NextResponse.json(
      { rates: {}, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
