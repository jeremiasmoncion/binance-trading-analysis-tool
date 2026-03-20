import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DownloadIcon, SearchIcon, SlidersHorizontalIcon, WarningTriangleIcon, BellIcon } from "../components/Icons";
import { useSignalsBotsReadModel } from "../hooks/useSignalsBotsReadModel";
import { useSelectedBotState } from "../hooks/useSelectedBot";
import { showToast, startLoading, stopLoading } from "../lib/ui-events";
import type { ViewName } from "../types";

type BotSettingsTab = "all-bots" | "general-settings" | "risk-management" | "notifications";
type BotStatusFilter = "all" | "running" | "paused" | "stopped";
type BotLayoutMode = "grid" | "table";

interface QuickEditDraft {
  mode: "create" | "edit";
  botId: string | null;
  botName: string;
  pair: string;
  strategy: string;
  investmentAmount: string;
  rangeLower: string;
  rangeUpper: string;
  gridCount: string;
  stopLossPct: string;
  takeProfitPct: string;
  autoCompoundProfits: boolean;
  accentClass: string;
}

interface QuickEditSource {
  id: string;
  name: string;
  pair: string;
  strategy: string;
  capital: {
    allocatedUsd: number;
  };
  workspaceSettings: {
    rangeLower: number | null;
    rangeUpper: number | null;
    gridCount: number | null;
    stopLossPct: number | null;
    takeProfitPct: number | null;
    autoCompoundProfits: boolean;
  };
  riskPolicy: {
    maxDrawdownPct: number;
  };
}

interface BotSettingsViewProps {
  onNavigateView: (view: ViewName) => void;
}

const BOT_TABS: Array<{ key: BotSettingsTab; label: string; icon: ReactNode }> = [
  { key: "all-bots", label: "All Bots", icon: <BotsTabIcon /> },
  { key: "general-settings", label: "General Settings", icon: <SlidersHorizontalIcon /> },
  { key: "risk-management", label: "Risk Management", icon: <ShieldTabIcon /> },
  { key: "notifications", label: "Notifications", icon: <BellIcon /> },
];

const INITIAL_GENERAL_SETTINGS = {
  defaultTradingPair: "BTC/USDT",
  defaultExchange: "Binance",
  baseCurrency: "USDT",
  family: "signal-core",
  ownerScope: "system" as "user" | "system" | "lab",
  executionEnvironment: "paper" as "paper" | "demo" | "real",
  automationMode: "observe" as "observe" | "assist" | "auto",
  operatingProfile: "manual-assisted" as "experimental" | "manual-assisted" | "automatic" | "unrestricted-ai",
  universeKind: "watchlist" as "watchlist" | "custom-list" | "hybrid" | "market-filter",
  customSymbolsText: "",
  dominantStyle: "swing" as "scalping" | "swing" | "long",
  allowedStyles: ["swing"] as Array<"scalping" | "swing" | "long">,
  preferredTimeframes: ["1h", "4h"] as string[],
  allowedTimeframes: ["15m", "1h", "4h"] as string[],
  executionOverlap: "allow-with-approval" as "block" | "allow-with-approval" | "allow",
  arbitrationMode: "priority" as "exclusive" | "priority" | "shared",
  orderSizeType: "fixed" as "fixed" | "percentage",
  autoRestartOnError: true,
  autoCompoundProfits: true,
  paperTradingMode: false,
  smartOrderRouting: true,
  antiSlippageProtection: true,
  analystEnabled: true,
  supervisorEnabled: true,
  unrestrictedModeEnabled: false,
  adaptiveAdjustmentsEnabled: true,
  requiresHumanApproval: true,
  autoExecutionEnabled: false,
  realExecutionEnabled: false,
  isIsolated: false,
  familySharingEnabled: false,
  globalLearningEnabled: false,
  allowPromotionToShared: false,
  requiresApprovalForSharedLearning: true,
  familyScope: "bot-family",
  executionSpeed: 50,
  apiRateLimit: 1200,
  maxConcurrentBots: 15,
  tradingScheduleEnabled: false,
  startTime: "09:00 AM",
  endTime: "05:00 PM",
  activeDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  timezone: "UTC",
};

const INITIAL_RISK_SETTINGS = {
  maximumDailyLossLimit: "500",
  maximumDrawdownPct: "15",
  maximumPositionSizePct: "25",
  maximumLeverage: "3x",
  globalStopLossEnabled: true,
  stopLossPct: "5",
  takeProfitPct: "10",
  trailingStopLossEnabled: true,
  trailingDistancePct: "2",
};

const INITIAL_NOTIFICATION_SETTINGS = {
  emailEnabled: true,
  emailAddress: "john@example.com",
  telegramEnabled: true,
  telegramHandle: "@johndoe",
  discordConnected: false,
  discordLabel: "Not connected",
  pushEnabled: true,
  pushLabel: "Mobile app",
  tradeExecuted: true,
  takeProfitHit: true,
  stopLossTriggered: true,
  botStatusChange: true,
  dailySummary: false,
  errorAlerts: true,
};

const STYLE_OPTIONS = ["scalping", "swing", "long"] as const;
const TIMEFRAME_OPTIONS = ["5m", "15m", "1h", "4h", "1d"] as const;
type GeneralSettingsState = typeof INITIAL_GENERAL_SETTINGS;

function buildGeneralSettingsState(selectedSettingsBot: any | null): GeneralSettingsState {
  if (!selectedSettingsBot) {
    return INITIAL_GENERAL_SETTINGS;
  }

  return {
    ...INITIAL_GENERAL_SETTINGS,
    ...selectedSettingsBot.generalSettings,
    defaultTradingPair: selectedSettingsBot.generalSettings?.defaultTradingPair || selectedSettingsBot.workspaceSettings.primaryPair || "BTC/USDT",
    autoCompoundProfits: selectedSettingsBot.generalSettings?.autoCompoundProfits ?? selectedSettingsBot.workspaceSettings.autoCompoundProfits,
    family: selectedSettingsBot.identity?.family || selectedSettingsBot.slug || "signal-core",
    ownerScope: selectedSettingsBot.identity?.ownerScope || "system",
    executionEnvironment: selectedSettingsBot.executionEnvironment || "paper",
    automationMode: selectedSettingsBot.automationMode || "observe",
    operatingProfile: selectedSettingsBot.identity?.operatingProfile || "manual-assisted",
    universeKind: selectedSettingsBot.universePolicy?.kind || "watchlist",
    customSymbolsText: Array.isArray(selectedSettingsBot.universePolicy?.symbols) ? selectedSettingsBot.universePolicy.symbols.join(", ") : "",
    dominantStyle: selectedSettingsBot.stylePolicy?.dominantStyle || "swing",
    allowedStyles: selectedSettingsBot.stylePolicy?.allowedStyles?.length ? selectedSettingsBot.stylePolicy.allowedStyles : ["swing"],
    preferredTimeframes: selectedSettingsBot.timeframePolicy?.preferredTimeframes?.length
      ? selectedSettingsBot.timeframePolicy.preferredTimeframes
      : ["1h", "4h"],
    allowedTimeframes: selectedSettingsBot.timeframePolicy?.allowedTimeframes?.length
      ? selectedSettingsBot.timeframePolicy.allowedTimeframes
      : ["15m", "1h", "4h"],
    executionOverlap: selectedSettingsBot.overlapPolicy?.executionOverlap || "allow-with-approval",
    arbitrationMode: selectedSettingsBot.overlapPolicy?.arbitrationMode || "priority",
    paperTradingMode: selectedSettingsBot.executionEnvironment === "paper",
    analystEnabled: selectedSettingsBot.aiPolicy?.analystEnabled ?? true,
    supervisorEnabled: selectedSettingsBot.aiPolicy?.supervisorEnabled ?? true,
    unrestrictedModeEnabled: selectedSettingsBot.aiPolicy?.unrestrictedModeEnabled ?? false,
    adaptiveAdjustmentsEnabled: selectedSettingsBot.strategyPolicy?.adaptiveAdjustmentsEnabled ?? true,
    requiresHumanApproval: selectedSettingsBot.executionPolicy?.requiresHumanApproval ?? true,
    autoExecutionEnabled: selectedSettingsBot.executionPolicy?.autoExecutionEnabled ?? false,
    realExecutionEnabled: selectedSettingsBot.executionPolicy?.realExecutionEnabled ?? false,
    isIsolated: selectedSettingsBot.identity?.isIsolated ?? false,
    familySharingEnabled: selectedSettingsBot.memoryPolicy?.familySharingEnabled ?? false,
    globalLearningEnabled: selectedSettingsBot.memoryPolicy?.globalLearningEnabled ?? false,
    allowPromotionToShared: selectedSettingsBot.memoryPolicy?.allowPromotionToShared ?? false,
    requiresApprovalForSharedLearning: selectedSettingsBot.memoryPolicy?.requiresApprovalForSharedLearning ?? true,
    familyScope: selectedSettingsBot.memoryPolicy?.familyScope || selectedSettingsBot.identity?.family || "bot-family",
  };
}

function buildNotificationSettingsState(selectedSettingsBot: { notificationSettings?: typeof INITIAL_NOTIFICATION_SETTINGS } | null) {
  return {
    ...INITIAL_NOTIFICATION_SETTINGS,
    ...(selectedSettingsBot?.notificationSettings || {}),
  };
}

function slugifyBotName(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "signal-bot";
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function summarizeAdaptationBias(value: string) {
  if (!value) return "Adaptation still converging";
  if (value.includes("keeping adaptive adjustments enabled")) return "Adaptive posture looks supported";
  if (value.includes("stay cautious")) return "Adaptive posture still cautious";
  return value;
}

export function BotSettingsView({ onNavigateView }: BotSettingsViewProps) {
  const [activeTab, setActiveTab] = useState<BotSettingsTab>("all-bots");
  const [statusFilter, setStatusFilter] = useState<BotStatusFilter>("all");
  const [layoutMode, setLayoutMode] = useState<BotLayoutMode>("grid");
  const [search, setSearch] = useState("");
  const [generalSettings, setGeneralSettings] = useState(INITIAL_GENERAL_SETTINGS);
  const [riskSettings, setRiskSettings] = useState(INITIAL_RISK_SETTINGS);
  const [notificationSettings, setNotificationSettings] = useState(INITIAL_NOTIFICATION_SETTINGS);
  const [quickEditDraft, setQuickEditDraft] = useState<QuickEditDraft | null>(null);
  const feedReadModel = useSignalsBotsReadModel();
  const { createBot, selectBot, updateBot, loading: botsLoading, error: botsError, hydrated: botsHydrated } = useSelectedBotState();
  const selectedSettingsBot = feedReadModel.selectedBotCard || feedReadModel.botCards[0] || null;

  const readModel = useMemo(() => {
    const cards = feedReadModel.botCards.map((bot) => {
      const topSignal = bot.leadingSignal;
      const pair = bot.workspaceSettings.primaryPair || topSignal?.context.symbol || inferBotPair(bot.slug, bot.name);
      const strategy = formatStrategyLabel(bot.strategyPolicy.preferredStrategyIds[0] || bot.tags[1] || bot.stylePolicy.dominantStyle);
      const trades24h = bot.localMemory.outcomeCount;
      const profit24h = bot.performance.realizedPnlUsd;
      const allocated = bot.capital.allocatedUsd;
      const capacity = Math.max(bot.riskPolicy.maxPositionUsd * bot.riskPolicy.maxOpenPositions, allocated, 1);
      return {
        ...bot,
        pair,
        strategy,
        trades24h,
        profit24h,
        winRate: bot.performance.winRate,
        allocationPct: Math.min((allocated / capacity) * 100, 100),
        capacityUsd: capacity,
        acceptedCount: bot.accepted,
        blockedCount: bot.blocked,
        ownedOutcomeCount: bot.ownership.ownedOutcomeCount,
        unresolvedOwnershipCount: bot.ownership.unresolvedDecisionCount + bot.ownership.unlinkedExecutionCount,
        reconciliationPct: bot.ownership.reconciliationPct,
        adaptationConfidence: bot.adaptationSummary?.trainingConfidence || "low",
        adaptationBias: bot.adaptationSummary?.adaptationBias || "Adaptation will stay conservative until owned outcomes improve.",
      };
    });

    const needle = search.trim().toLowerCase();
    const filteredCards = cards.filter((bot) => {
      const matchesStatus = statusFilter === "all"
        ? true
        : statusFilter === "running"
          ? bot.status === "active"
          : statusFilter === "paused"
            ? bot.status === "paused"
            : bot.status === "draft" || bot.status === "archived";
      const matchesSearch = needle
        ? [bot.name, bot.slug, bot.pair, bot.strategy].some((value) => value.toLowerCase().includes(needle))
        : true;
      return matchesStatus && matchesSearch;
    });

    return {
      cards,
      filteredCards,
      summary: feedReadModel.botSummary,
      tabs: {
        general: [
          {
            title: "Trading Mode",
            value: "Assist by default",
            note: "Bots remain visible and operator-approved before crossing into stronger execution modes.",
          },
          {
            title: "Universe Policy",
            value: "Watchlist + shared discovery",
            note: "Global settings stay anchored to shared watchlists and ranked market discovery.",
          },
          {
            title: "Capital Scope",
            value: "Shared policy, isolated bot ledgers",
            note: "Each bot stays measurable without breaking the platform-level accounting boundary.",
          },
          {
            title: "AI Governance",
            value: "Isolated labs only",
            note: "Any unrestricted profile remains isolated and never becomes the platform-wide default.",
          },
        ],
        risk: [
          {
            title: "Platform Daily Loss",
            value: "2.0%",
            note: "Shared protection before bot-specific aggression can escalate.",
          },
          {
            title: "Max Open Positions",
            value: "3 concurrent positions",
            note: "Keeps overlap pressure under control across the bot family.",
          },
          {
            title: "Max Symbol Exposure",
            value: "35% per market",
            note: "Prevents a single pair from dominating system capital.",
          },
          {
            title: "Real Execution Approval",
            value: "Human approval required",
            note: "The platform still holds the final approval wall for real orders.",
          },
        ],
        notifications: [
          {
            title: "Execution Alerts",
            value: "Enabled",
            note: "Important fills, pauses and failures stay visible to the operator.",
          },
          {
            title: "Risk Escalations",
            value: "Enabled",
            note: "The system raises warnings when a bot approaches policy limits.",
          },
          {
            title: "Daily Bot Digest",
            value: "Enabled",
            note: "Compact summaries replace noisy raw telemetry.",
          },
          {
            title: "Manual Escalation",
            value: "Control Panel",
            note: "High-risk events route back through the shared control surfaces.",
          },
        ],
        api: [
          {
            title: "Primary Exchange",
            value: "Binance",
            note: "Current exchange path used by the broader execution stack.",
          },
          {
            title: "Paper Environment",
            value: "Available",
            note: "Paper remains the default lane for early bot profiles.",
          },
          {
            title: "Demo Routing",
            value: "Enabled",
            note: "Bots can graduate into demo without opening parallel execution channels.",
          },
          {
            title: "Realtime Runtime",
            value: "Shared core",
            note: "Bot pages continue to consume the same shared runtime instead of local polling.",
          },
        ],
      },
    };
  }, [feedReadModel, search, statusFilter]);

  const toggleGeneralSetting = <TKey extends keyof typeof generalSettings>(key: TKey) => {
    setGeneralSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const updateGeneralSetting = <TKey extends keyof typeof generalSettings>(key: TKey, value: (typeof generalSettings)[TKey]) => {
    setGeneralSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const toggleActiveDay = (day: string) => {
    setGeneralSettings((current) => ({
      ...current,
      activeDays: current.activeDays.includes(day)
        ? current.activeDays.filter((item) => item !== day)
        : [...current.activeDays, day],
    }));
  };

  const toggleGeneralListItem = (
    key: "allowedStyles" | "preferredTimeframes" | "allowedTimeframes",
    value: string,
  ) => {
    setGeneralSettings((current) => {
      const currentItems = current[key] as string[];
      const nextItems = currentItems.includes(value)
        ? currentItems.filter((item) => item !== value)
        : [...currentItems, value];
      return {
        ...current,
        [key]: nextItems,
      };
    });
  };

  const toggleRiskSetting = <TKey extends keyof typeof riskSettings>(key: TKey) => {
    setRiskSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const updateRiskSetting = <TKey extends keyof typeof riskSettings>(key: TKey, value: (typeof riskSettings)[TKey]) => {
    setRiskSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const toggleNotificationSetting = <TKey extends keyof typeof notificationSettings>(key: TKey) => {
    setNotificationSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const openQuickEdit = (bot: QuickEditSource) => {
    selectBot(bot.id);
    setQuickEditDraft({
      mode: "edit",
      botId: bot.id,
      botName: bot.name,
      pair: bot.pair,
      strategy: bot.strategy,
      investmentAmount: String(Math.round(bot.capital.allocatedUsd || 0)),
      rangeLower: String(bot.workspaceSettings.rangeLower ?? ""),
      rangeUpper: String(bot.workspaceSettings.rangeUpper ?? ""),
      gridCount: String(bot.workspaceSettings.gridCount ?? ""),
      stopLossPct: String(bot.workspaceSettings.stopLossPct ?? bot.riskPolicy.maxDrawdownPct ?? ""),
      takeProfitPct: String(bot.workspaceSettings.takeProfitPct ?? ""),
      autoCompoundProfits: bot.workspaceSettings.autoCompoundProfits,
      accentClass: getAssetAccentClass(bot.pair.split("/")[0] || bot.name),
    });
  };

  const updateQuickEdit = <TKey extends keyof QuickEditDraft>(key: TKey, value: QuickEditDraft[TKey]) => {
    setQuickEditDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const openBotWorkspace = (bot: (typeof readModel.filteredCards)[number]) => {
    // Keep bot selection in one shared seam so Bot Settings and the full bot
    // workspace stay aligned without introducing a second local runtime.
    selectBot(bot.id);
    onNavigateView(resolveBotTarget(bot.slug));
  };

  useEffect(() => {
    if (!selectedSettingsBot) return;

    setGeneralSettings(buildGeneralSettingsState(selectedSettingsBot));

    setRiskSettings({
      ...INITIAL_RISK_SETTINGS,
      maximumDailyLossLimit: String(selectedSettingsBot.riskPolicy.maxPositionUsd || INITIAL_RISK_SETTINGS.maximumDailyLossLimit),
      maximumDrawdownPct: String(selectedSettingsBot.riskPolicy.maxDrawdownPct || INITIAL_RISK_SETTINGS.maximumDrawdownPct),
      maximumPositionSizePct: String(selectedSettingsBot.riskPolicy.maxSymbolExposurePct || INITIAL_RISK_SETTINGS.maximumPositionSizePct),
      maximumLeverage: selectedSettingsBot.executionEnvironment === "real" ? "3x" : INITIAL_RISK_SETTINGS.maximumLeverage,
      globalStopLossEnabled: selectedSettingsBot.workspaceSettings.stopLossPct != null,
      stopLossPct: String(selectedSettingsBot.workspaceSettings.stopLossPct ?? INITIAL_RISK_SETTINGS.stopLossPct),
      takeProfitPct: String(selectedSettingsBot.workspaceSettings.takeProfitPct ?? INITIAL_RISK_SETTINGS.takeProfitPct),
      trailingStopLossEnabled: !selectedSettingsBot.executionPolicy.suggestionsOnly,
      trailingDistancePct: String(selectedSettingsBot.riskPolicy.cooldownAfterLosses || INITIAL_RISK_SETTINGS.trailingDistancePct),
    });

    setNotificationSettings(buildNotificationSettingsState(selectedSettingsBot));
  }, [selectedSettingsBot?.id]);

  const handleCreateBot = async () => {
    setQuickEditDraft({
      mode: "create",
      botId: null,
      botName: `Signal Bot ${readModel.cards.length + 1}`,
      pair: "BTC/USDT",
      strategy: "Signals",
      investmentAmount: "0",
      rangeLower: "",
      rangeUpper: "",
      gridCount: "",
      stopLossPct: "5",
      takeProfitPct: "10",
      autoCompoundProfits: false,
      accentClass: getAssetAccentClass("BTC"),
    });
  };

  const handleToggleBotStatus = async (bot: (typeof readModel.filteredCards)[number]) => {
    const nextStatus = bot.status === "active" ? "paused" : "active";
    const loaderId = startLoading({ label: "Actualizando bot", detail: `${bot.name} → ${getBotStatusLabel(nextStatus)}` });
    try {
      await updateBot(bot.id, { status: nextStatus });
      showToast({
        tone: "success",
        title: "Estado actualizado",
        message: `${bot.name} ahora está ${getBotStatusLabel(nextStatus).toLowerCase()}.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo actualizar el bot",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleSaveQuickEdit = async () => {
    if (!quickEditDraft) return;
    const loaderId = startLoading({ label: "Guardando bot", detail: quickEditDraft.botName });
    try {
      const normalizedName = quickEditDraft.botName.trim() || "Signal Bot";
      const normalizedPair = quickEditDraft.pair.trim() || "BTC/USDT";
      const botPayload = {
        name: normalizedName,
        capital: {
          allocatedUsd: Number(quickEditDraft.investmentAmount || 0),
          availableUsd: Number(quickEditDraft.investmentAmount || 0),
          accountingScope: quickEditDraft.botId || slugifyBotName(normalizedName),
        },
        workspaceSettings: {
          primaryPair: normalizedPair,
          rangeLower: quickEditDraft.rangeLower ? Number(quickEditDraft.rangeLower) : null,
          rangeUpper: quickEditDraft.rangeUpper ? Number(quickEditDraft.rangeUpper) : null,
          gridCount: quickEditDraft.gridCount ? Number(quickEditDraft.gridCount) : null,
          stopLossPct: quickEditDraft.stopLossPct ? Number(quickEditDraft.stopLossPct) : null,
          takeProfitPct: quickEditDraft.takeProfitPct ? Number(quickEditDraft.takeProfitPct) : null,
          autoCompoundProfits: quickEditDraft.autoCompoundProfits,
        },
      };

      if (quickEditDraft.mode === "create") {
        const createdBot = await createBot({
          status: "draft",
          automationMode: "observe",
          executionEnvironment: "paper",
          ...botPayload,
        });
        selectBot(createdBot.id);
        showToast({
          tone: "success",
          title: "Bot creado",
          message: `${createdBot.name} ya forma parte del registro real.`,
        });
      } else if (quickEditDraft.botId) {
        await updateBot(quickEditDraft.botId, {
          ...botPayload,
          capital: {
            ...botPayload.capital,
            accountingScope: quickEditDraft.botId,
          },
        });
        showToast({
          tone: "success",
          title: "Bot actualizado",
          message: "Los cambios rápidos ya viven en el registro real del bot.",
        });
      }
      setQuickEditDraft(null);
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo guardar",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleSaveGeneralSettings = async () => {
    if (!selectedSettingsBot) return;
    const loaderId = startLoading({ label: "Guardando settings", detail: selectedSettingsBot.name });
    try {
      const customSymbols = generalSettings.customSymbolsText
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);
      const executionEnvironment = generalSettings.paperTradingMode ? "paper" : generalSettings.executionEnvironment;
      const automationMode = generalSettings.automationMode;
      const unrestrictedModeEnabled = generalSettings.operatingProfile === "unrestricted-ai" || generalSettings.unrestrictedModeEnabled;
      const isolatedMode = unrestrictedModeEnabled || generalSettings.isIsolated;
      const allowedStyles = generalSettings.allowedStyles.length ? generalSettings.allowedStyles : [generalSettings.dominantStyle];
      const preferredTimeframes = generalSettings.preferredTimeframes.length
        ? generalSettings.preferredTimeframes
        : [selectedSettingsBot.timeframePolicy.preferredTimeframes[0] || "1h"];
      const allowedTimeframes = generalSettings.allowedTimeframes.length
        ? generalSettings.allowedTimeframes
        : preferredTimeframes;

      await updateBot(selectedSettingsBot.id, {
        identity: {
          ...selectedSettingsBot.identity,
          family: generalSettings.family.trim() || selectedSettingsBot.identity.family,
          ownerScope: generalSettings.ownerScope,
          operatingProfile: generalSettings.operatingProfile,
          isIsolated: isolatedMode,
        },
        workspaceSettings: {
          ...selectedSettingsBot.workspaceSettings,
          primaryPair: generalSettings.defaultTradingPair,
          autoCompoundProfits: generalSettings.autoCompoundProfits,
        },
        generalSettings: {
          ...selectedSettingsBot.generalSettings,
          ...generalSettings,
        },
        executionEnvironment,
        automationMode,
        universePolicy: {
          ...selectedSettingsBot.universePolicy,
          kind: generalSettings.universeKind,
          symbols: generalSettings.universeKind === "watchlist" ? selectedSettingsBot.universePolicy.symbols : customSymbols,
        },
        stylePolicy: {
          ...selectedSettingsBot.stylePolicy,
          dominantStyle: generalSettings.dominantStyle,
          allowedStyles,
          multiStyleEnabled: allowedStyles.length > 1,
        },
        timeframePolicy: {
          ...selectedSettingsBot.timeframePolicy,
          preferredTimeframes,
          allowedTimeframes,
        },
        strategyPolicy: {
          ...selectedSettingsBot.strategyPolicy,
          adaptiveAdjustmentsEnabled: generalSettings.adaptiveAdjustmentsEnabled,
        },
        executionPolicy: {
          ...selectedSettingsBot.executionPolicy,
          requiresHumanApproval: generalSettings.requiresHumanApproval,
          autoExecutionEnabled: generalSettings.autoExecutionEnabled,
          realExecutionEnabled: generalSettings.realExecutionEnabled && executionEnvironment === "real",
          suggestionsOnly: automationMode === "observe",
        },
        aiPolicy: {
          ...selectedSettingsBot.aiPolicy,
          analystEnabled: generalSettings.analystEnabled,
          supervisorEnabled: generalSettings.supervisorEnabled,
          unrestrictedModeEnabled,
          isolationScope: isolatedMode ? "isolated" : "standard",
        },
        overlapPolicy: {
          ...selectedSettingsBot.overlapPolicy,
          executionOverlap: generalSettings.executionOverlap,
          arbitrationMode: generalSettings.arbitrationMode,
        },
        memoryPolicy: {
          ...selectedSettingsBot.memoryPolicy,
          familySharingEnabled: generalSettings.familySharingEnabled,
          globalLearningEnabled: generalSettings.globalLearningEnabled,
          allowPromotionToShared: generalSettings.allowPromotionToShared,
          requiresApprovalForSharedLearning: generalSettings.requiresApprovalForSharedLearning,
          familyScope: generalSettings.familyScope.trim() || selectedSettingsBot.identity.family,
        },
      });
      showToast({
        tone: "success",
        title: "General Settings guardado",
        message: `${selectedSettingsBot.name} ya usa identidad y políticas persistidas reales.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo guardar",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleResetGeneralSettings = () => {
    if (!selectedSettingsBot) {
      setGeneralSettings(INITIAL_GENERAL_SETTINGS);
      return;
    }
    setGeneralSettings(buildGeneralSettingsState(selectedSettingsBot));
  };

  const handleSaveRiskSettings = async () => {
    if (!selectedSettingsBot) return;
    const loaderId = startLoading({ label: "Guardando riesgo", detail: selectedSettingsBot.name });
    try {
      await updateBot(selectedSettingsBot.id, {
        workspaceSettings: {
          ...selectedSettingsBot.workspaceSettings,
          stopLossPct: riskSettings.globalStopLossEnabled ? Number(riskSettings.stopLossPct || 0) : null,
          takeProfitPct: Number(riskSettings.takeProfitPct || 0) || null,
        },
        riskPolicy: {
          ...selectedSettingsBot.riskPolicy,
          maxPositionUsd: Number(riskSettings.maximumDailyLossLimit || 0) || 0,
          maxDailyLossPct: Number(riskSettings.maximumDailyLossLimit || 0) || selectedSettingsBot.riskPolicy.maxDailyLossPct,
          maxDrawdownPct: Number(riskSettings.maximumDrawdownPct || 0) || 0,
          maxSymbolExposurePct: Number(riskSettings.maximumPositionSizePct || 0) || 0,
          cooldownAfterLosses: Number(riskSettings.trailingDistancePct || 0) || 0,
          realExecutionRequiresApproval: true,
        },
        executionPolicy: {
          ...selectedSettingsBot.executionPolicy,
          suggestionsOnly: !riskSettings.trailingStopLossEnabled,
        },
      });
      showToast({
        tone: "success",
        title: "Risk Management guardado",
        message: `${selectedSettingsBot.name} ya usa reglas de riesgo persistidas.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo guardar",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleResetRiskSettings = () => {
    if (!selectedSettingsBot) {
      setRiskSettings(INITIAL_RISK_SETTINGS);
      return;
    }
    setRiskSettings({
      ...INITIAL_RISK_SETTINGS,
      maximumDailyLossLimit: String(selectedSettingsBot.riskPolicy.maxPositionUsd || INITIAL_RISK_SETTINGS.maximumDailyLossLimit),
      maximumDrawdownPct: String(selectedSettingsBot.riskPolicy.maxDrawdownPct || INITIAL_RISK_SETTINGS.maximumDrawdownPct),
      maximumPositionSizePct: String(selectedSettingsBot.riskPolicy.maxSymbolExposurePct || INITIAL_RISK_SETTINGS.maximumPositionSizePct),
      maximumLeverage: selectedSettingsBot.executionEnvironment === "real" ? "3x" : INITIAL_RISK_SETTINGS.maximumLeverage,
      globalStopLossEnabled: selectedSettingsBot.workspaceSettings.stopLossPct != null,
      stopLossPct: String(selectedSettingsBot.workspaceSettings.stopLossPct ?? INITIAL_RISK_SETTINGS.stopLossPct),
      takeProfitPct: String(selectedSettingsBot.workspaceSettings.takeProfitPct ?? INITIAL_RISK_SETTINGS.takeProfitPct),
      trailingStopLossEnabled: !selectedSettingsBot.executionPolicy.suggestionsOnly,
      trailingDistancePct: String(selectedSettingsBot.riskPolicy.cooldownAfterLosses || INITIAL_RISK_SETTINGS.trailingDistancePct),
    });
  };

  const handleSaveNotificationSettings = async () => {
    if (!selectedSettingsBot) return;
    const loaderId = startLoading({ label: "Guardando notificaciones", detail: selectedSettingsBot.name });
    try {
      await updateBot(selectedSettingsBot.id, {
        notificationSettings: {
          ...selectedSettingsBot.notificationSettings,
          ...notificationSettings,
        },
      });
      showToast({
        tone: "success",
        title: "Notifications guardado",
        message: `${selectedSettingsBot.name} ya usa preferencias persistidas de alertas.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "No se pudo guardar",
        message: error instanceof Error ? error.message : "Inténtalo otra vez.",
      });
    } finally {
      stopLoading(loaderId);
    }
  };

  const handleResetNotificationSettings = () => {
    setNotificationSettings(buildNotificationSettingsState(selectedSettingsBot));
  };

  return (
    <div id="botSettingsView" className="view-panel active botsettings-view">
      <section className="botsettings-shell">
        <div className="botsettings-header">
          <div className="botsettings-header-copy">
            <span className="botsettings-kicker ui-pill">CONTROL PANEL</span>
            <h1 className="botsettings-title">Bot Settings</h1>
            <p className="botsettings-subtitle">
              Manage your bot fleet, platform-wide policy, risk controls, notifications and API connections from one
              shared control surface.
            </p>
          </div>

          <div className="botsettings-header-actions">
            <button type="button" className="botsettings-secondary-button ui-button">
              <DownloadIcon />
              Export
            </button>
            <button type="button" className="ui-button ui-button-primary" onClick={() => void handleCreateBot()}>Create New Bot</button>
          </div>
        </div>

        <div className="botsettings-summary-grid ui-summary-grid">
          <BotSummaryCard
            label="Active Bots"
            value={String(readModel.summary.activeBots)}
            note={`${readModel.summary.ownedOutcomeCount} owned outcomes / ${readModel.summary.unresolvedOwnershipCount} unresolved`}
            status="Live"
            tone="success"
            icon={<BotsSummaryIcon />}
          />
          <BotSummaryCard
            label="Total Trades (24h)"
            value={String(readModel.summary.totalTrades)}
            note={`${readModel.cards.reduce((sum, bot) => sum + bot.acceptedCount, 0)} accepted / ${readModel.cards.reduce((sum, bot) => sum + bot.blockedCount, 0)} blocked`}
            tone="info"
            icon={<TradeFlowIcon />}
          />
          <BotSummaryCard
            label="Total Profit (24h)"
            value={formatUsd(readModel.summary.totalProfit)}
            note={`${readModel.cards.filter((bot) => bot.profit24h > 0).length} profitable bots`}
            tone="primary"
            icon={<ProfitSummaryIcon />}
          />
          <BotSummaryCard
            label="Win Rate"
            value={`${readModel.summary.averageWinRate.toFixed(1)}%`}
            note="Average across visible bot cards"
            tone="warning"
            icon={<TargetSummaryIcon />}
            progress={readModel.summary.averageWinRate}
          />
          <BotSummaryCard
            label="Adaptation Ready"
            value={String(readModel.summary.learningReadyBots || 0)}
            note={`${readModel.summary.highConfidenceBots || 0} high / ${readModel.summary.mediumConfidenceBots || 0} medium / ${readModel.summary.lowConfidenceBots || 0} low confidence`}
            tone="info"
            icon={<AutomationBoltIcon />}
          />
        </div>

        <section className="botsettings-panel card">
          <div className="botsettings-tab-bar">
            {BOT_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`botsettings-tab-button ui-chip ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "all-bots" ? (
            <>
              <div className="botsettings-toolbar">
                <label className="botsettings-search-shell ui-input-shell">
                  <SearchIcon />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search bots by name, pair, or strategy..."
                    aria-label="Search bots"
                  />
                </label>

                <div className="botsettings-status-filters">
                  {([
                    { key: "all", label: "All" },
                    { key: "running", label: "Running" },
                    { key: "paused", label: "Paused" },
                    { key: "stopped", label: "Stopped" },
                  ] as Array<{ key: BotStatusFilter; label: string }>).map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className={`botsettings-status-chip ui-chip ${statusFilter === filter.key ? "active" : ""}`}
                      onClick={() => setStatusFilter(filter.key)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="botsettings-layout-toggle">
                  <button
                    type="button"
                    className={`botsettings-layout-button ${layoutMode === "grid" ? "active" : ""}`}
                    onClick={() => setLayoutMode("grid")}
                    aria-label="Grid layout"
                  >
                    <GridToggleIcon />
                  </button>
                  <button
                    type="button"
                    className={`botsettings-layout-button ${layoutMode === "table" ? "active" : ""}`}
                    onClick={() => setLayoutMode("table")}
                    aria-label="Table layout"
                  >
                    <ListToggleIcon />
                  </button>
                </div>
              </div>

              {layoutMode === "grid" ? (
                <div className="botsettings-card-grid">
                  {readModel.filteredCards.length ? readModel.filteredCards.map((bot) => (
                    <article key={bot.id} className={`botsettings-card ${getBotCardTone(bot.status)}`}>
                      <div className="botsettings-card-head">
                        <div className="botsettings-card-identity">
                          <BotAssetBadge pair={bot.pair} />
                          <div className="botsettings-card-copy">
                            <button type="button" className="botsettings-card-link" onClick={() => openBotWorkspace(bot)}>
                              <h3>{bot.name}</h3>
                            </button>
                            <p>{bot.pair}</p>
                          </div>
                        </div>

                        <div className="botsettings-card-head-actions">
                          <span className={`botsettings-status-pill ${getBotStatusClass(bot.status)}`}>{getBotStatusLabel(bot.status)}</span>
                          <button type="button" className="botsettings-menu-button" aria-label={`Open ${bot.name} options`}>
                            <KebabIcon />
                          </button>
                        </div>
                      </div>

                      <div className="botsettings-metric-grid">
                        <MetricCell label="Strategy" value={bot.strategy} tone="neutral" />
                        <MetricCell label="Trades (24h)" value={String(bot.trades24h)} tone="neutral" />
                        <MetricCell label="Profit (24h)" value={formatUsd(bot.profit24h)} tone={bot.profit24h > 0 ? "positive" : bot.profit24h < 0 ? "negative" : "neutral"} />
                        <MetricCell label="Win Rate" value={`${bot.winRate.toFixed(1)}%`} tone={bot.winRate >= 60 ? "positive" : bot.winRate >= 45 ? "neutral" : "negative"} />
                        <MetricCell label="Owned Outcomes" value={String(bot.ownedOutcomeCount)} tone={bot.ownedOutcomeCount > 0 ? "positive" : "neutral"} />
                        <MetricCell label="Needs Link" value={String(bot.unresolvedOwnershipCount)} tone={bot.unresolvedOwnershipCount > 0 ? "negative" : "positive"} />
                      </div>

                      <div className="botsettings-card-meta" style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                        <span>{bot.reconciliationPct.toFixed(0)}% reconciled activity</span>
                        <span>{bot.acceptedCount} accepted / {bot.blockedCount} blocked</span>
                      </div>
                      <div className="botsettings-card-meta" style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                        <span>{capitalize(bot.adaptationConfidence)} adaptation confidence</span>
                        <span>{summarizeAdaptationBias(bot.adaptationBias)}</span>
                      </div>

                      <div className="botsettings-allocation">
                        <div className="botsettings-allocation-head">
                          <span>Allocation</span>
                          <strong>{formatUsd(bot.capital.allocatedUsd)} / {formatUsd(bot.capacityUsd)}</strong>
                        </div>
                        <div className="botsettings-allocation-track">
                          <div className={`botsettings-allocation-fill ${getBotStatusClass(bot.status)}`} style={{ width: `${bot.allocationPct}%` }} />
                        </div>
                      </div>

                      <div className="botsettings-card-foot">
                        <button
                          type="button"
                          className={`botsettings-primary-action ${bot.status === "active" ? "is-pause" : "is-start"}`}
                          onClick={() => void handleToggleBotStatus(bot)}
                        >
                          {bot.status === "active" ? <PauseMiniIcon /> : <PlayMiniIcon />}
                          {bot.status === "active" ? "Pause" : "Start"}
                        </button>
                        <button
                          type="button"
                          className="botsettings-secondary-action"
                          onClick={() => openBotWorkspace(bot)}
                          aria-label={`Open full workspace for ${bot.name}`}
                        >
                          Open Bot
                        </button>
                        <button
                          type="button"
                          className="botsettings-gear-button"
                          aria-label={`Open settings for ${bot.name}`}
                          onClick={() => openQuickEdit(bot)}
                        >
                          <GearMiniIcon />
                        </button>
                      </div>
                    </article>
                  )) : (
                    <article className="botsettings-card">
                      <div className="botsettings-card-copy" style={{ padding: "1.5rem" }}>
                        <h3>{botsLoading && !botsHydrated ? "Loading bots..." : "No real bots found"}</h3>
                        <p>
                          {botsError
                            ? `The persisted bot registry could not be loaded: ${botsError}`
                            : "This list now waits for the persisted bot registry instead of falling back to template bots."}
                        </p>
                      </div>
                    </article>
                  )}
                </div>
              ) : (
                <div className="ui-table-shell botsettings-table-shell">
                  <table className="ui-table botsettings-table">
                    <thead>
                      <tr>
                        <th>Bot</th>
                        <th>Status</th>
                        <th>Strategy</th>
                        <th>Trades</th>
                        <th>Profit</th>
                        <th>Win Rate</th>
                        <th>Owned</th>
                        <th>Needs Link</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {readModel.filteredCards.length ? readModel.filteredCards.map((bot) => (
                        <tr key={bot.id}>
                          <td>
                            <div className="botsettings-table-identity">
                              <BotAssetBadge pair={bot.pair} />
                              <div>
                                <strong>{bot.name}</strong>
                                <span>{bot.pair}</span>
                              </div>
                            </div>
                          </td>
                          <td><span className={`botsettings-status-pill ${getBotStatusClass(bot.status)}`}>{getBotStatusLabel(bot.status)}</span></td>
                          <td>{bot.strategy}</td>
                          <td>{bot.trades24h}</td>
                          <td className={bot.profit24h > 0 ? "wallet-positive" : bot.profit24h < 0 ? "wallet-negative" : ""}>{formatUsd(bot.profit24h)}</td>
                          <td>{bot.winRate.toFixed(1)}%</td>
                          <td>{bot.ownedOutcomeCount}</td>
                          <td className={bot.unresolvedOwnershipCount > 0 ? "wallet-negative" : "wallet-positive"}>{bot.unresolvedOwnershipCount}</td>
                          <td>
                            <button type="button" className="botsettings-inline-link" onClick={() => openBotWorkspace(bot)}>
                              Open bot
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={9}>
                            {botsError
                              ? `The persisted bot registry could not be loaded: ${botsError}`
                              : botsLoading && !botsHydrated
                                ? "Loading bots..."
                                : "No real bots found yet."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}

          {activeTab === "general-settings" ? (
            <div className="botsettings-general-grid">
              <article className="botsettings-general-card">
                <div className="botsettings-general-head">
                  <div className="botsettings-general-title">
                    <div className="botsettings-general-icon is-info">
                      <BotsTabIcon />
                    </div>
                    <h3>Bot Identity</h3>
                  </div>
                </div>

                <div className="botsettings-form-stack">
                  <FormInput
                    label="Bot Family"
                    value={generalSettings.family}
                    onChange={(value) => updateGeneralSetting("family", value)}
                  />
                  <FormSelect
                    label="Owner Scope"
                    value={generalSettings.ownerScope}
                    options={["system", "user", "lab"]}
                    onChange={(value) => updateGeneralSetting("ownerScope", value as GeneralSettingsState["ownerScope"])}
                  />
                  <FormSelect
                    label="Operating Profile"
                    value={generalSettings.operatingProfile}
                    options={["manual-assisted", "experimental", "automatic", "unrestricted-ai"]}
                    onChange={(value) => updateGeneralSetting("operatingProfile", value as GeneralSettingsState["operatingProfile"])}
                  />
                </div>
              </article>

              <article className="botsettings-general-card">
                <div className="botsettings-general-head">
                  <div className="botsettings-general-title">
                    <div className="botsettings-general-icon is-success">
                      <AutomationBoltIcon />
                    </div>
                    <h3>Operating Envelope</h3>
                  </div>
                </div>

                <div className="botsettings-form-stack">
                  <FormSelect
                    label="Execution Environment"
                    value={generalSettings.executionEnvironment}
                    options={["paper", "demo", "real"]}
                    onChange={(value) => updateGeneralSetting("executionEnvironment", value as GeneralSettingsState["executionEnvironment"])}
                  />
                  <FormSelect
                    label="Automation Mode"
                    value={generalSettings.automationMode}
                    options={["observe", "assist", "auto"]}
                    onChange={(value) => updateGeneralSetting("automationMode", value as GeneralSettingsState["automationMode"])}
                  />
                  <FormSelect
                    label="Execution Overlap"
                    value={generalSettings.executionOverlap}
                    options={["block", "allow-with-approval", "allow"]}
                    onChange={(value) => updateGeneralSetting("executionOverlap", value as GeneralSettingsState["executionOverlap"])}
                  />
                  <FormSelect
                    label="Arbitration Mode"
                    value={generalSettings.arbitrationMode}
                    options={["priority", "exclusive", "shared"]}
                    onChange={(value) => updateGeneralSetting("arbitrationMode", value as GeneralSettingsState["arbitrationMode"])}
                  />
                </div>
              </article>

              <article className="botsettings-general-card">
                <div className="botsettings-general-head">
                  <div className="botsettings-general-title">
                    <div className="botsettings-general-icon is-primary">
                      <SlidersHorizontalIcon />
                    </div>
                    <h3>Trading Preferences</h3>
                  </div>
                </div>

                <div className="botsettings-form-stack">
                  <FormSelect
                    label="Default Trading Pair"
                    value={generalSettings.defaultTradingPair}
                    options={["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"]}
                    onChange={(value) => updateGeneralSetting("defaultTradingPair", value)}
                  />
                  <FormSelect
                    label="Default Exchange"
                    value={generalSettings.defaultExchange}
                    options={["Binance", "Binance Demo", "Paper Router"]}
                    onChange={(value) => updateGeneralSetting("defaultExchange", value)}
                  />
                  <FormSelect
                    label="Base Currency"
                    value={generalSettings.baseCurrency}
                    options={["USDT", "USDC", "USD"]}
                    onChange={(value) => updateGeneralSetting("baseCurrency", value)}
                  />

                  <div className="botsettings-field-block">
                    <label className="botsettings-field-label">Order Size Type</label>
                    <div className="botsettings-choice-grid">
                      <ChoiceCard
                        icon={<DollarSizeIcon />}
                        title="Fixed Amount"
                        active={generalSettings.orderSizeType === "fixed"}
                        onClick={() => updateGeneralSetting("orderSizeType", "fixed")}
                      />
                      <ChoiceCard
                        icon={<PercentSizeIcon />}
                        title="Percentage"
                        active={generalSettings.orderSizeType === "percentage"}
                        onClick={() => updateGeneralSetting("orderSizeType", "percentage")}
                      />
                    </div>
                  </div>
                </div>
              </article>

              <article className="botsettings-general-card">
                <div className="botsettings-general-head">
                  <div className="botsettings-general-title">
                    <div className="botsettings-general-icon is-warning">
                      <ShieldTabIcon />
                    </div>
                    <h3>Universe, Style & Timeframes</h3>
                  </div>
                </div>

                <div className="botsettings-form-stack">
                  <FormSelect
                    label="Universe Policy"
                    value={generalSettings.universeKind}
                    options={["watchlist", "custom-list", "hybrid", "market-filter"]}
                    onChange={(value) => updateGeneralSetting("universeKind", value as GeneralSettingsState["universeKind"])}
                  />
                  {generalSettings.universeKind !== "watchlist" ? (
                    <FormInput
                      label="Custom Symbols"
                      value={generalSettings.customSymbolsText}
                      onChange={(value) => updateGeneralSetting("customSymbolsText", value)}
                      note="Use comma-separated pairs, for example BTC/USDT, ETH/USDT."
                    />
                  ) : null}
                  <FormSelect
                    label="Dominant Style"
                    value={generalSettings.dominantStyle}
                    options={[...STYLE_OPTIONS]}
                    onChange={(value) => updateGeneralSetting("dominantStyle", value as GeneralSettingsState["dominantStyle"])}
                  />

                  <div className="botsettings-field-block">
                    <label className="botsettings-field-label">Allowed Styles</label>
                    <div className="botsettings-day-row">
                      {STYLE_OPTIONS.map((style) => (
                        <button
                          key={style}
                          type="button"
                          className={`botsettings-day-chip ${generalSettings.allowedStyles.includes(style) ? "active" : ""}`}
                          onClick={() => toggleGeneralListItem("allowedStyles", style)}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="botsettings-field-block">
                    <label className="botsettings-field-label">Preferred Timeframes</label>
                    <div className="botsettings-day-row">
                      {TIMEFRAME_OPTIONS.map((timeframe) => (
                        <button
                          key={timeframe}
                          type="button"
                          className={`botsettings-day-chip ${generalSettings.preferredTimeframes.includes(timeframe) ? "active" : ""}`}
                          onClick={() => toggleGeneralListItem("preferredTimeframes", timeframe)}
                        >
                          {timeframe}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="botsettings-field-block">
                    <label className="botsettings-field-label">Allowed Timeframes</label>
                    <div className="botsettings-day-row">
                      {TIMEFRAME_OPTIONS.map((timeframe) => (
                        <button
                          key={timeframe}
                          type="button"
                          className={`botsettings-day-chip ${generalSettings.allowedTimeframes.includes(timeframe) ? "active" : ""}`}
                          onClick={() => toggleGeneralListItem("allowedTimeframes", timeframe)}
                        >
                          {timeframe}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </article>

              <article className="botsettings-general-card">
                <div className="botsettings-general-head">
                  <div className="botsettings-general-title">
                    <div className="botsettings-general-icon is-warning">
                      <AutomationBoltIcon />
                    </div>
                    <h3>Automation Settings</h3>
                  </div>
                </div>

                <div className="botsettings-toggle-stack">
                  <ToggleRow
                    title="Auto-restart on error"
                    note="Automatically restart bots after recoverable errors"
                    checked={generalSettings.autoRestartOnError}
                    onToggle={() => toggleGeneralSetting("autoRestartOnError")}
                  />
                  <ToggleRow
                    title="Auto-compound profits"
                    note="Reinvest profits automatically"
                    checked={generalSettings.autoCompoundProfits}
                    onToggle={() => toggleGeneralSetting("autoCompoundProfits")}
                  />
                  <ToggleRow
                    title="Paper trading mode"
                    note="Test strategies without real funds"
                    checked={generalSettings.paperTradingMode}
                    onToggle={() => toggleGeneralSetting("paperTradingMode")}
                  />
                  <ToggleRow
                    title="Smart order routing"
                    note="Find best prices across exchanges"
                    checked={generalSettings.smartOrderRouting}
                    onToggle={() => toggleGeneralSetting("smartOrderRouting")}
                  />
                  <ToggleRow
                    title="Anti-slippage protection"
                    note="Prevent execution at unfavorable prices"
                    checked={generalSettings.antiSlippageProtection}
                    onToggle={() => toggleGeneralSetting("antiSlippageProtection")}
                  />
                  <ToggleRow
                    title="Analyst AI enabled"
                    note="Allow analyst intelligence in the bot policy envelope"
                    checked={generalSettings.analystEnabled}
                    onToggle={() => toggleGeneralSetting("analystEnabled")}
                  />
                  <ToggleRow
                    title="Supervisor AI enabled"
                    note="Allow supervisor intervention inside the bot policy envelope"
                    checked={generalSettings.supervisorEnabled}
                    onToggle={() => toggleGeneralSetting("supervisorEnabled")}
                  />
                  <ToggleRow
                    title="Adaptive adjustments"
                    note="Let the strategy policy adapt over time"
                    checked={generalSettings.adaptiveAdjustmentsEnabled}
                    onToggle={() => toggleGeneralSetting("adaptiveAdjustmentsEnabled")}
                  />
                  <ToggleRow
                    title="Human approval required"
                    note="Keep a human gate before stronger execution actions"
                    checked={generalSettings.requiresHumanApproval}
                    onToggle={() => toggleGeneralSetting("requiresHumanApproval")}
                  />
                  <ToggleRow
                    title="Auto execution enabled"
                    note="Allow the bot to execute automatically when policy permits"
                    checked={generalSettings.autoExecutionEnabled}
                    onToggle={() => toggleGeneralSetting("autoExecutionEnabled")}
                  />
                  <ToggleRow
                    title="Real execution enabled"
                    note="Allow real-environment execution only when the environment is real"
                    checked={generalSettings.realExecutionEnabled}
                    onToggle={() => toggleGeneralSetting("realExecutionEnabled")}
                  />
                  <ToggleRow
                    title="Isolated accounting"
                    note="Keep this bot isolated from the rest of the bot family"
                    checked={generalSettings.isIsolated}
                    onToggle={() => toggleGeneralSetting("isIsolated")}
                  />
                  <ToggleRow
                    title="Unrestricted AI mode"
                    note="Reserved for isolated lab-style bots only"
                    checked={generalSettings.unrestrictedModeEnabled}
                    onToggle={() => toggleGeneralSetting("unrestrictedModeEnabled")}
                  />
                </div>
              </article>

              <article className="botsettings-general-card">
                <div className="botsettings-general-head">
                  <div className="botsettings-general-title">
                    <div className="botsettings-general-icon is-info">
                      <PerformanceGaugeIcon />
                    </div>
                    <h3>Performance Settings</h3>
                  </div>
                </div>

                <div className="botsettings-slider-stack">
                  <SliderField
                    label="Execution Speed"
                    value={generalSettings.executionSpeed}
                    minLabel="Normal"
                    maxLabel="Ultra"
                    displayValue={generalSettings.executionSpeed >= 66 ? "Ultra" : generalSettings.executionSpeed >= 33 ? "Fast" : "Normal"}
                    max={100}
                    onChange={(value) => updateGeneralSetting("executionSpeed", value)}
                  />
                  <SliderField
                    label="API Rate Limit"
                    value={generalSettings.apiRateLimit}
                    min={300}
                    max={1800}
                    step={100}
                    minLabel="300/min"
                    maxLabel="1800/min"
                    displayValue={`${generalSettings.apiRateLimit}/min`}
                    onChange={(value) => updateGeneralSetting("apiRateLimit", value)}
                  />
                  <SliderField
                    label="Max Concurrent Bots"
                    value={generalSettings.maxConcurrentBots}
                    min={1}
                    max={30}
                    step={1}
                    minLabel="1"
                    maxLabel="30"
                    displayValue={String(generalSettings.maxConcurrentBots)}
                    onChange={(value) => updateGeneralSetting("maxConcurrentBots", value)}
                  />
                </div>
              </article>

              <article className="botsettings-general-card">
                <div className="botsettings-general-head">
                  <div className="botsettings-general-title">
                    <div className="botsettings-general-icon is-info">
                      <ShieldTabIcon />
                    </div>
                    <h3>Learning & Memory</h3>
                  </div>
                </div>

                <div className="botsettings-form-stack">
                  <FormInput
                    label="Family Scope"
                    value={generalSettings.familyScope}
                    onChange={(value) => updateGeneralSetting("familyScope", value)}
                    note="Controls which bot family can share learning with this bot."
                  />
                  <div className="botsettings-toggle-stack">
                    <ToggleRow
                      title="Family sharing enabled"
                      note="Allow this bot to consume and contribute family-level learning."
                      checked={generalSettings.familySharingEnabled}
                      onToggle={() => toggleGeneralSetting("familySharingEnabled")}
                    />
                    <ToggleRow
                      title="Global learning enabled"
                      note="Allow this bot to contribute to platform-level memory."
                      checked={generalSettings.globalLearningEnabled}
                      onToggle={() => toggleGeneralSetting("globalLearningEnabled")}
                    />
                    <ToggleRow
                      title="Promote outcomes to shared memory"
                      note="Allow stronger outcomes to be promoted beyond local memory."
                      checked={generalSettings.allowPromotionToShared}
                      onToggle={() => toggleGeneralSetting("allowPromotionToShared")}
                    />
                    <ToggleRow
                      title="Approval required for shared learning"
                      note="Keep a governance gate before new shared-learning promotion."
                      checked={generalSettings.requiresApprovalForSharedLearning}
                      onToggle={() => toggleGeneralSetting("requiresApprovalForSharedLearning")}
                    />
                  </div>
                </div>
              </article>

              <article className="botsettings-general-card">
                <div className="botsettings-general-head">
                  <div className="botsettings-general-title">
                    <div className="botsettings-general-icon is-success">
                      <ScheduleClockIcon />
                    </div>
                    <h3>Schedule Settings</h3>
                  </div>
                </div>

                <div className="botsettings-form-stack">
                  <ToggleRow
                    title="Trading schedule"
                    note="Limit trading to specific hours"
                    checked={generalSettings.tradingScheduleEnabled}
                    onToggle={() => toggleGeneralSetting("tradingScheduleEnabled")}
                  />

                  <div className="botsettings-time-grid">
                    <FormInput
                      label="Start Time"
                      value={generalSettings.startTime}
                      onChange={(value) => updateGeneralSetting("startTime", value)}
                      suffix={<TimeMiniIcon />}
                    />
                    <FormInput
                      label="End Time"
                      value={generalSettings.endTime}
                      onChange={(value) => updateGeneralSetting("endTime", value)}
                      suffix={<TimeMiniIcon />}
                    />
                  </div>

                  <div className="botsettings-field-block">
                    <label className="botsettings-field-label">Active Days</label>
                    <div className="botsettings-day-row">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                        <button
                          key={day}
                          type="button"
                          className={`botsettings-day-chip ${generalSettings.activeDays.includes(day) ? "active" : ""}`}
                          onClick={() => toggleActiveDay(day)}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  <FormSelect
                    label="Timezone"
                    value={generalSettings.timezone}
                    options={["UTC", "America/New_York", "America/Santo_Domingo", "Europe/London"]}
                    onChange={(value) => updateGeneralSetting("timezone", value)}
                  />
                </div>
              </article>

              <div className="botsettings-general-actions">
                <button
                  type="button"
                  className="botsettings-reset-button ui-button"
                  onClick={handleResetGeneralSettings}
                >
                  Reset to Default
                </button>
                <button type="button" className="ui-button ui-button-primary" onClick={() => void handleSaveGeneralSettings()}>
                  <SaveMiniIcon />
                  Save Settings
                </button>
              </div>
            </div>
          ) : null}

          {activeTab === "risk-management" ? (
            <div className="botsettings-general-grid">
              <article className="botsettings-general-card botsettings-risk-card">
                <div className="botsettings-general-head">
                  <div className="botsettings-general-title">
                    <div className="botsettings-general-icon is-danger">
                      <ShieldAlertIcon />
                    </div>
                    <h3>Global Risk Controls</h3>
                  </div>
                </div>

                <div className="botsettings-form-stack">
                  <FormInput
                    label="Maximum Daily Loss Limit"
                    value={riskSettings.maximumDailyLossLimit}
                    onChange={(value) => updateRiskSetting("maximumDailyLossLimit", value)}
                    prefix="$"
                    note="Trading will stop if daily losses exceed this amount"
                  />
                  <FormInput
                    label="Maximum Drawdown %"
                    value={riskSettings.maximumDrawdownPct}
                    onChange={(value) => updateRiskSetting("maximumDrawdownPct", value)}
                    suffix="%"
                  />
                  <FormInput
                    label="Maximum Position Size"
                    value={riskSettings.maximumPositionSizePct}
                    onChange={(value) => updateRiskSetting("maximumPositionSizePct", value)}
                    suffix="%"
                    note="Maximum % of portfolio in a single position"
                  />
                  <FormSelect
                    label="Maximum Leverage"
                    value={riskSettings.maximumLeverage}
                    options={["1x", "2x", "3x", "5x", "10x"]}
                    onChange={(value) => updateRiskSetting("maximumLeverage", value)}
                  />
                </div>
              </article>

              <article className="botsettings-general-card botsettings-risk-card">
                <div className="botsettings-general-head">
                  <div className="botsettings-general-title">
                    <div className="botsettings-general-icon is-success">
                      <TargetSummaryIcon />
                    </div>
                    <h3>Stop Loss &amp; Take Profit</h3>
                  </div>
                </div>

                <div className="botsettings-form-stack">
                  <ToggleRow
                    title="Global Stop Loss"
                    note="Apply to all bots by default"
                    checked={riskSettings.globalStopLossEnabled}
                    onToggle={() => toggleRiskSetting("globalStopLossEnabled")}
                  />

                  <div className="botsettings-time-grid">
                    <FormInput
                      label="Stop Loss %"
                      value={riskSettings.stopLossPct}
                      onChange={(value) => updateRiskSetting("stopLossPct", value)}
                      suffix="%"
                    />
                    <FormInput
                      label="Take Profit %"
                      value={riskSettings.takeProfitPct}
                      onChange={(value) => updateRiskSetting("takeProfitPct", value)}
                      suffix="%"
                    />
                  </div>

                  <ToggleRow
                    title="Trailing Stop Loss"
                    note="Adjust stop loss as price moves in your favor"
                    checked={riskSettings.trailingStopLossEnabled}
                    onToggle={() => toggleRiskSetting("trailingStopLossEnabled")}
                  />

                  <FormInput
                    label="Trailing Distance"
                    value={riskSettings.trailingDistancePct}
                    onChange={(value) => updateRiskSetting("trailingDistancePct", value)}
                    suffix="%"
                  />
                </div>
              </article>

              <article className="botsettings-general-card botsettings-risk-card botsettings-risk-span">
                <div className="botsettings-general-head">
                  <div className="botsettings-general-title">
                    <div className="botsettings-general-icon is-caution">
                      <WarningTriangleIcon />
                    </div>
                    <h3>Emergency Controls</h3>
                  </div>
                </div>

                <div className="botsettings-risk-emergency-grid">
                  <button type="button" className="botsettings-emergency-card is-danger">
                    <div className="botsettings-emergency-icon">
                      <StopShieldIcon />
                    </div>
                    <strong>Emergency Stop All</strong>
                    <span>Immediately stop all running bots and cancel pending orders</span>
                  </button>

                  <button type="button" className="botsettings-emergency-card is-warning">
                    <div className="botsettings-emergency-icon">
                      <ClosePositionsIcon />
                    </div>
                    <strong>Close All Positions</strong>
                    <span>Market sell all open positions across all bots</span>
                  </button>

                  <button type="button" className="botsettings-emergency-card is-caution">
                    <div className="botsettings-emergency-icon">
                      <PauseMiniIcon />
                    </div>
                    <strong>Pause All Bots</strong>
                    <span>Temporarily pause all bots while keeping positions open</span>
                  </button>
                </div>
              </article>

              <div className="botsettings-general-actions">
                <button type="button" className="botsettings-reset-button ui-button" onClick={handleResetRiskSettings}>
                  Reset to Default
                </button>
                <button type="button" className="ui-button ui-button-primary" onClick={() => void handleSaveRiskSettings()}>
                  <SaveMiniIcon />
                  Save Risk Settings
                </button>
              </div>
            </div>
          ) : null}

          {activeTab === "notifications" ? (
            <div className="botsettings-general-grid">
              <article className="botsettings-general-card botsettings-notifications-card">
                <div className="botsettings-general-head">
                  <div className="botsettings-general-title">
                    <div className="botsettings-general-icon is-primary">
                      <BellIcon />
                    </div>
                    <h3>Notification Channels</h3>
                  </div>
                </div>

                <div className="botsettings-toggle-stack">
                  <NotificationChannelRow
                    icon={<MailChannelIcon />}
                    tone="email"
                    title="Email"
                    meta={notificationSettings.emailAddress}
                    action={(
                      <button
                        type="button"
                        role="switch"
                        aria-checked={notificationSettings.emailEnabled}
                        className={`botsettings-switch ${notificationSettings.emailEnabled ? "is-active" : ""}`}
                        onClick={() => toggleNotificationSetting("emailEnabled")}
                      >
                        <span />
                      </button>
                    )}
                  />
                  <NotificationChannelRow
                    icon={<TelegramChannelIcon />}
                    tone="telegram"
                    title="Telegram"
                    meta={notificationSettings.telegramHandle}
                    action={(
                      <button
                        type="button"
                        role="switch"
                        aria-checked={notificationSettings.telegramEnabled}
                        className={`botsettings-switch ${notificationSettings.telegramEnabled ? "is-active" : ""}`}
                        onClick={() => toggleNotificationSetting("telegramEnabled")}
                      >
                        <span />
                      </button>
                    )}
                  />
                  <NotificationChannelRow
                    icon={<DiscordChannelIcon />}
                    tone="discord"
                    title="Discord"
                    meta={notificationSettings.discordLabel}
                    action={(
                      <button type="button" className="botsettings-channel-button ui-button">
                        Connect
                      </button>
                    )}
                  />
                  <NotificationChannelRow
                    icon={<PushChannelIcon />}
                    tone="push"
                    title="Push Notifications"
                    meta={notificationSettings.pushLabel}
                    action={(
                      <button
                        type="button"
                        role="switch"
                        aria-checked={notificationSettings.pushEnabled}
                        className={`botsettings-switch ${notificationSettings.pushEnabled ? "is-active" : ""}`}
                        onClick={() => toggleNotificationSetting("pushEnabled")}
                      >
                        <span />
                      </button>
                    )}
                  />
                </div>
              </article>

              <article className="botsettings-general-card botsettings-notifications-card">
                <div className="botsettings-general-head">
                  <div className="botsettings-general-title">
                    <div className="botsettings-general-icon is-warning">
                      <AlertChannelIcon />
                    </div>
                    <h3>Alert Types</h3>
                  </div>
                </div>

                <div className="botsettings-toggle-stack">
                  <ToggleRow
                    title="Trade Executed"
                    note="When a buy or sell order is filled"
                    checked={notificationSettings.tradeExecuted}
                    onToggle={() => toggleNotificationSetting("tradeExecuted")}
                  />
                  <ToggleRow
                    title="Take Profit Hit"
                    note="When TP target is reached"
                    checked={notificationSettings.takeProfitHit}
                    onToggle={() => toggleNotificationSetting("takeProfitHit")}
                  />
                  <ToggleRow
                    title="Stop Loss Triggered"
                    note="When SL is triggered"
                    checked={notificationSettings.stopLossTriggered}
                    onToggle={() => toggleNotificationSetting("stopLossTriggered")}
                  />
                  <ToggleRow
                    title="Bot Status Change"
                    note="Start, stop, pause events"
                    checked={notificationSettings.botStatusChange}
                    onToggle={() => toggleNotificationSetting("botStatusChange")}
                  />
                  <ToggleRow
                    title="Daily Summary"
                    note="End of day performance report"
                    checked={notificationSettings.dailySummary}
                    onToggle={() => toggleNotificationSetting("dailySummary")}
                  />
                  <ToggleRow
                    title="Error Alerts"
                    note="Bot errors and connection issues"
                    checked={notificationSettings.errorAlerts}
                    onToggle={() => toggleNotificationSetting("errorAlerts")}
                  />
                </div>
              </article>

              <div className="botsettings-general-actions">
                <button type="button" className="botsettings-reset-button ui-button" onClick={handleResetNotificationSettings}>
                  Reset to Default
                </button>
                <button type="button" className="ui-button ui-button-primary" onClick={() => void handleSaveNotificationSettings()}>
                  <SaveMiniIcon />
                  Save Notification Settings
                </button>
              </div>
            </div>
          ) : null}

        </section>

        {quickEditDraft ? (
          <div className="botsettings-drawer-shell" role="dialog" aria-modal="true" aria-label="Edit bot settings">
            <button type="button" className="botsettings-drawer-backdrop" aria-label="Close quick settings" onClick={() => setQuickEditDraft(null)} />
            <aside className="botsettings-drawer">
              <div className="botsettings-drawer-head">
                <h2>Edit Bot Settings</h2>
                <button type="button" className="botsettings-drawer-close" onClick={() => setQuickEditDraft(null)} aria-label="Close quick settings">
                  <CloseMiniIcon />
                </button>
              </div>

              <div className="botsettings-drawer-summary">
                <div className={`botsettings-asset-badge ${quickEditDraft.accentClass}`}>
                  {(quickEditDraft.pair.split("/")[0] || quickEditDraft.botName).slice(0, 1)}
                </div>
                <div className="botsettings-drawer-summary-copy">
                  <strong>{quickEditDraft.botName}</strong>
                  <span>{quickEditDraft.pair} • {quickEditDraft.strategy}</span>
                </div>
              </div>

              <div className="botsettings-drawer-form">
                <FormInput
                  label="Bot Name"
                  value={quickEditDraft.botName}
                  onChange={(value) => updateQuickEdit("botName", value)}
                />
                <FormInput
                  label="Investment Amount"
                  value={quickEditDraft.investmentAmount}
                  onChange={(value) => updateQuickEdit("investmentAmount", value)}
                  prefix="$"
                />
                <div className="botsettings-time-grid">
                  <FormInput
                    label="Grid Lower"
                    value={quickEditDraft.rangeLower}
                    onChange={(value) => updateQuickEdit("rangeLower", value)}
                  />
                  <FormInput
                    label="Grid Upper"
                    value={quickEditDraft.rangeUpper}
                    onChange={(value) => updateQuickEdit("rangeUpper", value)}
                  />
                </div>
                <FormInput
                  label="Number of Grids"
                  value={quickEditDraft.gridCount}
                  onChange={(value) => updateQuickEdit("gridCount", value)}
                />
                <div className="botsettings-time-grid">
                  <FormInput
                    label="Stop Loss %"
                    value={quickEditDraft.stopLossPct}
                    onChange={(value) => updateQuickEdit("stopLossPct", value)}
                  />
                  <FormInput
                    label="Take Profit %"
                    value={quickEditDraft.takeProfitPct}
                    onChange={(value) => updateQuickEdit("takeProfitPct", value)}
                  />
                </div>
                <ToggleRow
                  title="Auto-compound profits"
                  note="Reinvest profits into the grid"
                  checked={quickEditDraft.autoCompoundProfits}
                  onToggle={() => updateQuickEdit("autoCompoundProfits", !quickEditDraft.autoCompoundProfits)}
                />
              </div>

              <div className="botsettings-drawer-actions">
                <button type="button" className="botsettings-drawer-danger" aria-label={`Delete ${quickEditDraft.botName}`} disabled={quickEditDraft.mode === "create"}>
                  <TrashMiniIcon />
                </button>
                <button type="button" className="botsettings-reset-button ui-button" onClick={() => setQuickEditDraft(null)}>
                  Cancel
                </button>
                <button type="button" className="ui-button ui-button-primary" onClick={() => void handleSaveQuickEdit()}>
                  <SaveMiniIcon />
                  Save Changes
                </button>
              </div>
            </aside>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function BotSummaryCard(props: {
  label: string;
  value: string;
  note: string;
  tone: "success" | "info" | "primary" | "warning";
  icon: ReactNode;
  status?: string;
  progress?: number;
}) {
  return (
    <div className="botsettings-summary-card ui-summary-card">
      <div className="botsettings-summary-copy ui-summary-card-copy">
        <div className="botsettings-summary-head">
          <div className="botsettings-summary-label ui-summary-card-label">{props.label}</div>
          <div className={`botsettings-summary-icon ${props.tone} ui-summary-card-icon`}>{props.icon}</div>
        </div>

        <div className="botsettings-summary-value-row">
          <div className="botsettings-summary-value ui-summary-card-value">{props.value}</div>
        </div>

        <div className="botsettings-summary-footer">
          {props.status ? <span className={`botsettings-summary-status ${props.tone}`}>{props.status}</span> : <span className="botsettings-summary-note">{props.note}</span>}
          {typeof props.progress === "number" ? (
            <div className="botsettings-summary-progress-track">
              <div className="botsettings-summary-progress-fill" style={{ width: `${Math.max(0, Math.min(props.progress, 100))}%` }} />
            </div>
          ) : null}
          {!props.status ? null : <span className="botsettings-summary-note">{props.note}</span>}
        </div>
      </div>
    </div>
  );
}

function MetricCell(props: { label: string; value: string; tone: "positive" | "negative" | "neutral" }) {
  return (
    <div className="botsettings-metric-cell">
      <span>{props.label}</span>
      <strong className={props.tone === "positive" ? "is-positive" : props.tone === "negative" ? "is-negative" : ""}>{props.value}</strong>
    </div>
  );
}

function FormSelect(props: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="botsettings-field-block">
      <label className="botsettings-field-label">{props.label}</label>
      <label className="botsettings-select-shell ui-input-shell is-select">
        <select value={props.value} onChange={(event) => props.onChange(event.target.value)} aria-label={props.label}>
          {props.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <SelectChevronIcon />
      </label>
    </div>
  );
}

function FormInput(props: { label: string; value: string; onChange: (value: string) => void; prefix?: ReactNode; suffix?: ReactNode; note?: string }) {
  return (
    <div className="botsettings-field-block">
      <label className="botsettings-field-label">{props.label}</label>
      <label className="botsettings-input-shell ui-input-shell">
        {props.prefix ? <span className="botsettings-input-prefix">{props.prefix}</span> : null}
        <input value={props.value} onChange={(event) => props.onChange(event.target.value)} aria-label={props.label} />
        {props.suffix ? <span className="botsettings-input-suffix">{props.suffix}</span> : null}
      </label>
      {props.note ? <span className="botsettings-field-note">{props.note}</span> : null}
    </div>
  );
}

function ChoiceCard(props: { icon: ReactNode; title: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`botsettings-choice-card ${props.active ? "active" : ""}`} onClick={props.onClick}>
      <div className="botsettings-choice-icon">{props.icon}</div>
      <strong>{props.title}</strong>
    </button>
  );
}

function ToggleRow(props: { title: string; note: string; checked: boolean; onToggle: () => void }) {
  return (
    <div className="botsettings-toggle-card">
      <div className="botsettings-toggle-copy">
        <strong>{props.title}</strong>
        <span>{props.note}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        className={`botsettings-switch ${props.checked ? "is-active" : ""}`}
        onClick={props.onToggle}
      >
        <span />
      </button>
    </div>
  );
}

function NotificationChannelRow(props: { icon: ReactNode; tone: "email" | "telegram" | "discord" | "push"; title: string; meta: string; action: ReactNode }) {
  return (
    <div className="botsettings-channel-row">
      <div className="botsettings-channel-main">
        <div className={`botsettings-channel-icon is-${props.tone}`}>{props.icon}</div>
        <div className="botsettings-channel-copy">
          <strong>{props.title}</strong>
          <span>{props.meta}</span>
        </div>
      </div>
      <div className="botsettings-channel-action">{props.action}</div>
    </div>
  );
}

function SliderField(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  minLabel: string;
  maxLabel: string;
  displayValue: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="botsettings-slider-field">
      <div className="botsettings-slider-head">
        <strong>{props.label}</strong>
        <span>{props.displayValue}</span>
      </div>
      <input
        className="botsettings-slider"
        type="range"
        min={props.min ?? 0}
        max={props.max ?? 100}
        step={props.step ?? 1}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
        aria-label={props.label}
      />
      <div className="botsettings-slider-scale">
        <span>{props.minLabel}</span>
        <span>{props.maxLabel}</span>
      </div>
    </div>
  );
}

function BotAssetBadge({ pair }: { pair: string }) {
  const asset = pair.split("/")[0] || pair;
  return <div className={`botsettings-asset-badge ${getAssetAccentClass(asset)}`}>{asset.slice(0, 1)}</div>;
}

function getBotStatusLabel(status: string) {
  if (status === "active") return "Running";
  if (status === "paused") return "Paused";
  if (status === "draft") return "Draft";
  return "Stopped";
}

function getBotStatusClass(status: string) {
  if (status === "active") return "is-running";
  if (status === "paused") return "is-paused";
  return "is-stopped";
}

function getBotCardTone(status: string) {
  if (status === "active") return "is-running";
  if (status === "paused") return "is-paused";
  return "is-draft";
}

function inferBotPair(slug: string, name: string) {
  if (slug.includes("signal")) return "BTC/USDT";
  if (slug.includes("dca")) return "ETH/USDT";
  if (slug.includes("arbitrage")) return "BNB/USDT";
  if (slug.includes("pump")) return "SOL/USDT";
  if (name.toLowerCase().includes("ai")) return "AI/USDT";
  return "BTC/USDT";
}

function resolveBotTarget(slug: string): ViewName {
  if (slug) return "ai-signal-bot";
  return "ai-signal-bot";
}

function formatStrategyLabel(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatUsd(value: number) {
  if (!Number.isFinite(value) || value === 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function getAssetAccentClass(symbol: string) {
  if (symbol.startsWith("BTC")) return "is-btc";
  if (symbol.startsWith("ETH")) return "is-eth";
  if (symbol.startsWith("SOL")) return "is-sol";
  if (symbol.startsWith("BNB")) return "is-bnb";
  return "is-generic";
}

function BotsSummaryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="7" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.5 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TradeFlowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 7h11m0 0-2.8-2.8M18 7l-2.8 2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 17H6m0 0 2.8-2.8M6 17l2.8 2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProfitSummaryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 15 4.8-4.8 3.2 3.2 6-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6.6h5v5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TargetSummaryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

function BotsTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m12 5 7 3.8-7 3.8-7-3.8L12 5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m5 12.2 7 3.8 7-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m5 15.8 7 3.8 7-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldTabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4.5 18 7v4.5c0 4.2-2.4 6.8-6 8-3.6-1.2-6-3.8-6-8V7l6-2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldAlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4.5 18 7v4.5c0 4.2-2.4 6.8-6 8-3.6-1.2-6-3.8-6-8V7l6-2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 8.2v5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
    </svg>
  );
}

function GridToggleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <rect x="5" y="14" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="14" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ListToggleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 7h10M9 12h10M9 17h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="5.5" cy="7" r="1" fill="currentColor" />
      <circle cx="5.5" cy="12" r="1" fill="currentColor" />
      <circle cx="5.5" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="6.5" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="17.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

function TimeMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4.8l2.8 1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DollarSizeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.5 7.5c0-1.4-1.6-2.5-4.5-2.5s-4.5 1.1-4.5 2.8c0 4.5 9 2 9 6.2c0 1.8-1.7 3-4.5 3s-4.5-1.2-4.5-2.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PercentSizeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 18 12-12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function AutomationBoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2 5.8 12h4.4L9.7 22 17.9 11.7h-4.4L13 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function PerformanceGaugeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 15a7 7 0 1 1 14 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m12 12 3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </svg>
  );
}

function ScheduleClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.7v4.8l2.8 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SelectChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailChannelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="6.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="m6.5 8 5.5 4.3L17.5 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TelegramChannelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m18.8 5.6-2.4 11.5c-.2.9-.8 1.1-1.5.7l-3.2-2.4-1.5 1.4c-.2.2-.3.3-.7.3l.2-3.3 6-5.4c.3-.2-.1-.4-.4-.2l-7.3 4.6-3.1-1c-.8-.2-.8-.8.2-1.2L17.4 5c.7-.3 1.6.2 1.4.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function DiscordChannelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8.5 8.2c1-.4 2-.6 3.1-.7l.4.8c1-.1 2 0 3 .1l.5-.9c1.1.1 2.1.3 3 .7c.9 1.3 1.4 2.7 1.6 4.2c-.9.7-1.8 1.1-2.9 1.4l-.6-.9c-.6.2-1.2.3-1.8.4c-.7.1-1.3.1-2 0c-.6 0-1.2-.2-1.8-.4l-.6.9c-1-.2-2-.7-2.9-1.4c.2-1.5.7-2.9 1.6-4.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10.3" cy="11.4" r="1" fill="currentColor" />
      <circle cx="13.7" cy="11.4" r="1" fill="currentColor" />
    </svg>
  );
}

function PushChannelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="3.5" width="10" height="17" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11 17.3h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AlertChannelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.7v5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
    </svg>
  );
}

function TrashMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 7.5h8M10 7.5V6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.5 8.5 8.2 18a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-9.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10.2 11.3v4.4M13.8 11.3v4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m8 8 8 8M16 8l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SaveMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5.5 5h10.7l2.3 2.3V18.5A1.5 1.5 0 0 1 17 20H7a1.5 1.5 0 0 1-1.5-1.5V5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 5v4.2h7V5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PauseMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9.5 7v10M14.5 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlayMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 7 8 5-8 5V7Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}

function GearMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="2.8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 4.8v2.1M12 17.1v2.1M19.2 12h-2.1M6.9 12H4.8M17.1 6.9l-1.5 1.5M8.4 15.6l-1.5 1.5M17.1 17.1l-1.5-1.5M8.4 8.4L6.9 6.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StopShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4.5 18 7v4.5c0 4.2-2.4 6.8-6 8-3.6-1.2-6-3.8-6-8V7l6-2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 9h6v6H9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ClosePositionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m9 9 6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
