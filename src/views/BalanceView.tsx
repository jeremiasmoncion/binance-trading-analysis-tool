import { SearchIcon } from "../components/Icons";
import { EmptyState } from "../components/ui/EmptyState";
import { SectionCard } from "../components/ui/SectionCard";
import { StatCard } from "../components/ui/StatCard";
import { formatAmount, formatPct, formatPrice, formatSignedPct, formatSignedPrice } from "../lib/format";
import type { PortfolioAsset, PortfolioPayload } from "../types";

interface BalanceViewProps {
  payload: PortfolioPayload | null;
  period: string;
  hideSmallAssets: boolean;
  onPeriodChange: (period: string) => void;
  onRefresh: () => void;
  onToggleHideSmall: (value: boolean) => void;
}

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
  const portfolio = props.payload?.portfolio;
  const visibleAssets = getVisibleAssets(props.payload, props.hideSmallAssets);
  const nonUsdtAssets = visibleAssets.filter((asset) => asset.asset !== "USDT");
  const winner = nonUsdtAssets.slice().sort((a, b) => b.pnlValue - a.pnlValue)[0];
  const loser = nonUsdtAssets.slice().sort((a, b) => a.pnlValue - b.pnlValue)[0];
  const dominant = nonUsdtAssets.slice().sort((a, b) => b.marketValue - a.marketValue)[0];
  const totalVisibleValue = visibleAssets.reduce((sum, asset) => sum + Number(asset.marketValue || 0), 0);
  const periodLabel = props.period === "30d" ? "30 días" : props.period === "7d" ? "7 días" : "ayer";
  const hiddenLockedValue = portfolio?.hiddenLockedValue || 0;
  const hiddenLockedAssetsCount = portfolio?.hiddenLockedAssetsCount || 0;

  return (
    <div id="journalView" className="view-panel active">
      <SectionCard
        title="Balance"
        subtitle="Ve tu dinero total, el cambio frente al período elegido y el rendimiento vivo de tus activos conectados a Binance Demo Spot."
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
        <StatCard label="Capital total" value={formatPrice(portfolio?.totalValue || 0)} style={{ borderLeft: "4px solid #3b82f6" }} sub={
          <>
            Cuenta {props.payload?.summary?.accountType || "SPOT"} · {props.payload?.summary?.uid ? `UID ${props.payload.summary.uid}` : "sin UID visible"}
            {hiddenLockedAssetsCount ? ` · Excluye ${formatPrice(hiddenLockedValue)} bloqueado` : ""}
          </>
        } />
        <StatCard label="Incremento del período" value={formatSignedPrice(portfolio?.periodChangeValue || 0)} toneClass={getPerformanceClass(portfolio?.periodChangeValue || 0)} style={{ borderLeft: "4px solid #22c55e" }} sub={`Comparado con ${periodLabel} · ${formatSignedPct(portfolio?.periodChangePct || 0)}`} />
        <StatCard label="Rendimiento abierto" value={formatSignedPrice(portfolio?.unrealizedPnl || 0)} toneClass={getPerformanceClass(portfolio?.unrealizedPnl || 0)} style={{ borderLeft: "4px solid #10b981" }} sub={`${formatSignedPct(portfolio?.unrealizedPnlPct || 0)} sobre activos todavía abiertos`} />
        <StatCard label="Activos en verde" value={String(portfolio?.winnersCount || 0)} style={{ borderLeft: "4px solid #f59e0b" }} sub={`${portfolio?.openPositionsCount || 0} activos visibles`} />
      </div>

      <div className="dashboard-main-grid">
        <div className="dashboard-stack">
          <SectionCard title="Resumen del dinero" subtitle="Tu liquidez, lo que está invertido y la base estimada de tus activos visibles.">
            <div className="stats-grid" style={{ marginBottom: 0 }}>
              <StatCard label="Disponible en USDT" value={formatPrice(portfolio?.cashValue || 0)} sub="Liquidez lista para operar" />
              <StatCard label="Capital en monedas" value={formatPrice(portfolio?.positionsValue || 0)} sub="Valor vivo de tus activos" />
              <StatCard label="Costo promedio abierto" value={formatPrice(portfolio?.investedValue || 0)} sub="Base estimada según tus trades" />
              <StatCard label="Última lectura" value={portfolio?.updatedAt ? new Date(portfolio.updatedAt).toLocaleTimeString("es-ES") : "--:--"} sub="Dato calculado en backend" />
            </div>
          </SectionCard>

          <SectionCard title="Detalle por moneda" subtitle="Aquí ves cuánto dinero tienes por activo, el precio promedio estimado y el rendimiento abierto de cada balance.">
            <div className="portfolio-toolbar">
              <SearchIcon className="portfolio-search-icon" />
              <label className="portfolio-filter-toggle">
                <input type="checkbox" checked={props.hideSmallAssets} onChange={(e) => props.onToggleHideSmall(e.target.checked)} />
                <span>Ocultar activos de menos de 1 USD</span>
              </label>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Moneda</th>
                    <th>Cantidad</th>
                    <th>Precio actual</th>
                    <th>Precio promedio</th>
                    <th>Valor actual</th>
                    <th>Rendimiento abierto</th>
                    <th>Cambio del período</th>
                  </tr>
                </thead>
                <tbody>
                  {!visibleAssets.length ? (
                    <tr>
                      <td colSpan={7}><EmptyState message={props.hideSmallAssets ? "No hay activos visibles por encima de 1 USD con el filtro actual." : "No hay balances disponibles para esta cuenta."} /></td>
                    </tr>
                  ) : (
                    visibleAssets.map((asset) => <AssetRow asset={asset} key={asset.asset} />)
                  )}
                </tbody>
              </table>
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
                  <div className="portfolio-highlight-note">Ahora mismo va en <span className="portfolio-positive">{formatSignedPrice(winner.pnlValue)}</span> ({formatSignedPct(winner.pnlPct)}) frente a su costo promedio.</div>
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
              La comparación con {periodLabel} usa tus holdings actuales y el precio de referencia del activo en ese momento. El rendimiento abierto usa el costo promedio estimado según tus trades de Binance Demo Spot.
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
      <td><div className="portfolio-metric"><strong className={periodClass}>{formatSignedPrice(asset.periodChangeValue)}</strong><span className={periodClass}>{formatSignedPct(asset.periodChangePct)}</span></div></td>
    </tr>
  );
}
