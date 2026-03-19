import type { useBinanceData } from "../hooks/useBinanceData";
import type { useMarketData } from "../hooks/useMarketData";
import type { useSignalMemory } from "../hooks/useSignalMemory";
import type { useWatchlist } from "../hooks/useWatchlist";

export type ReturnTypeUseMarketData = ReturnType<typeof useMarketData>;
export type ReturnTypeUseBinanceData = ReturnType<typeof useBinanceData>;
export type ReturnTypeUseSignalMemory = ReturnType<typeof useSignalMemory>;
export type ReturnTypeUseWatchlist = ReturnType<typeof useWatchlist>;
