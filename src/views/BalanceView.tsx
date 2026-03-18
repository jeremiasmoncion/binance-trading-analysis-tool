import { useMemo, useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { formatAmount, formatPct, formatPrice, formatSignedPct, formatSignedPrice } from "../lib/format";
import type { BinanceOrderSummary, BinanceTradeSummary, PortfolioAsset, PortfolioPayload } from "../types";

interface BalanceViewProps {
  payload: PortfolioPayload | null;
  period: string;
  hideSmallAssets: boolean;
  onPeriodChange: (period: string) => void;
  onRefresh: () => void;
  onToggleHideSmall: (value: boolean) => void;
}

type WalletTab = "holdings" | "nfts" | "staking" | "history";
type AssetFilter = "all" | "large" | "mid" | "small" | "stablecoins" | "defi";

const STABLE_ASSETS = new Set(["USDT", "USDC", "FDUSD", "DAI", "TUSD", "BUSD"]);
const DEFI_ASSETS = new Set(["UNI", "AAVE", "LINK", "MKR", "LDO", "CRV", "SNX", "COMP", "SUSHI"]);

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

export function BalanceView(props: BalanceViewProps) {
  const [activeTab, setActiveTab] = useState<WalletTab>("holdings");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [assetSearch, setAssetSearch] = useState("");
  const portfolio = props.payload?.portfolio;
  const visibleAssets = getVisibleAssets(props.payload, props.hideSmallAssets);
  const periodLabel = props.period === "30d" ? "30D" : props.period === "7d" ? "7D" : "Today";
  const positiveAssets = visibleAssets.filter((asset) => asset.pnlValue > 0);
  const negativeAssets = visibleAssets.filter((asset) => asset.pnlValue < 0);
  const bestPerformer = visibleAssets.slice().sort((a, b) => b.pnlPct - a.pnlPct)[0];
  const allocation = useMemo(() => buildAllocation(visibleAssets), [visibleAssets]);
  const allocationGradient = useMemo(() => buildAllocationGradient(allocation), [allocation]);
  const filteredAssets = useMemo(() => {
    return visibleAssets.filter((asset) => {
      const matchesFilter = assetFilter === "all" ? true : classifyAsset(asset) === assetFilter;
      const needle = assetSearch.trim().toUpperCase();
      const matchesSearch = needle ? asset.asset.includes(needle) || asset.symbol.includes(needle) : true;
      return matchesFilter && matchesSearch;
    });
  }, [assetFilter, assetSearch, visibleAssets]);

  return (
    <div id="balanceView" className="view-panel active wallet-template-view">
      <div className="wallet-hero-card">
        <div className="wallet-hero-main">
          <div className="wallet-hero-icon">C</div>
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

        <div className="wallet-hero-metrics">
          <div className="wallet-hero-metric-box">
            <div className="wallet-hero-metric-label">Today's P&amp;L</div>
            <div className={`wallet-hero-metric-value ${getPerformanceClass(portfolio?.realizedPnl || 0)}`}>{formatSignedPrice(portfolio?.realizedPnl || 0)}</div>
          </div>
          <div className="wallet-hero-metric-box">
            <div className="wallet-hero-metric-label">{periodLabel} P&amp;L</div>
            <div className={`wallet-hero-metric-value ${getPerformanceClass(portfolio?.periodChangeValue || 0)}`}>{formatSignedPrice(portfolio?.periodChangeValue || 0)}</div>
          </div>
          <div className="wallet-hero-metric-box">
            <div className="wallet-hero-metric-label">Open P&amp;L</div>
            <div className={`wallet-hero-metric-value ${getPerformanceClass(portfolio?.unrealizedPnl || 0)}`}>{formatSignedPrice(portfolio?.unrealizedPnl || 0)}</div>
          </div>
          <div className="wallet-hero-metric-box">
            <div className="wallet-hero-metric-label">All Time</div>
            <div className={`wallet-hero-metric-value ${getPerformanceClass(portfolio?.totalPnl || 0)}`}>{formatSignedPrice(portfolio?.totalPnl || 0)}</div>
          </div>
        </div>
      </div>

      <div className="wallet-toolbar-row">
        <div className="wallet-tab-bar">
          <button className={`wallet-tab-button ${activeTab === "holdings" ? "active" : ""}`} onClick={() => setActiveTab("holdings")}>Holdings</button>
          <button className={`wallet-tab-button ${activeTab === "nfts" ? "active" : ""}`} onClick={() => setActiveTab("nfts")}>NFTs</button>
          <button className={`wallet-tab-button ${activeTab === "staking" ? "active" : ""}`} onClick={() => setActiveTab("staking")}>Staking</button>
          <button className={`wallet-tab-button ${activeTab === "history" ? "active" : ""}`} onClick={() => setActiveTab("history")}>History</button>
        </div>

        <div className="wallet-toolbar-actions">
          <button className="wallet-secondary-button" onClick={() => props.onToggleHideSmall(!props.hideSmallAssets)}>
            {props.hideSmallAssets ? "Show All" : "Filters"}
          </button>
          <button className="wallet-secondary-button" onClick={props.onRefresh}>Export</button>
        </div>
      </div>

      {activeTab === "holdings" ? (
        <>
          <div className="wallet-quick-stats-grid">
            <div className="wallet-quick-card">
              <div>
                <div className="wallet-quick-label">Total Assets</div>
                <div className="wallet-quick-value">{visibleAssets.length}</div>
                <div className="wallet-quick-chip">{props.payload?.summary?.accountType || "SPOT"} Account</div>
              </div>
              <div className="wallet-quick-icon wallet-quick-icon-info">◎</div>
            </div>

            <div className="wallet-quick-card">
              <div>
                <div className="wallet-quick-label">In Profit</div>
                <div className="wallet-quick-value wallet-positive">{positiveAssets.length}</div>
                <div className="wallet-quick-chip wallet-positive">{visibleAssets.length ? formatPct((positiveAssets.length / visibleAssets.length) * 100) : "0%"}</div>
              </div>
              <div className="wallet-quick-icon wallet-quick-icon-success">↗</div>
            </div>

            <div className="wallet-quick-card">
              <div>
                <div className="wallet-quick-label">In Loss</div>
                <div className="wallet-quick-value wallet-negative">{negativeAssets.length}</div>
                <div className="wallet-quick-chip wallet-negative">{visibleAssets.length ? formatPct((negativeAssets.length / visibleAssets.length) * 100) : "0%"}</div>
              </div>
              <div className="wallet-quick-icon wallet-quick-icon-danger">↘</div>
            </div>

            <div className="wallet-quick-card">
              <div>
                <div className="wallet-quick-label">Best Performer</div>
                <div className="wallet-quick-value">{bestPerformer?.asset || "--"}</div>
                <div className={`wallet-quick-chip ${getPerformanceClass(bestPerformer?.pnlPct || 0)}`}>{bestPerformer ? formatSignedPct(bestPerformer.pnlPct) : "--"}</div>
              </div>
              <div className="wallet-quick-icon wallet-quick-icon-accent">{bestPerformer?.asset?.slice(0, 3) || "TOP"}</div>
            </div>
          </div>

          <div className="wallet-main-grid">
            <section className="wallet-holdings-card">
              <div className="wallet-card-header">
                <div className="wallet-card-title-block">
                  <h3 className="wallet-card-title">Asset Holdings</h3>
                </div>
                <div className="wallet-card-tools">
                  <div className="wallet-search-shell">
                    <input
                      value={assetSearch}
                      onChange={(event) => setAssetSearch(event.target.value)}
                      placeholder="Search assets..."
                    />
                  </div>
                  <button className="wallet-secondary-button" onClick={props.onRefresh}>Sort</button>
                </div>
              </div>

              <div className="wallet-filter-chip-row">
                <button className={`wallet-filter-chip ${assetFilter === "all" ? "active" : ""}`} onClick={() => setAssetFilter("all")}>All Assets</button>
                <button className={`wallet-filter-chip ${assetFilter === "large" ? "active" : ""}`} onClick={() => setAssetFilter("large")}>Large Cap</button>
                <button className={`wallet-filter-chip ${assetFilter === "mid" ? "active" : ""}`} onClick={() => setAssetFilter("mid")}>Mid Cap</button>
                <button className={`wallet-filter-chip ${assetFilter === "small" ? "active" : ""}`} onClick={() => setAssetFilter("small")}>Small Cap</button>
                <button className={`wallet-filter-chip ${assetFilter === "stablecoins" ? "active" : ""}`} onClick={() => setAssetFilter("stablecoins")}>Stablecoins</button>
                <button className={`wallet-filter-chip ${assetFilter === "defi" ? "active" : ""}`} onClick={() => setAssetFilter("defi")}>DeFi</button>
              </div>

              <div className="wallet-table-shell">
                <table className="wallet-assets-table">
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
                      filteredAssets.map((asset) => <WalletAssetRow key={asset.asset} asset={asset} />)
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="wallet-allocation-card">
              <h3 className="wallet-card-title">Portfolio Allocation</h3>
              <div className="wallet-allocation-donut" style={{ backgroundImage: allocationGradient }}>
                <div className="wallet-allocation-center">
                  <div className="wallet-allocation-center-value">{visibleAssets.length}</div>
                  <div className="wallet-allocation-center-label">Assets</div>
                </div>
              </div>
              <div className="wallet-allocation-legend">
                {allocation.length ? (
                  allocation.map((asset) => (
                    <div key={asset.asset} className="wallet-allocation-row">
                      <div className="wallet-allocation-asset">
                        <span className="wallet-allocation-dot" style={{ backgroundColor: asset.color }} />
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
        <div className="wallet-history-stack">
          <WalletHistoryPanel title="Open Orders" subtitle="Órdenes aún activas o parciales.">
            <WalletOrderTable orders={props.payload?.openOrders || []} emptyMessage="No hay órdenes abiertas en esta cuenta." />
          </WalletHistoryPanel>

          <WalletHistoryPanel title="Recent Orders" subtitle="Órdenes completadas o canceladas recientemente.">
            <WalletClosedOrderTable orders={props.payload?.recentOrders || []} emptyMessage="Todavía no hay órdenes recientes visibles." />
          </WalletHistoryPanel>

          <WalletHistoryPanel title="Trade History" subtitle="Trades ejecutados con comisión y PnL realizado.">
            <WalletTradeTable trades={props.payload?.recentTrades || []} emptyMessage="Aún no hay trades recientes para construir historial." />
          </WalletHistoryPanel>
        </div>
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
          <div className="wallet-asset-icon">{asset.asset.slice(0, 1)}</div>
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
        <span className={`wallet-pill ${pnlClass}`}>{formatSignedPrice(asset.pnlValue)}</span>
      </td>
      <td>
        <button type="button" className="wallet-row-action">•••</button>
      </td>
    </tr>
  );
}

function WalletHistoryPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="wallet-history-card">
      <div className="wallet-card-header">
        <div className="wallet-card-title-block">
          <h3 className="wallet-card-title">{title}</h3>
          <p className="wallet-card-subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="wallet-table-shell">{children}</div>
    </section>
  );
}

function WalletOrderTable({ orders, emptyMessage }: { orders: BinanceOrderSummary[]; emptyMessage: string }) {
  return (
    <table className="wallet-assets-table">
      <thead>
        <tr>
          <th>Pair</th>
          <th>Side</th>
          <th>Type</th>
          <th>Price</th>
          <th>Qty</th>
          <th>Filled</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {!orders.length ? (
          <tr><td colSpan={7}><EmptyState message={emptyMessage} /></td></tr>
        ) : (
          orders.map((order, index) => (
            <tr key={`${order.symbol}-${order.updateTime}-${index}`}>
              <td>{order.symbol}</td>
              <td className={order.side === "BUY" ? "wallet-positive" : "wallet-negative"}>{order.side}</td>
              <td>{order.type}</td>
              <td>{order.price > 0 ? formatPrice(order.price) : "Market"}</td>
              <td>{formatAmount(order.origQty)}</td>
              <td>{formatAmount(order.executedQty)}</td>
              <td>{order.status}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function WalletClosedOrderTable({ orders, emptyMessage }: { orders: BinanceOrderSummary[]; emptyMessage: string }) {
  return (
    <table className="wallet-assets-table">
      <thead>
        <tr>
          <th>Pair</th>
          <th>Side</th>
          <th>Type</th>
          <th>Status</th>
          <th>Filled</th>
          <th>Value</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        {!orders.length ? (
          <tr><td colSpan={7}><EmptyState message={emptyMessage} /></td></tr>
        ) : (
          orders.map((order, index) => (
            <tr key={`${order.symbol}-${order.updateTime}-${index}`}>
              <td>{order.symbol}</td>
              <td className={order.side === "BUY" ? "wallet-positive" : "wallet-negative"}>{order.side}</td>
              <td>{order.type}</td>
              <td>{order.status}</td>
              <td>{formatAmount(order.executedQty)}</td>
              <td>{formatPrice(order.quoteQty)}</td>
              <td>{new Date(order.updateTime).toLocaleString("es-DO")}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function WalletTradeTable({ trades, emptyMessage }: { trades: BinanceTradeSummary[]; emptyMessage: string }) {
  return (
    <table className="wallet-assets-table">
      <thead>
        <tr>
          <th>Trade</th>
          <th>Side</th>
          <th>Price</th>
          <th>Qty</th>
          <th>Value</th>
          <th>Commission</th>
          <th>P&amp;L</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        {!trades.length ? (
          <tr><td colSpan={8}><EmptyState message={emptyMessage} /></td></tr>
        ) : (
          trades.map((trade, index) => (
            <tr key={`${trade.symbol}-${trade.time}-${index}`}>
              <td>{trade.symbol}</td>
              <td className={trade.side === "BUY" ? "wallet-positive" : "wallet-negative"}>{trade.side}</td>
              <td>{formatPrice(trade.price)}</td>
              <td>{formatAmount(trade.qty)}</td>
              <td>{formatPrice(trade.value)}</td>
              <td>{formatAmount(trade.commission)} {trade.commissionAsset}</td>
              <td className={getPerformanceClass(trade.realizedPnl || 0)}>{formatSignedPrice(trade.realizedPnl || 0)}</td>
              <td>{new Date(trade.time).toLocaleString("es-DO")}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
