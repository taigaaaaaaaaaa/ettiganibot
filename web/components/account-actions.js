"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function finishLoading() {
  window.dispatchEvent(new Event("ettigani:loading-end"));
}

export default function AccountActions() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function logout() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setError("ログアウトできませんでした。もう一度お試しください。");
        finishLoading();
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("通信に失敗しました。接続を確認してください。");
    } finally {
      setLoading(false);
      finishLoading();
    }
  }
  return (
    <>
      {error ? (
        <p aria-live="polite" className="form-error">
          {error}
        </p>
      ) : null}
      <button className="action-link" disabled={loading} onClick={logout} type="button">
        {loading ? "読み込み中..." : "ログアウト"}
      </button>
    </>
  );
}
