"use client";

import { useEffect, useRef } from "react";

/**
 * Forms show their error at the top while the Save button is at the bottom, so on a phone
 * the message can be off screen. Put the returned ref on the error box: it scrolls into
 * view each time a new error appears.
 */
export function useRevealError(error: string | null) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [error]);
  return ref;
}
