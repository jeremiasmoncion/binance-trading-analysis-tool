import { useEffect, useMemo, useState } from "react";
import { ArrowUpDownIcon, CoinsIcon, DownloadIcon, SearchIcon, SlidersHorizontalIcon, TrendDownIcon, TrendUpIcon, WalletIcon } from "../components/Icons";
import { EmptyState } from "../components/ui/EmptyState";
import { formatAmount, formatPct, formatPrice, formatSignedPct, formatSignedPrice } from "../lib/format";
import type { BinanceAccountMovement, PortfolioAsset, PortfolioPayload } from "../types";

interface BalanceViewProps {
  payload: PortfolioPayload | null;
  period: string;
  hideSmallAssets: boolean;
  onPeriodChange: (period: string) => void;
  onRefresh: () => void;
  onRefreshFull: () => void;
  onToggleHideSmall: (value: boolean) => void;
}

type WalletTab = "holdings" | "nfts" | "staking" | "history";
type AssetFilter = "all" | "large" | "mid" | "small" | "stablecoins" | "defi";
type MovementFilter = "all" | "deposit" | "withdrawal";
type AssetSortDirection = "desc" | "asc";

const STABLE_ASSETS = new Set(["USDT", "USDC", "FDUSD", "DAI", "TUSD", "BUSD"]);
const DEFI_ASSETS = new Set(["UNI", "AAVE", "LINK", "MKR", "LDO", "CRV", "SNX", "COMP", "SUSHI"]);
const ASSET_ICON_SLUGS: Record<string, string> = {
  BTC: "btc",
  ETH: "eth",
  BNB: "bnb",
  SOL: "sol",
  XRP: "xrp",
  ADA: "ada",
  DOGE: "doge",
  AVAX: "avax",
  LINK: "link",
  DOT: "dot",
  LTC: "ltc",
  BCH: "bch",
  UNI: "uni",
  AAVE: "aave",
  MKR: "mkr",
  CRV: "crv",
  SNX: "snx",
  COMP: "comp",
  SUSHI: "sushi",
  USDT: "usdt",
  USDC: "usdc",
  FDUSD: "fdusd",
  DAI: "dai",
  TUSD: "tusd",
  BUSD: "busd",
  TRX: "trx",
  TON: "ton",
  TAO: "tao",
  SHIB: "shib",
  PEPE: "pepe",
  WIF: "wif",
};

function getVisibleAssets(payload: PortfolioPayload | null, hideSmallAssets: boolean) {
  const assets = payload?.assets || [];
  return hideSmallAssets ? assets.filter((asset) => Number(asset.marketValue || 0) >= 1) : assets;
}

function getPerformanceClass(value: number) {
  if (value > 0) return "wallet-positive";
  if (value < 0) return "wallet-negative";
  return "wallet-neutral";
}

function classifyAsset(asset: PortfolioAsset): AssetFilter {
  if (STABLE_ASSETS.has(asset.asset)) return "stablecoins";
  if (DEFI_ASSETS.has(asset.asset)) return "defi";
  if (asset.marketValue >= 10_000) return "large";
  if (asset.marketValue >= 1_000) return "mid";
  return "small";
}

function buildAllocation(assets: PortfolioAsset[]) {
  const ranked = assets
    .filter((asset) => asset.marketValue > 0)
    .sort((a, b) => b.marketValue - a.marketValue)
    .slice(0, 5);
  const total = ranked.reduce((sum, asset) => sum + asset.marketValue, 0);
  return ranked.map((asset, index) => ({
    ...asset,
    sharePct: total > 0 ? (asset.marketValue / total) * 100 : 0,
    color: ["#f59e0b", "#6366f1", "#8b5cf6", "#ef4444", "#14b8a6"][index] || "#94a3b8",
  }));
}

function buildAllocationGradient(items: ReturnType<typeof buildAllocation>) {
  if (!items.length) {
    return "conic-gradient(#1e293b 0deg 360deg)";
  }

  let current = 0;
  const stops = items.map((item) => {
    const start = current;
    current += (item.sharePct / 100) * 360;
    return `${item.color} ${start}deg ${current}deg`;
  });
  if (current < 360) {
    stops.push(`#1e293b ${current}deg 360deg`);
  }
  return `conic-gradient(${stops.join(", ")})`;
}

function formatMovementDate(time: number) {
  if (!time) return "Sin fecha";
  return new Intl.DateTimeFormat("es-DO", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

function getMovementStatusLabel(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (["1", "6", "completed", "success"].includes(normalized)) return "Completado";
  if (["0", "pending", "processing"].includes(normalized)) return "Pendiente";
  if (["cancelled", "rejected", "failed"].includes(normalized)) return "Fallido";
  return status || "Desconocido";
}

function getAssetIconUrl(asset: string) {
  const normalized = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const slug = ASSET_ICON_SLUGS[normalized] || normalized.toLowerCase();
  return `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${slug}.png`;
}

function AssetLogo({
  asset,
  className = "",
  fallbackClassName = "",
}: {
  asset: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const iconUrl = getAssetIconUrl(asset);
  const initials = asset.slice(0, 3);

  if (!asset || failed) {
    return <div className={`${className} ${fallbackClassName}`.trim()}>{initials}</div>;
  }

  return (
    <img
      src={iconUrl}
      alt={`${asset} logo`}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function BalanceView(props: BalanceViewProps) {
  const [activeTab, setActiveTab] = useState<WalletTab>("holdings");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetSortDirection, setAssetSortDirection] = useState<AssetSortDirection>("desc");
  const [assetPage, setAssetPage] = useState(1);
  const [historyBootstrapped, setHistoryBootstrapped] = useState(false);
  const portfolio = props.payload?.portfolio;
  const visibleAssets = getVisibleAssets(props.payload, props.hideSmallAssets);
  const periodLabel = props.period === "30d" ? "30D" : props.period === "7d" ? "7D" : "24H";
  const positiveAssets = visibleAssets.filter((asset) => asset.pnlValue > 0);
  const negativeAssets = visibleAssets.filter((asset) => asset.pnlValue < 0);
  const bestPerformer = visibleAssets.slice().sort((a, b) => b.pnlPct - a.pnlPct)[0];
  const selectedWindowLabel = props.period === "30d" ? "30D P&L" : props.period === "7d" ? "7D P&L" : "24H P&L";
  const allocation = useMemo(() => buildAllocation(visibleAssets), [visibleAssets]);
  const allocationGradient = useMemo(() => buildAllocationGradient(allocation), [allocation]);
  const accountMovements = props.payload?.accountMovements || [];
  const filteredAssets = useMemo(() => {
    const matches = visibleAssets.filter((asset) => {
      const matchesFilter = assetFilter === "all" ? true : classifyAsset(asset) === assetFilter;
      const needle = assetSearch.trim().toUpperCase();
      const matchesSearch = needle ? asset.asset.includes(needle) || asset.symbol.includes(needle) : true;
      return matchesFilter && matchesSearch;
    });
    return matches.sort((left, right) => (
      assetSortDirection === "desc"
        ? Number(right.marketValue || 0) - Number(left.marketValue || 0)
        : Number(left.marketValue || 0) - Number(right.marketValue || 0)
    ));
  }, [assetFilter, assetSearch, assetSortDirection, visibleAssets]);
  const filteredMovements = useMemo(() => {
    return accountMovements.filter((movement) => movementFilter === "all" ? true : movement.type === movementFilter);
  }, [accountMovements, movementFilter]);
  const assetPageSize = 10;
  const totalAssetPages = Math.max(1, Math.ceil(filteredAssets.length / assetPageSize));
  const paginatedAssets = useMemo(() => {
    const start = (assetPage - 1) * assetPageSize;
    return filteredAssets.slice(start, start + assetPageSize);
  }, [assetPage, filteredAssets]);

  useEffect(() => {
    if (activeTab === "history" && !historyBootstrapped) {
      props.onRefreshFull();
      setHistoryBootstrapped(true);
    }
    if (activeTab !== "history" && historyBootstrapped) {
      setHistoryBootstrapped(false);
    }
  }, [activeTab, historyBootstrapped, props.onRefreshFull]);

  useEffect(() => {
    setAssetPage(1);
  }, [assetFilter, assetSearch, assetSortDirection]);

  useEffect(() => {
    if (assetPage > totalAssetPages) {
      setAssetPage(totalAssetPages);
    }
  }, [assetPage, totalAssetPages]);

  return (
    <div id="balanceView" className="view-panel active wallet-template-view">
      <div className="wallet-hero-card">
        <div className="wallet-hero-main">
          <div className="wallet-hero-icon">
            <WalletIcon />
          </div>
          <div className="wallet-hero-copy">
            <div className="wallet-hero-label">Total Portfolio Value</div>
            <div className="wallet-hero-value">{formatPrice(portfolio?.totalValue || 0)}</div>
            <div className="wallet-hero-change-row">
              <span className={`wallet-hero-badge ${getPerformanceClass(portfolio?.periodChangeValue || 0)}`}>
                {formatSignedPrice(portfolio?.periodChangeValue || 0)} ({formatSignedPct(portfolio?.periodChangePct || 0)})
              </span>
              <span className="wallet-hero-change-label">{periodLabel} Change</span>
            </div>
          </div>
        </div>

        <div className="wallet-hero-metrics ui-metric-grid">
          <div className="wallet-hero-metric-box ui-metric-box">
            <div className="wallet-hero-metric-label ui-metric-box-label">Today's P&amp;L</div>
            <div className={`wallet-hero-metric-value ui-metric-box-value ${getPerformanceClass(portfolio?.realizedPnl || 0)}`}>{formatSignedPrice(portfolio?.realizedPnl || 0)}</div>
          </div>
          <div className="wallet-hero-metric-box ui-metric-box">
            <div className="wallet-hero-metric-label ui-metric-box-label">{selectedWindowLabel}</div>
            <div className={`wallet-hero-metric-value ui-metric-box-value ${getPerformanceClass(portfolio?.periodChangeValue || 0)}`}>{formatSignedPrice(portfolio?.periodChangeValue || 0)}</div>
          </div>
          <div className="wallet-hero-metric-box ui-metric-box">
            <div className="wallet-hero-metric-label ui-metric-box-label">Open P&amp;L</div>
            <div className={`wallet-hero-metric-value ui-metric-box-value ${getPerformanceClass(portfolio?.unrealizedPnl || 0)}`}>{formatSignedPrice(portfolio?.unrealizedPnl || 0)}</div>
          </div>
          <div className="wallet-hero-metric-box ui-metric-box">
            <div className="wallet-hero-metric-label ui-metric-box-label">All Time</div>
            <div className={`wallet-hero-metric-value ui-metric-box-value ${getPerformanceClass(portfolio?.totalPnl || 0)}`}>{formatSignedPrice(portfolio?.totalPnl || 0)}</div>
          </div>
        </div>
      </div>

      <div className="wallet-toolbar-row ui-toolbar">
        <div className="wallet-tab-bar">
          <button className={`wallet-tab-button ui-chip ${activeTab === "holdings" ? "active" : ""}`} onClick={() => setActiveTab("holdings")}>Holdings</button>
          <button className={`wallet-tab-button ui-chip ${activeTab === "nfts" ? "active" : ""}`} onClick={() => setActiveTab("nfts")}>NFTs</button>
          <button className={`wallet-tab-button ui-chip ${activeTab === "staking" ? "active" : ""}`} onClick={() => setActiveTab("staking")}>Staking</button>
          <button className={`wallet-tab-button ui-chip ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>History</button>
        </div>

        <div className="wallet-toolbar-actions ui-toolbar-actions">
          <button className="wallet-secondary-button ui-button" onClick={() => props.onToggleHideSmall(!props.hideSmallAssets)}>
            <SlidersHorizontalIcon />
            Filters
          </button>
          <button className="wallet-secondary-button ui-button" onClick={props.onRefresh}>
            <DownloadIcon />
            Export
          </button>
        </div>
      </div>

      {activeTab === "holdings" ? (
        <>
          <div className="wallet-quick-stats-grid ui-summary-grid">
            <div className="wallet-quick-card ui-summary-card">
              <div className="wallet-quick-copy ui-summary-card-copy">
                <div className="wallet-quick-label ui-summary-card-label">Total Assets</div>
                <div className="wallet-quick-value ui-summary-card-value">{visibleAssets.length}</div>
                <div className="wallet-quick-chip wallet-quick-chip-info ui-pill">{props.payload?.summary?.accountType || "SPOT"} Account</div>
              </div>
              <div className="wallet-quick-icon wallet-quick-icon-info ui-summary-card-icon">
                <CoinsIcon />
              </div>
            </div>

            <div className="wallet-quick-card ui-summary-card">
              <div className="wallet-quick-copy ui-summary-card-copy">
                <div className="wallet-quick-label ui-summary-card-label">In Profit</div>
                <div className="wallet-quick-value ui-summary-card-value wallet-positive">{positiveAssets.length}</div>
                <div className="wallet-quick-chip wallet-positive ui-pill">{visibleAssets.length ? formatPct((positiveAssets.length / visibleAssets.length) * 100) : "0%"}</div>
              </div>
              <div className="wallet-quick-icon wallet-quick-icon-success ui-summary-card-icon">
                <TrendUpIcon />
              </div>
            </div>

            <div className="wallet-quick-card ui-summary-card">
              <div className="wallet-quick-copy ui-summary-card-copy">
                <div className="wallet-quick-label ui-summary-card-label">In Loss</div>
                <div className="wallet-quick-value ui-summary-card-value wallet-negative">{negativeAssets.length}</div>
                <div className="wallet-quick-chip wallet-negative ui-pill">{visibleAssets.length ? formatPct((negativeAssets.length / visibleAssets.length) * 100) : "0%"}</div>
              </div>
              <div className="wallet-quick-icon wallet-quick-icon-danger ui-summary-card-icon">
                <TrendDownIcon />
              </div>
            </div>

            <div className="wallet-quick-card ui-summary-card">
              <div className="wallet-quick-copy ui-summary-card-copy">
                <div className="wallet-quick-label ui-summary-card-label">Best Performer</div>
                <div className="wallet-quick-value ui-summary-card-value">{bestPerformer?.asset || "--"}</div>
                <div className={`wallet-quick-chip ui-pill ${getPerformanceClass(bestPerformer?.pnlPct || 0)}`}>{bestPerformer ? formatSignedPct(bestPerformer.pnlPct) : "--"}</div>
              </div>
              {bestPerformer ? (
                <AssetLogo
                  asset={bestPerformer.asset}
                  className="wallet-quick-asset-logo"
                  fallbackClassName="wallet-quick-icon wallet-quick-icon-accent ui-summary-card-icon wallet-quick-asset-fallback"
                />
              ) : (
                <div className="wallet-quick-icon wallet-quick-icon-accent ui-summary-card-icon">TOP</div>
              )}
            </div>
          </div>

          <div className="wallet-main-grid">
            <section className="wallet-holdings-card">
              <div className="wallet-card-header">
                <div className="wallet-card-title-block">
                  <h3 className="wallet-card-title">Asset Holdings</h3>
                </div>
                <div className="wallet-card-tools">
                  <div className="wallet-search-shell ui-input-shell">
                    <SearchIcon />
                    <input
                      value={assetSearch}
                      onChange={(event) => setAssetSearch(event.target.value)}
                      placeholder="Search assets..."
                    />
                  </div>
                  <button
                    className="wallet-secondary-button ui-button"
                    onClick={() => setAssetSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))}
                  >
                    <ArrowUpDownIcon />
                    Sort {assetSortDirection === "desc" ? "↓" : "↑"}
                  </button>
                </div>
              </div>

              <div className="wallet-filter-chip-row ui-chip-row">
                <button className={`wallet-filter-chip ui-chip ${assetFilter === "all" ? "active" : ""}`} onClick={() => setAssetFilter("all")}>All Assets</button>
                <button className={`wallet-filter-chip ui-chip ${assetFilter === "large" ? "active" : ""}`} onClick={() => setAssetFilter("large")}>Large Cap</button>
                <button className={`wallet-filter-chip ui-chip ${assetFilter === "mid" ? "active" : ""}`} onClick={() => setAssetFilter("mid")}>Mid Cap</button>
                <button className={`wallet-filter-chip ui-chip ${assetFilter === "small" ? "active" : ""}`} onClick={() => setAssetFilter("small")}>Small Cap</button>
                <button className={`wallet-filter-chip ui-chip ${assetFilter === "stablecoins" ? "active" : ""}`} onClick={() => setAssetFilter("stablecoins")}>Stablecoins</button>
                <button className={`wallet-filter-chip ui-chip ${assetFilter === "defi" ? "active" : ""}`} onClick={() => setAssetFilter("defi")}>DeFi</button>
              </div>

              <div className="wallet-table-shell ui-table-shell">
                <table className="wallet-assets-table ui-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Price</th>
                      <th>24H</th>
                      <th>Holdings</th>
                      <th>Value</th>
                      <th>P&amp;L</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {!filteredAssets.length ? (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState message="No encontramos activos con ese filtro en esta cuenta." />
                        </td>
                      </tr>
                    ) : (
                      paginatedAssets.map((asset) => <WalletAssetRow key={asset.asset} asset={asset} />)
                    )}
                  </tbody>
                </table>
              </div>

              {filteredAssets.length ? (
                <div className="wallet-pagination-row">
                  <div className="wallet-pagination-copy">
                    Mostrando {(assetPage - 1) * assetPageSize + 1}-{Math.min(assetPage * assetPageSize, filteredAssets.length)} de {filteredAssets.length} activos
                  </div>
                  <div className="wallet-pagination-actions">
                    <button
                      className="wallet-secondary-button ui-button"
                      onClick={() => setAssetPage((page) => Math.max(1, page - 1))}
                      disabled={assetPage === 1}
                    >
                      Anterior
                    </button>
                    <span className="wallet-pagination-pill">Página {assetPage} / {totalAssetPages}</span>
                    <button
                      className="wallet-secondary-button ui-button"
                      onClick={() => setAssetPage((page) => Math.min(totalAssetPages, page + 1))}
                      disabled={assetPage === totalAssetPages}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <aside className="wallet-allocation-card">
              <h3 className="wallet-card-title">Portfolio Allocation</h3>
              <div className="wallet-allocation-donut" style={{ backgroundImage: allocationGradient }}>
                <div className="wallet-allocation-center">
                  <div className="wallet-allocation-center-value">{visibleAssets.length}</div>
                  <div className="wallet-allocation-center-label">Assets</div>
                </div>
              </div>
              <div className="wallet-allocation-legend ui-legend">
                {allocation.length ? (
                  allocation.map((asset) => (
                    <div key={asset.asset} className="wallet-allocation-row ui-legend-row">
                      <div className="wallet-allocation-asset ui-legend-key">
                        <span
                          className="wallet-allocation-dot"
                          style={{ backgroundColor: asset.color }}
                          aria-hidden="true"
                        />
                        <span>{asset.asset}</span>
                      </div>
                      <span>{formatPct(asset.sharePct)}</span>
                    </div>
                  ))
                ) : (
                  <div className="wallet-allocation-empty">Todavía no hay asignación visible.</div>
                )}
              </div>
            </aside>
          </div>
        </>
      ) : null}

      {activeTab === "nfts" ? (
        <div className="wallet-placeholder-card">
          <h3 className="wallet-card-title">NFTs</h3>
          <p className="wallet-placeholder-copy">Aquí vamos a mostrar colecciones, floor price y distribución NFT cuando esa capa entre al producto.</p>
        </div>
      ) : null}

      {activeTab === "staking" ? (
        <div className="wallet-placeholder-card">
          <h3 className="wallet-card-title">Staking</h3>
          <p className="wallet-placeholder-copy">Esta sección quedará preparada para rendimiento, APR, lockups y estrategias de staking más adelante.</p>
        </div>
      ) : null}

      {activeTab === "history" ? (
        <section className="wallet-history-card wallet-funding-history-card">
          <div className="wallet-card-header">
            <div className="wallet-card-title-block">
              <h3 className="wallet-card-title">Transaction History</h3>
              <p className="wallet-card-subtitle">Movimientos de fondos de la cuenta, como depósitos y retiros, sin incluir operaciones de trading.</p>
            </div>
            <div className="wallet-card-tools">
              <div className="wallet-history-filter-row">
                <button className={`wallet-filter-chip ui-chip ${movementFilter === "all" ? "active" : ""}`} onClick={() => setMovementFilter("all")}>All Types</button>
                <button className={`wallet-filter-chip ui-chip ${movementFilter === "deposit" ? "active" : ""}`} onClick={() => setMovementFilter("deposit")}>Deposits</button>
                <button className={`wallet-filter-chip ui-chip ${movementFilter === "withdrawal" ? "active" : ""}`} onClick={() => setMovementFilter("withdrawal")}>Withdrawals</button>
              </div>
            </div>
          </div>

          <div className="wallet-history-movement-stack">
            {filteredMovements.length ? (
              filteredMovements.map((movement) => <WalletMovementCard key={movement.id} movement={movement} />)
            ) : (
              <div className="wallet-history-empty">
                <EmptyState message="Todavía no encontramos depósitos o retiros visibles en esta cuenta Binance Demo." />
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function WalletAssetRow({ asset }: { asset: PortfolioAsset }) {
  const pnlClass = getPerformanceClass(asset.pnlValue);
  const periodClass = getPerformanceClass(asset.periodChangeValue);

  return (
    <tr>
      <td>
        <div className="wallet-asset-cell">
          <AssetLogo
            asset={asset.asset}
            className="wallet-asset-logo"
            fallbackClassName="wallet-asset-icon"
          />
          <div>
            <div className="wallet-asset-name">{asset.asset}</div>
            <div className="wallet-asset-symbol">{asset.symbol}</div>
          </div>
        </div>
      </td>
      <td>{formatPrice(asset.currentPrice)}</td>
      <td className={periodClass}>{formatSignedPct(asset.periodChangePct)}</td>
      <td>
        <div className="wallet-holdings-cell">
          <strong>{formatAmount(asset.quantity)}</strong>
          <span>{asset.asset}</span>
        </div>
      </td>
      <td>{formatPrice(asset.marketValue)}</td>
      <td>
        <span className={`wallet-pill ui-pill ${pnlClass}`}>{formatSignedPrice(asset.pnlValue)}</span>
      </td>
      <td>
        <button type="button" className="wallet-row-action ui-row-action">•••</button>
      </td>
    </tr>
  );
}

function WalletMovementCard({ movement }: { movement: BinanceAccountMovement }) {
  const isDeposit = movement.type === "deposit";
  const statusLabel = getMovementStatusLabel(movement.status);

  return (
    <article className="wallet-movement-card">
      <div className="wallet-movement-main">
        <div className={`wallet-movement-icon ${isDeposit ? "wallet-movement-icon-deposit" : "wallet-movement-icon-withdrawal"}`}>
          {isDeposit ? <TrendUpIcon /> : <TrendDownIcon />}
        </div>
        <div className="wallet-movement-copy">
          <div className="wallet-movement-title-row">
            <h4 className="wallet-movement-title">{isDeposit ? "Deposit" : "Withdrawal"}</h4>
            <span className={`wallet-movement-status ${statusLabel === "Completado" ? "wallet-positive" : statusLabel === "Pendiente" ? "wallet-neutral" : "wallet-negative"}`}>{statusLabel}</span>
          </div>
          <div className="wallet-movement-meta">{formatMovementDate(movement.time)}</div>
          <div className="wallet-movement-submeta">
            <span>{movement.asset}</span>
            {movement.network ? <span>{movement.network}</span> : null}
          </div>
        </div>
      </div>
      <div className="wallet-movement-values">
        <div className={`wallet-movement-amount ${isDeposit ? "wallet-positive" : "wallet-negative"}`}>
          {isDeposit ? "+" : "-"}{formatAmount(movement.amount)} {movement.asset}
        </div>
        <div className="wallet-movement-usd">{movement.estimatedUsdValue ? formatPrice(movement.estimatedUsdValue) : "Valor no disponible"}</div>
      </div>
    </article>
  );
}
