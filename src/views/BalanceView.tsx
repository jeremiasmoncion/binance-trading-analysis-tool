import { useEffect, useMemo, useState } from "react";
import { SearchIcon } from "../components/Icons";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
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

const PAGE_SIZE = 10;

function getPerformanceClass(value: number) {
  if (value > 0) return "portfolio-positive";
  if (value < 0) return "portfolio-negative";
  return "portfolio-neutral";
}

function getVisibleAssets(payload: PortfolioPayload | null, hideSmallAssets: boolean) {
  const assets = payload?.assets || [];
  return hideSmallAssets ? assets.filter((asset) => Number(asset.marketValue || 0) >= 1) : assets;
}

export function BalanceView(props: BalanceViewProps) {
  const [assetPage, setAssetPage] = useState(1);
  const [openOrdersPage, setOpenOrdersPage] = useState(1);
  const [closedOrdersPage, setClosedOrdersPage] = useState(1);
  const [tradesPage, setTradesPage] = useState(1);
  const portfolio = props.payload?.portfolio;
  const visibleAssets = getVisibleAssets(props.payload, props.hideSmallAssets);
  const openOrders = props.payload?.openOrders || [];
  const recentOrders = props.payload?.recentOrders || [];
  const recentTrades = props.payload?.recentTrades || [];
  const nonUsdtAssets = visibleAssets.filter((asset) => asset.asset !== "USDT");
  const winner = nonUsdtAssets.slice().sort((a, b) => b.pnlValue - a.pnlValue)[0];
  const loser = nonUsdtAssets.slice().sort((a, b) => a.pnlValue - b.pnlValue)[0];
  const dominant = nonUsdtAssets.slice().sort((a, b) => b.marketValue - a.marketValue)[0];
  const totalVisibleValue = visibleAssets.reduce((sum, asset) => sum + Number(asset.marketValue || 0), 0);
  const periodLabel = props.period === "30d" ? "30 días" : props.period === "7d" ? "7 días" : "ayer";
  const hiddenLockedValue = portfolio?.hiddenLockedValue || 0;
  const hiddenLockedAssetsCount = portfolio?.hiddenLockedAssetsCount || 0;
  const pagedAssets = useMemo(() => paginateRows(visibleAssets, assetPage), [visibleAssets, assetPage]);
  const pagedOpenOrders = useMemo(() => paginateRows(openOrders, openOrdersPage), [openOrders, openOrdersPage]);
  const pagedClosedOrders = useMemo(() => paginateRows(recentOrders, closedOrdersPage), [recentOrders, closedOrdersPage]);
  const pagedTrades = useMemo(() => paginateRows(recentTrades, tradesPage), [recentTrades, tradesPage]);

  useEffect(() => {
    setAssetPage(1);
  }, [props.hideSmallAssets, props.payload?.assets?.length]);

  useEffect(() => {
    setOpenOrdersPage(1);
    setClosedOrdersPage(1);
    setTradesPage(1);
  }, [props.payload?.openOrders?.length, props.payload?.recentOrders?.length, props.payload?.recentTrades?.length]);

  return (
    <div id="balanceView" className="view-panel active">
      <SectionCard
        title="Balance"
        subtitle="Ve tu dinero total, el cambio frente al período elegido y el rendimiento vivo de tus activos conectados a Binance Demo Spot."
        actions={
          <div className="inline-actions">
            <select className="timeframe-select" value={props.period} onChange={(e) => props.onPeriodChange(e.target.value)}>
              <option value="1d">Comparar con ayer</option>
              <option value="7d">Comparar con 7 días</option>
              <option value="30d">Comparar con 30 días</option>
            </select>
            <button className="btn-primary" onClick={props.onRefresh}>Actualizar capital</button>
          </div>
        }
      />

      <div className="stats-grid">
        <StatCard label="Capital total" value={formatPrice(portfolio?.totalValue || 0)} accentClass="accent-blue" sub={
          <>
            Cuenta {props.payload?.summary?.accountType || "SPOT"} · {props.payload?.summary?.uid ? `UID ${props.payload.summary.uid}` : "sin UID visible"}
            {hiddenLockedAssetsCount ? ` · Excluye ${formatPrice(hiddenLockedValue)} bloqueado` : ""}
          </>
        } />
        <StatCard label="Incremento del período" value={formatSignedPrice(portfolio?.periodChangeValue || 0)} toneClass={getPerformanceClass(portfolio?.periodChangeValue || 0)} accentClass="accent-green" sub={`Comparado con ${periodLabel} · ${formatSignedPct(portfolio?.periodChangePct || 0)}`} />
        <StatCard label="PnL realizado" value={formatSignedPrice(portfolio?.realizedPnl || 0)} toneClass={getPerformanceClass(portfolio?.realizedPnl || 0)} accentClass="accent-green" sub="Ganancia o pérdida ya cerrada por ventas" />
        <StatCard label="PnL no realizado" value={formatSignedPrice(portfolio?.unrealizedPnl || 0)} toneClass={getPerformanceClass(portfolio?.unrealizedPnl || 0)} accentClass="accent-emerald" sub={`${formatSignedPct(portfolio?.unrealizedPnlPct || 0)} sobre activos todavía abiertos`} />
        <StatCard label="PnL total" value={formatSignedPrice(portfolio?.totalPnl || 0)} toneClass={getPerformanceClass(portfolio?.totalPnl || 0)} accentClass="accent-blue" sub="Realizado + no realizado" />
        <StatCard label="Activos en verde" value={String(portfolio?.winnersCount || 0)} accentClass="accent-amber" sub={`${portfolio?.openPositionsCount || 0} activos visibles`} />
      </div>

      <div className="dashboard-main-grid">
        <div className="dashboard-stack">
          <SectionCard title="Resumen del dinero" subtitle="Tu liquidez, lo que está invertido y la base estimada de tus activos visibles.">
            <div className="stats-grid no-bottom-gap">
              <StatCard label="Disponible en USDT" value={formatPrice(portfolio?.cashValue || 0)} sub="Liquidez lista para operar" />
              <StatCard label="Capital en monedas" value={formatPrice(portfolio?.positionsValue || 0)} sub="Valor vivo de tus activos" />
              <StatCard label="Costo promedio abierto" value={formatPrice(portfolio?.investedValue || 0)} sub="Base estimada según tus trades" />
              <StatCard label="Última lectura" value={portfolio?.updatedAt ? new Date(portfolio.updatedAt).toLocaleTimeString("es-ES") : "--:--"} sub="Dato calculado en backend" />
            </div>
          </SectionCard>

          <SectionCard title="Detalle por moneda" subtitle="Aquí ves cuánto dinero tienes por activo, su costo promedio real y el PnL realizado/no realizado por moneda.">
            <div className="portfolio-toolbar">
              <SearchIcon className="portfolio-search-icon" />
              <label className="portfolio-filter-toggle">
                <input type="checkbox" checked={props.hideSmallAssets} onChange={(e) => props.onToggleHideSmall(e.target.checked)} />
                <span>Ocultar activos de menos de 1 USD</span>
              </label>
            </div>
            <div className="table-scroll">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Moneda</th>
                    <th>Cantidad</th>
                    <th>Precio actual</th>
                    <th>Precio promedio</th>
                    <th>Valor actual</th>
                    <th>PnL abierto</th>
                    <th>PnL realizado</th>
                    <th>Cambio del período</th>
                  </tr>
                </thead>
                <tbody>
                  {!visibleAssets.length ? (
                    <tr>
                      <td colSpan={8}><EmptyState message={props.hideSmallAssets ? "No hay activos visibles por encima de 1 USD con el filtro actual." : "No hay balances disponibles para esta cuenta."} /></td>
                    </tr>
                  ) : (
                    pagedAssets.rows.map((asset) => <AssetRow asset={asset} key={asset.asset} />)
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={assetPage}
              totalPages={pagedAssets.totalPages}
              totalItems={visibleAssets.length}
              label="activos"
              onPageChange={setAssetPage}
            />
          </SectionCard>

          <SectionCard title="Historial real" subtitle="Órdenes y trades recientes de Binance Demo Spot para leer entradas, salidas y ejecuciones.">
            <div className="history-stack">
              <div className="history-panel">
                <div className="history-panel-head">
                  <div>
                    <div className="card-title history-title">Órdenes abiertas</div>
                    <div className="card-subtitle">Lo que todavía está pendiente o parcialmente ejecutado.</div>
                  </div>
                  <span className="history-badge">{openOrders.length}</span>
                </div>
                <div className="table-scroll">
                  <table className="portfolio-table">
                    <thead>
                      <tr>
                        <th>Par</th>
                        <th>Lado</th>
                        <th>Tipo</th>
                        <th>Precio</th>
                        <th>Cantidad</th>
                        <th>Ejecutado</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!openOrders.length ? (
                        <tr><td colSpan={7}><EmptyState message="No hay órdenes abiertas en esta cuenta." /></td></tr>
                      ) : (
                        pagedOpenOrders.rows.map((order, index) => <OrderRow key={`${order.symbol}-${order.updateTime}-${index}`} order={order} />)
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  currentPage={openOrdersPage}
                  totalPages={pagedOpenOrders.totalPages}
                  totalItems={openOrders.length}
                  label="órdenes abiertas"
                  onPageChange={setOpenOrdersPage}
                />
              </div>

              <div className="history-panel">
                <div className="history-panel-head">
                  <div>
                    <div className="card-title history-title">Órdenes cerradas recientes</div>
                    <div className="card-subtitle">Compras y ventas ya completadas o canceladas.</div>
                  </div>
                  <span className="history-badge">{recentOrders.length}</span>
                </div>
                <div className="table-scroll">
                  <table className="portfolio-table">
                    <thead>
                      <tr>
                        <th>Par</th>
                        <th>Lado</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Ejecutado</th>
                        <th>Valor</th>
                        <th>Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!recentOrders.length ? (
                        <tr><td colSpan={7}><EmptyState message="Todavía no hay órdenes cerradas recientes para los activos visibles." /></td></tr>
                      ) : (
                        pagedClosedOrders.rows.map((order, index) => <ClosedOrderRow key={`${order.symbol}-${order.updateTime}-${index}`} order={order} />)
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  currentPage={closedOrdersPage}
                  totalPages={pagedClosedOrders.totalPages}
                  totalItems={recentOrders.length}
                  label="órdenes cerradas"
                  onPageChange={setClosedOrdersPage}
                />
              </div>

              <div className="history-panel">
                <div className="history-panel-head">
                  <div>
                    <div className="card-title history-title">Trades recientes</div>
                  <div className="card-subtitle">Ejecuciones reales con comisión y PnL realizado por venta.</div>
                </div>
                <span className="history-badge">{recentTrades.length}</span>
              </div>
              <div className="table-scroll">
                <table className="portfolio-table">
                  <thead>
                    <tr>
                      <th>Trade</th>
                      <th>Lado</th>
                      <th>Precio</th>
                      <th>Cantidad</th>
                      <th>Valor</th>
                      <th>Comisión</th>
                      <th>PnL realizado</th>
                      <th>Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!recentTrades.length ? (
                      <tr><td colSpan={8}><EmptyState message="Aún no hay trades recientes para construir historial real." /></td></tr>
                    ) : (
                      pagedTrades.rows.map((trade, index) => <TradeRow key={`${trade.symbol}-${trade.time}-${index}`} trade={trade} />)
                    )}
                  </tbody>
                </table>
              </div>
                <PaginationControls
                  currentPage={tradesPage}
                  totalPages={pagedTrades.totalPages}
                  totalItems={recentTrades.length}
                  label="trades"
                  onPageChange={setTradesPage}
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="dashboard-stack">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Lectura rápida</div>
                <div className="card-subtitle">Una vista corta para saber qué está empujando tu balance y qué lo está frenando.</div>
              </div>
            </div>
            <div>
              {winner ? (
                <div className="portfolio-highlight-card">
                  <div className="portfolio-highlight-title">Mejor abierta: {winner.asset}</div>
                  <div className="portfolio-highlight-note">Ahora mismo va en <span className="portfolio-positive">{formatSignedPrice(winner.pnlValue)}</span> ({formatSignedPct(winner.pnlPct)}) frente a su costo promedio real.</div>
                </div>
              ) : null}
              {loser ? (
                <div className="portfolio-highlight-card">
                  <div className="portfolio-highlight-title">Más presionada: {loser.asset}</div>
                  <div className="portfolio-highlight-note">Actualmente va en <span className={getPerformanceClass(loser.pnlValue)}>{formatSignedPrice(loser.pnlValue)}</span> ({formatSignedPct(loser.pnlPct)}).</div>
                </div>
              ) : null}
              {dominant && totalVisibleValue > 0 ? (
                <div className="portfolio-highlight-card">
                  <div className="portfolio-highlight-title">Mayor peso: {dominant.asset}</div>
                  <div className="portfolio-highlight-note">Representa {formatPct((dominant.marketValue / totalVisibleValue) * 100)} de tu cuenta y hoy vale {formatPrice(dominant.marketValue)}.</div>
                </div>
              ) : null}
              {!winner && !loser && !dominant ? (
                <div className="portfolio-highlight-card">
                  <div className="portfolio-highlight-title">Sin activos visibles</div>
                  <div className="portfolio-highlight-note">La cuenta no tiene monedas con valor distinto de cero fuera de USDT.</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Nota del cálculo</div>
                <div className="card-subtitle">Para que tengas claro cómo estamos leyendo el cambio y el beneficio.</div>
              </div>
            </div>
            <div className="binance-status-note">
              La comparación con {periodLabel} usa tus holdings actuales y el precio de referencia del activo en ese momento. El PnL abierto usa el costo promedio real según tus trades de Binance Demo Spot, y el PnL realizado sale de las ventas ya ejecutadas contra ese costo promedio histórico.
              {hiddenLockedAssetsCount
                ? ` El total visible excluye ${hiddenLockedAssetsCount} activo${hiddenLockedAssetsCount > 1 ? "s" : ""} 100% bloqueado${hiddenLockedAssetsCount > 1 ? "s" : ""} por ${formatPrice(hiddenLockedValue)} para acercarse a la vista spot de Binance.`
                : ""}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function AssetRow({ asset }: { asset: PortfolioAsset }) {
  const pnlClass = getPerformanceClass(asset.pnlValue);
  const periodClass = getPerformanceClass(asset.periodChangeValue);

  return (
    <tr>
      <td>
        <div className="portfolio-asset">
          <strong>{asset.asset}</strong>
          <span>{asset.symbol}</span>
        </div>
      </td>
      <td>
        <div className="portfolio-metric">
          <strong>{formatAmount(asset.quantity)}</strong>
          <span>
            Libre {formatAmount(asset.free)}
            {asset.locked > 0 ? ` · Bloq. ${formatAmount(asset.locked)}` : ""}
          </span>
        </div>
      </td>
      <td><div className="portfolio-metric"><strong>{formatPrice(asset.currentPrice)}</strong><span>Mercado</span></div></td>
      <td><div className="portfolio-metric"><strong>{asset.avgEntryPrice > 0 ? formatPrice(asset.avgEntryPrice) : "--"}</strong><span>{asset.tradeCount || 0} trades</span></div></td>
      <td><div className="portfolio-metric"><strong>{formatPrice(asset.marketValue)}</strong><span>Costo est. {formatPrice(asset.investedValue)}</span></div></td>
      <td><div className="portfolio-metric"><strong className={pnlClass}>{formatSignedPrice(asset.pnlValue)}</strong><span className={pnlClass}>{formatSignedPct(asset.pnlPct)}</span></div></td>
      <td><div className="portfolio-metric"><strong className={getPerformanceClass(asset.realizedPnl)}>{formatSignedPrice(asset.realizedPnl)}</strong><span>{asset.tradeCount || 0} ejecuciones</span></div></td>
      <td><div className="portfolio-metric"><strong className={periodClass}>{formatSignedPrice(asset.periodChangeValue)}</strong><span className={periodClass}>{formatSignedPct(asset.periodChangePct)}</span></div></td>
    </tr>
  );
}

function OrderRow({ order }: { order: BinanceOrderSummary }) {
  return (
    <tr>
      <td><div className="portfolio-asset"><strong>{order.symbol}</strong><span>{new Date(order.updateTime).toLocaleString("es-DO")}</span></div></td>
      <td><span className={order.side === "BUY" ? "portfolio-positive" : "portfolio-negative"}>{order.side === "BUY" ? "Compra" : "Venta"}</span></td>
      <td>{order.type}</td>
      <td>{order.price > 0 ? formatPrice(order.price) : "Market"}</td>
      <td>{formatAmount(order.origQty)}</td>
      <td>{formatAmount(order.executedQty)}</td>
      <td>{order.status}</td>
    </tr>
  );
}

function ClosedOrderRow({ order }: { order: BinanceOrderSummary }) {
  return (
    <tr>
      <td><div className="portfolio-asset"><strong>{order.symbol}</strong><span>{order.price > 0 ? formatPrice(order.price) : "Market"}</span></div></td>
      <td><span className={order.side === "BUY" ? "portfolio-positive" : "portfolio-negative"}>{order.side === "BUY" ? "Compra" : "Venta"}</span></td>
      <td>{order.type}</td>
      <td>{order.status}</td>
      <td>{formatAmount(order.executedQty)}</td>
      <td>{formatPrice(order.quoteQty)}</td>
      <td>{new Date(order.updateTime).toLocaleString("es-DO")}</td>
    </tr>
  );
}

function TradeRow({ trade }: { trade: BinanceTradeSummary }) {
  return (
    <tr>
      <td><div className="portfolio-asset"><strong>{trade.symbol}</strong><span>{trade.orderId ? `Orden ${trade.orderId}` : "Trade"}</span></div></td>
      <td><span className={trade.side === "BUY" ? "portfolio-positive" : "portfolio-negative"}>{trade.side === "BUY" ? "Compra" : "Venta"}</span></td>
      <td>{formatPrice(trade.price)}</td>
      <td>{formatAmount(trade.qty)}</td>
      <td>{formatPrice(trade.value)}</td>
      <td>{formatAmount(trade.commission)} {trade.commissionAsset}</td>
      <td><span className={getPerformanceClass(trade.realizedPnl || 0)}>{formatSignedPrice(trade.realizedPnl || 0)}</span></td>
      <td>{new Date(trade.time).toLocaleString("es-DO")}</td>
    </tr>
  );
}

function paginateRows<T>(rows: T[], currentPage: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return {
    rows: rows.slice(start, start + PAGE_SIZE),
    totalPages,
    safePage,
  };
}

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  label,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  label: string;
  onPageChange: (page: number) => void;
}) {
  if (totalItems <= PAGE_SIZE) {
    return null;
  }

  return (
    <div className="pagination-bar">
      <div className="pagination-note">
        Mostrando {Math.min((currentPage - 1) * PAGE_SIZE + 1, totalItems)}-{Math.min(currentPage * PAGE_SIZE, totalItems)} de {totalItems} {label}
      </div>
      <div className="pagination-actions">
        <button className="btn-secondary-soft" type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
          Anterior
        </button>
        <span className="pagination-page">Página {currentPage} de {totalPages}</span>
        <button className="btn-secondary-soft" type="button" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
