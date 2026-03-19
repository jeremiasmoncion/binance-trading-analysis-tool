import { useSyncExternalStore } from "react";

type Listener = () => void;
type Updater<TState> = Partial<TState> | ((current: TState) => TState);

export interface DataPlaneStore<TState> {
  getState: () => TState;
  setState: (updater: Updater<TState>) => void;
  subscribe: (listener: Listener) => () => void;
  reset: () => void;
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
) {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
