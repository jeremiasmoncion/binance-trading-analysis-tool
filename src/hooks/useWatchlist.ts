import { useEffect, useMemo, useState } from "react";
import { watchlistService } from "../services/api";
import type { UserSession } from "../types";

interface UseWatchlistOptions {
  currentUser: UserSession | null;
}

const GLOBAL_WATCHLIST_KEY = "crype-watchlist";

function normalizeCoin(value: unknown) {
  const raw = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return "";
  if (raw.includes("/")) return raw;
  if (raw.endsWith("USDT") && raw.length > 4) {
    return `${raw.slice(0, -4)}/USDT`;
  }
  return raw;
}

function getLegacyStorageKey(username: string) {
  return `crype-watchlist:${username}`;
}

function normalizeWatchlist(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => normalizeCoin(item)),
    ),
  );
}

export function useWatchlist({ currentUser }: UseWatchlistOptions) {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const globalRaw = window.localStorage.getItem(GLOBAL_WATCHLIST_KEY);
        const parsedGlobal = globalRaw ? normalizeWatchlist(JSON.parse(globalRaw)) : [];
        const parsedLegacy = currentUser
          ? normalizeWatchlist(JSON.parse(window.localStorage.getItem(getLegacyStorageKey(currentUser.username)) || "[]"))
          : [];
        const seedCoins = parsedGlobal.length ? parsedGlobal : parsedLegacy;

        if (active) {
          setWatchlist(seedCoins);
          setHydrated(true);
          setRemoteReady(!currentUser);
        }

        if (!currentUser) return;

        try {
          const payload = await watchlistService.list();
          const remoteCoins = normalizeWatchlist(payload.coins || []);
          if (remoteCoins.length) {
            if (active) {
              setWatchlist(remoteCoins);
              window.localStorage.setItem(GLOBAL_WATCHLIST_KEY, JSON.stringify(remoteCoins));
              window.localStorage.setItem(getLegacyStorageKey(currentUser.username), JSON.stringify(remoteCoins));
            }
          } else if (seedCoins.length) {
            await watchlistService.replace(seedCoins);
            if (active) {
              setWatchlist(seedCoins);
            }
          }
        } catch {
          if (active && seedCoins.length) {
            setWatchlist(seedCoins);
            window.localStorage.setItem(GLOBAL_WATCHLIST_KEY, JSON.stringify(seedCoins));
          }
        } finally {
          if (active) {
            setRemoteReady(true);
          }
        }
      } catch {
        if (active) {
          setWatchlist([]);
          setHydrated(true);
          setRemoteReady(!currentUser);
        }
      }
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!hydrated || (currentUser && !remoteReady)) return;
    window.localStorage.setItem(GLOBAL_WATCHLIST_KEY, JSON.stringify(watchlist));
    if (currentUser) {
      window.localStorage.setItem(getLegacyStorageKey(currentUser.username), JSON.stringify(watchlist));
      void watchlistService.replace(watchlist).catch(() => {
        // keep local state if remote sync fails
      });
    }
  }, [currentUser, hydrated, remoteReady, watchlist]);

  const watchlistSet = useMemo(() => new Set(watchlist), [watchlist]);

  return {
    watchlist,
    watchlistSet,
    isWatched(coin: string) {
      return watchlistSet.has(normalizeCoin(coin));
    },
    toggleWatchlist(coin: string) {
      const normalizedCoin = normalizeCoin(coin);
      setWatchlist((current) =>
        current.includes(normalizedCoin)
          ? current.filter((item) => item !== normalizedCoin)
          : [normalizedCoin, ...current],
      );
    },
  };
}
