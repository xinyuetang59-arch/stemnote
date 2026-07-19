/**
 * 帖子状态管理 (Zustand)
 * 混合存储：IndexedDB（本地缓存）+ GUN.js（P2P 共享同步）
 * - 自己的帖子：写入 IndexedDB + GUN
 * - 他人的帖子：从 GUN 网络实时同步
 * - 其他人打开网站时，会自动从 GUN 网络拉取所有共享帖子
 */
import { create } from 'zustand';
import {
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  getCommentsByPostId,
  createComment,
  deleteComment,
  type Post,
  type PostType,
  type Comment,
} from '../lib/db';
import {
  publishPostToGun,
  removePostFromGun,
  publishCommentToGun,
  removeCommentFromGun,
  subscribeToGunPosts,
  subscribeToGunComments,
} from '../lib/gun';
import { useUserStore } from './userStore';

interface PostFilters {
  school: string;
  type: PostType | '';
}

interface PostState {
  posts: Post[];
  gunPosts: Post[];       // 仅来自 GUN 网络的帖子
  currentPost: Post | null;
  comments: Comment[];
  filters: PostFilters;
  loading: boolean;
  loaded: boolean;

  /** 初始化：加载本地 + 订阅 GUN */
  initPosts: () => () => void;

  /** 加载所有帖子（本地 + GUN 合并） */
  loadPosts: () => Promise<void>;

  /** 加载单个帖子 */
  loadPost: (id: number) => Promise<void>;

  /** 加载帖子评论（本地 + GUN 合并） */
  loadComments: (postId: number) => Promise<void>;

  /** 创建新帖子（本地 + GUN） */
  addPost: (title: string, content: string, type: PostType, attachments?: Post['attachments']) => Promise<number>;

  /** 编辑帖子（仅本地） */
  editPost: (id: number, updates: Partial<Post>) => Promise<void>;

  /** 删除帖子（本地 + GUN） */
  removePost: (id: number) => Promise<void>;

  /** 添加评论（本地 + GUN） */
  addComment: (postId: number, content: string, parentId?: number | null) => Promise<void>;

  /** 删除评论（本地 + GUN） */
  removeComment: (id: number) => Promise<void>;

  /** 设置筛选条件 */
  setFilter: (filters: Partial<PostFilters>) => void;

  /** 清空筛选 */
  clearFilters: () => void;

  /** 获取筛选后的帖子列表（合并本地和 GUN） */
  getFilteredPosts: () => Post[];
}

// 用于存储 GUN 订阅取消函数的引用
let unsubscribePosts: (() => void) | null = null;

export const usePostStore = create<PostState>((set, get) => ({
  posts: [],
  gunPosts: [],
  currentPost: null,
  comments: [],
  filters: { school: '', type: '' },
  loading: false,
  loaded: false,

  initPosts: () => {
    // 订阅 GUN 网络中的帖子变化
    unsubscribePosts = subscribeToGunPosts((gunPosts) => {
      set({ gunPosts });
      // 自动合并到 posts 列表
      get().loadPosts();
    });

    // 返回清理函数
    return () => {
      if (unsubscribePosts) {
        unsubscribePosts();
        unsubscribePosts = null;
      }
    };
  },

  loadPosts: async () => {
    set({ loading: true });
    try {
      // 从 IndexedDB 加载本地帖子
      const localPosts = await getAllPosts();
      const { gunPosts } = get();

      // 合并本地和 GUN 帖子（按 ID 去重，优先本地——因为本地有完整附件数据）
      const merged = new Map<number, Post>();
      for (const p of gunPosts) merged.set(p.id!, p);
      for (const p of localPosts) merged.set(p.id!, p); // 本地覆盖 GUN（附件数据完整）

      const allPosts = Array.from(merged.values())
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      set({ posts: allPosts, loading: false, loaded: true });
    } catch (error) {
      console.error('加载帖子失败:', error);
      set({ loading: false });
    }
  },

  loadPost: async (id: number) => {
    set({ loading: true });
    try {
      let post = await getPostById(id);
      // 如果本地没有，尝试从 GUN 帖子中获取
      if (!post) {
        post = get().gunPosts.find((p) => p.id === id) || undefined;
      }
      set({ currentPost: post, loading: false });
      if (post) {
        // 加载本地评论
        const localComments = await getCommentsByPostId(id);
        set({ comments: localComments });
      }
    } catch (error) {
      console.error('加载帖子详情失败:', error);
      set({ loading: false });
    }
  },

  loadComments: async (postId: number) => {
    try {
      const localComments = await getCommentsByPostId(postId);
      set({ comments: localComments });

      // 同时订阅 GUN 评论
      subscribeToGunComments(postId, (gunComments) => {
        const current = get().comments;
        // 合并去重
        const merged = new Map<number, Comment>();
        for (const c of gunComments) merged.set(c.id!, c);
        for (const c of current) merged.set(c.id!, c);
        set({ comments: Array.from(merged.values())
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)) });
      });
    } catch (error) {
      console.error('加载评论失败:', error);
    }
  },

  addPost: async (title, content, type, attachments = []) => {
    const user = useUserStore.getState().profile;
    if (!user) throw new Error('请先设置用户信息');

    const now = Date.now();
    // 1. 保存到本地 IndexedDB
    const id = await createPost({
      title,
      content,
      type,
      school: user.school,
      author: user.nickname,
      authorId: user.id,
      attachments,
      createdAt: now,
      updatedAt: now,
    });

    // 2. 发布到 GUN 网络（让其他人能看到）
    const post = await getPostById(id);
    if (post) {
      publishPostToGun(post);
    }

    // 重新加载
    await get().loadPosts();
    return id;
  },

  editPost: async (id, updates) => {
    await updatePost(id, updates);
    const { currentPost } = get();
    if (currentPost?.id === id) {
      const updated = await getPostById(id);
      set({ currentPost: updated || null });
    }
    // 编辑后也更新到 GUN（如果是自己的帖子）
    const updatedPost = await getPostById(id);
    if (updatedPost) {
      publishPostToGun(updatedPost);
    }
    await get().loadPosts();
  },

  removePost: async (id) => {
    // 1. 从本地删除
    await deletePost(id);
    // 2. 从 GUN 网络删除
    removePostFromGun(id);
    set({ currentPost: null, comments: [] });
    await get().loadPosts();
  },

  addComment: async (postId, content, parentId = null) => {
    const user = useUserStore.getState().profile;
    if (!user) throw new Error('请先设置用户信息');

    const commentData = {
      postId,
      content,
      parentId: parentId || null,
      author: user.nickname,
      authorId: user.id,
      createdAt: Date.now(),
    };

    // 1. 保存到本地
    const id = await createComment(commentData);

    // 2. 发布到 GUN
    publishCommentToGun({ id, ...commentData });

    await get().loadComments(postId);
  },

  removeComment: async (id) => {
    await deleteComment(id);
    removeCommentFromGun(id);
    const { currentPost } = get();
    if (currentPost) {
      await get().loadComments(currentPost.id!);
    }
  },

  setFilter: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  clearFilters: () => {
    set({ filters: { school: '', type: '' } });
  },

  getFilteredPosts: () => {
    const { posts, filters } = get();
    let result = [...posts];

    if (filters.school) {
      result = result.filter((p) => p.school === filters.school);
    }
    if (filters.type) {
      result = result.filter((p) => p.type === filters.type);
    }

    return result;
  },
}));
