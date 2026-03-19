import type { MarketDataPlane, SystemDataPlane } from "../data-platform/contracts";
import type { RealtimeCoreBootstrapPayload, RealtimeCoreEventEnvelope } from "./contracts";

export interface RealtimeCoreState {
  bootstrappedAt: string | null;
  lastEventAt: string | null;
  market: MarketDataPlane | null;
  system: SystemDataPlane | null;
}

export const initialRealtimeCoreState: RealtimeCoreState = {
  bootstrappedAt: null,
  lastEventAt: null,
  market: null,
  system: null,
};

export function reduceRealtimeCoreBootstrap(
  state: RealtimeCoreState,
  bootstrap: RealtimeCoreBootstrapPayload,
  nextMarket: MarketDataPlane | null,
  nextSystem: SystemDataPlane | null,
): RealtimeCoreState {
  return {
    ...state,
    bootstrappedAt: bootstrap.generatedAt,
    market: nextMarket,
    system: nextSystem,
  };
}

export function reduceRealtimeCoreEvent(
  state: RealtimeCoreState,
  event: RealtimeCoreEventEnvelope,
  reducers: {
    applyMarket: (current: MarketDataPlane | null, event: RealtimeCoreEventEnvelope) => MarketDataPlane | null;
    applySystem: (current: SystemDataPlane | null, event: RealtimeCoreEventEnvelope) => SystemDataPlane | null;
  },
): RealtimeCoreState {
  return {
    ...state,
    lastEventAt: event.createdAt,
    market: reducers.applyMarket(state.market, event),
    system: reducers.applySystem(state.system, event),
  };
}
