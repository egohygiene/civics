import { useMemo } from "react";
import {
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CircleHelp,
  GitCompareArrows,
  ShieldAlert,
} from "lucide-react";
import { buildRaceHistoryView } from "../../lib/race-history-data.js";
import {
  CandidatePortrait,
} from "./ProfileExperience.jsx";
import {
  formatProfileDate,
  formatProfileNumber,
  formatProfilePercent,
} from "./profile-view.js";
import "./race-history.css";

function StageLabel({ value }) {
  return <span className="race-history-stage">{value === "primary" ? "Primary" : value === "general" ? "General" : value}</span>;
}

export function RaceHistoryExperience({
  candidates,
  id = "race-history",
  office,
}) {
  const view = useMemo(() => buildRaceHistoryView({ candidates }), [candidates]);
  if (!view.rows.length) return null;

  return (
    <section className="race-history" id={id} aria-labelledby={`${id}-title`}>
      <header className="race-history-heading">
        <div className="race-history-heading-icon"><GitCompareArrows aria-hidden="true" /></div>
        <div>
          <p>Historical lens · selected context</p>
          <h3 id={`${id}-title`}>How each candidate last met a similar ballot</h3>
        </div>
        <span><BarChart3 aria-hidden="true" />Shared 0–100% axis</span>
      </header>

      <div className="race-history-method">
        <p><strong>{view.transform.id} v{view.transform.version}</strong>{view.transform.selectionRule}</p>
        <p>{view.note}</p>
      </div>

      {view.availableRows.length ? (
        <>
          <div className="race-history-axis" aria-hidden="true">
            {view.axisTicks.map((tick) => <span key={tick} style={{ "--history-offset": `${tick}%` }}>{tick}%</span>)}
          </div>
          <div className="race-history-rows">
            {view.rows.map((row) => {
              const candidate = candidates.find(({ id: candidateId }) => candidateId === row.candidateId);
              if (!row.context) {
                return (
                  <article className={`race-history-row party-${row.party}`} key={row.candidateId}>
                    <CandidatePortrait candidate={candidate} compact photo={candidate?.portrait} size="small" />
                    <div className="race-history-empty"><CircleHelp aria-hidden="true" /><span><strong>{row.candidateName}</strong>No sourced prior contest selected.</span></div>
                  </article>
                );
              }
              const context = row.context;
              return (
                <article className={`race-history-row party-${row.party}`} key={row.candidateId}>
                  <div className="race-history-person">
                    <CandidatePortrait candidate={candidate} compact photo={candidate?.portrait} size="small" />
                    <span><small>{candidate?.partyLabel ?? candidate?.party} ballot</small><strong>{row.candidateName}</strong></span>
                  </div>
                  <div className="race-history-context">
                    <span className={`race-history-context-kind is-${context.contextKind}`}>{context.contextLabel}</span>
                    <span><CalendarClock aria-hidden="true" />{formatProfileDate(context.date)}</span>
                    <strong>{context.office}</strong>
                    <span><StageLabel value={context.stage} /><b className={`race-history-outcome is-${context.outcome}`}>{context.outcome}</b>{context.jurisdiction}</span>
                  </div>
                  <div className="race-history-measure">
                    <div className="race-history-value"><strong>{formatProfilePercent(context.sharePercent)}</strong><span>{formatProfileNumber(context.candidateVotes)} of {formatProfileNumber(context.totalVotes)} reported candidate votes</span></div>
                    <div
                      className="race-history-track"
                      role="img"
                      aria-label={`${row.candidateName}: ${formatProfilePercent(context.sharePercent)} in the ${formatProfileDate(context.date)} ${context.office} ${context.stage}`}
                    >
                      {view.axisTicks.map((tick) => <i key={tick} aria-hidden="true" style={{ "--history-offset": `${tick}%` }} />)}
                      <span style={{ width: `${context.sharePercent}%` }}><b>{formatProfilePercent(context.sharePercent)}</b></span>
                    </div>
                    <footer>
                      <span>{context.caution}</span>
                      {context.source?.url ? <a href={context.source.url} target="_blank" rel="noreferrer">Official result source <ArrowUpRight aria-hidden="true" /></a> : <span>Source link unavailable</span>}
                    </footer>
                  </div>
                </article>
              );
            })}
          </div>
          <details className="race-history-table">
            <summary>Exact selected historical records</summary>
            <div>
              <table>
                <caption>One past contest selected per candidate by the disclosed transform; these records are context, not a current-race forecast.</caption>
                <thead><tr><th scope="col">Candidate</th><th scope="col">Date</th><th scope="col">Office and stage</th><th scope="col">Reported candidate votes</th><th scope="col">Candidate-vote pool</th><th scope="col">Share</th><th scope="col">Result</th><th scope="col">Context</th><th scope="col">Source</th></tr></thead>
                <tbody>
                  {view.availableRows.map((row) => <tr key={row.candidateId}><th scope="row">{row.candidateName}</th><td>{formatProfileDate(row.context.date)}</td><td>{row.context.office} · {row.context.stage}</td><td>{formatProfileNumber(row.context.candidateVotes)}</td><td>{formatProfileNumber(row.context.totalVotes)}</td><td>{formatProfilePercent(row.context.sharePercent)}</td><td>{row.context.outcome}</td><td>{row.context.contextLabel}</td><td>{row.context.source?.url ? <a href={row.context.source.url} target="_blank" rel="noreferrer">Open official source <ArrowUpRight aria-hidden="true" /></a> : "Unavailable"}</td></tr>)}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <div className="race-history-no-data"><CircleHelp aria-hidden="true" /><p><strong>No comparable records are materialized yet.</strong> Missing prior-election history remains unknown, not zero.</p></div>
      )}

      <footer className="race-history-warning">
        <ShieldAlert aria-hidden="true" />
        <p><strong>Not a horse-race model.</strong> These are selected historical results for orientation. They do not measure current support, momentum, viability, candidate quality, or the likely result of the {office} race.</p>
      </footer>
    </section>
  );
}

export default RaceHistoryExperience;
