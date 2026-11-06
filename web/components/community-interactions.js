"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Bookmark, Heart, MessageCircle, Pencil, Send, Trash2 } from "lucide-react";
import { getAvatarUrl } from "@/lib/discord";

function finishLoading() {
  window.dispatchEvent(new Event("ettigani:loading-end"));
}

function getRootCommentId(comment, commentsById) {
  let current = comment;
  const visited = new Set();
  while (current.parentCommentId && commentsById.has(current.parentCommentId)) {
    if (visited.has(current.id)) return null;
    visited.add(current.id);
    current = commentsById.get(current.parentCommentId);
  }
  return current.id;
}

function CommentAuthor({ comment, size }) {
  const author = comment.author;
  return (
    <Image alt="" height={size} src={getAvatarUrl(author, author.id)} unoptimized width={size} />
  );
}

function CommentMeta({ comment }) {
  return (
    <p className="comment-meta">
      <Link href={`/users/${comment.author.id}`}>
        {comment.author.globalName || comment.author.username}
      </Link>
      <time>{new Date(comment.createdAt).toLocaleString("ja-JP")}</time>
      {comment.editedAt ? <span className="comment-edited">編集済み</span> : null}
    </p>
  );
}

export default function CommunityInteractions({ post, viewer }) {
  const [likeCount, setLikeCount] = useState(post.likeCount ?? post.likes?.length ?? 0);
  const [saveCount, setSaveCount] = useState(post.saveCount ?? post.saves?.length ?? 0);
  const [liked, setLiked] = useState(
    post.liked ?? Boolean(viewer && post.likes?.includes(viewer.id)),
  );
  const [saved, setSaved] = useState(
    post.saved ?? Boolean(viewer && post.saves?.includes(viewer.id)),
  );
  const [comments, setComments] = useState(post.comments || []);
  const [comment, setComment] = useState("");
  const [reply, setReply] = useState("");
  const [replyingTo, setReplyingTo] = useState("");
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editText, setEditText] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const commentsById = new Map(comments.map((item) => [item.id, item]));
  const rootComments = comments.filter(
    (item) => !item.parentCommentId || !commentsById.has(item.parentCommentId),
  );
  async function interact(action, fields = {}) {
    setError("");
    setBusyAction(action);
    try {
      const response = await fetch(`/api/community/posts/${post.id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...fields }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "操作を完了できませんでした。");
        return false;
      }
      if (action === "like") {
        setLiked(result.liked);
        setLikeCount(result.likeCount);
      }
      if (action === "save") {
        setSaved(result.saved);
        setSaveCount(result.saveCount);
      }
      if (
        [
          "comment",
          "reply",
          "edit-comment",
          "edit-reply",
          "delete-comment",
          "delete-reply",
        ].includes(action)
      ) {
        setComments(result.comments);
        if (action === "comment") setComment("");
        if (action === "reply") {
          setReply("");
          setReplyingTo("");
        }
        if (action === "edit-comment" || action === "edit-reply") {
          setEditText("");
          setEditingCommentId("");
        }
      }
      return true;
    } catch {
      setError("通信に失敗しました。接続を確認して、もう一度お試しください。");
      return false;
    } finally {
      setBusyAction("");
      finishLoading();
    }
  }

  async function submitComment(event) {
    event.preventDefault();
    await interact("comment", { comment });
  }

  async function submitReply(event, parentCommentId) {
    event.preventDefault();
    await interact("reply", { comment: reply, parentCommentId });
  }

  function renderEditForm(item) {
    const isReply = Boolean(item.parentCommentId);
    const action = isReply ? "edit-reply" : "edit-comment";
    return (
      <form
        className="comment-form reply-form"
        onSubmit={(event) => {
          event.preventDefault();
          interact(action, {
            comment: editText,
            commentId: item.id,
            ...(isReply ? { parentCommentId: item.parentCommentId } : {}),
          });
        }}
      >
        <textarea
          aria-label="コメントを編集"
          maxLength={2000}
          onChange={(event) => setEditText(event.target.value)}
          required
          rows={2}
          value={editText}
        />
        <div className="reply-form-actions">
          <button
            className="comment-text-button"
            onClick={() => {
              setEditingCommentId("");
              setEditText("");
            }}
            type="button"
          >
            キャンセル
          </button>
          <button
            aria-label="変更を保存"
            className="icon-button"
            disabled={!editText.trim() || Boolean(busyAction)}
            type="submit"
          >
            {busyAction === action ? "…" : <Send size={17} />}
          </button>
        </div>
      </form>
    );
  }

  return (
    <section className="post-engagement">
      <div className="post-actions">
        {viewer ? (
          <>
            <button
              aria-pressed={liked}
              className={liked ? "post-action is-liked" : "post-action"}
              disabled={Boolean(busyAction)}
              onClick={() => interact("like")}
              type="button"
            >
              {busyAction === "like" ? (
                "読み込み中..."
              ) : (
                <>
                  <Heart fill={liked ? "currentColor" : "none"} size={18} /> いいね {likeCount}
                </>
              )}
            </button>
            <a className="post-action" href="#comments">
              <MessageCircle size={18} /> コメント {comments.length}
            </a>
            <button
              aria-pressed={saved}
              className={saved ? "post-action is-saved" : "post-action"}
              disabled={Boolean(busyAction)}
              onClick={() => interact("save")}
              type="button"
            >
              {busyAction === "save" ? (
                "読み込み中..."
              ) : (
                <>
                  <Bookmark fill={saved ? "currentColor" : "none"} size={18} /> 保存 {saveCount}
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <Link className="post-action" href="/api/auth/discord">
              <Heart size={18} /> ログインして交流
            </Link>
            <a className="post-action" href="#comments">
              <MessageCircle size={18} /> コメント {comments.length}
            </a>
          </>
        )}
      </div>
      {error ? (
        <p aria-live="polite" className="form-error">
          {error}
        </p>
      ) : null}
      <div className="comments-section" id="comments">
        <h2>コメント ({comments.length})</h2>
        {viewer ? (
          <form className="comment-form" onSubmit={submitComment}>
            <textarea
              aria-label="コメント"
              maxLength={2000}
              onChange={(event) => setComment(event.target.value)}
              placeholder="コメントを書く"
              required
              rows={3}
              value={comment}
            />
            <button
              aria-label="コメントを送信"
              className="icon-button"
              disabled={!comment.trim() || Boolean(busyAction)}
              type="submit"
            >
              {busyAction === "comment" ? "…" : <Send size={17} />}
            </button>
          </form>
        ) : (
          <p className="muted-copy">コメントにはDiscordログインが必要です。</p>
        )}
        {comments.length ? (
          <ul className="comment-list">
            {rootComments.map((item) => {
              const rootId = getRootCommentId(item, commentsById);
              const replies = comments.filter(
                (entry) => entry.id !== item.id && getRootCommentId(entry, commentsById) === rootId,
              );
              return (
                <li className="comment-item" key={item.id}>
                  <CommentAuthor comment={item} size={34} />
                  <div className="comment-content">
                    <CommentMeta comment={item} />
                    <p className="comment-body">
                      {item.deletedAt ? "このコメントは削除されました。" : item.body}
                    </p>
                    <div className="comment-controls">
                      {viewer && !item.deletedAt ? (
                        <button
                          className="comment-text-button"
                          disabled={Boolean(busyAction)}
                          onClick={() => {
                            setError("");
                            setReplyingTo((current) => (current === item.id ? "" : item.id));
                          }}
                          type="button"
                        >
                          <MessageCircle size={14} /> 返信
                        </button>
                      ) : null}
                      {viewer?.id === item.author.id && !item.deletedAt ? (
                        <>
                          <button
                            className="comment-text-button"
                            disabled={Boolean(busyAction)}
                            onClick={() => {
                              setError("");
                              setEditText(item.body);
                              setEditingCommentId((current) =>
                                current === item.id ? "" : item.id,
                              );
                            }}
                            type="button"
                          >
                            <Pencil size={14} /> 編集
                          </button>
                          <button
                            className="comment-text-button comment-delete-button"
                            disabled={Boolean(busyAction)}
                            onClick={() => interact("delete-comment", { commentId: item.id })}
                            type="button"
                          >
                            <Trash2 size={14} /> 削除
                          </button>
                        </>
                      ) : null}
                      {replies.length ? (
                        <span className="reply-count">返信 {replies.length}件</span>
                      ) : null}
                    </div>
                    {editingCommentId === item.id ? renderEditForm(item) : null}
                    {replies.length ? (
                      <ul className="comment-reply-list">
                        {replies.map((replyItem) => (
                          <li className="comment-reply-item" key={replyItem.id}>
                            <CommentAuthor comment={replyItem} size={30} />
                            <div className="comment-content">
                              <CommentMeta comment={replyItem} />
                              <p className="comment-body">
                                {replyItem.deletedAt
                                  ? "この返信は削除されました。"
                                  : replyItem.body}
                              </p>
                              <div className="comment-controls">
                                {viewer && !item.deletedAt ? (
                                  <button
                                    className="comment-text-button"
                                    disabled={Boolean(busyAction)}
                                    onClick={() => {
                                      setError("");
                                      setReplyingTo((current) =>
                                        current === item.id ? "" : item.id,
                                      );
                                    }}
                                    type="button"
                                  >
                                    <MessageCircle size={14} /> 返信
                                  </button>
                                ) : null}
                                {viewer?.id === replyItem.author.id && !replyItem.deletedAt ? (
                                  <>
                                    <button
                                      className="comment-text-button"
                                      disabled={Boolean(busyAction)}
                                      onClick={() => {
                                        setError("");
                                        setEditText(replyItem.body);
                                        setEditingCommentId((current) =>
                                          current === replyItem.id ? "" : replyItem.id,
                                        );
                                      }}
                                      type="button"
                                    >
                                      <Pencil size={14} /> 編集
                                    </button>
                                    <button
                                      className="comment-text-button comment-delete-button"
                                      disabled={Boolean(busyAction)}
                                      onClick={() =>
                                        interact("delete-reply", {
                                          commentId: replyItem.id,
                                          parentCommentId: item.id,
                                        })
                                      }
                                      type="button"
                                    >
                                      <Trash2 size={14} /> 削除
                                    </button>
                                  </>
                                ) : null}
                              </div>
                              {editingCommentId === replyItem.id ? renderEditForm(replyItem) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {viewer && replyingTo === item.id ? (
                      <form
                        className="comment-form reply-form"
                        onSubmit={(event) => submitReply(event, item.id)}
                      >
                        <textarea
                          aria-label="返信"
                          maxLength={2000}
                          onChange={(event) => setReply(event.target.value)}
                          placeholder="返信を書く"
                          required
                          rows={2}
                          value={reply}
                        />
                        <div className="reply-form-actions">
                          <button
                            className="comment-text-button"
                            onClick={() => {
                              setReplyingTo("");
                              setReply("");
                            }}
                            type="button"
                          >
                            キャンセル
                          </button>
                          <button
                            aria-label="返信を送信"
                            className="icon-button"
                            disabled={!reply.trim() || Boolean(busyAction)}
                            type="submit"
                          >
                            {busyAction === "reply" ? "…" : <Send size={17} />}
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted-copy">まだコメントはありません。</p>
        )}
      </div>
    </section>
  );
}
