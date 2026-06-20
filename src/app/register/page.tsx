"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();

  const [nickname, setNickname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (nickname.trim().length < 2) { setError("닉네임은 2자 이상이어야 합니다."); return; }
    if (username.trim().length < 4)  { setError("아이디는 4자 이상이어야 합니다."); return; }
    if (password.length < 6)         { setError("비밀번호는 6자 이상이어야 합니다."); return; }

    setLoading(true);

    // 닉네임 중복 확인
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("nickname", nickname.trim());

    if ((count ?? 0) > 0) {
      setError("이미 사용 중인 닉네임입니다.");
      setLoading(false);
      return;
    }

    // Supabase Auth 가입 (username을 email 형식으로 변환)
    const fakeEmail = `${username.trim()}@stockgame.local`;
    const { error: signUpError } = await supabase.auth.signUp({
      email: fakeEmail,
      password,
      options: {
        data: { nickname: nickname.trim() },
      },
    });

    if (signUpError) {
      setError(
        signUpError.message.includes("already registered")
          ? "이미 사용 중인 아이디입니다."
          : signUpError.message
      );
      setLoading(false);
      return;
    }

    router.push("/game");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-800">📈 주식 픽 게임</h1>
          <p className="text-gray-500 text-sm mt-1">가입 시 1,000 포인트 지급!</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-gray-800">회원가입</h2>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="2자 이상"
              autoComplete="nickname"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">아이디</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="4자 이상 (영문/숫자)"
              autoComplete="username"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              autoComplete="new-password"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? "처리 중..." : "가입하기"}
          </button>

          <p className="text-center text-sm text-gray-500">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-blue-600 font-medium hover:underline">
              로그인
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
