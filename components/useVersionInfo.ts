"use client";

import { useEffect, useState } from "react";

export const WEBSITE_VERSION = process.env.APP_VERSION || "unknown";

/**
 * This build's version and, in the two-site IIS setup, the API's: a mismatch means only one
 * site was updated. apiVersion is null while loading and "older" when the API has no version
 * yet. With website and API in one server there is nothing to compare, so no request is made.
 */
export function useVersionInfo() {
  const split = process.env.APP_TARGET === "web";
  const [apiVersion, setApiVersion] = useState<string | null>(split ? null : WEBSITE_VERSION);

  useEffect(() => {
    if (!split) return;
    fetch("/api/version", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        setApiVersion(r.ok && d?.version ? d.version : "older");
      })
      .catch(() => setApiVersion(null));
  }, [split]);

  return {
    website: WEBSITE_VERSION,
    api: apiVersion,
    mismatch: apiVersion !== null && apiVersion !== WEBSITE_VERSION,
  };
}
