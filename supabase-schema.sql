-- ============================================================
-- StemNote Supabase 数据库迁移脚本
-- 在 Supabase SQL Editor 中运行此脚本：
--   https://supabase.com/dashboard → 选择项目 → SQL Editor → New Query
-- ============================================================

-- 1. 帖子表
CREATE TABLE IF NOT EXISTS posts (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  type TEXT NOT NULL DEFAULT 'transcription',
  school TEXT DEFAULT '',
  author TEXT DEFAULT '',
  author_id TEXT DEFAULT '',
  attachment_names TEXT[] DEFAULT '{}',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 2. 评论表
CREATE TABLE IF NOT EXISTS comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_id BIGINT,
  content TEXT NOT NULL,
  author TEXT DEFAULT '',
  author_id TEXT DEFAULT '',
  created_at BIGINT NOT NULL
);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_school ON posts(school);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);

-- 4. 启用 Supabase Realtime（让前端可以订阅实时变更）
-- 注意：Supabase 默认的 Realtime publication 是 'supabase_realtime'
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- 5. 启用 Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 6. RLS 策略
-- StemNote 使用 localStorage 管理用户身份，不依赖 Supabase Auth
-- 因此允许所有公开读写操作

-- 帖子权限
CREATE POLICY "允许公开读取帖子" ON posts
  FOR SELECT USING (true);

CREATE POLICY "允许公开创建帖子" ON posts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "允许公开更新帖子" ON posts
  FOR UPDATE USING (true);

CREATE POLICY "允许公开删除帖子" ON posts
  FOR DELETE USING (true);

-- 评论权限
CREATE POLICY "允许公开读取评论" ON comments
  FOR SELECT USING (true);

CREATE POLICY "允许公开创建评论" ON comments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "允许公开删除评论" ON comments
  FOR DELETE USING (true);
