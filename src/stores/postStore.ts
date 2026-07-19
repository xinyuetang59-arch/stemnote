/**
 * 帖子状态管理 (Zustand)
 * 管理帖子列表、筛选、CRUD 操作
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
import { useUserStore } from './userStore';

interface PostFilters {
  school: string;
  type: PostType | '';
}

interface PostState {
  posts: Post[];
  currentPost: Post | null;
  comments: Comment[];
  filters: PostFilters;
  loading: boolean;
  loaded: boolean;

  /** 加载所有帖子 */
  loadPosts: () => Promise<void>;

  /** 加载单个帖子 */
  loadPost: (id: number) => Promise<void>;

  /** 加载帖子评论 */
  loadComments: (postId: number) => Promise<void>;

  /** 创建新帖子 */
  addPost: (title: string, content: string, type: PostType, attachments?: Post['attachments']) => Promise<number>;

  /** 编辑帖子 */
  editPost: (id: number, updates: Partial<Post>) => Promise<void>;

  /** 删除帖子 */
  removePost: (id: number) => Promise<void>;

  /** 添加评论 */
  addComment: (postId: number, content: string, parentId?: number | null) => Promise<void>;

  /** 删除评论 */
  removeComment: (id: number) => Promise<void>;

  /** 设置筛选条件 */
  setFilter: (filters: Partial<PostFilters>) => void;

  /** 清空筛选 */
  clearFilters: () => void;

  /** 获取筛选后的帖子列表 */
  getFilteredPosts: () => Post[];
}

export const usePostStore = create<PostState>((set, get) => ({
  posts: [],
  currentPost: null,
  comments: [],
  filters: { school: '', type: '' },
  loading: false,
  loaded: false,

  loadPosts: async () => {
    set({ loading: true });
    try {
      const posts = await getAllPosts();
      set({ posts, loading: false, loaded: true });
    } catch (error) {
      console.error('加载帖子失败:', error);
      set({ loading: false });
    }
  },

  loadPost: async (id: number) => {
    set({ loading: true });
    try {
      const post = await getPostById(id);
      set({ currentPost: post || null, loading: false });
      if (post) {
        const comments = await getCommentsByPostId(id);
        set({ comments });
      }
    } catch (error) {
      console.error('加载帖子详情失败:', error);
      set({ loading: false });
    }
  },

  loadComments: async (postId: number) => {
    try {
      const comments = await getCommentsByPostId(postId);
      set({ comments });
    } catch (error) {
      console.error('加载评论失败:', error);
    }
  },

  addPost: async (title, content, type, attachments = []) => {
    const user = useUserStore.getState().profile;
    if (!user) throw new Error('请先设置用户信息');

    const now = Date.now();
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

    // 重新加载帖子列表
    await get().loadPosts();
    return id;
  },

  editPost: async (id, updates) => {
    await updatePost(id, updates);
    // 刷新当前帖子和列表
    const { currentPost } = get();
    if (currentPost?.id === id) {
      const updated = await getPostById(id);
      set({ currentPost: updated || null });
    }
    await get().loadPosts();
  },

  removePost: async (id) => {
    await deletePost(id);
    set({ currentPost: null, comments: [] });
    await get().loadPosts();
  },

  addComment: async (postId, content, parentId = null) => {
    const user = useUserStore.getState().profile;
    if (!user) throw new Error('请先设置用户信息');

    await createComment({
      postId,
      content,
      parentId: parentId || null,
      author: user.nickname,
      authorId: user.id,
      createdAt: Date.now(),
    });

    // 重新加载评论
    await get().loadComments(postId);
  },

  removeComment: async (id) => {
    await deleteComment(id);
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
