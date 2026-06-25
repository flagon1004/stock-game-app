"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";

interface Stock {
  stock_code: string;
  stock_name: string;
  sort_order: number;
}

interface Round {
  id: string;
  start_date: string;
  end_date: string;
  is_finalized: boolean;
}

/** 현재 투표 가능 시간인지 확인 (KST 기준: 금 17:00 ~ 월 07:00) */
function isVotingOpen(): boolean {
  const now = new Date();
  // KST = UTC+9
  const kstOffset = 9 * 60;
  const kstMs = now.getTime() + (kstOffset + now.getTimezoneOffset()) * 60 * 1000;
  const kst = new Date(kstMs);
  const day = kst.getDay(); // 0=일, 1=월, 2=화 ... 5=금, 6=토
  const hour = kst.getHours();
  const minute = kst.getMinutes();
  const timeVal = hour * 100 + minute; // HHMM

  // 금요일(5) 17:00 이후
  if (day === 5 && timeVal >= 1700) return true;
  // 토요일(6) 전체
  if (day === 6) return true;
  // 일요일(0) 전체
  if (day === 0) return true;
  // 월요일(1) 07:00 이전
  if (day === 1 && timeVal < 700) return true;
  return false;
}

function getVotingStatusMessage(): string {
  const now = new Date();
  const kstOffset = 9 * 60;
  const kstMs = now.getTime() + (kstOffset + now.getTimezoneOffset()) * 60 * 1000;
  const kst = new Date(kstMs);
  const day = kst.getDay();

  if (day === 1) return "월요일 오전 7시에 투표가 마감되었습니다.";
  if (day >= 2 && day <= 4) return "투표는 금요일 오후 5시에 시작됩니다.";
  if (day === 5) return "투표는 오늘(금) 오후 5시에 시작됩니다.";
  return "현재 투표 기간이 아닙니다.";
}

export default function GamePage() {
  const { user, profile, loading, logout } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [round, setRound] = useState<Round | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [pickCounts, setPickCounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [votingOpen] = useState(isVotingOpen());

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: roundData } = await supabase
        .from("weekly_rounds")
        .select("id, start_date, end_date, is_finalized")
        .eq("is_finalized", false)
        .order("start_date", { ascending: false })
        .limit(1)
        .single();

      if (!roundData) { setPageLoading(false); return; }
      setRound(roundData);

      const { data: stockData } = await supabase
        .from("round_stocks")
        .select("stock_code, stock_name, sort_order")
        .eq("round_id", roundData.id)
        .order("sort_order");

      setStocks(stockData ?? []);

      const { data: pickData } = await supabase
        .from("picks")
        .select("stock_code")
        .eq("user_id", user!.id)
        .eq("round_id", roundData.id)
        .maybeSingle();

      if (pickData) {
        setSubmittedCode(pickData.stock_code);
        setSelected(pickData.stock_code);
        // 이미 픽한 경우 통계 로드
        await loadPickCounts(roundData.id);
      }

      setPageLoading(false);
    }

    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPickCounts(roundId: string) {
    const { data } = await supabase.rpc("get_pick_counts", { p_round_id: roundId });
    if (data) {
      const counts: Record<string, number> = {};
      (data as { stock_code: string; cnt: number }[]).forEach((row) => {
        counts[row.stock_code] = Number(row.cnt);
      });
      setPickCounts(counts);
    }
  }

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        불러오는 중...
      </div>
    );
  }

  if (!user || !profile) return null;

  async function handleSubmit() {
    if (!selected || !round) return;
    setError("");
    setSubmitting(true);

    const { error: insertError } = await supabase.from("picks").insert({
      user_id: user!.id,
      round_id: round.id,
      stock_code: selected,
    });

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "이미 이번 라운드에 선택하셨습니다."
          : "제출에 실패했습니다. 다시 시도해주세요."
      );
    } else {
      setSubmittedCode(selected);
      await loadPickCounts(round.id);
    }

    setSubmitting(false);
  }

  const totalPicks = Object.values(pickCounts).reduce((s, c) => s + c, 0);

  const endDate = round ? new Date(round.end_date) : null;
  const endDateStr = endDate
    ? `${endDate.getMonth() + 1}월 ${endDate.getDate()}일`
    : "";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-800 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">📈 주식 픽 게임</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/mypage" className="opacity-80 hover:opacity-100">
            {profile.nickname}
            <span className="ml-1 text-xs opacity-60">{profile.points.toLocaleString()}pt</span>
          </Link>
          <button
            onClick={() => { logout(); router.push("/login"); }}
            className="opacity-60 hover:opacity-100 text-xs"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-5">
        {!round ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">이번 주 라운드 준비 중입니다.</p>
            <p className="text-sm mt-1">관리자가 종목을 등록하면 투표가 시작됩니다.</p>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-sm text-blue-700 font-medium">
                이번 주 ({round.start_date} ~ {endDateStr}) 가장 많이 오를 종목은?
              </p>
              <p className="text-xs text-blue-500 mt-0.5">1위 +100pt · 2위 +50pt</p>
            </div>

            {/* 투표 마감 안내 */}
            {!votingOpen && !submittedCode && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                <p className="text-sm font-medium text-amber-700">⏰ 현재 투표 시간이 아닙니다</p>
                <p className="text-xs text-amber-600 mt-0.5">{getVotingStatusMessage()}</p>
                <p className="text-xs text-amber-500 mt-0.5">투표 가능 시간: 금요일 17:00 ~ 월요일 07:00</p>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="space-y-3">
              {stocks.map((stock) => {
                const isSelected = selected === stock.stock_code;
                const isSubmitted = submittedCode === stock.stock_code;
                const count = pickCounts[stock.stock_code] ?? 0;
                const pct = totalPicks > 0 ? Math.round((count / totalPicks) * 100) : 0;

                return (
                  <button
                    key={stock.stock_code}
                    onClick={() => {
                      if (!submittedCode && votingOpen) setSelected(stock.stock_code);
                    }}
                    disabled={!!submittedCode || !votingOpen}
                    className={`w-full text-left rounded-xl border-2 px-4 py-4 transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-100 bg-white hover:border-gray-300"
                    } ${submittedCode && !isSubmitted ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{stock.stock_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{stock.stock_code}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? "border-blue-600 bg-blue-600" : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* 픽 제출 후 통계 Bar */}
                    {submittedCode && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{count}명</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              isSubmitted ? "bg-blue-500" : "bg-gray-300"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {!submittedCode ? (
              <button
                onClick={handleSubmit}
                disabled={!selected || submitting || !votingOpen}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl py-3 transition-colors"
              >
                {submitting ? "제출 중..." : "선택 완료"}
              </button>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4 text-center space-y-1">
                <p className="text-green-700 font-semibold">✅ 선택 완료!</p>
                <p className="text-sm text-green-600">
                  {stocks.find((s) => s.stock_code === submittedCode)?.stock_name} 선택하셨습니다.
                </p>
                <p className="text-xs text-gray-400 mt-1">결과는 금요일 장 마감 후 공개됩니다.</p>
              </div>
            )}
          </>
        )}

        <div className="text-center">
          <Link href="/mypage" className="text-sm text-blue-600 hover:underline">
            내 점수 · 지난 라운드 보기 →
          </Link>
        </div>
      </main>
    </div>
  );
}
