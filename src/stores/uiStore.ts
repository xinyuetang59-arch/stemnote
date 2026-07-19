/**
 * UI 状态管理 (Zustand)
 * 管理主题、Toast 通知、弹窗等全局 UI 状态
 */
import { create } from 'zustand';
import { getTheme, setTheme, type ThemeMode } from '../lib/storage';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface UIState {
  theme: ThemeMode;
  toasts: Toast[];
  mobileMenuOpen: boolean;
  onboardingOpen: boolean;

  /** 初始化主题 */
  initTheme: () => void;

  /** 切换主题 */
  toggleTheme: (mode?: ThemeMode) => void;

  /** 添加 Toast */
  addToast: (message: string, type?: Toast['type'], duration?: number) => void;

  /** 移除 Toast */
  removeToast: (id: string) => void;

  /** 切换移动端菜单 */
  setMobileMenuOpen: (open: boolean) => void;

  /** 切换引导弹窗 */
  setOnboardingOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: 'system',
  toasts: [],
  mobileMenuOpen: false,
  onboardingOpen: false,

  initTheme: () => {
    const theme = getTheme();
    set({ theme });
    applyTheme(theme);
  },

  toggleTheme: (mode) => {
    const newTheme = mode || (get().theme === 'dark' ? 'light' : 'dark');
    set({ theme: newTheme });
    setTheme(newTheme);
    applyTheme(newTheme);
  },

  addToast: (message, type = 'info', duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast: Toast = { id, message, type, duration };
    set((state) => ({ toasts: [...state.toasts, toast] }));

    // 自动移除
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  setMobileMenuOpen: (open) => {
    set({ mobileMenuOpen: open });
  },

  setOnboardingOpen: (open) => {
    set({ onboardingOpen: open });
  },
}));

/** 应用主题到 DOM */
function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // system: 跟随操作系统
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
}
