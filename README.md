# 🎵 声轨成谱 StemNote

> 校园乐谱共享与 AI 扒谱工具 — 上传音频、自动生成五线谱、分享到社区

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/stemnote)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/yourusername/stemnote)

---

## ✨ 功能简介

- 🎹 **AI 扒谱** — 上传音频文件（MP3/WAV/FLAC），自动识别音符并生成五线谱
- 📝 **手动修正** — 点击五线谱上的音符，拖动调整音高和时值
- 📤 **多格式导出** — 支持导出 MIDI / MusicXML / PDF / PNG
- 💬 **校园社区** — 发布扒谱作品、纠错求助、寻找演奏搭子
- 🔒 **纯本地存储** — 所有数据存储在浏览器 IndexedDB 中，无需服务器

---

## 🚀 一键部署

### 方式一：Vercel（推荐）

1. 点击上方 **Deploy with Vercel** 按钮
2. 登录 Vercel，授权 GitHub
3. 点击 **Deploy**，等待 30 秒
4. 获得网址：`https://你的项目名.vercel.app`

### 方式二：Netlify

1. 点击上方 **Deploy to Netlify** 按钮
2. 连接 Git 仓库
3. 构建命令：`npm run build`，输出目录：`dist`
4. 获得网址：`https://随机名称.netlify.app`

### 方式三：Cloudflare Pages

1. 连接 GitHub 仓库到 Cloudflare Pages
2. 构建命令：`npm run build`，输出目录：`dist`
3. 获得网址：`https://你的项目.pages.dev`

---

## 💻 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/stemnote.git
cd stemnote

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 浏览器打开 http://localhost:5173
```

---

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 8 |
| CSS 框架 | Tailwind CSS 3 |
| 路由 | React Router DOM 6 (HashRouter) |
| 状态管理 | Zustand |
| 本地存储 | IndexedDB (idb) + localStorage |
| 音频处理 | Web Audio API + pitchfinder |
| 乐谱渲染 | VexFlow 5 |
| 导出 | @tonejs/midi + jsPDF + html2canvas |
| 图标 | Lucide React |

---

## ⚠️ 扒谱精度说明

本工具的扒谱功能基于纯前端音高检测算法（YIN），**结果仅供参考**，建议结合人工校对使用。

- 扒谱精度受录音质量、乐器种类、背景噪声等因素影响
- 如需高精度专业扒谱，推荐使用桌面端软件如 Melodyne、AnthemScore
- 支持手动修正：点击五线谱上的音符，在右侧面板调整音高和时值

---

## 📁 项目结构

```
stemnote/
├── src/
│   ├── lib/          # 核心工具库 (DB、存储、音频处理)
│   ├── stores/       # Zustand 状态管理
│   ├── components/   # React 组件
│   │   ├── layout/   # 布局组件
│   │   ├── ui/       # 通用 UI 组件
│   │   ├── community/ # 社区组件
│   │   └── transcribe/ # 扒谱组件
│   └── pages/        # 页面组件
├── vercel.json       # Vercel 部署配置
├── netlify.toml      # Netlify 部署配置
└── _redirects        # Netlify 路由重定向
```

---

## 📄 License

MIT
