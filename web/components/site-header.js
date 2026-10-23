"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/", label: "ホーム" },
  { href: "/ranking", label: "ランキング" },
  { href: "/global-ranking", label: "グローバルランキング" },
  { href: "/statistics", label: "統計" },
  { href: "/commands", label: "コマンド一覧" },
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシー" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

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
        </nav>
      </div>
    </header>
  );
}
