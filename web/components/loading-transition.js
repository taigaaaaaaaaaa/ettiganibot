"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationCompletion() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    window.dispatchEvent(new Event("ettigani:loading-end"));
  }, [pathname, search]);

  return null;
}

export default function LoadingTransition({ children }) {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("loading.");
  const [isFading, setIsFading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    let hideTimer;
    let urlTimer;
    let loadingStartUrl;

    function finishLoading() {
      window.clearTimeout(hideTimer);
      window.clearInterval(urlTimer);
      setIsActionLoading(false);
    }

    function startLoading() {
      window.clearTimeout(hideTimer);
      window.clearInterval(urlTimer);
      loadingStartUrl = window.location.href;
      setIsActionLoading(true);
      urlTimer = window.setInterval(() => {
        if (window.location.href !== loadingStartUrl) finishLoading();
      }, 100);
      hideTimer = window.setTimeout(finishLoading, 20_000);
    }

    function handleClick(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest("button");
      if (button && !button.disabled && !button.hasAttribute("data-loading-exempt")) {
        if (button.type !== "submit") startLoading();
        return;
      }

      const link = target.closest("a[href]");
      if (
        !link ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.hasAttribute("download") ||
        link.target === "_blank"
      ) {
        return;
      }
      if (link.getAttribute("href")?.startsWith("#")) return;
      startLoading();
    }

    function handleSubmit() {
      startLoading();
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("ettigani:loading-end", finishLoading);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearInterval(urlTimer);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("ettigani:loading-end", finishLoading);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new Event("ettigani:loading-end"));
  }, [pathname]);

  useEffect(() => {
    let currentProgress = 0;
    let dotCount = 1;
    let fadeTimer;
    let hideTimer;

    const dotTimer = setInterval(() => {
      dotCount = (dotCount % 3) + 1;
      setMessage(`loading${".".repeat(dotCount)}`);
    }, 400);

    const progressTimer = setInterval(() => {
      currentProgress = Math.min(currentProgress + 2, 100);
      setProgress(currentProgress);

      if (currentProgress === 100) {
        clearInterval(progressTimer);
        clearInterval(dotTimer);
        setMessage("えっちがにbotへようこそ");

        fadeTimer = setTimeout(() => {
          setIsFading(true);
        }, 1200);
        hideTimer = setTimeout(() => {
          setIsVisible(false);
        }, 2200);
      }
    }, 70);

    return () => {
      clearInterval(dotTimer);
      clearInterval(progressTimer);
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <>
      {children}
      {isVisible ? (
        <div
          aria-live="polite"
          className={`loading-screen${isFading ? " is-fading" : ""}`}
          role="status"
        >
          <span aria-hidden="true" className="crab">
            🦀
          </span>
          <div className="loading-box">
            <div
              aria-label="読み込み中"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progress}
              className="loading-bar"
              role="progressbar"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="loading-text">{message}</p>
        </div>
      ) : null}
      {isActionLoading ? (
        <div aria-live="polite" className="action-loading-indicator" role="status">
          <span aria-hidden="true" className="page-loading-spinner" />
          <span>読み込み中...</span>
        </div>
      ) : null}
      <Suspense fallback={null}>
        <NavigationCompletion />
      </Suspense>
    </>
  );
}
