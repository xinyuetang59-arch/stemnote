/**
 * localStorage 工具函数
 * 用于存储用户信息、主题偏好等持久化数据
 */

const USER_KEY = 'stemnote-user';
const THEME_KEY = 'stemnote-theme';
const ONBOARDED_KEY = 'stemnote-onboarded';

// ===== 用户信息 =====

export interface UserProfile {
  id: string;       // UUID
  nickname: string;
  school: string;
}

/** 获取用户信息，不存在则返回 null */
export function getUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** 保存用户信息 */
export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem(USER_KEY, JSON.stringify(profile));
}

/** 删除用户信息 */
export function clearUserProfile(): void {
  localStorage.removeItem(USER_KEY);
}

// ===== 主题 =====

export type ThemeMode = 'light' | 'dark' | 'system';

export function getTheme(): ThemeMode {
  return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'system';
}

export function setTheme(theme: ThemeMode): void {
  localStorage.setItem(THEME_KEY, theme);
}

// ===== 引导状态 =====

export function isOnboarded(): boolean {
  return localStorage.getItem(ONBOARDED_KEY) === 'true';
}

export function setOnboarded(): void {
  localStorage.setItem(ONBOARDED_KEY, 'true');
}

// ===== UUID 生成 =====

export function generateUUID(): string {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}
