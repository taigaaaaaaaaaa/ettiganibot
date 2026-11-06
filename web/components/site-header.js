"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/", label: "ホーム" },
  { href: "/community", label: "コミュニティ" },
  { href: "/dev-notes", label: "開発者ノート" },
  { href: "/servers", label: "サーバー" },
  { href: "/community/rankings", label: "コミュニティランキング" },
  { href: "/ranking", label: "ランキング" },
  { href: "/statistics", label: "統計" },
  { href: "/server-monitor", label: "サーバー監視" },
  { href: "/commands", label: "コマンド一覧" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (active) setUser(result.user);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/" onClick={() => setMenuOpen(false)}>
          <span aria-hidden="true" className="brand-crab">
            🦀
          </span>
          <span>えっちがにのサイト！</span>
        </Link>
        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
          className="menu-toggle"
          data-loading-exempt
          onClick={() => setMenuOpen(!menuOpen)}
          type="button"
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav aria-label="メインナビゲーション" className={`site-nav ${menuOpen ? "is-open" : ""}`}>
          {links.map((link) => (
            <Link
              aria-current={pathname === link.href ? "page" : undefined}
              className={pathname === link.href ? "nav-link is-active" : "nav-link"}
              href={link.href}
              key={link.href}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {user?.isAdmin ? (
            <Link
              aria-current={pathname === "/admin/devnotes" ? "page" : undefined}
              className={pathname === "/admin/devnotes" ? "nav-link is-active" : "nav-link"}
              href="/admin/devnotes"
              onClick={() => setMenuOpen(false)}
            >
              ノート管理
            </Link>
          ) : null}
          <Link
            aria-current={pathname === "/terms" ? "page" : undefined}
            className={pathname === "/terms" ? "nav-link is-active" : "nav-link"}
            href="/terms"
            onClick={() => setMenuOpen(false)}
          >
            利用規約
          </Link>
          <Link
            aria-current={pathname === "/privacy" ? "page" : undefined}
            className={pathname === "/privacy" ? "nav-link is-active" : "nav-link"}
            href="/privacy"
            onClick={() => setMenuOpen(false)}
          >
            プライバシー
          </Link>
        </nav>
        {user ? (
          <Link className="header-account" href="/me" onClick={() => setMenuOpen(false)}>
            <Image alt="" height={32} src={user.avatarUrl} unoptimized width={32} />
            <span>{user.globalName || user.username}</span>
          </Link>
        ) : (
          <Link
            className="header-login"
            href="/api/auth/discord"
            onClick={() => setMenuOpen(false)}
          >
            Discordログイン
          </Link>
        )}
      </div>
    </header>
  );
}
