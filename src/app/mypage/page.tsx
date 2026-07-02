"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";

interface RoundResult {
  round_id: string;
  start_date: string;
  end_date: string;
  my_stock_code: string | null;
  my_stock_name: string | null;
  rank1_stock: string | null;
  rank2_stock: string | null;
  change_rates: Record<string, number> | null;
  stocks: { stock_code: string; stock_name: string; sort_order: number }[];
}

interface CurrentRound {
  id: string;
  start_date: string;
  end_date: string;
}

interface CurrentStock {
  stock_code: string;
  stock_name: string;
  sort_order: number;
}

function calcPoints(myCode: string | null, rank1: string | null, rank2: string | null): number {
  if (!myCode) return 0;
  if (myCode === rank1) return 100;
  if (myCode === rank2) return 50;
  return 0;
}

export default function MyPage() {
  const { user, profile, loading, logout } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [currentRound, setCurrentRound] = useState<CurrentRound | null>(null);
  const [currentStocks, setCurrentStocks] = useState<CurrentStock[]>([]);
  const [currentRates, setCurrentRates] = useState<Record<string, number>>({});
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    async function loadCurrentRound() {
      const { data: roundData } = await supabase
        .from("weekly_rounds")
        .select("id, start_date, end_date")
        .eq("is_finalized", false)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!roundData) return;
      setCurrentRound(roundData);

      const { data: stockData } = await supabase
        .from("round_stocks")
        .select("stock_code, stock_name, sort_order")
        .eq("round_id", roundData.id)
        .order("sort_order");
      setCurrentStocks(stockData ?? []);

      try {
        const res = await fetch("/api/current-rates");
        const json = await res.json();
        setCurrentRates(json.rates ?? {});
      } catch {
        setCurrentRates({});
      }
    }

    async function load() {
      // 확정된 라운드 중 가장 최근 1주만 조회 (RLS가 미확정 results를 차단하므로 안전)
      const [{ data: finalizedRounds }] = await Promise.all([
        supabase
          .from("weekly_rounds")
          .select("id, start_date, end_date")
          .eq("is_finalized", true)
          .order("start_date", { ascending: false })
          .limit(1),
        loadCurrentRound(),
      ]);

      if (!finalizedRounds || finalizedRounds.length === 0) {
        setPageLoading(false);
        return;
      }

      const roundIds = finalizedRounds.map((r) => r.id);

      // 내 픽, 결과, 종목 병렬 조회
      const [{ data: myPicks }, { data: results }, { data: allStocks }] = await Promise.all([
        supabase
          .from("picks")
          .select("round_id, stock_code")
          .eq("user_id", user!.id)
          .in("round_id", roundIds),
        supabase
          .from("results")
          .select("round_id, rank1_stock, rank2_stock, change_rates")
          .in("round_id", roundIds),
        supabase
          .from("round_stocks")
          .select("round_id, stock_code, stock_name, sort_order")
          .in("round_id", roundIds)
          .order("sort_order"),
      ]);

      const merged: RoundResult[] = finalizedRounds.map((r) => {
        const pick = myPicks?.find((p) => p.round_id === r.id);
        const result = results?.find((res) => res.round_id === r.id);
        const stocks = (allStocks ?? []).filter((s) => s.round_id === r.id);
        const myStock = stocks.find((s) => s.stock_code === pick?.stock_code);

        return {
          round_id: r.id,
          start_date: r.start_date,
          end_date: r.end_date,
          my_stock_code: pick?.stock_code ?? null,
          my_stock_name: myStock?.stock_name ?? null,
          rank1_stock: result?.rank1_stock ?? null,
          rank2_stock: result?.rank2_stock ?? null,
          change_rates: result?.change_rates ?? null,
          stocks,
        };
      });

      setRounds(merged);
      setPageLoading(false);
    }

    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        불러오는 중...
      </div>
    );
  }

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-800 text-white px-4 py-3 flex items-center justify-between">
        <Link href="/game" className="text-sm opacity-70 hover:opacity-100">← 게임으로</Link>
        <h1 className="font-bold">마이페이지</h1>
        <button
          onClick={() => { logout(); router.push("/login"); }}
          className="text-xs opacity-60 hover:opacity-100"
        >
          로그아웃
        </button>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6">
        {/* 포인트 카드 */}
        <div className="bg-blue-700 text-white rounded-2xl px-5 py-5">
          <p className="text-sm opacity-80">안녕하세요, {profile.nickname}님</p>
          <p className="text-3xl font-bold mt-1">{profile.points.toLocaleString()} pt</p>
          <p className="text-xs opacity-60 mt-1">누적 포인트</p>
        </div>

        {/* 현재 라운드 진행 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">현재 라운드 진행</h2>

          {!currentRound ? (
            <p className="text-sm text-gray-400 text-center py-6">진행 중인 라운드가 없습니다.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-sm font-medium text-gray-700">
                  {currentRound.start_date} ~ {currentRound.end_date}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">전일 종가 기준의 현재 등락률</p>
              </div>

              <div className="px-4 py-3 space-y-2">
                {currentStocks.map((stock, idx) => {
                  const rate = currentRates[stock.stock_code];
                  const hasRate = rate !== undefined;

                  return (
                    <div key={stock.stock_code} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold w-4 text-gray-400">{idx + 1}</span>
                        <span className="font-medium text-gray-800">{stock.stock_name}</span>
                      </div>
                      <span
                        className={
                          !hasRate
                            ? "text-gray-300"
                            : rate >= 0
                            ? "text-red-500 font-medium"
                            : "text-blue-500 font-medium"
                        }
                      >
                        {hasRate ? `${rate >= 0 ? "+" : ""}${rate.toFixed(1)}%` : "-"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* 지난 라운드 결과 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">지난 라운드 결과</h2>

          {rounds.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">확정된 라운드가 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {rounds.map((r) => {
                const earned = calcPoints(r.my_stock_code, r.rank1_stock, r.rank2_stock);
                const sortedStocks = [...r.stocks].sort(
                  (a, b) =>
                    (r.change_rates?.[b.stock_code] ?? 0) -
                    (r.change_rates?.[a.stock_code] ?? 0)
                );

                return (
                  <div key={r.round_id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">
                        {r.start_date} ~ {r.end_date}
                      </p>
                      {r.my_stock_code ? (
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            earned > 0
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {earned > 0 ? `+${earned}pt` : "0pt"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">미참여</span>
                      )}
                    </div>

                    <div className="px-4 py-3 space-y-2">
                      {sortedStocks.map((stock, idx) => {
                        const rate = r.change_rates?.[stock.stock_code] ?? 0;
                        const isRank1 = stock.stock_code === r.rank1_stock;
                        const isRank2 = stock.stock_code === r.rank2_stock;
                        const isMyPick = r.my_stock_code === stock.stock_code;

                        return (
                          <div key={stock.stock_code} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-bold w-4 ${
                                  idx === 0 ? "text-yellow-500" : idx === 1 ? "text-gray-400" : "text-gray-300"
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <span className={`font-medium ${isMyPick ? "text-blue-700" : "text-gray-800"}`}>
                                {stock.stock_name}
                                {isMyPick && " ✓"}
                              </span>
                              {(isRank1 || isRank2) && (
                                <span className="text-xs bg-yellow-50 text-yellow-600 border border-yellow-200 rounded px-1">
                                  {isRank1 ? "1위" : "2위"}
                                </span>
                              )}
                            </div>
                            <span className={rate >= 0 ? "text-red-500 font-medium" : "text-blue-500 font-medium"}>
                              {rate >= 0 ? "+" : ""}{rate.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
