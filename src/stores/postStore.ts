/**
 * 帖子状态管理 (Zustand)
 * 混合存储：IndexedDB（本地缓存 + 附件）+ Supabase（跨用户同步）
 * - 自己的帖子：写入 Supabase（获取 ID）→ 存入 IndexedDB（含附件）
 * - 他人的帖子：从 Supabase 实时同步 → 写入 IndexedDB 缓存
 * - Supabase 是数据的唯一致信源，IndexedDB 是本地缓存 + 附件存储
 */
import { create } from 'zustand';
import {
  getAllPosts,
  getPostById,
  createPost as createPostInDB,
  updatePost as updatePostInDB,
  deletePost as deletePostInDB,
  getCommentsByPostId,
  createComment as createCommentInDB,
  deleteComment as deleteCommentInDB,
  upsertPosts,
  upsertComments,
  type Post,
  type PostType,
  type Comment,
} from '../lib/db';
import {
  fetchAllPosts,
  insertPost as insertPostToSupabase,
  updatePostInSupabase,
  deletePostFromSupabase,
  insertComment as insertCommentToSupabase,
  deleteCommentFromSupabase,
  subscribeToAllPosts,
  subscribeToComments,
} from '../lib/supabase';
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

  /** 初始化：从 Supabase 加载 + 订阅实时变更 */
  initPosts: () => () => void;

  /** 加载所有帖子（Supabase + 本地 IndexedDB 合并） */
  loadPosts: () => Promise<void>;

  /** 加载单个帖子详情 */
  loadPost: (id: number) => Promise<void>;

  /** 加载帖子评论（Supabase 实时订阅 + 本地缓存） */
  loadComments: (postId: number) => Promise<void>;

  /** 创建新帖子（Supabase 先 → IndexedDB 后） */
  addPost: (title: string, content: string, type: PostType, attachments?: Post['attachments']) => Promise<number>;

  /** 编辑帖子（IndexedDB + Supabase） */
  editPost: (id: number, updates: Partial<Post>) => Promise<void>;

  /** 删除帖子（Supabase + IndexedDB 级联删除） */
  removePost: (id: number) => Promise<void>;

  /** 添加评论（Supabase 先 → IndexedDB 后） */
  addComment: (postId: number, content: string, parentId?: number | null) => Promise<void>;

  /** 删除评论（Supabase + IndexedDB） */
  removeComment: (id: number) => Promise<void>;

  /** 设置筛选条件 */
  setFilter: (filters: Partial<PostFilters>) => void;

  /** 清空筛选 */
  clearFilters: () => void;

  /** 获取筛选后的帖子列表 */
  getFilteredPosts: () => Post[];
}

// 存储订阅取消函数，防止内存泄漏
let unsubscribePosts: (() => void) | null = null;
let unsubscribeComments: (() => void) | null = null;

export const usePostStore = create<PostState>((set, get) => ({
  posts: [],
  currentPost: null,
  comments: [],
  filters: { school: '', type: '' },
  loading: false,
  loaded: false,

  initPosts: () => {
    // 订阅 Supabase 帖子变更（包含初始加载）
    unsubscribePosts = subscribeToAllPosts(async (supabasePosts) => {
      try {
        // 获取本地已有帖子（可能有附件数据）
        const localPosts = await getAllPosts();
        const localMap = new Map(localPosts.map((p) => [p.id!, p]));

        // 合并：从 Supabase 获取最新元数据，但保留本地附件
        for (const sp of supabasePosts) {
          const local = localMap.get(sp.id!);
          if (local?.attachments?.length) {
            sp.attachments = local.attachments;
          }
        }

        // 写入 IndexedDB 缓存
        await upsertPosts(supabasePosts);

        // 从 IndexedDB 加载完整列表
        const merged = await getAllPosts();
        set({ posts: merged, loaded: true });
      } catch (error) {
        console.error('同步帖子失败，降级到本地数据:', error);
        const localPosts = await getAllPosts();
        set({ posts: localPosts, loaded: true });
      }
    });

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
      // 从 Supabase 拉取最新帖子
      const supabasePosts = await fetchAllPosts();

      if (supabasePosts.length > 0) {
        // 获取本地帖子（保留附件数据）
        const localPosts = await getAllPosts();
        const localMap = new Map(localPosts.map((p) => [p.id!, p]));

        for (const sp of supabasePosts) {
          const local = localMap.get(sp.id!);
          if (local?.attachments?.length) {
            sp.attachments = local.attachments;
          }
        }

        await upsertPosts(supabasePosts);
      }

      // 从 IndexedDB 加载完整列表
      const merged = await getAllPosts();
      set({ posts: merged, loading: false, loaded: true });
    } catch (error) {
      console.error('加载帖子失败，降级到本地数据:', error);
      const localPosts = await getAllPosts();
      set({ posts: localPosts, loading: false, loaded: true });
    }
  },

  loadPost: async (id: number) => {
    set({ loading: true });
    try {
      let post = await getPostById(id);
      set({ currentPost: post || null, loading: false });

      if (post) {
        // 加载评论（含实时订阅）
        await get().loadComments(id);
      }
    } catch (error) {
      console.error('加载帖子详情失败:', error);
      set({ loading: false });
    }
  },

  loadComments: async (postId: number) => {
    // 清理之前的评论订阅，防止重复订阅
    if (unsubscribeComments) {
      unsubscribeComments();
      unsubscribeComments = null;
    }

    try {
      // 订阅 Supabase 评论变更（包含初始加载）
      unsubscribeComments = subscribeToComments(postId, async (supabaseComments) => {
        // 同步到 IndexedDB
        await upsertComments(supabaseComments);

        // 从 IndexedDB 加载完整评论
        const localComments = await getCommentsByPostId(postId);
        set({ comments: localComments });
      });
    } catch (error) {
      console.error('加载评论失败，降级到本地数据:', error);
      const localComments = await getCommentsByPostId(postId);
      set({ comments: localComments });
    }
  },

  addPost: async (title, content, type, attachments = []) => {
    const user = useUserStore.getState().profile;
    if (!user) throw new Error('请先设置用户信息');

    const now = Date.now();

    // 1. 先插入 Supabase，获取全局唯一 ID
    const postData: Post = {
      id: 0, // 占位，Supabase 不发送此字段
      title,
      content,
      type,
      school: user.school,
      author: user.nickname,
      authorId: user.id,
      attachments,
      createdAt: now,
      updatedAt: now,
    };

    const id = await insertPostToSupabase(postData);

    // 2. 用 Supabase 返回的 ID 存入 IndexedDB（含附件 Blob）
    postData.id = id;
    await createPostInDB(postData as Post & { id: number });

    // 3. 刷新本地列表（Supabase Realtime 也会触发刷新）
    await get().loadPosts();
    return id;
  },

  editPost: async (id, updates) => {
    // 1. 更新 IndexedDB
    await updatePostInDB(id, updates);

    // 2. 更新当前帖子展示
    const { currentPost } = get();
    if (currentPost?.id === id) {
      const updated = await getPostById(id);
      set({ currentPost: updated || null });
    }

    // 3. 同步到 Supabase
    const updatedPost = await getPostById(id);
    if (updatedPost) {
      await updatePostInSupabase(id, updatedPost);
    }

    // 4. 刷新列表
    await get().loadPosts();
  },

  removePost: async (id) => {
    // 1. 从 Supabase 删除（级联删除评论）
    await deletePostFromSupabase(id);

    // 2. 从 IndexedDB 删除
    await deletePostInDB(id);

    // 3. 清空当前帖子状态
    set({ currentPost: null, comments: [] });

    // 4. 刷新列表
    await get().loadPosts();
  },

  addComment: async (postId, content, parentId = null) => {
    const user = useUserStore.getState().profile;
    if (!user) throw new Error('请先设置用户信息');

    const now = Date.now();

    // 1. 先插入 Supabase，获取全局唯一 ID
    const commentData: Comment = {
      id: 0, // 占位
      postId,
      parentId: parentId || null,
      content,
      author: user.nickname,
      authorId: user.id,
      createdAt: now,
    };

    const id = await insertCommentToSupabase(commentData);

    // 2. 用 Supabase 返回的 ID 存入 IndexedDB
    commentData.id = id;
    await createCommentInDB(commentData);

    // 3. 刷新评论列表（Supabase Realtime 也会触发刷新）
    await get().loadComments(postId);
  },

  removeComment: async (id) => {
    // 1. 从 Supabase 删除
    await deleteCommentFromSupabase(id);

    // 2. 从 IndexedDB 删除
    await deleteCommentInDB(id);

    // 3. 刷新评论
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
