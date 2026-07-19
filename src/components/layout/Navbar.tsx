/**
 * 顶部导航栏组件
 * 响应式设计：桌面端显示完整导航，移动端折叠为汉堡菜单
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Music, Menu, X, User, Settings, Sun, Moon } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { useUIStore } from '../../stores/uiStore';

/** Logo SVG 组件 */
function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 bg-brand-gold rounded-lg flex items-center justify-center">
        <Music className="w-5 h-5 text-brand-navy" />
      </div>
      <span className="font-serif text-lg font-bold text-brand-navy dark:text-white hidden sm:block">
        声轨成谱
      </span>
    </div>
  );
}

export default function Navbar() {
  const location = useLocation();
  const profile = useUserStore((s) => s.profile);
  const { theme, toggleTheme, mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { path: '/transcribe', label: '扒谱', icon: Music },
  ];

  return (
    <nav className="sticky top-0 z-30 bg-white/80 dark:bg-brand-navy/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0" onClick={() => setMobileMenuOpen(false)}>
            <Logo />
          </Link>

          {/* 桌面导航链接 */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/transcribe"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/transcribe')
                  ? 'bg-brand-gold/10 text-brand-gold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Music className="w-4 h-4" />
              扒谱
            </Link>
            <Link
              to="/"
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/') && location.pathname === '/'
                  ? 'bg-brand-gold/10 text-brand-gold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              社区
            </Link>
            {profile && (
              <Link
                to="/my-posts"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/my-posts')
                    ? 'bg-brand-gold/10 text-brand-gold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                我的帖子
              </Link>
            )}
          </div>

          {/* 右侧操作 */}
          <div className="flex items-center gap-2">
            {/* 主题切换 */}
            <button
              onClick={() => toggleTheme()}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="切换主题"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* 用户菜单 */}
            {profile ? (
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="w-7 h-7 bg-brand-gold rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-brand-navy" />
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-slate-700 dark:text-slate-200">
                    {profile.nickname}
                  </span>
                </button>

                {/* 下拉菜单 */}
                {profileMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-20 animate-fade-in">
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{profile.nickname}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{profile.school}</p>
                      </div>
                      <Link
                        to="/my-posts"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <Music className="w-4 h-4" /> 我的帖子
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <Settings className="w-4 h-4" /> 设置
                      </Link>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                to="/settings"
                className="px-4 py-2 bg-brand-gold text-brand-navy text-sm font-medium rounded-lg hover:bg-brand-gold-light transition-colors"
              >
                设置昵称
              </Link>
            )}

            {/* 移动端菜单按钮 */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="菜单"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* 移动端菜单 */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-700 py-3 animate-fade-in">
            <Link
              to="/transcribe"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Music className="w-4 h-4" /> 扒谱工作台
            </Link>
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              社区
            </Link>
            {profile && (
              <Link
                to="/my-posts"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                我的帖子
              </Link>
            )}
            <Link
              to="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Settings className="w-4 h-4" /> 设置
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
