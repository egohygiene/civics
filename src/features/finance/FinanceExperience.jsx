import { useId, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CalendarClock,
  CircleHelp,
  Database,
  ExternalLink,
  FileCheck2,
  Info,
  Landmark,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import {
  FINANCE_METRICS,
  FINANCE_STATUS_LABELS,
  FINANCE_TOTALS,
  buildLinePoints,
  collectSeriesDates,
  formatCompactUsd,
  formatExactUsd,
  formatFinanceDate,
  formatFinanceTimestamp,
  maximumSeriesAmount,
  buildFinanceView,
  normalizeFinanceView,
  percentageOf,
  pointsToPath,
} from "./finance-view.js";
import "./finance.css";

const SERIES_COLORS = ["#72e6ca", "#9b8cff", "#efc677", "#f198b0", "#7bb9f5"];
const CHART_DIMENSIONS = {
  width: 760,
  height: 300,
  top: 22,
  right: 20,
  bottom: 42,
  left: 76,
};

function FinanceStatus({ value }) {
  return (
    <span className={`finance-status finance-status-${value ?? "unknown"}`}>
      <i aria-hidden="true" />
      {FINANCE_STATUS_LABELS[value] ?? value ?? "Unknown"}
    </span>
  );
}

function ExactMoney({ metric, compact = false }) {
  if (!metric || metric.amountCents === null) {
    return <span className="finance-unknown"><CircleHelp aria-hidden="true" /> Unknown</span>;
  }

  const displayValue = compact
    ? formatCompactUsd(metric.amountCents)
    : formatExactUsd(metric.amountCents);
  return <span title={compact ? formatExactUsd(metric.amountCents) : undefined}>{displayValue}</span>;
}

function CandidateSnapshot({ candidate }) {
  return (
    <article className={`finance-candidate-card${candidate.comparison.isComparable ? "" : " is-incomplete"}`}>
      <header>
        <span className="finance-avatar" aria-hidden="true">{candidate.initials}</span>
        <div>
          <p>{candidate.party}</p>
          <h3>{candidate.name}</h3>
        </div>
        <FinanceStatus value={candidate.status} />
      </header>
      <dl className="finance-stat-grid">
        {FINANCE_TOTALS.map(({ key, label }) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd><ExactMoney metric={candidate.totals[key]} compact /></dd>
            {candidate.totals[key].amountCents !== null ? (
              <small>{formatExactUsd(candidate.totals[key].amountCents)}</small>
            ) : null}
          </div>
        ))}
      </dl>
      <footer>
        <CalendarClock aria-hidden="true" />
        {candidate.comparison.hasSamePeriod ? (
          <span>Same period · {formatFinanceDate(candidate.coverage.startDate)}–{formatFinanceDate(candidate.coverage.throughDate)}</span>
        ) : (
          <span>{candidate.comparison.reason}</span>
        )}
      </footer>
    </article>
  );
}

function EmptyVisualization({ children }) {
  return (
    <div className="finance-empty">
      <Database aria-hidden="true" />
      <div><strong>Not enough comparable data yet</strong><p>{children}</p></div>
    </div>
  );
}

function CumulativeMoneyChart({ candidates, comparison }) {
  const [metricKey, setMetricKey] = useState("receipts");
  const chartId = useId();
  const dates = useMemo(() => collectSeriesDates(candidates), [candidates]);
  const maximumAmount = useMemo(
    () => maximumSeriesAmount(candidates, metricKey),
    [candidates, metricKey],
  );
  const dateRange = {
    start: comparison.startDate ?? dates.at(0),
    end: comparison.throughDate ?? dates.at(-1),
  };
  const plottedCandidates = candidates.map((candidate, index) => ({
    candidate,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    points: buildLinePoints(
      candidate.series,
      metricKey,
      CHART_DIMENSIONS,
      dateRange,
      maximumAmount,
    ),
  })).filter(({ points }) => points.length);
  const chartHeight = CHART_DIMENSIONS.height - CHART_DIMENSIONS.top - CHART_DIMENSIONS.bottom;
  const seriesKey = FINANCE_METRICS[metricKey].seriesKey;

  return (
    <article className="finance-panel finance-series-panel">
      <header className="finance-panel-heading">
        <div>
          <span className="finance-panel-icon"><TrendingUp aria-hidden="true" /></span>
          <div><p>Velocity, not a ranking</p><h3>Cumulative money over time</h3></div>
        </div>
        <div className="finance-metric-switch" role="group" aria-label="Choose cumulative finance measure">
          {Object.entries(FINANCE_METRICS).map(([key, metric]) => (
            <button
              key={key}
              type="button"
              aria-pressed={metricKey === key}
              onClick={() => setMetricKey(key)}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </header>
      <p className="finance-panel-lede">
        Every line uses the same period and scale. “Receipts” follows regulator terminology and can include transfers or loans—not only contributions. Hover-independent labels and the exact-value table preserve the comparison without relying on color.
      </p>

      {plottedCandidates.length && maximumAmount ? (
        <>
          <div className="finance-chart-scroll">
            <svg
              className="finance-line-chart"
              viewBox={`0 0 ${CHART_DIMENSIONS.width} ${CHART_DIMENSIONS.height}`}
              role="img"
              aria-labelledby={`${chartId}-title ${chartId}-description`}
            >
              <title id={`${chartId}-title`}>{FINANCE_METRICS[metricKey].longLabel} by candidate</title>
              <desc id={`${chartId}-description`}>
                Same-cutoff cumulative campaign-finance values. Exact values follow in a table.
              </desc>
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = CHART_DIMENSIONS.top + (1 - ratio) * chartHeight;
                return (
                  <g key={ratio} className="finance-grid-line">
                    <line x1={CHART_DIMENSIONS.left} x2={CHART_DIMENSIONS.width - CHART_DIMENSIONS.right} y1={y} y2={y} />
                    <text x={CHART_DIMENSIONS.left - 12} y={y + 4}>{formatCompactUsd(Math.round(maximumAmount * ratio))}</text>
                  </g>
                );
              })}
              <text className="finance-axis-label" x={CHART_DIMENSIONS.left} y={CHART_DIMENSIONS.height - 10}>
                {formatFinanceDate(dateRange.start, { month: "short", year: "numeric", day: undefined })}
              </text>
              <text className="finance-axis-label" textAnchor="end" x={CHART_DIMENSIONS.width - CHART_DIMENSIONS.right} y={CHART_DIMENSIONS.height - 10}>
                {formatFinanceDate(dateRange.end, { month: "short", year: "numeric", day: undefined })}
              </text>
              {plottedCandidates.map(({ candidate, color, points }) => (
                <g key={candidate.candidateId} style={{ "--finance-series": color }}>
                  <path className="finance-series-line" d={pointsToPath(points)} />
                  {points.map((point) => (
                    <circle className="finance-series-point" key={point.date} cx={point.x} cy={point.y} r="4">
                      <title>{candidate.name}: {formatExactUsd(point.amountCents)} on {formatFinanceDate(point.date)}</title>
                    </circle>
                  ))}
                </g>
              ))}
            </svg>
          </div>
          <ul className="finance-series-legend" aria-label="Candidate series">
            {plottedCandidates.map(({ candidate, color }) => (
              <li key={candidate.candidateId} style={{ "--finance-series": color }}><i aria-hidden="true" />{candidate.name}</li>
            ))}
          </ul>
          <details className="finance-data-table">
            <summary>Exact {FINANCE_METRICS[metricKey].label.toLowerCase()} time series</summary>
            <div>
              <table>
                <caption>{FINANCE_METRICS[metricKey].longLabel}, reported in exact U.S. dollars</caption>
                <thead><tr><th scope="col">Date</th>{candidates.map((candidate) => <th scope="col" key={candidate.candidateId}>{candidate.name}</th>)}</tr></thead>
                <tbody>
                  {dates.map((date) => (
                    <tr key={date}>
                      <th scope="row">{formatFinanceDate(date)}</th>
                      {candidates.map((candidate) => {
                        const point = candidate.series.find((item) => item.date === date);
                        return <td key={candidate.candidateId}>{formatExactUsd(point?.[seriesKey])}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <EmptyVisualization>At least one reviewed candidate series is required before a line is drawn.</EmptyVisualization>
      )}
    </article>
  );
}

function ReceiptComposition({ candidates }) {
  const categories = [...new Map(
    candidates.flatMap((candidate) => candidate.receiptComposition)
      .map((item) => [item.id, { id: item.id, label: item.label }]),
  ).values()];
  const candidatesWithComposition = candidates.filter((candidate) => (
    candidate.receiptComposition.some((item) => item.amountCents !== null)
  ));

  return (
    <article className="finance-panel finance-composition-panel">
      <header className="finance-panel-heading">
        <div>
          <span className="finance-panel-icon"><WalletCards aria-hidden="true" /></span>
          <div><p>Aggregate source mix</p><h3>Where receipts came from</h3></div>
        </div>
      </header>
      <p className="finance-panel-lede">Categories describe reported receipt types—not the beliefs, industries, or intent of individual donors.</p>
      {candidatesWithComposition.length ? (
        <>
          <div className="finance-composition-list">
            {candidatesWithComposition.map((candidate) => {
              const total = candidate.receiptComposition.reduce((sum, item) => sum + (item.amountCents ?? 0), 0);
              return (
                <div className="finance-composition-row" key={candidate.candidateId}>
                  <div>
                    <strong>{candidate.name}</strong>
                    <span>{formatExactUsd(total)} categorized · {formatFinanceDate(candidate.coverage.startDate)}–{formatFinanceDate(candidate.coverage.throughDate)}</span>
                  </div>
                  <div className="finance-stacked-bar" role="img" aria-label={`${candidate.name} receipt composition`}>
                    {candidate.receiptComposition.filter((item) => item.amountCents > 0).map((item) => {
                      const categoryIndex = categories.findIndex((category) => category.id === item.id);
                      return (
                        <span
                          key={item.id}
                          style={{
                            "--finance-category": SERIES_COLORS[categoryIndex % SERIES_COLORS.length],
                            width: `${percentageOf(item.amountCents, total)}%`,
                          }}
                        >
                          <i className="finance-visually-hidden">{item.label}: {formatExactUsd(item.amountCents)}</i>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <ul className="finance-category-legend">
            {categories.map((category, index) => (
              <li key={category.id} style={{ "--finance-category": SERIES_COLORS[index % SERIES_COLORS.length] }}><i aria-hidden="true" />{category.label}</li>
            ))}
          </ul>
          <details className="finance-data-table">
            <summary>Exact receipt composition table</summary>
            <div>
              <table>
                <caption>Aggregate reported receipts by source type</caption>
                <thead><tr><th scope="col">Candidate</th>{categories.map((category) => <th scope="col" key={category.id}>{category.label}</th>)}</tr></thead>
                <tbody>
                  {candidatesWithComposition.map((candidate) => (
                    <tr key={candidate.candidateId}>
                      <th scope="row">{candidate.name}</th>
                      {categories.map((category) => {
                        const item = candidate.receiptComposition.find(({ id }) => id === category.id);
                        return <td key={category.id}>{formatExactUsd(item?.amountCents)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <EmptyVisualization>Receipt categories will appear only after the underlying filings are normalized to a shared taxonomy.</EmptyVisualization>
      )}
    </article>
  );
}

function OutsideSpending({ candidates }) {
  return (
    <article className="finance-panel finance-outside-panel">
      <header className="finance-panel-heading">
        <div>
          <span className="finance-panel-icon"><Landmark aria-hidden="true" /></span>
          <div><p>Independent activity</p><h3>Outside spending</h3></div>
        </div>
        <span className="finance-separation-badge"><ShieldCheck aria-hidden="true" /> Kept separate</span>
      </header>
      <div className="finance-explainer">
        <Info aria-hidden="true" />
        <p>This money was reported by outside groups and was not controlled by a candidate committee. Support and opposition are never combined into a net score.</p>
      </div>
      <div className="finance-outside-grid">
        {candidates.map((candidate) => (
          <section key={candidate.candidateId}>
            <div className="finance-outside-heading"><h4>{candidate.name}</h4><FinanceStatus value={candidate.outsideSpending.status} /></div>
            <dl>
              <div><dt>Supporting</dt><dd><ExactMoney metric={candidate.outsideSpending.support} /></dd></div>
              <div><dt>Opposing</dt><dd><ExactMoney metric={candidate.outsideSpending.opposition} /></dd></div>
            </dl>
            <small>Through {formatFinanceDate(candidate.outsideSpending.throughDate)}</small>
          </section>
        ))}
      </div>
    </article>
  );
}

function GeneratedSummary({ summary }) {
  if (!summary?.text) return null;

  return (
    <article className="finance-panel finance-summary-panel">
      <header className="finance-panel-heading">
        <div>
          <span className="finance-panel-icon"><Sparkles aria-hidden="true" /></span>
          <div><p>Machine-assisted orientation</p><h3>{summary.title ?? "What the filings show"}</h3></div>
        </div>
        <span className="finance-ai-badge">AI-generated · {summary.reviewStatus ?? "Unreviewed"}</span>
      </header>
      <p className="finance-summary-text">{summary.text}</p>
      <div className="finance-summary-trust">
        {summary.disclosure ? <div><strong>Disclosure</strong><p>{summary.disclosure}</p></div> : null}
        {summary.method ? <div><strong>Method</strong><p>{summary.method}</p></div> : null}
        {summary.limitations?.length ? (
          <div><strong>Summary limitations</strong><ul>{summary.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div>
        ) : null}
      </div>
      <footer>
        <span>Generated {formatFinanceTimestamp(summary.generatedAt)}</span>
        {summary.reviewedAt ? <span>Human-reviewed {formatFinanceTimestamp(summary.reviewedAt)}</span> : null}
        <span>{summary.sourceIds?.length ?? 0} linked sources</span>
      </footer>
    </article>
  );
}

function SourceAndLimitations({ view }) {
  const allLimitations = [
    ...view.limitations,
    ...view.candidates.flatMap((candidate) => candidate.limitations ?? []),
  ];
  const limitations = [...new Set(allLimitations)];

  return (
    <article className="finance-panel finance-method-panel">
      <div className="finance-method-column">
        <header><FileCheck2 aria-hidden="true" /><div><p>Trace the numbers</p><h3>Sources and freshness</h3></div></header>
        {view.sources.length ? (
          <ul className="finance-source-list">
            {view.sources.map((source) => (
              <li key={source.id}>
                <div><strong>{source.name}</strong><span>{source.publisher ?? source.kind}</span></div>
                <p>Reporting through {formatFinanceDate(source.reportingThrough)} · checked {source.checkedAt?.includes("T") ? formatFinanceTimestamp(source.checkedAt) : formatFinanceDate(source.checkedAt)}</p>
                {source.url ? <a href={source.url} target="_blank" rel="noreferrer">Open source <ExternalLink aria-hidden="true" /></a> : null}
              </li>
            ))}
          </ul>
        ) : <p className="finance-method-empty">No reviewed source record is attached yet.</p>}
      </div>
      <div className="finance-method-column">
        <header><TriangleAlert aria-hidden="true" /><div><p>Read with context</p><h3>Limitations</h3></div></header>
        {limitations.length ? <ul className="finance-limitations">{limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul> : <p className="finance-method-empty">No additional limitations were supplied.</p>}
      </div>
    </article>
  );
}

export function FinanceExperience({ className = "", financeView }) {
  const view = useMemo(() => normalizeFinanceView(financeView), [financeView]);
  const unavailableCandidates = view.candidates.filter((candidate) => !candidate.comparison.isComparable);

  return (
    <section className={`civic-finance ${className}`.trim()} aria-labelledby={`${view.id}-finance-title`}>
      <header className="finance-hero">
        <div>
          <p className="finance-kicker"><BadgeDollarSign aria-hidden="true" /> Campaign finance lens</p>
          <h2 id={`${view.id}-finance-title`}>{view.title}</h2>
          <p>See exact regulator totals, movement over time, and reported source mix. Money is context—not a proxy for support, integrity, or election outcome.</p>
        </div>
        <aside>
          <FinanceStatus value={view.status} />
          <span>Shared cutoff</span>
          <strong>{formatFinanceDate(view.comparison.throughDate)}</strong>
          <small>{view.comparison.label}</small>
        </aside>
      </header>

      {unavailableCandidates.length ? (
        <div className="finance-coverage-notice" role="status">
          <TriangleAlert aria-hidden="true" />
          <p><strong>{unavailableCandidates.length} {unavailableCandidates.length === 1 ? "candidate is" : "candidates are"} excluded from shared-period charts.</strong> Their cards and within-record composition remain visible rather than silently treating a different reporting window—or missing data—as zero.</p>
        </div>
      ) : null}

      <div className="finance-snapshot-grid">
        {view.candidates.map((candidate) => <CandidateSnapshot key={candidate.candidateId} candidate={candidate} />)}
      </div>

      <div className="finance-visual-grid">
        <CumulativeMoneyChart candidates={view.comparableCandidates} comparison={view.comparison} />
        <ReceiptComposition candidates={view.candidates.filter((candidate) => ["available", "partial"].includes(candidate.status))} />
      </div>
      <OutsideSpending candidates={view.candidates} />
      <GeneratedSummary summary={view.summary} />
      <SourceAndLimitations view={view} />
    </section>
  );
}

/**
 * Race-level adapter for normalized candidate finance records.
 * No network request is made; records must be materialized before render.
 */
export function FinanceRaceExperience({
  candidates,
  className = "",
  comparison,
  electionLabel,
  id,
  limitations,
  office,
  records,
  synthesis,
  title,
}) {
  const financeView = useMemo(() => buildFinanceView({
    candidates,
    comparison,
    electionLabel,
    id,
    limitations,
    office,
    records,
    synthesis,
    title,
  }), [candidates, comparison, electionLabel, id, limitations, office, records, synthesis, title]);

  return <FinanceExperience className={className} financeView={financeView} />;
}

/**
 * Candidate sports-page adapter using the same visual and evidence contract.
 */
export function FinanceCandidateExperience({ candidate, record, ...viewProps }) {
  return <FinanceRaceExperience {...viewProps} candidates={[candidate]} records={record ? [record] : []} />;
}

export default FinanceExperience;
