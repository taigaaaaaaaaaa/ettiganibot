import CommandExplorer from "@/components/command-explorer";
import commands from "@/app/data/commands.json";

export const metadata = { title: "コマンド一覧" };

export default function CommandsPage() {
  return (
    <>
      <p className="eyebrow">Botで利用できる機能</p>
      <h1 className="page-heading">コマンド一覧</h1>
      <p className="page-lead">現在のcommandsフォルダの登録定義から生成しています。</p>
      <CommandExplorer commands={commands} />
    </>
  );
}
