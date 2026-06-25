"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";

interface Round {
  id: string;
  start_date: string;
  end_date: string;
  is_finalized: boolean;
}

interface RoundStock {
  stock_code: string;
  stock_name: string;
  sort_order: number;
}

interface PickCount {
  stock_code: string;
  count: number;
}

const EMPTY_STOCKS = Array.from({ length: 5 }, (_, i) => ({
  stock_code: "",
  stock_name: "",
  analysis_url: "",
  sort_order: i + 1,
}));

export default function AdminPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [rounds, setRounds] = useState<Round[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"rounds" | "create" | "finalize">("rounds");

  // 라운드 생성 상태
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newStocks, setNewStocks] = useState(EMPTY_STOCKS);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  // 결과 확정 상태
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [roundStocks, setRoundStocks] = useState<RoundStock[]>([]);
  const [pickCounts, setPickCounts] = useState<PickCount[]>([]);
  const [changeRates, setChangeRates] = useState<Record<string, string>>({});
  const [rank1, setRank1] = useState("");
  const [rank2, setRank2] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeMsg, setFinalizeMsg] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (!profile) { setPageLoading(false); return; }
    if (!profile.is_admin) { router.replace("/game"); return; }
    loadRounds();
  }, [user, profile, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadRounds() {
    const { data } = await supabase
      .from("weekly_rounds")
      .select("id, start_date, end_date, is_finalized")
      .order("start_date", { ascending: false });
    setRounds(data ?? []);
    setPageLoading(false);
  }

  async function handleCreateRound() {
    setCreateMsg("");
    if (!newStartDate || !newEndDate) { setCreateMsg("날짜를 입력해주세요."); return; }
    const validStocks = newStocks.filter((s) => s.stock_code && s.stock_name);
    if (validStocks.length < 2) { setCreateMsg("종목을 2개 이상 입력해주세요."); return; }

    setCreating(true);
    const { data: roundData, error: roundErr } = await supabase
      .from("weekly_rounds")
      .insert({ start_date: newStartDate, end_date: newEndDate })
      .select("id")
      .single();

    if (roundErr || !roundData) {
      setCreateMsg("라운드 생성 실패: " + roundErr?.message);
      setCreating(false);
      return;
    }

    const { error: stockErr } = await supabase.from("round_stocks").insert(
      validStocks.map((s) => ({
        round_id: roundData.id,
        stock_code: s.stock_code.trim(),
        stock_name: s.stock_name.trim(),
        sort_order: s.sort_order,
        analysis_url: s.analysis_url.trim() || null,
      }))
    );

    if (stockErr) {
      setCreateMsg("종목 등록 실패: " + stockErr.message);
    } else {
      setCreateMsg("✅ 라운드가 생성되었습니다!");
      setNewStartDate("");
      setNewEndDate("");
      setNewStocks(EMPTY_STOCKS);
      loadRounds();
    }
    setCreating(false);
  }

  async function handleSelectRound(round: Round) {
    setSelectedRound(round);
    setFinalizeMsg("");
    setRank1("");
    setRank2("");
    setChangeRates({});

    const [{ data: stocks }, { data: picks }] = await Promise.all([
      supabase
        .from("round_stocks")
        .select("stock_code, stock_name, sort_order")
        .eq("round_id", round.id)
        .order("sort_order"),
      supabase
        .from("picks")
        .select("stock_code")
        .eq("round_id", round.id),
    ]);

    setRoundStocks(stocks ?? []);

    // 픽 집계
    const counts: Record<string, number> = {};
    (picks ?? []).forEach((p) => {
      counts[p.stock_code] = (counts[p.stock_code] ?? 0) + 1;
    });
    setPickCounts(
      Object.entries(counts).map(([stock_code, count]) => ({ stock_code, count }))
    );

    setActiveTab("finalize");
  }

  async function handleFinalize() {
    if (!selectedRound) return;
    if (!rank1 || !rank2) { setFinalizeMsg("1위, 2위 종목을 선택해주세요."); return; }
    if (rank1 === rank2) { setFinalizeMsg("1위와 2위가 같을 수 없습니다."); return; }

    const rates: Record<string, number> = {};
    for (const stock of roundStocks) {
      const val = parseFloat(changeRates[stock.stock_code] ?? "0");
      rates[stock.stock_code] = isNaN(val) ? 0 : val;
    }

    setFinalizing(true);
    setFinalizeMsg("");

    // results 테이블에 insert
    const { error: resultErr } = await supabase.from("results").insert({
      round_id: selectedRound.id,
      rank1_stock: rank1,
      rank2_stock: rank2,
      change_rates: rates,
    });

    if (resultErr) {
      setFinalizeMsg("결과 등록 실패: " + resultErr.message);
      setFinalizing(false);
      return;
    }

    // finalize_round 함수 호출 (포인트 지급 + is_finalized=true)
    const { error: finalErr } = await supabase.rpc("finalize_round", {
      p_round_id: selectedRound.id,
    });

    if (finalErr) {
      setFinalizeMsg("확정 처리 실패: " + finalErr.message);
    } else {
      setFinalizeMsg("✅ 라운드가 확정되었습니다! 포인트가 지급되었습니다.");
      loadRounds();
    }
    setFinalizing(false);
  }

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        불러오는 중...
      </div>
    );
  }

  if (!user || !profile?.is_admin) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold">관리자 페이지</h1>
        <button
          onClick={() => router.push("/game")}
          className="text-xs opacity-60 hover:opacity-100"
        >
          게임으로 →
        </button>
      </header>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-200 flex">
        {(["rounds", "create", "finalize"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "text-blue-700 border-b-2 border-blue-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "rounds" ? "라운드 목록" : tab === "create" ? "라운드 생성" : "결과 확정"}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        {/* 라운드 목록 */}
        {activeTab === "rounds" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500">전체 라운드</h2>
            {rounds.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">등록된 라운드가 없습니다.</p>
            )}
            {rounds.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {r.start_date} ~ {r.end_date}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.is_finalized
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {r.is_finalized ? "확정" : "진행 중"}
                  </span>
                </div>
                {!r.is_finalized && (
                  <button
                    onClick={() => handleSelectRound(r)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    결과 입력 →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 라운드 생성 */}
        {activeTab === "create" && (
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-gray-500">새 라운드 생성</h2>

            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">시작일</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">종료일 (금/목)</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">종목 목록 (최대 5개)</label>
                {newStocks.map((stock, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`종목코드 ${idx + 1}`}
                      value={stock.stock_code}
                      onChange={(e) => {
                        const updated = [...newStocks];
                        updated[idx] = { ...updated[idx], stock_code: e.target.value };
                        setNewStocks(updated);
                      }}
                      className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder={`종목명 ${idx + 1}`}
                      value={stock.stock_name}
                      onChange={(e) => {
                        const updated = [...newStocks];
                        updated[idx] = { ...updated[idx], stock_name: e.target.value };
                        setNewStocks(updated);
                      }}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="url"
                      placeholder="분석 URL (선택)"
                      value={stock.analysis_url}
                      onChange={(e) => {
                        const updated = [...newStocks];
                        updated[idx] = { ...updated[idx], analysis_url: e.target.value };
                        setNewStocks(updated);
                      }}
                      className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {createMsg && (
              <p
                className={`text-sm rounded-lg px-3 py-2 ${
                  createMsg.startsWith("✅")
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {createMsg}
              </p>
            )}

            <button
              onClick={handleCreateRound}
              disabled={creating}
              className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              {creating ? "생성 중..." : "라운드 생성"}
            </button>
          </div>
        )}

        {/* 결과 확정 */}
        {activeTab === "finalize" && (
          <div className="space-y-5">
            {!selectedRound ? (
              <p className="text-sm text-gray-400 text-center py-8">
                라운드 목록에서 &quot;결과 입력&quot; 버튼을 누르세요.
              </p>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <p className="text-sm font-medium text-gray-700">
                    {selectedRound.start_date} ~ {selectedRound.end_date}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    참여자 수: {pickCounts.reduce((s, p) => s + p.count, 0)}명
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500">등락률 입력 (%)</p>
                  {roundStocks.map((stock) => {
                    const pickCount = pickCounts.find((p) => p.stock_code === stock.stock_code)?.count ?? 0;
                    return (
                      <div key={stock.stock_code} className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{stock.stock_name}</p>
                          <p className="text-xs text-gray-400">{stock.stock_code} · {pickCount}명 선택</p>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={changeRates[stock.stock_code] ?? ""}
                          onChange={(e) =>
                            setChangeRates((prev) => ({
                              ...prev,
                              [stock.stock_code]: e.target.value,
                            }))
                          }
                          className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500">순위 지정</p>
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-gray-500">🥇 1위 종목</label>
                      <select
                        value={rank1}
                        onChange={(e) => setRank1(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">선택</option>
                        {roundStocks.map((s) => (
                          <option key={s.stock_code} value={s.stock_code}>
                            {s.stock_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-gray-500">🥈 2위 종목</label>
                      <select
                        value={rank2}
                        onChange={(e) => setRank2(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">선택</option>
                        {roundStocks.map((s) => (
                          <option key={s.stock_code} value={s.stock_code}>
                            {s.stock_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {finalizeMsg && (
                  <p
                    className={`text-sm rounded-lg px-3 py-2 ${
                      finalizeMsg.startsWith("✅")
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {finalizeMsg}
                  </p>
                )}

                <button
                  onClick={handleFinalize}
                  disabled={finalizing}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
                >
                  {finalizing ? "처리 중..." : "결과 확정 및 포인트 지급"}
                </button>
                <p className="text-xs text-gray-400 text-center">
                  확정 후에는 되돌릴 수 없습니다.
                </p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
