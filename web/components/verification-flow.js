"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const ERROR_MESSAGES = {
  turnstile_failed: "Turnstile認証を完了できませんでした。チェックをやり直してください。",
  turnstile_unavailable: "Turnstileの確認に失敗しました。しばらくしてからもう一度お試しください。",
  oauth_failed: "Discord認証に失敗しました。もう一度認証を開始してください。",
  invalid_state:
    "認証セッションの有効期限が切れたか、確認できませんでした。最初からやり直してください。",
  guild_not_joined:
    "対象サーバーに参加していないため認証できません。先にサーバーへ参加してください。",
  role_failed:
    "認証ロールを付与できませんでした。サーバー管理者にBotの権限とロール位置を確認してもらってください。",
  database_error: "認証情報の保存に失敗しました。時間をおいて再度お試しください。",
  not_configured:
    "このサーバーの認証設定が完了していません。サーバー管理者にお問い合わせください。",
  terms_required: "サーバー規約への同意が必要です。",
  rate_limited: "操作が集中しています。しばらく待ってからもう一度お試しください。",
  verification_in_progress: "認証処理を実行中です。少し待ってからページを再読み込みしてください。",
  rate_limit_unavailable: "認証システムが混み合っています。時間をおいてもう一度お試しください。",
  guild_check_failed: "サーバーの参加状況を確認できませんでした。時間をおいて再度お試しください。",
};

function VerifyFrame({ eyebrow, title, children }) {
  return (
    <div className="verification-page">
      <section className="verification-card">
        <div className="verification-brand">
          <span aria-hidden="true" className="verification-mark">
            ◆
          </span>
          <span>サーバー認証</span>
        </div>
        <p className="verification-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
        <p className="verification-footnote">Discord公式とは関係ありません。</p>
      </section>
    </div>
  );
}

export function VerificationStart({ guildId, siteKey }) {
  const widgetRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!siteKey || !widgetRef.current) return undefined;
    let active = true;
    const renderWidget = () => {
      if (!active || !window.turnstile || widgetIdRef.current !== null) return;
      widgetIdRef.current = window.turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        action: "verify",
        callback: (token) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () =>
          setError("Turnstileを読み込めませんでした。ページを再読み込みしてください。"),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.querySelector("#turnstile-script");
      if (!script) {
        script = document.createElement("script");
        script.id = "turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget);
      return () => {
        active = false;
        script.removeEventListener("load", renderWidget);
        if (widgetIdRef.current !== null && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }

    return () => {
      active = false;
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  async function beginVerification(event) {
    event.preventDefault();
    if (!turnstileToken || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/verify/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, token: turnstileToken }),
      });
      const result = await response.json();
      if (!response.ok) {
        window.location.assign(
          `/verify/error?reason=${encodeURIComponent(result.error || "database_error")}`,
        );
        return;
      }
      window.location.assign(result.authorizeUrl);
    } catch {
      setLoading(false);
      setError("認証を開始できませんでした。ネットワークを確認して再度お試しください。");
    }
  }

  return (
    <VerifyFrame eyebrow="SECURITY CHECK" title="🔐 サーバー認証">
      <p className="verification-description">
        このサーバーを利用するには認証が必要です。
        <br />
        Turnstile認証後、Discordアカウントでログインしてください。
      </p>
      {!guildId ? (
        <p className="verification-alert">
          認証対象のサーバー情報がありません。Discordの認証パネルから開始してください。
        </p>
      ) : !siteKey ? (
        <p className="verification-alert">
          Turnstileの公開キーが設定されていません。サーバー管理者にお問い合わせください。
        </p>
      ) : (
        <form className="verification-form" onSubmit={beginVerification}>
          <div className="turnstile-container" ref={widgetRef} />
          {error ? <p className="verification-alert">{error}</p> : null}
          <button
            className="verification-primary"
            disabled={!turnstileToken || loading}
            type="submit"
          >
            {loading ? "確認しています…" : "Discordで認証を続ける"}
          </button>
        </form>
      )}
    </VerifyFrame>
  );
}

export function TermsConsent({ username }) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function completeVerification(event) {
    event.preventDefault();
    if (!agreed || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/verify/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreed }),
      });
      const result = await response.json();
      if (!response.ok) {
        window.location.assign(
          `/verify/error?reason=${encodeURIComponent(result.error || "database_error")}`,
        );
        return;
      }
      if (result.admin) {
        window.location.assign("/verify/admin");
        return;
      }
      if (result.alreadyVerified) {
        window.location.assign("/verify/already");
        return;
      }
      const warning = result.logWarning ? "&logWarning=1" : "";
      window.location.assign(
        `/verify/success?guild=${encodeURIComponent(result.guildId)}${warning}`,
      );
    } catch {
      setLoading(false);
      setError(ERROR_MESSAGES.database_error);
    }
  }

  return (
    <VerifyFrame eyebrow="SERVER RULES" title="サーバー規約">
      <p className="verification-description">
        Discordアカウント: <strong>{username}</strong>
      </p>
      <div className="verification-rules">
        <section>
          <h2>1. 他の利用者への迷惑行為を禁止します。</h2>
          <p>以下の行為は禁止です。</p>
          <ul>
            <li>荒らし行為</li>
            <li>スパム行為</li>
            <li>誹謗中傷</li>
            <li>嫌がらせ行為</li>
            <li>サーバー運営の妨害</li>
          </ul>
        </section>
        <section>
          <h2>2. Discord利用規約を遵守してください。</h2>
          <p>Discord利用規約およびコミュニティガイドラインに違反する行為は禁止です。</p>
        </section>
        <section>
          <h2>3. 運営による対応について</h2>
          <p>運営が不適切と判断した場合、以下の対応等を行う場合があります。</p>
          <ul>
            <li>メッセージ削除</li>
            <li>ロール剥奪</li>
            <li>タイムアウト</li>
            <li>キック</li>
            <li>BAN</li>
          </ul>
        </section>
        <section>
          <h2>4. 認証について</h2>
          <p>
            認証を完了すると「✅認証済み！」ロールが付与されます。認証は本人確認を目的としており、個人情報の収集を目的とするものではありません。
          </p>
        </section>
      </div>
      <form className="verification-form" onSubmit={completeVerification}>
        <label className="verification-checkbox">
          <input
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            type="checkbox"
          />
          <span>上記内容に同意します</span>
        </label>
        {error ? <p className="verification-alert">{error}</p> : null}
        <button className="verification-primary" disabled={!agreed || loading} type="submit">
          {loading ? "認証しています…" : "同意して認証を完了"}
        </button>
      </form>
    </VerifyFrame>
  );
}

export function VerificationMessage({ kind, guildId, logWarning = false }) {
  const success = kind === "success";
  useEffect(() => {
    if (!success) return undefined;
    const timer = window.setTimeout(() => {
      window.location.href = "discord://";
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const title =
    kind === "success"
      ? "✅ 認証完了！"
      : kind === "already"
        ? "✅ 既に認証済みです"
        : "✅ 管理者は認証不要です";
  return (
    <VerifyFrame eyebrow="VERIFICATION" title={title}>
      <p className="verification-description">
        {success
          ? "認証済みロールを付与しました。"
          : kind === "already"
            ? "このサーバーでは既に認証が完了しています。"
            : "Administrator権限を確認しました。認証手続きは不要です。"}
      </p>
      {success ? <p className="verification-countdown">3秒後にDiscordへ戻ります…</p> : null}
      {logWarning ? (
        <p className="verification-alert">
          認証は完了しましたが、認証ログを送信できませんでした。管理者にお知らせください。
        </p>
      ) : null}
      <a className="verification-primary verification-button-link" href="discord://">
        Discordに戻る
      </a>
      {guildId ? (
        <a
          className="verification-secondary"
          href={`https://discord.com/channels/${encodeURIComponent(guildId)}`}
        >
          ブラウザーでサーバーを開く
        </a>
      ) : null}
    </VerifyFrame>
  );
}

export function VerificationError({ reason }) {
  const message =
    ERROR_MESSAGES[reason] ||
    "認証を完了できませんでした。最初からやり直すか、サーバー管理者にお問い合わせください。";
  return (
    <VerifyFrame eyebrow="VERIFICATION ERROR" title="認証できませんでした">
      <p className="verification-alert">{message}</p>
      <Link className="verification-primary verification-button-link" href="/">
        認証パネルに戻る
      </Link>
    </VerifyFrame>
  );
}
