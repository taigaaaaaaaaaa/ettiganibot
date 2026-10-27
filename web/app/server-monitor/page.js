import ServerMonitorDashboard from "@/components/server-monitor-dashboard";

export const metadata = { title: "サーバー監視（Server Monitor）" };

export default function ServerMonitorPage() {
  return (
    <>
      <p className="eyebrow">SYSTEM STATUS</p>
      <h1 className="page-heading">サーバー監視</h1>
      <p className="page-lead">
        Webサービスの実行環境をリアルタイムで表示します。情報は1秒ごとに更新されます。
      </p>
      <ServerMonitorDashboard />
    </>
  );
}
