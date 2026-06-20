"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fakeEmail = `${username.trim()}@stockgame.local`;
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });

    if (signInError) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
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
          <p className="text-gray-500 text-sm mt-1">이번 주 1위 종목을 맞혀보세요</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-gray-800">로그인</h2>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">아이디</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
              autoComplete="current-password"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>

          <p className="text-center text-sm text-gray-500">
            계정이 없으신가요?{" "}
            <Link href="/register" className="text-blue-600 font-medium hover:underline">
              회원가입
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
