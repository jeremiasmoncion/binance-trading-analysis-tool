import { useBotOperationalLoop } from "../hooks/useBotOperationalLoop";

export function BotRuntimeHost() {
  useBotOperationalLoop();
  return null;
}
