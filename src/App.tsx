/**
 * App 根组件
 * HashRouter 路由配置 + 全局初始化
 */
import { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Loading from './components/ui/Loading';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { useUserStore } from './stores/userStore';
import { useUIStore } from './stores/uiStore';
import { isOnboarded } from './lib/storage';
import OnboardingModal from './components/ui/OnboardingModal';

// 懒加载页面
const HomePage = lazy(() => import('./pages/HomePage'));
const TranscribePage = lazy(() => import('./pages/TranscribePage'));
const PostDetailPage = lazy(() => import('./pages/PostDetailPage'));
const NewPostPage = lazy(() => import('./pages/NewPostPage'));
const MyPostsPage = lazy(() => import('./pages/MyPostsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

/** 页面加载占位 */
function PageLoading() {
  return <Loading fullPage text="页面加载中..." />;
}

export default function App() {
  const initUser = useUserStore((s) => s.init);
  const initTheme = useUIStore((s) => s.initTheme);
  const setOnboardingOpen = useUIStore((s) => s.setOnboardingOpen);

  // 应用初始化
  useEffect(() => {
    initUser();
    initTheme();

    // 检查是否需要显示引导
    if (!isOnboarded()) {
      // 延迟显示引导，等页面渲染完成
      const timer = setTimeout(() => {
        setOnboardingOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [initUser, initTheme, setOnboardingOpen]);

  return (
    <ErrorBoundary>
      <HashRouter>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="transcribe" element={<TranscribePage />} />
              <Route path="post/:id" element={<PostDetailPage />} />
              <Route path="new-post" element={<NewPostPage />} />
              <Route path="my-posts" element={<MyPostsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              {/* 404 */}
              <Route path="*" element={
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                  <h2 className="text-4xl font-bold text-slate-300 dark:text-slate-600 mb-2">404</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">页面不存在</p>
                  <a href="#/" className="text-brand-gold hover:underline">返回首页</a>
                </div>
              } />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
      <OnboardingModal />
    </ErrorBoundary>
  );
}
