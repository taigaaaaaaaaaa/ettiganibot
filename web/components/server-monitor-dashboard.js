"use client";

import { useEffect, useState } from "react";

const REFRESH_INTERVAL = 1_000;
const HISTORY_LIMIT = 60;

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  return `${(value / 1_000_000_000).toFixed(2)} GB`;
}

function formatRate(value) {
  if (!Number.isFinite(value)) return "計測中";
  return `${formatBytes(value)}/s`;
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "計測中";
}

function formatDuration(value) {
  if (!Number.isFinite(value)) return "—";
  const seconds = Math.floor(value);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return `${days}日 ${hours}時間 ${minutes}分`;
}

function MetricCard({ label, value, used, total, percent, color, caption }) {
  const width = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;

  return (
    <article className="monitor-card monitor-metric-card">
      <div className="monitor-card-heading">
        <h2>{label}</h2>
        <span>{formatPercent(percent)}</span>
      </div>
      <p className="monitor-metric-value">{value}</p>
      <div
        aria-label={`${label} ${formatPercent(percent)}`}
        className="monitor-progress-track"
        role="img"
      >
        <div className={`monitor-progress-fill ${color}`} style={{ width: `${width}%` }} />
      </div>
      <p className="monitor-card-caption">
        {caption ?? (
          <>
            {formatBytes(used)} 使用中 <span aria-hidden="true">/</span> {formatBytes(total)}
          </>
        )}
      </p>
    </article>
  );
}

function networkPath(history, key) {
  const max = Math.max(1, ...history.map((sample) => sample[key] ?? 0));
  return history
    .map((sample, index) => {
      const x = history.length > 1 ? (index / (history.length - 1)) * 100 : 0;
      const y = 92 - ((sample[key] ?? 0) / max) * 82;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export default function ServerMonitorDashboard() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [online, setOnline] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let active = true;
    let timer;
    let controller;

    const refresh = async () => {
      if (!active || document.visibilityState !== "visible") {
        timer = window.setTimeout(refresh, REFRESH_INTERVAL);
        return;
      }

      controller = new AbortController();
      try {
        const response = await fetch("/api/server-monitor", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const nextData = await response.json();
        if (!active) return;

        setData(nextData);
        setOnline(true);
        setUpdatedAt(new Date());
        if (nextData.metrics.network) {
          setHistory((current) =>
            [
              ...current,
              {
                receive: nextData.metrics.network.receiveSpeed,
                send: nextData.metrics.network.sendSpeed,
              },
            ].slice(-HISTORY_LIMIT),
          );
        }
      } catch (error) {
        if (!active || error.name === "AbortError") return;
        setOnline(false);
      } finally {
        if (active) timer = window.setTimeout(refresh, REFRESH_INTERVAL);
      }
    };

    const resume = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer);
        void refresh();
      }
    };

    void refresh();
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  const system = data?.system;
  const metrics = data?.metrics;
  const network = metrics?.network;

  return (
    <div className="monitor-dashboard">
      <section aria-label="サーバーの接続状態" className="monitor-status-bar">
        <div className="monitor-status-copy">
          <span
            aria-hidden="true"
            className={`monitor-status-dot ${online === null ? "is-connecting" : online ? "is-online" : ""}`}
          />
          <div>
            <p className="monitor-status-title">
              {online === null ? "接続中" : online ? "Online" : "Offline"}
            </p>
            <p className="monitor-status-caption">
              {online
                ? "監視APIに接続中"
                : online === false
                  ? "監視APIに接続できません"
                  : "監視APIを確認しています"}
            </p>
          </div>
        </div>
        <p className="monitor-updated">
          最終更新 {updatedAt ? updatedAt.toLocaleTimeString("ja-JP") : "—"}
        </p>
      </section>

      {online === false && data ? (
        <p className="status-note" role="status">
          最新データを取得できません。表示中の値は前回の更新時点のものです。
        </p>
      ) : null}

      <section aria-label="リアルタイム使用率" className="monitor-metrics-grid">
        <MetricCard
          color="is-blue"
          label="CPU"
          percent={metrics?.cpuUsage}
          value={formatPercent(metrics?.cpuUsage)}
          caption="システム全体の使用率"
        />
        <MetricCard
          color="is-green"
          label="メモリ"
          percent={metrics?.memoryUsage}
          total={system?.memoryTotal}
          used={metrics?.memoryUsed}
          value={formatPercent(metrics?.memoryUsage)}
        />
        <MetricCard
          color="is-purple"
          label="ストレージ"
          percent={metrics?.storageUsage}
          total={system?.storageTotal}
          used={metrics?.storageUsed}
          value={formatPercent(metrics?.storageUsage)}
        />
      </section>

      <section aria-labelledby="monitor-network-title" className="monitor-card monitor-network">
        <div className="monitor-section-heading">
          <div>
            <p className="eyebrow">LIVE TRAFFIC</p>
            <h2 id="monitor-network-title">ネットワーク</h2>
          </div>
          <span className="monitor-live-label">
            <span aria-hidden="true" /> 1秒ごとに更新
          </span>
        </div>
        {network ? (
          <>
            <div className="monitor-network-stats">
              <div>
                <span className="monitor-network-legend is-receive">受信</span>
                <strong>{formatRate(network.receiveSpeed)}</strong>
                <small>合計 {formatBytes(network.received)}</small>
              </div>
              <div>
                <span className="monitor-network-legend is-send">送信</span>
                <strong>{formatRate(network.sendSpeed)}</strong>
                <small>合計 {formatBytes(network.sent)}</small>
              </div>
            </div>
            <div aria-label="ネットワーク速度の履歴" className="monitor-chart-wrap" role="img">
              <svg
                aria-hidden="true"
                className="monitor-chart"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <path className="monitor-chart-grid" d="M 0 10 H 100 M 0 50 H 100 M 0 90 H 100" />
                <path className="monitor-chart-receive" d={networkPath(history, "receive")} />
                <path className="monitor-chart-send" d={networkPath(history, "send")} />
              </svg>
            </div>
            <div className="monitor-chart-legend">
              <span>
                <i className="is-receive" />
                受信速度
              </span>
              <span>
                <i className="is-send" />
                送信速度
              </span>
              <span>直近60サンプル</span>
            </div>
          </>
        ) : (
          <p className="monitor-unavailable">この実行環境ではネットワーク統計を取得できません。</p>
        )}
      </section>

      <section aria-labelledby="monitor-system-title">
        <h2 className="section-title" id="monitor-system-title">
          システム情報
        </h2>
        <dl className="monitor-system-grid">
          <div>
            <dt>OS</dt>
            <dd>{system?.os ?? "—"}</dd>
          </div>
          <div>
            <dt>CPU</dt>
            <dd>{system?.cpuModel ?? "—"}</dd>
          </div>
          <div>
            <dt>コア / スレッド</dt>
            <dd>{system ? `${system.physicalCores ?? "—"} / ${system.threads}` : "—"}</dd>
          </div>
          <div>
            <dt>メモリ総容量</dt>
            <dd>{formatBytes(system?.memoryTotal)}</dd>
          </div>
          <div>
            <dt>ストレージ総容量</dt>
            <dd>{formatBytes(system?.storageTotal)}</dd>
          </div>
          <div>
            <dt>稼働時間</dt>
            <dd>{formatDuration(system?.uptime)}</dd>
          </div>
          <div>
            <dt>現在時刻</dt>
            <dd>{system ? new Date(system.currentTime).toLocaleString("ja-JP") : "—"}</dd>
          </div>
        </dl>
        <p className="monitor-footnote">
          表示対象はWebコンテナの実行環境です。ホスト全体の監視値とは異なる場合があります。
        </p>
      </section>
    </div>
  );
}
