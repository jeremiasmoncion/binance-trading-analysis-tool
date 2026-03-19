import { useRef, useSyncExternalStore } from "react";

type Listener = () => void;
type Updater<TState> = Partial<TState> | ((current: TState) => TState);

export interface DataPlaneStore<TState> {
  getState: () => TState;
  setState: (updater: Updater<TState>) => void;
  subscribe: (listener: Listener) => () => void;
  reset: () => void;
}

export type EqualityFn<TSelection> = (left: TSelection, right: TSelection) => boolean;

export function shallowEqualSelection<TSelection>(left: TSelection, right: TSelection) {
  if (Object.is(left, right)) return true;
  if (!left || !right) return false;
  if (typeof left !== "object" || typeof right !== "object") return false;

  const leftEntries = Object.entries(left as Record<string, unknown>);
  const rightEntries = Object.entries(right as Record<string, unknown>);
  if (leftEntries.length !== rightEntries.length) return false;

  return leftEntries.every(([key, value]) => Object.is(value, (right as Record<string, unknown>)[key]));
}

export function createDataPlaneStore<TState>(initialState: TState): DataPlaneStore<TState> {
  let state = initialState;
  const listeners = new Set<Listener>();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    getState: () => state,
    setState: (updater) => {
      const nextState = typeof updater === "function"
        ? (updater as (current: TState) => TState)(state)
        : { ...state, ...updater };

      if (Object.is(nextState, state)) return;
      state = nextState;
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset: () => {
      state = initialState;
      emit();
    },
  };
}

export function useDataPlaneStore<TState, TSelection>(
  store: DataPlaneStore<TState>,
  selector: (state: TState) => TSelection,
  isEqual: EqualityFn<TSelection> = Object.is,
) {
  const cacheRef = useRef<TSelection | undefined>(undefined);
  return useSyncExternalStore(
    store.subscribe,
    () => {
      const nextSelection = selector(store.getState());
      if (cacheRef.current !== undefined && isEqual(cacheRef.current, nextSelection)) {
        return cacheRef.current;
      }
      cacheRef.current = nextSelection;
      return nextSelection;
    },
    () => {
      const nextSelection = selector(store.getState());
      if (cacheRef.current !== undefined && isEqual(cacheRef.current, nextSelection)) {
        return cacheRef.current;
      }
      cacheRef.current = nextSelection;
      return nextSelection;
    },
  );
}
