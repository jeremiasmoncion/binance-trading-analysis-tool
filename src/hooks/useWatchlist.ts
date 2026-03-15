import { useEffect, useMemo, useState } from "react";
import { watchlistService } from "../services/api";
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
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => {
          const raw = item.trim().toUpperCase();
          if (raw.includes("/")) return raw;
          if (raw.endsWith("USDT") && raw.length > 4) {
            return `${raw.slice(0, -4)}/USDT`;
          }
          return raw;
        }),
    ),
  );
}

export function useWatchlist({ currentUser }: UseWatchlistOptions) {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const globalRaw = window.localStorage.getItem(GLOBAL_WATCHLIST_KEY);
        const parsedGlobal = globalRaw ? normalizeWatchlist(JSON.parse(globalRaw)) : [];

        if (active) {
          setWatchlist(parsedGlobal);
          setHydrated(true);
        }

        if (!currentUser) return;

        try {
          const payload = await watchlistService.list();
          const remoteCoins = normalizeWatchlist(payload.coins || []);
          if (active && remoteCoins.length) {
            setWatchlist(remoteCoins);
            window.localStorage.setItem(GLOBAL_WATCHLIST_KEY, JSON.stringify(remoteCoins));
            window.localStorage.setItem(getLegacyStorageKey(currentUser.username), JSON.stringify(remoteCoins));
            return;
          }

          if (active && !remoteCoins.length && parsedGlobal.length) {
            await watchlistService.replace(parsedGlobal);
          }
        } catch {
          if (!parsedGlobal.length && currentUser) {
            const legacyRaw = window.localStorage.getItem(getLegacyStorageKey(currentUser.username));
            const parsedLegacy = legacyRaw ? normalizeWatchlist(JSON.parse(legacyRaw)) : [];
            if (active && parsedLegacy.length) {
              setWatchlist(parsedLegacy);
              window.localStorage.setItem(GLOBAL_WATCHLIST_KEY, JSON.stringify(parsedLegacy));
            }
          }
        }
      } catch {
        if (active) {
          setWatchlist([]);
          setHydrated(true);
        }
      }
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(GLOBAL_WATCHLIST_KEY, JSON.stringify(watchlist));
    if (currentUser) {
      window.localStorage.setItem(getLegacyStorageKey(currentUser.username), JSON.stringify(watchlist));
      void watchlistService.replace(watchlist).catch(() => {
        // keep local state if remote sync fails
      });
    }
  }, [currentUser, hydrated, watchlist]);

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
