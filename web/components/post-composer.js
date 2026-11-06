"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

function finishLoading() {
  window.dispatchEvent(new Event("ettigani:loading-end"));
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function PostComposer({ guilds = [] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const imageInput = useRef(null);

  useEffect(() => {
    if (!image) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function selectImage(event) {
    const selected = event.target.files?.[0] || null;
    setError("");
    if (
      selected &&
      (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) ||
        selected.size > MAX_IMAGE_SIZE)
    ) {
      setError("JPEG・PNG・WebP形式で、5MB以下の画像を選択してください。");
      event.target.value = "";
      setImage(null);
      return;
    }
    setImage(selected);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    try {
      let thumbnail = null;
      if (image) {
        const uploadData = new FormData();
        uploadData.set("image", image);
        const uploadResponse = await fetch("/api/community/uploads", {
          method: "POST",
          body: uploadData,
        });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) {
          setError(uploadResult.error || "画像をアップロードできませんでした。");
          finishLoading();
          return;
        }
        thumbnail = uploadResult.url;
      }

      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          body: formData.get("body"),
          category: formData.get("category"),
          tags: String(formData.get("tags") || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          thumbnail,
          visibility: formData.get("visibility"),
          guildId: formData.get("guildId"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "投稿を作成できませんでした。");
        finishLoading();
        return;
      }
      router.push(`/community/${result.post.id}`);
      router.refresh();
    } catch {
      setError("通信に失敗しました。接続を確認して、もう一度お試しください。");
      finishLoading();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="community-form panel-card" onSubmit={submit}>
      <label>
        タイトル
        <input maxLength={120} name="title" placeholder="投稿のタイトル" required />
      </label>
      <label>
        本文
        <textarea
          maxLength={20000}
          name="body"
          placeholder="内容を書いてみましょう"
          required
          rows={12}
        />
      </label>
      <div className="form-grid">
        <label>
          カテゴリー（任意）
          <input maxLength={50} name="category" placeholder="例: 開発、質問、雑談" />
        </label>
        <label>
          タグ（カンマ区切り）
          <input name="tags" placeholder="Discord, NodeJS, Cloudflare" />
        </label>
      </div>
      <div className="image-upload-field">
        <label htmlFor="post-image">画像（任意）</label>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="image-upload-input"
          id="post-image"
          ref={imageInput}
          onChange={selectImage}
          type="file"
        />
        <label className="image-upload-button" htmlFor="post-image">
          {image ? "画像を選び直す" : "画像を選択"}
        </label>
        <span className="image-upload-hint">JPEG・PNG・WebP / 5MBまで</span>
        {image && previewUrl ? (
          <div className="image-preview">
            <Image
              alt="選択した画像のプレビュー"
              height={320}
              src={previewUrl}
              unoptimized
              width={520}
            />
            <button
              onClick={() => {
                if (imageInput.current) imageInput.current.value = "";
                setImage(null);
              }}
              type="button"
            >
              画像を削除
            </button>
          </div>
        ) : null}
      </div>
      <div className="form-grid">
        <label>
          公開範囲
          <select defaultValue="public" name="visibility">
            <option value="public">全体公開</option>
            <option value="server">サーバー限定</option>
          </select>
        </label>
        <label>
          対象サーバー
          <select defaultValue="" name="guildId">
            <option value="">全体公開を選択中</option>
            {guilds.map((guild) => (
              <option key={guild.id} value={guild.id}>
                {guild.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p aria-live="polite" className="form-error">
          {error}
        </p>
      ) : null}
      <button className="action-link primary" disabled={saving} type="submit">
        {saving ? "読み込み中..." : "投稿する"}
      </button>
    </form>
  );
}
