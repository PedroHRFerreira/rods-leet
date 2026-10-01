import { useEffect, useRef } from "react";
import type { PublicSubmission } from "../lib/contracts";
import {
  resultReactionLedger,
  resultReactionTone,
  type ResultReactionKind,
} from "./resultReactionState";

export interface ResultReactionProps {
  submission: PublicSubmission;
  identity: string;
  kind: ResultReactionKind;
  /** Disable for results restored from history/cache instead of a live response. */
  animate?: boolean;
}

export function ResultReaction({
  submission,
  identity,
  kind,
  animate = true,
}: ResultReactionProps) {
  const element = useRef<HTMLSpanElement>(null);
  const tone = resultReactionTone(submission, kind);

  useEffect(() => {
    const target = element.current;
    if (!target || !tone) return;
    // An effect replay in StrictMode keeps the same element and claim.
    if (target.dataset.claim === `${identity}:${submission.id}`) return;
    target.removeAttribute("data-play");
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      // Browser storage is optional; the ledger still prevents page-local replay.
    }
    if (
      animate &&
      resultReactionLedger.claim(identity, submission.id, storage)
    ) {
      target.dataset.claim = `${identity}:${submission.id}`;
      target.dataset.play = "true";
    }
  }, [animate, identity, submission.id, tone]);

  if (!tone || !animate) return null;
  return (
    <span
      key={`${identity}:${submission.id}`}
      ref={element}
      className={`result-reaction result-reaction--${tone}`}
      aria-hidden="true"
    >
      <svg
        className="result-reaction-mark"
        viewBox="0 0 48 48"
        width="48"
        height="48"
        fill="none"
        focusable="false"
      >
        <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="2" />
        {tone === "success" ? (
          <path
            d="m16 24 5 5 11-11"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <path
              d="M31 18a10 10 0 1 0 2 11M31 13v7h-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>
      {tone === "success" &&
        Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className={`result-reaction-spark result-reaction-spark--${index}`}
          />
        ))}
    </span>
  );
}
