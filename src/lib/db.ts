/**
 * IndexedDB 数据库封装 (使用 idb 库)
 * 存储帖子、评论、附件数据
 */
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'stemnote-db';
const DB_VERSION = 1;

// ===== 类型定义 =====

/** 帖子类型标签 */
export type PostType = 'transcription' | 'correction' | 'partner' | 'request';

/** 帖子类型中文标签映射 */
export const POST_TYPE_LABELS: Record<PostType, string> = {
  transcription: '🎵 扒谱作品',
  correction: '🔧 纠错求助',
  partner: '🤝 找演奏搭子',
  request: '📝 求谱需求',
};

/** 附件 */
export interface Attachment {
  name: string;
  type: string;       // MIME type
  size: number;       // bytes
  data: Blob;
}

/** 帖子 */
export interface Post {
  id?: number;
  title: string;
  content: string;
  type: PostType;
  school: string;
  author: string;
  authorId: string;
  attachments: Attachment[];
  createdAt: number;
  updatedAt: number;
}

/** 评论 */
export interface Comment {
  id?: number;
  postId: number;
  parentId: number | null;  // null = 一级评论
  content: string;
  author: string;
  authorId: string;
  createdAt: number;
}

// ===== 数据库单例 =====
let dbInstance: IDBPDatabase | null = null;

/** 获取数据库实例（单例模式） */
export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 帖子存储
      if (!db.objectStoreNames.contains('posts')) {
        const postStore = db.createObjectStore('posts', {
          keyPath: 'id',
          autoIncrement: true,
        });
        postStore.createIndex('authorId', 'authorId');
        postStore.createIndex('school', 'school');
        postStore.createIndex('type', 'type');
        postStore.createIndex('createdAt', 'createdAt');
      }

      // 评论存储
      if (!db.objectStoreNames.contains('comments')) {
        const commentStore = db.createObjectStore('comments', {
          keyPath: 'id',
          autoIncrement: true,
        });
        commentStore.createIndex('postId', 'postId');
        commentStore.createIndex('parentId', 'parentId');
        commentStore.createIndex('createdAt', 'createdAt');
      }
    },
  });

  return dbInstance;
}

// ===== 帖子操作 =====

/** 获取所有帖子，按时间倒序 */
export async function getAllPosts(): Promise<Post[]> {
  const db = await getDB();
  const posts = await db.getAll('posts');
  return posts.sort((a, b) => b.createdAt - a.createdAt);
}

/** 根据 ID 获取帖子 */
export async function getPostById(id: number): Promise<Post | undefined> {
  const db = await getDB();
  return db.get('posts', id);
}

/** 根据学校筛选帖子 */
export async function getPostsBySchool(school: string): Promise<Post[]> {
  const db = await getDB();
  const index = db.transaction('posts').store.index('school');
  const posts = await index.getAll(school);
  return posts.sort((a, b) => b.createdAt - a.createdAt);
}

/** 根据类型筛选帖子 */
export async function getPostsByType(type: PostType): Promise<Post[]> {
  const db = await getDB();
  const index = db.transaction('posts').store.index('type');
  const posts = await index.getAll(type);
  return posts.sort((a, b) => b.createdAt - a.createdAt);
}

/** 根据作者 ID 获取帖子 */
export async function getPostsByAuthor(authorId: string): Promise<Post[]> {
  const db = await getDB();
  const index = db.transaction('posts').store.index('authorId');
  const posts = await index.getAll(authorId);
  return posts.sort((a, b) => b.createdAt - a.createdAt);
}

/** 创建帖子（使用显式 ID，通常来自 Supabase） */
export async function createPost(post: Post & { id: number }): Promise<number> {
  const db = await getDB();
  await db.put('posts', post);
  return post.id;
}

/** 批量同步帖子到 IndexedDB（仅插入不存在的，更新已有的） */
export async function upsertPosts(posts: Post[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('posts', 'readwrite');
  for (const post of posts) {
    if (post.id != null) {
      await tx.store.put(post);
    }
  }
  await tx.done;
}

/** 批量同步评论到 IndexedDB */
export async function upsertComments(comments: Comment[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('comments', 'readwrite');
  for (const comment of comments) {
    if (comment.id != null) {
      await tx.store.put(comment);
    }
  }
  await tx.done;
}

/** 更新帖子 */
export async function updatePost(id: number, updates: Partial<Post>): Promise<void> {
  const db = await getDB();
  const post = await db.get('posts', id);
  if (!post) throw new Error('帖子不存在');
  const updated = { ...post, ...updates, updatedAt: Date.now() };
  await db.put('posts', updated);
}

/** 删除帖子（同时删除关联评论和附件） */
export async function deletePost(id: number): Promise<void> {
  const db = await getDB();
  // 删除关联评论
  const commentIndex = db.transaction('comments', 'readwrite').store.index('postId');
  const comments = await commentIndex.getAllKeys(id);
  const commentTx = db.transaction('comments', 'readwrite');
  for (const key of comments) {
    await commentTx.store.delete(key);
  }
  await commentTx.done;
  // 删除帖子
  await db.delete('posts', id);
}

// ===== 评论操作 =====

/** 获取帖子的所有评论 */
export async function getCommentsByPostId(postId: number): Promise<Comment[]> {
  const db = await getDB();
  const index = db.transaction('comments').store.index('postId');
  const comments = await index.getAll(postId);
  return comments.sort((a, b) => a.createdAt - b.createdAt);
}

/** 创建评论 */
export async function createComment(comment: Omit<Comment, 'id'>): Promise<number> {
  const db = await getDB();
  const id = await db.add('comments', comment);
  return id as number;
}

/** 删除单条评论 */
export async function deleteComment(id: number): Promise<void> {
  const db = await getDB();
  // 同时删除该评论的子回复
  const index = db.transaction('comments', 'readwrite').store.index('parentId');
  const children = await index.getAllKeys(id);
  const tx = db.transaction('comments', 'readwrite');
  for (const key of children) {
    await tx.store.delete(key);
  }
  await db.delete('comments', id);
}

// ===== 数据导出/导入 =====

/** 导出所有数据为 JSON */
export async function exportAllData(): Promise<string> {
  const db = await getDB();
  const posts = await db.getAll('posts');
  const comments = await db.getAll('comments');
  return JSON.stringify({ posts, comments, exportedAt: Date.now() }, null, 2);
}

/** 从 JSON 导入数据 */
export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json);
  const db = await getDB();
  const tx = db.transaction(['posts', 'comments'], 'readwrite');

  if (data.posts) {
    for (const post of data.posts) {
      await tx.objectStore('posts').put(post);
    }
  }
  if (data.comments) {
    for (const comment of data.comments) {
      await tx.objectStore('comments').put(comment);
    }
  }
  await tx.done;
}
