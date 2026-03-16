import { useEffect, useMemo, useState } from "react";
import { watchlistService } from "../services/api";
import type { UserSession, WatchlistGroup } from "../types";

interface UseWatchlistOptions {
  currentUser: UserSession | null;
}

const GLOBAL_WATCHLIST_STATE_KEY = "crype-watchlists";

function normalizeCoin(value: unknown) {
  const raw = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return "";
  if (raw.includes("/")) return raw;
  if (raw.endsWith("USDT") && raw.length > 4) {
    return `${raw.slice(0, -4)}/USDT`;
  }
  return raw;
}

function normalizeListName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40) || "Principal";
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

function normalizeLists(value: unknown): WatchlistGroup[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const groups = value
    .map((item) => {
      const source = item as Partial<WatchlistGroup> | undefined;
      const name = normalizeListName(source?.name);
      if (!name || seen.has(name)) return null;
      seen.add(name);
      return {
        name,
        coins: normalizeWatchlist(source?.coins),
        isActive: Boolean(source?.isActive),
      } satisfies WatchlistGroup;
    })
    .filter((item): item is WatchlistGroup => Boolean(item));

  if (!groups.length) {
    return [{ name: "Principal", coins: [], isActive: true }];
  }

  if (!groups.some((item) => item.isActive)) {
    groups[0] = { ...groups[0], isActive: true };
  }

  return groups.map((item, index) => ({ ...item, isActive: index === groups.findIndex((entry) => entry.isActive) }));
}

function normalizeWatchlistState(value: unknown) {
  if (!value || typeof value !== "object") {
    return { lists: normalizeLists([]), activeListName: "Principal" };
  }

  const source = value as { lists?: unknown; activeListName?: unknown };
  const lists = normalizeLists(source.lists);
  const activeListName = normalizeListName(source.activeListName) || lists.find((item) => item.isActive)?.name || "Principal";

  return {
    lists: lists.map((item) => ({ ...item, isActive: item.name === activeListName })),
    activeListName,
  };
}

function serializeState(lists: WatchlistGroup[], activeListName: string) {
  return JSON.stringify({
    lists: lists.map((item) => ({
      name: item.name,
      coins: normalizeWatchlist(item.coins),
      isActive: item.name === activeListName,
    })),
    activeListName,
  });
}

export function useWatchlist({ currentUser }: UseWatchlistOptions) {
  const [lists, setLists] = useState<WatchlistGroup[]>([{ name: "Principal", coins: [], isActive: true }]);
  const [activeListName, setActiveListName] = useState("Principal");
  const [hydrated, setHydrated] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const globalRaw = window.localStorage.getItem(GLOBAL_WATCHLIST_STATE_KEY);
        const legacyGlobalRaw = window.localStorage.getItem("crype-watchlist");
        const parsedLegacy = currentUser
          ? normalizeWatchlist(JSON.parse(window.localStorage.getItem(getLegacyStorageKey(currentUser.username)) || "[]"))
          : [];

        const seedState = globalRaw
          ? normalizeWatchlistState(JSON.parse(globalRaw))
          : {
              lists: [
                {
                  name: "Principal",
                  coins: parsedLegacy.length
                    ? parsedLegacy
                    : legacyGlobalRaw
                      ? normalizeWatchlist(JSON.parse(legacyGlobalRaw))
                      : [],
                  isActive: true,
                },
              ],
              activeListName: "Principal",
            };

        if (active) {
          setLists(seedState.lists);
          setActiveListName(seedState.activeListName);
          setHydrated(true);
          setRemoteReady(!currentUser);
        }

        if (!currentUser) return;

        try {
          const payload = await watchlistService.list();
          const remoteLists = normalizeLists(payload.lists || []);
          const remoteActive = normalizeListName(payload.activeListName) || remoteLists.find((item) => item.isActive)?.name || "Principal";

          if (remoteLists.length) {
            if (active) {
              setLists(remoteLists.map((item) => ({ ...item, isActive: item.name === remoteActive })));
              setActiveListName(remoteActive);
              window.localStorage.setItem(GLOBAL_WATCHLIST_STATE_KEY, serializeState(remoteLists, remoteActive));
            }
          } else {
            const seedActiveList = seedState.activeListName || "Principal";
            await watchlistService.updateList(seedActiveList, { isActive: true }).catch(() => null);
            await watchlistService.replace(seedActiveList, seedState.lists.find((item) => item.name === seedActiveList)?.coins || []);
            if (active) {
              setLists(seedState.lists);
              setActiveListName(seedActiveList);
            }
          }
        } catch {
          if (active) {
            setLists(seedState.lists);
            setActiveListName(seedState.activeListName);
          }
        } finally {
          if (active) {
            setRemoteReady(true);
          }
        }
      } catch {
        if (active) {
          setLists([{ name: "Principal", coins: [], isActive: true }]);
          setActiveListName("Principal");
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
    if (!hydrated) return;
    window.localStorage.setItem(GLOBAL_WATCHLIST_STATE_KEY, serializeState(lists, activeListName));
  }, [activeListName, hydrated, lists]);

  const activeList = useMemo(
    () => lists.find((item) => item.name === activeListName) || lists[0] || { name: "Principal", coins: [], isActive: true },
    [activeListName, lists],
  );

  const watchlist = activeList?.coins || [];
  const watchlistSet = useMemo(() => new Set(watchlist.map((item) => normalizeCoin(item))), [watchlist]);

  async function syncLists(nextLists: WatchlistGroup[], nextActiveListName: string, remoteAction?: () => Promise<{ lists: WatchlistGroup[]; activeListName: string | null }>) {
    setLists(nextLists.map((item) => ({ ...item, isActive: item.name === nextActiveListName })));
    setActiveListName(nextActiveListName);

    if (!currentUser || !remoteReady || !remoteAction) return;

    try {
      const payload = await remoteAction();
      const normalized = normalizeLists(payload.lists || []);
      const activeName = normalizeListName(payload.activeListName) || normalized.find((item) => item.isActive)?.name || "Principal";
      setLists(normalized.map((item) => ({ ...item, isActive: item.name === activeName })));
      setActiveListName(activeName);
    } catch {
      // keep optimistic local state if remote sync fails
    }
  }

  return {
    lists,
    activeListName,
    activeList,
    watchlist,
    watchlistSet,
    isWatched(coin: string) {
      return watchlistSet.has(normalizeCoin(coin));
    },
    async setActiveList(name: string) {
      const normalizedName = normalizeListName(name);
      if (!lists.some((item) => item.name === normalizedName)) return;
      await syncLists(
        lists.map((item) => ({ ...item, isActive: item.name === normalizedName })),
        normalizedName,
        () => watchlistService.updateList(normalizedName, { isActive: true }),
      );
    },
    async toggleWatchlist(coin: string) {
      const normalizedCoin = normalizeCoin(coin);
      const nextCoins = watchlist.includes(normalizedCoin)
        ? watchlist.filter((item) => item !== normalizedCoin)
        : [normalizedCoin, ...watchlist];
      const nextLists = lists.map((item) => (item.name === activeListName ? { ...item, coins: nextCoins } : item));
      await syncLists(nextLists, activeListName, () => watchlistService.replace(activeListName, nextCoins));
    },
    async createList(name: string) {
      const normalizedName = normalizeListName(name);
      if (lists.some((item) => item.name === normalizedName)) return;
      const nextLists = [...lists.map((item) => ({ ...item, isActive: false })), { name: normalizedName, coins: [], isActive: true }];
      await syncLists(nextLists, normalizedName, () => watchlistService.createList(normalizedName));
    },
    async renameList(name: string, nextName: string) {
      const normalizedName = normalizeListName(name);
      const normalizedNext = normalizeListName(nextName);
      if (normalizedName === normalizedNext || lists.some((item) => item.name === normalizedNext)) return;
      const nextLists = lists.map((item) => (item.name === normalizedName ? { ...item, name: normalizedNext } : item));
      await syncLists(nextLists, activeListName === normalizedName ? normalizedNext : activeListName, () => watchlistService.updateList(normalizedName, { nextName: normalizedNext }));
    },
    async deleteList(name: string) {
      const normalizedName = normalizeListName(name);
      if (lists.length <= 1 || !lists.some((item) => item.name === normalizedName)) return;
      const remaining = lists.filter((item) => item.name !== normalizedName);
      const nextActive = activeListName === normalizedName ? remaining[0].name : activeListName;
      await syncLists(remaining, nextActive, () => watchlistService.deleteList(normalizedName));
    },
    async replaceListCoins(name: string, coins: string[]) {
      const normalizedName = normalizeListName(name);
      const nextCoins = normalizeWatchlist(coins);
      if (!lists.some((item) => item.name === normalizedName)) return;
      const nextLists = lists.map((item) => (item.name === normalizedName ? { ...item, coins: nextCoins } : item));
      await syncLists(nextLists, activeListName, () => watchlistService.replace(normalizedName, nextCoins));
    },
  };
}
