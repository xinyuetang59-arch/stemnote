/**
 * Supabase 客户端与 API 封装
 * 替代 GUN.js 作为帖子和评论的数据同步层
 *
 * 架构：
 * - Supabase PostgreSQL = 帖子和评论的唯一致信源
 * - IndexedDB = 本地缓存 + 附件 Blob 存储
 * - Supabase Realtime = 跨用户实时同步
 */
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Post, PostType, Comment } from './db';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
  console.warn(
    '⚠️ Supabase 未配置：请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 环境变量。\n' +
    '帖子将以本地模式运行，跨用户同步不可用。'
  );
}

export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'placeholder',
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// ===== Supabase 行类型（snake_case 数据库列 → camelCase TS 属性） =====

interface PostRow {
  id: number;
  title: string;
  content: string;
  type: string;
  school: string;
  author: string;
  author_id: string;
  attachment_names: string[];
  created_at: number;
  updated_at: number;
}

interface CommentRow {
  id: number;
  post_id: number;
  parent_id: number | null;
  content: string;
  author: string;
  author_id: string;
  created_at: number;
}

// ===== 类型转换 =====

function rowToPost(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title,
    content: row.content || '',
    type: (row.type as PostType) || 'transcription',
    school: row.school || '',
    author: row.author || '',
    authorId: row.author_id || '',
    attachments: [], // 附件从 IndexedDB 本地获取
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function postToRow(post: Post): Omit<PostRow, 'id'> {
  return {
    title: post.title,
    content: post.content,
    type: post.type,
    school: post.school,
    author: post.author,
    author_id: post.authorId,
    attachment_names: post.attachments?.map((a) => a.name) || [],
    created_at: post.createdAt,
    updated_at: post.updatedAt,
  };
}

function rowToComment(row: CommentRow): Comment {
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id ?? null,
    content: row.content,
    author: row.author || '',
    authorId: row.author_id || '',
    createdAt: row.created_at,
  };
}

// ===== 帖子操作 =====

/** 从 Supabase 获取所有帖子 */
export async function fetchAllPosts(): Promise<Post[]> {
  if (!isConfigured) return [];

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取帖子失败:', error);
    return [];
  }

  return (data as PostRow[]).map(rowToPost);
}

/** 向 Supabase 插入帖子，返回数据库生成的 ID */
export async function insertPost(post: Post): Promise<number> {
  if (!isConfigured) throw new Error('Supabase 未配置');

  const { data, error } = await supabase
    .from('posts')
    .insert(postToRow(post))
    .select('id')
    .single();

  if (error) throw new Error(`发布帖子失败: ${error.message}`);
  return (data as { id: number }).id;
}

/** 更新 Supabase 中的帖子 */
export async function updatePostInSupabase(id: number, post: Post): Promise<void> {
  if (!isConfigured) return;

  const { error } = await supabase
    .from('posts')
    .update(postToRow(post))
    .eq('id', id);

  if (error) console.error('更新帖子失败:', error);
}

/** 从 Supabase 删除帖子（级联删除关联评论） */
export async function deletePostFromSupabase(id: number): Promise<void> {
  if (!isConfigured) return;

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', id);

  if (error) console.error('删除帖子失败:', error);
}

// ===== 评论操作 =====

/** 从 Supabase 获取帖子的所有评论 */
export async function fetchComments(postId: number): Promise<Comment[]> {
  if (!isConfigured) return [];

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('获取评论失败:', error);
    return [];
  }

  return (data as CommentRow[]).map(rowToComment);
}

/** 向 Supabase 插入评论，返回数据库生成的 ID */
export async function insertComment(comment: Comment): Promise<number> {
  if (!isConfigured) throw new Error('Supabase 未配置');

  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: comment.postId,
      parent_id: comment.parentId ?? null,
      content: comment.content,
      author: comment.author,
      author_id: comment.authorId,
      created_at: comment.createdAt,
    })
    .select('id')
    .single();

  if (error) throw new Error(`发布评论失败: ${error.message}`);
  return (data as { id: number }).id;
}

/** 从 Supabase 删除评论 */
export async function deleteCommentFromSupabase(id: number): Promise<void> {
  if (!isConfigured) return;

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id);

  if (error) console.error('删除评论失败:', error);
}

// ===== 实时订阅 =====

let postsChannel: RealtimeChannel | null = null;

/**
 * 订阅所有帖子变更（初始加载 + 实时更新）
 * 返回取消订阅的函数
 */
export function subscribeToAllPosts(callback: (posts: Post[]) => void): () => void {
  if (!isConfigured) {
    console.warn('Supabase 未配置，实时同步不可用。帖子仅来自本地 IndexedDB。');
    return () => {};
  }

  // 初始全量加载
  fetchAllPosts().then(callback).catch((e) => {
    console.error('初始加载帖子失败:', e);
  });

  // 订阅实时变更：任何帖子的增/改/删都触发全量重取
  postsChannel = supabase
    .channel('posts-all')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'posts' },
      () => {
        fetchAllPosts().then(callback).catch((e) => {
          console.error('实时同步帖子失败:', e);
        });
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Supabase 帖子实时同步已就绪');
      }
    });

  return () => {
    if (postsChannel) {
      supabase.removeChannel(postsChannel).catch(() => {});
      postsChannel = null;
    }
  };
}

/**
 * 订阅某个帖子的评论变更（初始加载 + 实时更新）
 * 返回取消订阅的函数
 */
export function subscribeToComments(
  postId: number,
  callback: (comments: Comment[]) => void
): () => void {
  if (!isConfigured) {
    console.warn('Supabase 未配置，评论实时同步不可用。');
    return () => {};
  }

  // 初始加载
  fetchComments(postId).then(callback).catch((e) => {
    console.error('初始加载评论失败:', e);
  });

  // 订阅实时变更
  const channel = supabase
    .channel(`comments-${postId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `post_id=eq.${postId}`,
      },
      () => {
        fetchComments(postId).then(callback).catch((e) => {
          console.error('实时同步评论失败:', e);
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel).catch(() => {});
  };
}
