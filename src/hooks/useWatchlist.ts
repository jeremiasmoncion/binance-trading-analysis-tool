import { useEffect, useMemo, useState } from "react";
import type { UserSession } from "../types";

interface UseWatchlistOptions {
  currentUser: UserSession | null;
}

function getStorageKey(username: string) {
  return `crype-watchlist:${username}`;
}

export function useWatchlist({ currentUser }: UseWatchlistOptions) {
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setWatchlist([]);
      return;
    }

    const raw = window.localStorage.getItem(getStorageKey(currentUser.username));
    if (!raw) {
      setWatchlist([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setWatchlist(Array.isArray(parsed) ? parsed : []);
    } catch {
      setWatchlist([]);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    window.localStorage.setItem(getStorageKey(currentUser.username), JSON.stringify(watchlist));
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
