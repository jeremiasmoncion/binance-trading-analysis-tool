import { useEffect, useMemo, useState } from "react";
import type { UserSession } from "../types";

interface UseWatchlistOptions {
  currentUser: UserSession | null;
}

const GLOBAL_WATCHLIST_KEY = "crype-watchlist";

function getLegacyStorageKey(username: string) {
  return `crype-watchlist:${username}`;
}

function normalizeWatchlist(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)));
}

export function useWatchlist({ currentUser }: UseWatchlistOptions) {
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    try {
      const globalRaw = window.localStorage.getItem(GLOBAL_WATCHLIST_KEY);
      const parsedGlobal = globalRaw ? normalizeWatchlist(JSON.parse(globalRaw)) : [];

      if (parsedGlobal.length) {
        setWatchlist(parsedGlobal);
        return;
      }

      if (currentUser) {
        const legacyRaw = window.localStorage.getItem(getLegacyStorageKey(currentUser.username));
        const parsedLegacy = legacyRaw ? normalizeWatchlist(JSON.parse(legacyRaw)) : [];
        if (parsedLegacy.length) {
          setWatchlist(parsedLegacy);
          window.localStorage.setItem(GLOBAL_WATCHLIST_KEY, JSON.stringify(parsedLegacy));
          return;
        }
      }

      setWatchlist([]);
    } catch {
      setWatchlist([]);
    }
  }, [currentUser]);

  useEffect(() => {
    window.localStorage.setItem(GLOBAL_WATCHLIST_KEY, JSON.stringify(watchlist));
    if (currentUser) {
      window.localStorage.setItem(getLegacyStorageKey(currentUser.username), JSON.stringify(watchlist));
    }
  }, [currentUser, watchlist]);

  const watchlistSet = useMemo(() => new Set(watchlist), [watchlist]);

  return {
    watchlist,
    watchlistSet,
    isWatched(coin: string) {
      return watchlistSet.has(coin);
    },
    toggleWatchlist(coin: string) {
      setWatchlist((current) =>
        current.includes(coin) ? current.filter((item) => item !== coin) : [coin, ...current],
      );
    },
  };
}
