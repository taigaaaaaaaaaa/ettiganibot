"use client";

import { useEffect, useState } from "react";

export default function LoadingTransition({ children }) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("loading.");
  const [isFading, setIsFading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

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
    </>
  );
}
