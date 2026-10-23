"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL = 30_000;

export default function RankingDataLoader({ preloadRankings = false }) {
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    if (preloadRankings) {
      const warmRankings = async () => {
        const requests = ["count", "casino"].map(async (mode) => {
          const query = new URLSearchParams({
            mode,
            period: "total",
            limit: "50",
            includeAffiliations: "false",
          });
          const response = await fetch(`/api/rankings?${query}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`ランキングの先行取得に失敗しました (${response.status})`);
          }
          await response.arrayBuffer();
        });

        try {
          await Promise.all(requests);
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error("ランキングの先行取得に失敗しました。", error);
          }
        }
      };

      void warmRankings();
    }

    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, REFRESH_INTERVAL);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [preloadRankings, router]);

  return null;
}
