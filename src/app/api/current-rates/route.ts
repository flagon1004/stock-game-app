import { NextResponse } from "next/server";
import { fetchCurrentRates } from "@/lib/googleSheets";

export async function GET() {
  try {
    const rates = await fetchCurrentRates();
    return NextResponse.json({ rates });
  } catch (error) {
    console.error("현재 등락률 조회 실패:", error);
    return NextResponse.json({ rates: {} }, { status: 500 });
  }
}
