import type { ExecutionCandidate } from "../../types";
import type { Bot } from "../bots/contracts";
import {
  createBotConsumableSignal,
  createSignalFeed,
  createSystemSignalFromCandidate,
  publishSystemSignal,
} from "./classification";
import type { BotConsumableSignal, PublishedSignal, SignalFeed, SignalFeedKind } from "./contracts";

export interface PublishedSignalFeedInput {
  audience: PublishedSignal["audience"];
  kind: SignalFeedKind;
  generatedAt?: string;
}

export interface CandidateSignalFeedBundle {
  all: SignalFeed<PublishedSignal>;
  watchlist: SignalFeed<PublishedSignal>;
  marketWide: SignalFeed<PublishedSignal>;
}

function isWatchlistCandidate(candidate: ExecutionCandidate, watchlistSymbols: Set<string>) {
  return watchlistSymbols.has(String(candidate.symbol || candidate.coin || "").toUpperCase());
}

export function createPublishedSignalFeedFromCandidates(
  candidates: ExecutionCandidate[],
  input: PublishedSignalFeedInput,
): SignalFeed<PublishedSignal> {
  const observedAt = input.generatedAt ?? new Date().toISOString();
  const items = candidates.map((candidate) => publishSystemSignal(createSystemSignalFromCandidate(candidate, observedAt), {
    audience: input.audience,
    feedKinds: [input.kind],
  }));

  return createSignalFeed(input.kind, items, observedAt);
}

export function createPublishedSignalFeedBundleFromCandidates(
  candidates: ExecutionCandidate[],
  input: {
    watchlistSymbols?: string[];
    generatedAt?: string;
  } = {},
): CandidateSignalFeedBundle {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const watchlistSymbols = new Set((input.watchlistSymbols || []).map((item) => String(item || "").toUpperCase()));
  const watchlistCandidates = candidates.filter((candidate) => isWatchlistCandidate(candidate, watchlistSymbols));
  const marketWideCandidates = candidates.filter((candidate) => !isWatchlistCandidate(candidate, watchlistSymbols));

  return {
    all: createSignalFeed("market-wide", [
      ...createPublishedSignalFeedFromCandidates(watchlistCandidates, {
        audience: "watchlist",
        kind: "watchlist",
        generatedAt,
      }).items,
      ...createPublishedSignalFeedFromCandidates(marketWideCandidates, {
        audience: "market",
        kind: "market-wide",
        generatedAt,
      }).items,
    ], generatedAt),
    watchlist: createPublishedSignalFeedFromCandidates(watchlistCandidates, {
      audience: "watchlist",
      kind: "watchlist",
      generatedAt,
    }),
    marketWide: createPublishedSignalFeedFromCandidates(marketWideCandidates, {
      audience: "market",
      kind: "market-wide",
      generatedAt,
    }),
  };
}

export function createBotConsumableFeed(
  bot: Bot,
  publishedSignals: PublishedSignal[],
  generatedAt = new Date().toISOString(),
): SignalFeed<BotConsumableSignal> {
  const items = publishedSignals.map((signal) => createBotConsumableSignal(bot, signal));
  return createSignalFeed("bot-specific", items, generatedAt);
}
