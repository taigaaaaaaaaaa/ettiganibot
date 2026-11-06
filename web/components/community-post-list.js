"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { getDefaultAvatar } from "@/lib/discord";

function editedLabel(post) {
  if (!post.updatedAt || new Date(post.updatedAt) <= new Date(post.createdAt)) return null;
  const days = Math.floor((Date.now() - new Date(post.updatedAt).getTime()) / 86_400_000);
  return `${Math.max(0, days)}日前に編集済み`;
}

function PostActions({ post, viewer, admin, onSaved, onDeleted }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState("");
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [category, setCategory] = useState(post.category || "未分類");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canManage = Boolean(viewer && (viewer.id === post.author.id || admin));

  async function savePost(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/community/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, category }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "投稿を保存できませんでした。");
        return;
      }
      onSaved(result.post);
      setDialog("");
    } catch {
      setError("通信に失敗しました。接続を確認して、もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  async function deletePost() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/community/posts/${post.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "投稿を削除できませんでした。");
        return;
      }
      onDeleted(post.id);
      setDialog("");
    } catch {
      setError("通信に失敗しました。接続を確認して、もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  return canManage ? (
    <>
      <div className="post-menu">
        <button
          aria-expanded={menuOpen}
          aria-label="投稿メニュー"
          className="post-menu-trigger"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <MoreVertical aria-hidden="true" size={20} />
        </button>
        {menuOpen ? (
          <div className="discord-dropdown">
            <button
              onClick={() => {
                setTitle(post.title);
                setBody(post.body);
                setCategory(post.category || "未分類");
                setError("");
                setDialog("edit");
                setMenuOpen(false);
              }}
              type="button"
            >
              編集
            </button>
            <button
              className="danger"
              onClick={() => {
                setReason("");
                setError("");
                setDialog("delete");
                setMenuOpen(false);
              }}
              type="button"
            >
              削除
            </button>
          </div>
        ) : null}
      </div>
      {dialog && typeof document !== "undefined"
        ? createPortal(
            <div
              className="discord-modal-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !saving) setDialog("");
              }}
            >
              <section
                aria-labelledby="post-management-title"
                aria-modal="true"
                className="discord-modal"
                role="dialog"
              >
                {dialog === "edit" ? (
                  <form className="post-edit-form" onSubmit={savePost}>
                    <h2 id="post-management-title">投稿を編集</h2>
                    <label>
                      タイトル
                      <input
                        maxLength={120}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        value={title}
                      />
                    </label>
                    <label>
                      本文
                      <textarea
                        maxLength={20000}
                        onChange={(event) => setBody(event.target.value)}
                        required
                        rows={9}
                        value={body}
                      />
                    </label>
                    <label>
                      カテゴリー
                      <input
                        maxLength={50}
                        onChange={(event) => setCategory(event.target.value)}
                        value={category}
                      />
                    </label>
                    {error ? (
                      <p aria-live="polite" className="form-error">
                        {error}
                      </p>
                    ) : null}
                    <div className="modal-actions">
                      <button
                        className="modal-secondary"
                        onClick={() => setDialog("")}
                        type="button"
                      >
                        キャンセル
                      </button>
                      <button className="modal-primary" disabled={saving} type="submit">
                        {saving ? "保存中…" : "保存"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h2 id="post-management-title">この投稿を削除しますか？</h2>
                    <p className="modal-copy">この操作は元に戻せません</p>
                    {admin && post.author.id !== viewer.id ? (
                      <label>
                        削除理由（任意）
                        <textarea
                          maxLength={500}
                          onChange={(event) => setReason(event.target.value)}
                          rows={3}
                          value={reason}
                        />
                      </label>
                    ) : null}
                    {error ? (
                      <p aria-live="polite" className="form-error">
                        {error}
                      </p>
                    ) : null}
                    <div className="modal-actions">
                      <button
                        className="modal-secondary"
                        disabled={saving}
                        onClick={() => setDialog("")}
                        type="button"
                      >
                        キャンセル
                      </button>
                      <button
                        className="modal-danger"
                        disabled={saving}
                        onClick={deletePost}
                        type="button"
                      >
                        {saving ? "削除中…" : "削除する"}
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  ) : null;
}

function PostCard({ post, viewer, admin, onSaved, onDeleted }) {
  return (
    <article className="post-card" key={post.id}>
      {post.thumbnail ? (
        <Link className="post-card-image" href={`/community/${post.id}`}>
          <Image alt="" height={260} src={post.thumbnail} unoptimized width={520} />
        </Link>
      ) : null}
      <div className="post-card-content">
        <PostActions
          admin={admin}
          onDeleted={onDeleted}
          onSaved={onSaved}
          post={post}
          viewer={viewer}
        />
        <div className="post-meta">
          <span className="category-chip">{post.category || "未分類"}</span>
          <time>{new Date(post.createdAt).toLocaleDateString("ja-JP")}</time>
          {editedLabel(post) ? <span>{editedLabel(post)}</span> : null}
          {post.visibility === "server" ? <span>サーバー限定</span> : null}
        </div>
        <h2>
          <Link href={`/community/${post.id}`}>{post.title}</Link>
        </h2>
        <p className="post-excerpt">
          {post.body.slice(0, 180)}
          {post.body.length > 180 ? "…" : ""}
        </p>
        <div className="post-card-footer">
          <Link className="post-author" href={`/users/${post.author.id}`}>
            <Image
              alt=""
              height={28}
              src={
                post.author.avatar
                  ? `https://cdn.discordapp.com/avatars/${post.author.id}/${post.author.avatar}.${post.author.avatar.startsWith("a_") ? "gif" : "png"}?size=64`
                  : getDefaultAvatar(post.author.id)
              }
              unoptimized
              width={28}
            />
            {post.author.globalName || post.author.username}
          </Link>
          <span>♥ {post.likeCount ?? post.likes?.length ?? 0}</span>
          <span>💬 {post.comments?.length || 0}</span>
        </div>
        {post.tags?.length ? (
          <div className="tag-list">
            {post.tags.map((item) => (
              <Link href={`/community?tag=${encodeURIComponent(item)}`} key={item}>
                #{item}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function CommunityPostList({ initialPosts, viewer, admin }) {
  const [posts, setPosts] = useState(initialPosts);

  function updatePost(post) {
    setPosts((current) => current.map((item) => (item.id === post.id ? post : item)));
  }

  function removePost(postId) {
    setPosts((current) => current.filter((item) => item.id !== postId));
  }

  return posts.length ? (
    posts.map((post) => (
      <PostCard
        admin={admin}
        key={post.id}
        onDeleted={removePost}
        onSaved={updatePost}
        post={post}
        viewer={viewer}
      />
    ))
  ) : (
    <p className="empty-state">まだ投稿がありません。最初の投稿を作成してみましょう。</p>
  );
}
