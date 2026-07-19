/**
 * 首次访问引导弹窗
 * 让用户输入昵称和学校
 */
import { useState } from 'react';
import { Music, Sparkles, Users } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { useUIStore } from '../../stores/uiStore';
import { setOnboarded } from '../../lib/storage';
import { SCHOOLS } from '../../lib/utils';
import Modal from './Modal';

export default function OnboardingModal() {
  const { onboardingOpen, setOnboardingOpen } = useUIStore();
  const { setProfile } = useUserStore();
  const addToast = useUIStore((s) => s.addToast);

  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState('');
  const [school, setSchool] = useState('');

  const handleFinish = () => {
    if (!nickname.trim()) {
      addToast('请输入昵称', 'warning');
      return;
    }
    if (!school) {
      addToast('请选择学校', 'warning');
      return;
    }

    setProfile(nickname.trim(), school);
    setOnboarded();
    setOnboardingOpen(false);
    addToast('欢迎加入声轨成谱！🎵', 'success');
  };

  const handleSkip = () => {
    setOnboarded();
    setOnboardingOpen(false);
  };

  const steps = [
    {
      icon: Music,
      title: '欢迎来到声轨成谱',
      description: '校园乐谱共享与AI扒谱工具',
      content: (
        <div className="space-y-4 text-center">
          <div className="w-20 h-20 mx-auto bg-brand-gold/10 rounded-full flex items-center justify-center">
            <Music className="w-10 h-10 text-brand-gold" />
          </div>
          <div>
            <h3 className="text-xl font-serif font-bold text-slate-900 dark:text-white">
              声轨成谱 StemNote
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              上传音频，AI自动扒谱，生成五线谱<br />
              分享作品，寻找演奏伙伴
            </p>
          </div>
        </div>
      ),
    },
    {
      icon: Sparkles,
      title: '三步上手',
      description: '快速开始扒谱之旅',
      content: (
        <div className="space-y-3">
          {[
            { emoji: '🎵', title: '上传音频', desc: '拖拽 MP3/WAV 文件，AI 自动识别音符' },
            { emoji: '📝', title: '查看乐谱', desc: '自动生成五线谱，支持手动修正' },
            { emoji: '💬', title: '分享社区', desc: '发布作品，与同学们交流讨论' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <span className="text-2xl">{item.emoji}</span>
              <div>
                <h4 className="font-medium text-slate-800 dark:text-white text-sm">{item.title}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: Users,
      title: '设置你的身份',
      description: '让同学们认识你',
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              昵称
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="你的昵称"
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/30 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              学校
            </label>
            <select
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-gold/30 transition-colors"
            >
              <option value="">请选择学校</option>
              {SCHOOLS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[Math.min(step, steps.length - 1)];
  const isLastStep = step >= steps.length - 1;

  return (
    <Modal open={onboardingOpen} onClose={() => {}} size="md" title="">
      <div className="text-center">
        {/* 步骤指示器 */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i <= step ? 'bg-brand-gold' : 'bg-slate-200 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>

        {/* 图标 */}
        <div className="mb-4">
          <currentStep.icon className="w-10 h-10 text-brand-gold mx-auto" />
        </div>

        {/* 标题 */}
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          {currentStep.title}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {currentStep.description}
        </p>

        {/* 内容 */}
        <div className="mb-6 text-left">
          {currentStep.content}
        </div>

        {/* 按钮 */}
        <div className="flex gap-3 justify-center">
          {!isLastStep && (
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              跳过
            </button>
          )}
          {isLastStep ? (
            <>
              <button
                onClick={handleSkip}
                className="px-5 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                稍后设置
              </button>
              <button
                onClick={handleFinish}
                className="px-5 py-2.5 bg-brand-gold text-brand-navy rounded-xl text-sm font-semibold hover:bg-brand-gold-light transition-colors"
              >
                开始使用
              </button>
            </>
          ) : (
            <button
              onClick={() => setStep(step + 1)}
              className="px-5 py-2.5 bg-brand-gold text-brand-navy rounded-xl text-sm font-semibold hover:bg-brand-gold-light transition-colors"
            >
              下一步
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
