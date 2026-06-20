import { User } from "./types";

const STORAGE_KEY = "stock_game_user";

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export function storeUser(user: User): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

// 목업 사용자 저장소 (새로고침 시 초기화)
let mockUsers: { username: string; password: string; user: User }[] = [];

export function mockRegister(
  nickname: string,
  username: string,
  password: string
): { success: boolean; error?: string; user?: User } {
  if (mockUsers.find((u) => u.username === username)) {
    return { success: false, error: "이미 사용 중인 아이디입니다." };
  }
  const user: User = {
    id: crypto.randomUUID(),
    nickname,
    username,
    points: 1000, // 가입 보너스
  };
  mockUsers.push({ username, password, user });
  return { success: true, user };
}

export function mockLogin(
  username: string,
  password: string
): { success: boolean; error?: string; user?: User } {
  const found = mockUsers.find(
    (u) => u.username === username && u.password === password
  );
  if (!found) {
    return { success: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }
  return { success: true, user: found.user };
}
