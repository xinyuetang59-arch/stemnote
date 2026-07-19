/**
 * 用户状态管理 (Zustand)
 * 管理用户昵称、学校、登录状态
 */
import { create } from 'zustand';
import {
  getUserProfile,
  saveUserProfile,
  generateUUID,
  type UserProfile,
} from '../lib/storage';

interface UserState {
  profile: UserProfile | null;
  isOnboarded: boolean;

  /** 初始化用户（从 localStorage 加载） */
  init: () => void;

  /** 创建/更新用户信息 */
  setProfile: (nickname: string, school: string) => void;

  /** 更新昵称 */
  setNickname: (nickname: string) => void;

  /** 更新学校 */
  setSchool: (school: string) => void;

  /** 完成引导 */
  completeOnboarding: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  isOnboarded: false,

  init: () => {
    const profile = getUserProfile();
    set({ profile, isOnboarded: !!profile });
  },

  setProfile: (nickname: string, school: string) => {
    const existing = get().profile;
    const profile: UserProfile = {
      id: existing?.id || generateUUID(),
      nickname,
      school,
    };
    saveUserProfile(profile);
    set({ profile, isOnboarded: true });
  },

  setNickname: (nickname: string) => {
    const profile = get().profile;
    if (!profile) return;
    const updated = { ...profile, nickname };
    saveUserProfile(updated);
    set({ profile: updated });
  },

  setSchool: (school: string) => {
    const profile = get().profile;
    if (!profile) return;
    const updated = { ...profile, school };
    saveUserProfile(updated);
    set({ profile: updated });
  },

  completeOnboarding: () => {
    set({ isOnboarded: true });
  },
}));
