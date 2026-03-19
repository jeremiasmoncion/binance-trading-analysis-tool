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

export function createBotConsumableFeed(
  bot: Bot,
  publishedSignals: PublishedSignal[],
  generatedAt = new Date().toISOString(),
): SignalFeed<BotConsumableSignal> {
  const items = publishedSignals.map((signal) => createBotConsumableSignal(bot, signal));
  return createSignalFeed("bot-specific", items, generatedAt);
}
