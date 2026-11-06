"use client";

import { useState } from "react";

function emptyNote() {
  return {
    title: "",
    body: "",
    category: "",
    tags: [],
    imageUrl: "",
    summary: "",
    publishedAt: toLocalDateTime(new Date()),
    isPublished: false,
  };
}

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function DevNotesAdmin({ initialNotes }) {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function editNote(note) {
    setDraft({
      ...note,
      tags: note.tags || [],
      imageUrl: note.imageUrl || "",
      summary: note.summary || "",
      publishedAt: toLocalDateTime(note.publishedAt || note.date),
      isPublished: note.isPublished !== false,
    });
    setError("");
  }

  function updateField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveNote(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...draft,
      tags:
        typeof draft.tags === "string"
          ? draft.tags.split(",").map((tag) => tag.trim())
          : draft.tags,
      publishedAt: draft.publishedAt ? new Date(draft.publishedAt).toISOString() : "",
    };
    try {
      const response = await fetch(
        draft.slug
          ? `/api/admin/dev-notes/${encodeURIComponent(draft.slug)}`
          : "/api/admin/dev-notes",
        {
          method: draft.slug ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "記事を保存できませんでした。");
        return;
      }
      setNotes((current) =>
        draft.slug
          ? current.map((note) => (note.slug === draft.slug ? result.note : note))
          : [result.note, ...current],
      );
      setDraft(null);
    } catch {
      setError("通信に失敗しました。接続を確認して、もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(note) {
    if (!window.confirm(`「${note.title}」を削除しますか？この操作は元に戻せません。`)) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/dev-notes/${encodeURIComponent(note.slug)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "記事を削除できませんでした。");
        return;
      }
      setNotes((current) => current.filter((item) => item.slug !== note.slug));
      if (draft?.slug === note.slug) setDraft(null);
    } catch {
      setError("通信に失敗しました。接続を確認して、もう一度お試しください。");
    }
  }

  return (
    <div className="dev-notes-admin">
      <div className="section-row">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1 className="page-heading">開発者ノート管理</h1>
        </div>
        <button
          className="action-link primary"
          onClick={() => {
            setDraft(emptyNote());
            setError("");
          }}
          type="button"
        >
          新しい記事
        </button>
      </div>
      {error && !draft ? (
        <p aria-live="polite" className="form-error">
          {error}
        </p>
      ) : null}
      {draft ? (
        <form className="community-form panel-card admin-note-form" onSubmit={saveNote}>
          <div className="section-row">
            <h2>{draft.slug ? "記事を編集" : "記事を作成"}</h2>
            <button className="modal-secondary" onClick={() => setDraft(null)} type="button">
              閉じる
            </button>
          </div>
          <label>
            タイトル
            <input
              maxLength={120}
              onChange={(event) => updateField("title", event.target.value)}
              required
              value={draft.title}
            />
          </label>
          <label>
            本文（Markdown対応）
            <textarea
              maxLength={50000}
              onChange={(event) => updateField("body", event.target.value)}
              placeholder={"# 見出し\n\n- リスト\n\n```js\nコードブロック\n```"}
              required
              rows={16}
              value={draft.body}
            />
          </label>
          <div className="form-grid">
            <label>
              カテゴリー
              <input
                maxLength={40}
                onChange={(event) => updateField("category", event.target.value)}
                required
                value={draft.category}
              />
            </label>
            <label>
              タグ（カンマ区切り）
              <input
                onChange={(event) => updateField("tags", event.target.value)}
                value={Array.isArray(draft.tags) ? draft.tags.join(", ") : draft.tags}
              />
            </label>
          </div>
          <label>
            アイキャッチ画像URL（任意・HTTPS）
            <input
              onChange={(event) => updateField("imageUrl", event.target.value)}
              type="url"
              value={draft.imageUrl}
            />
          </label>
          <label>
            概要
            <textarea
              maxLength={300}
              onChange={(event) => updateField("summary", event.target.value)}
              rows={3}
              value={draft.summary}
            />
          </label>
          <div className="form-grid">
            <label>
              公開日時
              <input
                onChange={(event) => updateField("publishedAt", event.target.value)}
                required
                type="datetime-local"
                value={draft.publishedAt || ""}
              />
            </label>
            <label className="admin-publish-toggle">
              <span>公開設定</span>
              <span className="admin-checkbox">
                <input
                  checked={draft.isPublished}
                  onChange={(event) => updateField("isPublished", event.target.checked)}
                  type="checkbox"
                />
                公開する
              </span>
            </label>
          </div>
          {error ? (
            <p aria-live="polite" className="form-error">
              {error}
            </p>
          ) : null}
          <div className="modal-actions">
            <button className="modal-secondary" onClick={() => setDraft(null)} type="button">
              キャンセル
            </button>
            <button className="modal-primary" disabled={saving} type="submit">
              {saving ? "保存中…" : "保存する"}
            </button>
          </div>
        </form>
      ) : null}
      <section className="note-list admin-note-list">
        {notes.length ? (
          notes.map((note) => (
            <article className="note-card" key={note.slug}>
              <div className="post-meta">
                <span className="category-chip">{note.category}</span>
                <span
                  className={note.isPublished === false ? "admin-status is-draft" : "admin-status"}
                >
                  {note.isPublished === false ? "下書き" : "公開"}
                </span>
                <time>
                  {note.publishedAt
                    ? new Date(note.publishedAt).toLocaleString("ja-JP")
                    : note.date}
                </time>
              </div>
              <h2>{note.title}</h2>
              <div className="admin-note-actions">
                <button className="modal-secondary" onClick={() => editNote(note)} type="button">
                  編集
                </button>
                <button className="modal-danger" onClick={() => deleteNote(note)} type="button">
                  削除
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">記事はありません。</p>
        )}
      </section>
    </div>
  );
}
