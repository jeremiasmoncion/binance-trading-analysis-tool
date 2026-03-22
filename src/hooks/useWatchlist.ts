import { useCallback, useEffect, useMemo, useState } from "react";
import { watchlistService } from "../services/api";
import { showToast, startLoading, stopLoading } from "../lib/ui-events";
import type { UserSession, WatchlistGroup } from "../types";

interface UseWatchlistOptions {
  currentUser: UserSession | null;
}

const WATCHLIST_STATE_KEY_PREFIX = "crype-watchlists";

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

function getWatchlistStorageKey(username: string | null | undefined) {
  const normalized = String(username || "").trim().toLowerCase();
  return normalized ? `${WATCHLIST_STATE_KEY_PREFIX}:${normalized}` : WATCHLIST_STATE_KEY_PREFIX;
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

function hasWatchlistGroupsChanged(current: WatchlistGroup[], next: WatchlistGroup[]) {
  if (current === next) return false;
  if (current.length !== next.length) return true;

  for (let index = 0; index < current.length; index += 1) {
    const currentGroup = current[index];
    const nextGroup = next[index];
    if (
      currentGroup.name !== nextGroup.name
      || currentGroup.isActive !== nextGroup.isActive
      || currentGroup.coins.length !== nextGroup.coins.length
    ) {
      return true;
    }

    for (let coinIndex = 0; coinIndex < currentGroup.coins.length; coinIndex += 1) {
      if (currentGroup.coins[coinIndex] !== nextGroup.coins[coinIndex]) {
        return true;
      }
    }
  }

  return false;
}

export function useWatchlist({ currentUser }: UseWatchlistOptions) {
  const [lists, setLists] = useState<WatchlistGroup[]>([{ name: "Principal", coins: [], isActive: true }]);
  const [activeListName, setActiveListName] = useState("Principal");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const storageKey = getWatchlistStorageKey(currentUser?.username);
        const globalRaw = window.localStorage.getItem(storageKey);
        const legacyScopedRaw = currentUser
          ? window.localStorage.getItem(getLegacyStorageKey(currentUser.username))
          : null;
        const legacyGlobalRaw = window.localStorage.getItem("crype-watchlist");
        const parsedLegacy = currentUser
          ? normalizeWatchlist(JSON.parse(legacyScopedRaw || "[]"))
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
          setLists((current) => (hasWatchlistGroupsChanged(current, seedState.lists) ? seedState.lists : current));
          setActiveListName((current) => (current !== seedState.activeListName ? seedState.activeListName : current));
          setHydrated(true);
        }

        if (!currentUser) return;

        try {
          const payload = await watchlistService.list();
          const remoteLists = normalizeLists(payload.lists || []);
          const remoteActive = normalizeListName(payload.activeListName) || remoteLists.find((item) => item.isActive)?.name || "Principal";

          if (remoteLists.length) {
            if (active) {
              const nextLists = remoteLists.map((item) => ({ ...item, isActive: item.name === remoteActive }));
              setLists((current) => (hasWatchlistGroupsChanged(current, nextLists) ? nextLists : current));
              setActiveListName((current) => (current !== remoteActive ? remoteActive : current));
              window.localStorage.setItem(storageKey, serializeState(remoteLists, remoteActive));
            }
          } else {
            const seedActiveList = seedState.activeListName || "Principal";
            await watchlistService.updateList(seedActiveList, { isActive: true }).catch(() => null);
            await watchlistService.replace(seedActiveList, seedState.lists.find((item) => item.name === seedActiveList)?.coins || []);
            if (active) {
              setLists((current) => (hasWatchlistGroupsChanged(current, seedState.lists) ? seedState.lists : current));
              setActiveListName((current) => (current !== seedActiveList ? seedActiveList : current));
            }
          }
        } catch {
          if (active) {
            setLists((current) => (hasWatchlistGroupsChanged(current, seedState.lists) ? seedState.lists : current));
            setActiveListName((current) => (current !== seedState.activeListName ? seedState.activeListName : current));
          }
        }
      } catch {
        if (active) {
          const fallbackLists = [{ name: "Principal", coins: [], isActive: true }];
          setLists((current) => (hasWatchlistGroupsChanged(current, fallbackLists) ? fallbackLists : current));
          setActiveListName((current) => (current !== "Principal" ? "Principal" : current));
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
    window.localStorage.setItem(getWatchlistStorageKey(currentUser?.username), serializeState(lists, activeListName));
  }, [activeListName, currentUser?.username, hydrated, lists]);

  const activeList = useMemo(
    () => lists.find((item) => item.name === activeListName) || lists[0] || { name: "Principal", coins: [], isActive: true },
    [activeListName, lists],
  );

  const watchlist = activeList?.coins || [];
  const watchlistSet = useMemo(() => new Set(watchlist.map((item) => normalizeCoin(item))), [watchlist]);

  const syncLists = useCallback(async (
    nextLists: WatchlistGroup[],
    nextActiveListName: string,
    remoteAction?: () => Promise<{ lists: WatchlistGroup[]; activeListName: string | null }>,
  ) => {
    const optimisticLists = nextLists.map((item) => ({ ...item, isActive: item.name === nextActiveListName }));
    setLists((current) => (hasWatchlistGroupsChanged(current, optimisticLists) ? optimisticLists : current));
    setActiveListName((current) => (current !== nextActiveListName ? nextActiveListName : current));

    if (!currentUser || !remoteAction) return;

    try {
      // Watchlists treat localStorage as a warm cache only. Once a user has a
      // session, the remote payload stays canonical even if the first hydrate
      // came from cache to avoid keeping a parallel source of truth alive.
      const payload = await remoteAction();
      const normalized = normalizeLists(payload.lists || []);
      const activeName = normalizeListName(payload.activeListName) || normalized.find((item) => item.isActive)?.name || "Principal";
      const syncedLists = normalized.map((item) => ({ ...item, isActive: item.name === activeName }));
      // Remote watchlist syncs often echo the optimistic state back verbatim.
      // Ignore equivalent list payloads so the shared system plane does not
      // rerender on every successful mutation or hydration round-trip.
      setLists((current) => (hasWatchlistGroupsChanged(current, syncedLists) ? syncedLists : current));
      setActiveListName((current) => (current !== activeName ? activeName : current));
      window.localStorage.setItem(getWatchlistStorageKey(currentUser?.username), serializeState(normalized, activeName));
    } catch {
      // keep optimistic local state if remote sync fails
    }
  }, [currentUser]);

  // Keep watchlist actions referentially stable so the shared data plane can
  // expose them without re-publishing handlers on every render.
  const isWatched = useCallback((coin: string) => (
    watchlistSet.has(normalizeCoin(coin))
  ), [watchlistSet]);

  const setActiveList = useCallback(async (name: string) => {
    const normalizedName = normalizeListName(name);
    if (!lists.some((item) => item.name === normalizedName)) return;
    const loaderId = startLoading({ label: "Cambiando lista activa", detail: normalizedName });
    try {
      await syncLists(
        lists.map((item) => ({ ...item, isActive: item.name === normalizedName })),
        normalizedName,
        () => watchlistService.updateList(normalizedName, { isActive: true }),
      );
      showToast({
        tone: "success",
        title: "Lista activa actualizada",
        message: `${normalizedName} ahora alimenta las señales automáticas.`,
      });
    } finally {
      stopLoading(loaderId);
    }
  }, [lists, syncLists]);

  const toggleWatchlist = useCallback(async (coin: string) => {
    const normalizedCoin = normalizeCoin(coin);
    const nextCoins = watchlist.includes(normalizedCoin)
      ? watchlist.filter((item) => item !== normalizedCoin)
      : [normalizedCoin, ...watchlist];
    const nextLists = lists.map((item) => (item.name === activeListName ? { ...item, coins: nextCoins } : item));
    const loaderId = startLoading({ label: "Actualizando watchlist", detail: normalizedCoin });
    try {
      await syncLists(nextLists, activeListName, () => watchlistService.replace(activeListName, nextCoins));
      showToast({
        tone: watchlist.includes(normalizedCoin) ? "info" : "success",
        title: watchlist.includes(normalizedCoin) ? "Moneda removida" : "Moneda agregada",
        message: watchlist.includes(normalizedCoin)
          ? `${normalizedCoin} salió de ${activeListName}.`
          : `${normalizedCoin} ya quedó vigilada en ${activeListName}.`,
      });
    } finally {
      stopLoading(loaderId);
    }
  }, [activeListName, lists, syncLists, watchlist]);

  const createList = useCallback(async (name: string) => {
    const normalizedName = normalizeListName(name);
    if (lists.some((item) => item.name === normalizedName)) return;
    const nextLists = [...lists.map((item) => ({ ...item, isActive: false })), { name: normalizedName, coins: [], isActive: true }];
    const loaderId = startLoading({ label: "Creando lista", detail: normalizedName });
    try {
      await syncLists(nextLists, normalizedName, () => watchlistService.createList(normalizedName));
      showToast({
        tone: "success",
        title: "Lista creada",
        message: `${normalizedName} ya está lista para organizar monedas.`,
      });
    } finally {
      stopLoading(loaderId);
    }
  }, [lists, syncLists]);

  const renameList = useCallback(async (name: string, nextName: string) => {
    const normalizedName = normalizeListName(name);
    const normalizedNext = normalizeListName(nextName);
    if (normalizedName === normalizedNext || lists.some((item) => item.name === normalizedNext)) return;
    const nextLists = lists.map((item) => (item.name === normalizedName ? { ...item, name: normalizedNext } : item));
    const loaderId = startLoading({ label: "Renombrando lista", detail: `${normalizedName} → ${normalizedNext}` });
    try {
      await syncLists(nextLists, activeListName === normalizedName ? normalizedNext : activeListName, () => watchlistService.updateList(normalizedName, { nextName: normalizedNext }));
      showToast({
        tone: "success",
        title: "Lista renombrada",
        message: `${normalizedName} ahora se llama ${normalizedNext}.`,
      });
    } finally {
      stopLoading(loaderId);
    }
  }, [activeListName, lists, syncLists]);

  const deleteList = useCallback(async (name: string) => {
    const normalizedName = normalizeListName(name);
    if (lists.length <= 1 || !lists.some((item) => item.name === normalizedName)) return;
    const remaining = lists.filter((item) => item.name !== normalizedName);
    const nextActive = activeListName === normalizedName ? remaining[0].name : activeListName;
    const loaderId = startLoading({ label: "Eliminando lista", detail: normalizedName });
    try {
      await syncLists(remaining, nextActive, () => watchlistService.deleteList(normalizedName));
      showToast({
        tone: "warning",
        title: "Lista eliminada",
        message: `${normalizedName} salió del sistema. ${nextActive} queda activa.`,
      });
    } finally {
      stopLoading(loaderId);
    }
  }, [activeListName, lists, syncLists]);

  const replaceListCoins = useCallback(async (name: string, coins: string[]) => {
    const normalizedName = normalizeListName(name);
    const nextCoins = normalizeWatchlist(coins);
    if (!lists.some((item) => item.name === normalizedName)) return;
    const nextLists = lists.map((item) => (item.name === normalizedName ? { ...item, coins: nextCoins } : item));
    const loaderId = startLoading({ label: "Reordenando lista", detail: normalizedName });
    try {
      await syncLists(nextLists, activeListName, () => watchlistService.replace(normalizedName, nextCoins));
      showToast({
        tone: "success",
        title: "Lista actualizada",
        message: `${normalizedName} ya refleja tu nueva selección de monedas.`,
      });
    } finally {
      stopLoading(loaderId);
    }
  }, [activeListName, lists, syncLists]);

  return {
    lists,
    activeListName,
    activeList,
    watchlist,
    watchlistSet,
    isWatched,
    setActiveList,
    toggleWatchlist,
    createList,
    renameList,
    deleteList,
    replaceListCoins,
  };
}
