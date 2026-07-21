/**
 * GUN.js P2P 去中心化数据库
 * 实现跨设备帖子同步，无需后端服务器
 *
 * 工作原理：
 * - 帖子写入 GUN 后自动通过 WebRTC/Relay 同步到其他在线节点
 * - 每个浏览器既是客户端也是中继节点
 * - 数据持久化在浏览器 localStorage + 分布式网络
 */
import Gun from 'gun/gun';
import 'gun/sea'; // Security, Encryption, Authorization
import type { Post, PostType, Comment } from './db';

// GUN 实例（单例）
const gun = new Gun({
  peers: [
    'https://gun-us.herokuapp.com/gun',
    'https://peer.wall.org/gun',
    'https://gundb.herokuapp.com/gun'
  ],
  localStorage: true, // 启用本地持久化
  radisk: true,       // 启用 Radisk 存储引擎
});

// 帖子数据的 GUN 引用
const postsNode = gun.get('stemnote-posts');

// 评论数据的 GUN 引用
const commentsNode = gun.get('stemnote-comments');

/** 序列化帖子（清理不可序列化的字段如 Blob） */
function serializePost(post: Post): Record<string, unknown> {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    type: post.type,
    school: post.school,
    author: post.author,
    authorId: post.authorId,
    // 附件不通过 GUN 同步（过大），仅保留名称
    attachmentNames: post.attachments?.map((a) => a.name) || [],
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

/** 将 GUN 数据反序列化为 Post（附件为空，从 IndexedDB 补充） */
function deserializePost(data: Record<string, unknown>): Post | null {
  if (!data.id || !data.title) return null;

  return {
    id: data.id as number,
    title: data.title as string,
    content: (data.content as string) || '',
    type: (data.type as PostType) || 'transcription',
    school: (data.school as string) || '',
    author: (data.author as string) || '',
    authorId: (data.authorId as string) || '',
    attachments: [], // 附件从 IndexedDB 本地获取
    createdAt: (data.createdAt as number) || Date.now(),
    updatedAt: (data.updatedAt as number) || Date.now(),
  };
}

/**
 * 将帖子发布到 GUN 网络
 * 其他在线用户会自动收到此帖子
 */
export function publishPostToGun(post: Post): void {
  const serialized = serializePost(post);
  const postRef = postsNode.get(String(post.id));
  // 逐字段写入以确保数据完整性
  for (const [key, value] of Object.entries(serialized)) {
    postRef.get(key).put(value as never);
  }
}

/**
 * 从 GUN 网络删除帖子
 */
export function removePostFromGun(postId: number): void {
  postsNode.get(String(postId)).put(null as never);
}

/**
 * 将评论发布到 GUN 网络
 */
export function publishCommentToGun(comment: Comment): void {
  const commentRef = commentsNode.get(String(comment.id));
  commentRef.get('postId').put(comment.postId as never);
  commentRef.get('content').put(comment.content as never);
  commentRef.get('author').put(comment.author as never);
  commentRef.get('authorId').put(comment.authorId as never);
  commentRef.get('parentId').put((comment.parentId ?? null) as never);
  commentRef.get('createdAt').put(comment.createdAt as never);
}

/**
 * 从 GUN 网络删除评论
 */
export function removeCommentFromGun(commentId: number): void {
  commentsNode.get(String(commentId)).put(null as never);
}

/**
 * 监听 GUN 网络中的所有帖子变化
 * 返回取消监听的函数
 */
export function subscribeToGunPosts(callback: (posts: Post[]) => void): () => void {
  const allPosts: Map<number, Post> = new Map();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // 每隔一段时间检查一次所有帖子
  const checkPosts = () => {
    const posts: Post[] = [];
    allPosts.forEach((post) => posts.push(post));
    posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(posts);
  };

  const debouncedCheck = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkPosts, 300);
  };

  // 监听 posts 节点的变化
  postsNode.map().on((data: Record<string, unknown>, key: string) => {
    if (!data || data === null || typeof data !== 'object') {
      allPosts.delete(Number(key));
    } else {
      const post = deserializePost(data);
      if (post) {
        allPosts.set(post.id!, post);
      }
    }
    debouncedCheck();
  });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}

/**
 * 监听 GUN 网络中的评论变化
 */
export function subscribeToGunComments(
  postId: number,
  callback: (comments: Comment[]) => void
): () => void {
  const allComments: Map<number, Comment> = new Map();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const checkComments = () => {
    const comments: Comment[] = [];
    allComments.forEach((c) => {
      if (c.postId === postId) comments.push(c);
    });
    comments.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    callback(comments);
  };

  const debouncedCheck = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkComments, 300);
  };

  commentsNode.map().on((data: Record<string, unknown>, key: string) => {
    if (!data || data === null || typeof data !== 'object') {
      allComments.delete(Number(key));
    } else if (data.postId && data.content) {
      allComments.set(Number(key), {
        id: Number(key),
        postId: data.postId as number,
        parentId: (data.parentId as number) || null,
        content: data.content as string,
        author: (data.author as string) || '',
        authorId: (data.authorId as string) || '',
        createdAt: (data.createdAt as number) || Date.now(),
      });
    }
    debouncedCheck();
  });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}

export { gun };
export default gun;
