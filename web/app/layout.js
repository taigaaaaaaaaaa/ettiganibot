import "./globals.css";
import SiteHeader from "@/components/site-header";
import LoadingTransition from "@/components/loading-transition";

export const metadata = {
  title: {
    default: "えっちがにbotのサイト！",
    template: "%s | えっちがにbotのサイト！",
  },
  description: "えっちがにbotの公式サイト！",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        <LoadingTransition>
          <SiteHeader />
          <main className="page-shell">{children}</main>
          <footer className="site-footer">
            <span>えっちがにbot</span>
            <span>Discord公式とは関係ありません。</span>
          </footer>
        </LoadingTransition>
      </body>
    </html>
  );
}
