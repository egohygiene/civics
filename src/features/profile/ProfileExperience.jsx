import { useEffect, useId, useMemo, useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CircleHelp,
  Database,
  ExternalLink,
  FileCheck2,
  History,
  Link2,
  MapPin,
  ScanSearch,
  Sparkles,
  TriangleAlert,
  UserRound,
  Vote,
} from "lucide-react";
import {
  PHOTO_VERIFICATION,
  PROFILE_STATUS_LABELS,
  SOURCE_KIND_LABELS,
  buildProfileView,
  formatProfileDate,
  formatProfileNumber,
  formatProfilePercent,
  normalizeProfilePhoto,
  resolveProfileSources,
} from "./profile-view.js";
import "./profile.css";

function joinClasses(...values) {
  return values.filter(Boolean).join(" ");
}

function ProfileStatus({ value }) {
  const normalizedValue = Object.hasOwn(PROFILE_STATUS_LABELS, value) ? value : "unknown";
  return (
    <span className={`profile-status profile-status-${normalizedValue}`}>
      <i aria-hidden="true" />
      {PROFILE_STATUS_LABELS[normalizedValue]}
    </span>
  );
}

export function PhotoVerificationIndicator({ status = "unverified", compact = false }) {
  const tooltipId = useId();
  const normalizedStatus = status === "verified" ? "verified" : "unverified";
  const copy = PHOTO_VERIFICATION[normalizedStatus];

  return (
    <span
      aria-describedby={tooltipId}
      aria-label={copy.label}
      className={joinClasses("profile-photo-status", `is-${normalizedStatus}`, compact && "is-compact")}
      tabIndex="0"
      title={`${copy.label}. ${copy.description}`}
    >
      {normalizedStatus === "verified" ? <Check aria-hidden="true" /> : <span aria-hidden="true" />}
      {!compact ? <b>{normalizedStatus === "verified" ? "Verified photo" : "Unverified photo"}</b> : null}
      <span className="profile-photo-tooltip" id={tooltipId} role="tooltip">
        <strong>{copy.label}</strong>
        {copy.description}
      </span>
    </span>
  );
}

export function CandidatePortrait({
  candidate,
  className = "",
  compact = false,
  photo = {},
  showStatus = true,
  size = "hero",
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const normalizedPhoto = useMemo(() => normalizeProfilePhoto(photo), [photo]);
  const preferredImageUrl = size === "hero" ? normalizedPhoto.url : normalizedPhoto.thumbnailUrl;
  const imageUrl = normalizedPhoto.verificationStatus === "verified" && preferredImageUrl && !imageFailed
    ? preferredImageUrl
    : null;
  const effectiveStatus = imageUrl && normalizedPhoto.verificationStatus === "verified"
    ? "verified"
    : "unverified";

  useEffect(() => {
    setImageFailed(false);
  }, [preferredImageUrl]);

  return (
    <figure className={joinClasses("profile-portrait", `profile-portrait-${size}`, className)}>
      <div className="profile-portrait-frame">
        {imageUrl ? (
          <img
            alt={normalizedPhoto.alt || `${candidate.name} profile`}
            loading="lazy"
            onError={() => setImageFailed(true)}
            src={imageUrl}
          />
        ) : (
          <span className="profile-portrait-fallback" aria-label={`No reviewed photo available for ${candidate.name}`}>
            <UserRound aria-hidden="true" />
            <b aria-hidden="true">{candidate.initials}</b>
          </span>
        )}
        {showStatus ? <PhotoVerificationIndicator status={effectiveStatus} compact={compact} /> : null}
      </div>
      {!compact ? (
        <figcaption>
          {imageUrl && (normalizedPhoto.source?.url || normalizedPhoto.embeddedSource?.url) ? (
            <a href={normalizedPhoto.source?.url ?? normalizedPhoto.embeddedSource.url} target="_blank" rel="noreferrer">
              Photo source <ExternalLink aria-hidden="true" />
            </a>
          ) : (
            <span>{imageUrl ? "Photo source not linked" : "Portrait unverified · initials shown"}</span>
          )}
        </figcaption>
      ) : null}
    </figure>
  );
}

function EmptyProfilePanel({ children, icon: Icon = Database, title }) {
  return (
    <div className="profile-empty">
      <Icon aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

function SourceLinks({ sourceById, sourceIds }) {
  const sources = resolveProfileSources(sourceIds, sourceById);
  if (!sources.length) return <span className="profile-source-missing">Source link pending</span>;
  return (
    <span className="profile-inline-sources">
      {sources.map((source) => source.url ? (
        <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
          {source.label}<ExternalLink aria-hidden="true" />
        </a>
      ) : <span key={source.id}>{source.label}</span>)}
    </span>
  );
}

function ProfileHero({ view }) {
  const { candidate, photo } = view;
  return (
    <header className="profile-hero">
      <CandidatePortrait candidate={candidate} photo={photo} />
      <div className="profile-hero-copy">
        <div className="profile-eyebrow">
          <span className="profile-party"><i aria-hidden="true" />{candidate.partyLabel}</span>
          <span><ScanSearch aria-hidden="true" />Research profile</span>
        </div>
        <h2>{candidate.name}</h2>
        <p className="profile-role">{candidate.role}</p>
        <div className="profile-location-line">
          <span><Vote aria-hidden="true" />{candidate.office}</span>
          {candidate.locality ? <span><MapPin aria-hidden="true" />{candidate.locality}</span> : null}
          {view.checkedAt ? <span><CalendarClock aria-hidden="true" />Sources checked {formatProfileDate(view.checkedAt)}</span> : null}
        </div>
        {candidate.summary && !view.synthesis ? (
          <div className="profile-intro">
            <span><Sparkles aria-hidden="true" />AI-assisted orientation · unreviewed</span>
            <p>{candidate.summary}</p>
          </div>
        ) : null}
        {view.links.length ? (
          <nav className="profile-link-list" aria-label={`${candidate.name} official and candidate-controlled links`}>
            {view.links.map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
                <Link2 aria-hidden="true" />
                <span><strong>{link.label}</strong><small>{link.kindLabel}</small></span>
                <ExternalLink aria-hidden="true" />
              </a>
            ))}
          </nav>
        ) : (
          <p className="profile-link-empty"><Link2 aria-hidden="true" />No official or candidate-controlled links have been reviewed yet.</p>
        )}
      </div>
    </header>
  );
}

function ProfileFacts({ facts, identifiers, sourceById }) {
  return (
    <section className="profile-panel profile-facts" aria-labelledby="profile-facts-title">
      <header className="profile-panel-heading">
        <span><FileCheck2 aria-hidden="true" /></span>
        <div><p>At a glance</p><h3 id="profile-facts-title">Sourced profile facts</h3></div>
      </header>
      {facts.length ? (
        <dl>
          {facts.map((fact) => (
            <div key={fact.id}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
              {fact.detail ? <p>{fact.detail}</p> : null}
              <footer><ProfileStatus value={fact.status} /><SourceLinks sourceById={sourceById} sourceIds={fact.sourceIds} /></footer>
            </div>
          ))}
        </dl>
      ) : (
        <EmptyProfilePanel title="Profile facts are not researched yet" icon={CircleHelp}>
          Missing facts remain unknown until a source supports them.
        </EmptyProfilePanel>
      )}
      {identifiers.length ? (
        <details className="profile-identifiers">
          <summary>Public record identifiers <span>{identifiers.length}</span></summary>
          <dl>
            {identifiers.map((identifier) => (
              <div key={identifier.id}>
                <dt>{identifier.systemLabel}{identifier.current ? "" : " · historical"}</dt>
                <dd>{identifier.value}</dd>
                {identifier.scope ? <p>{identifier.scope}</p> : null}
                <footer><SourceLinks sourceById={sourceById} sourceIds={identifier.sourceIds} /></footer>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </section>
  );
}

function EvidenceSynthesis({ synthesis, sourceById }) {
  if (!synthesis) return null;
  return (
    <section className="profile-panel profile-synthesis" aria-labelledby="profile-synthesis-title">
      <header className="profile-panel-heading">
        <span><Sparkles aria-hidden="true" /></span>
        <div><p>Machine-assisted, inspectable</p><h3 id="profile-synthesis-title">{synthesis.title}</h3></div>
        <span className="profile-draft-label">{synthesis.reviewStatus}</span>
      </header>
      <p className="profile-synthesis-text">{synthesis.text}</p>
      <aside><Sparkles aria-hidden="true" /><p><strong>{synthesis.disclosure}</strong>{synthesis.method ? ` ${synthesis.method}` : ""}</p></aside>
      <dl className="profile-synthesis-meta">
        <div><dt>Generated</dt><dd>{synthesis.generatedAt ? formatProfileDate(synthesis.generatedAt) : "Timestamp unavailable"}</dd></div>
        <div><dt>Evidence set</dt><dd><SourceLinks sourceById={sourceById} sourceIds={synthesis.sourceIds} /></dd></div>
      </dl>
      {synthesis.limitations.length ? (
        <ul className="profile-compact-limitations">
          {synthesis.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
        </ul>
      ) : null}
    </section>
  );
}

function CareerTimeline({ timeline, sourceById }) {
  return (
    <section className="profile-panel profile-timeline" aria-labelledby="profile-timeline-title">
      <header className="profile-panel-heading">
        <span><BriefcaseBusiness aria-hidden="true" /></span>
        <div><p>Public-service chronology</p><h3 id="profile-timeline-title">Career timeline</h3></div>
      </header>
      <p className="profile-chart-note">Durations share one calendar axis. Listed roles are sourced facts—not judgments about performance. {timeline.note}</p>
      {timeline.bars.length ? (
        <>
          <div className="profile-timeline-scroll">
            <div
              className="profile-timeline-chart"
              role="img"
              aria-label={`Career roles shown from ${formatProfileDate(timeline.domain.startDate)} through ${formatProfileDate(timeline.domain.endDate)}`}
            >
              <div className="profile-timeline-axis" aria-hidden="true">
                {timeline.axisTicks.map((tick, index) => (
                  <span key={`${tick.label}-${index}`} style={{ "--profile-offset": `${tick.offsetPercent}%` }}>{tick.label}</span>
                ))}
              </div>
              <div className="profile-timeline-lanes">
                {timeline.bars.map((entry) => (
                  <div className="profile-timeline-lane" key={entry.id}>
                    <div><strong>{entry.title}</strong><span>{entry.organization ?? "Organization not recorded"}</span></div>
                    <div className="profile-timeline-track">
                      {timeline.axisTicks.map((tick, index) => <i key={index} aria-hidden="true" style={{ "--profile-offset": `${tick.offsetPercent}%` }} />)}
                      <span
                        className="profile-timeline-bar"
                        style={{
                          "--profile-offset": `${entry.offsetPercent}%`,
                          "--profile-width": `${entry.widthPercent}%`,
                        }}
                      >
                        <b>{formatProfileDate(entry.startDate, true)}–{entry.isCurrent ? "current" : formatProfileDate(entry.endDate, true)}</b>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <details className="profile-data-table">
            <summary>Career timeline sources and exact dates</summary>
            <div>
              <table>
                <caption>Reviewed career and public-service history</caption>
                <thead><tr><th scope="col">Period</th><th scope="col">Role</th><th scope="col">Organization</th><th scope="col">Evidence type</th><th scope="col">Source</th></tr></thead>
                <tbody>
                  {timeline.rows.map((entry) => (
                    <tr key={entry.id}>
                      <th scope="row">{formatProfileDate(entry.startDate)}–{entry.isCurrent ? "current" : formatProfileDate(entry.endDate)}</th>
                      <td>{entry.title}</td>
                      <td>{entry.organization ?? "Unknown"}</td>
                      <td>{SOURCE_KIND_LABELS[entry.evidenceKind] ?? entry.evidenceKind}</td>
                      <td><SourceLinks sourceById={sourceById} sourceIds={entry.sourceIds} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <EmptyProfilePanel title="No comparable career dates yet" icon={History}>
          A timeline appears only after role dates and sources are reviewed. An undated title is not assigned a duration.
        </EmptyProfilePanel>
      )}
      {timeline.unrangedRows.length ? (
        <div className="profile-unranged">
          <TriangleAlert aria-hidden="true" />
          <p><strong>{timeline.unrangedRows.length} role{timeline.unrangedRows.length === 1 ? "" : "s"} omitted from the duration chart.</strong> Their start or end boundary is not documented yet; they remain in the exact table.</p>
        </div>
      ) : null}
    </section>
  );
}

function ElectionHistory({ elections, sourceById }) {
  return (
    <section className="profile-panel profile-elections" aria-labelledby="profile-elections-title">
      <header className="profile-panel-heading">
        <span><BarChart3 aria-hidden="true" /></span>
        <div><p>Past contests, not a forecast</p><h3 id="profile-elections-title">Prior election results</h3></div>
      </header>
      <p className="profile-chart-note">{elections.note}</p>
      {elections.chartRows.length ? (
        <>
          <div className="profile-election-chart">
            <div className="profile-election-axis" aria-hidden="true">
              {elections.axisTicks.map((tick) => <span key={tick} style={{ "--profile-offset": `${tick}%` }}>{tick}%</span>)}
            </div>
            {elections.chartRows.map((election) => (
              <article key={election.id} className="profile-election-row">
                <header>
                  <div><span>{formatProfileDate(election.date)}</span><strong>{election.office}</strong><small>{election.electionType}{election.jurisdiction ? ` · ${election.jurisdiction}` : ""}</small></div>
                  <div><strong>{formatProfilePercent(election.voteShare)}</strong><span>{formatProfileNumber(election.candidateVotes)} votes</span></div>
                </header>
                <div
                  className="profile-vote-bar"
                  role="img"
                  aria-label={`${election.office}: ${formatProfilePercent(election.voteShare)}, ${formatProfileNumber(election.candidateVotes)} of ${formatProfileNumber(election.totalVotes)} reported votes`}
                >
                  {elections.axisTicks.map((tick) => <i key={tick} aria-hidden="true" style={{ "--profile-offset": `${tick}%` }} />)}
                  <span className="profile-vote-candidate" style={{ width: `${election.candidateWidth}%` }} />
                  <span className="profile-vote-rest" style={{ width: `${election.otherWidth}%` }} />
                </div>
                <footer>
                  <span>{election.result ?? "Result label not recorded"}</span>
                  <SourceLinks sourceById={sourceById} sourceIds={election.sourceIds} />
                </footer>
              </article>
            ))}
          </div>
          <div className="profile-election-legend" aria-label="Election chart legend"><span><i aria-hidden="true" />Candidate's reported votes</span><span><i aria-hidden="true" />All other reported votes</span></div>
          <details className="profile-data-table">
            <summary>Exact prior-election results</summary>
            <div>
              <table>
                <caption>Prior election results; votes are counts and share is percent</caption>
                <thead><tr><th scope="col">Date</th><th scope="col">Contest</th><th scope="col">Candidate votes</th><th scope="col">Total reported votes</th><th scope="col">Share</th><th scope="col">Result</th><th scope="col">Source</th></tr></thead>
                <tbody>
                  {elections.rows.map((election) => (
                    <tr key={election.id}>
                      <th scope="row">{formatProfileDate(election.date)}</th>
                      <td>{election.office} · {election.electionType}</td>
                      <td>{formatProfileNumber(election.candidateVotes)}</td>
                      <td>{formatProfileNumber(election.totalVotes)}</td>
                      <td>{formatProfilePercent(election.voteShare)}</td>
                      <td>{election.result ?? "Unknown"}</td>
                      <td><SourceLinks sourceById={sourceById} sourceIds={election.sourceIds} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <EmptyProfilePanel title="Prior-election results are not available" icon={Vote}>
          Civics will not draw a zero-value bar when vote counts or an official result are missing.
        </EmptyProfilePanel>
      )}
      {elections.unknownRows.length ? <p className="profile-chart-gap"><CircleHelp aria-hidden="true" />{elections.unknownRows.length} contest{elections.unknownRows.length === 1 ? " has" : "s have"} incomplete vote totals and appears only in the exact table.</p> : null}
    </section>
  );
}

function EvidenceCoverage({ evidence, sourceById }) {
  return (
    <section className="profile-panel profile-evidence" aria-labelledby="profile-evidence-title">
      <header className="profile-panel-heading">
        <span><ScanSearch aria-hidden="true" /></span>
        <div><p>Coverage, not scoring</p><h3 id="profile-evidence-title">Evidence layers</h3></div>
      </header>
      <p className="profile-chart-note">{evidence.note}</p>
      {evidence.layers.length ? (
        <dl>
          {evidence.layers.map((layer) => (
            <div key={layer.id}>
              <dt><span>{layer.label}</span>{layer.detail ? <small>{layer.detail}</small> : null}</dt>
              <dd><ProfileStatus value={layer.status} /><SourceLinks sourceById={sourceById} sourceIds={layer.sourceIds} /></dd>
            </div>
          ))}
        </dl>
      ) : (
        <EmptyProfilePanel title="Evidence coverage has not been cataloged" icon={ScanSearch}>
          No completeness state is inferred from an empty record.
        </EmptyProfilePanel>
      )}
    </section>
  );
}

function ProfileSources({ limitations, sources }) {
  return (
    <section className="profile-panel profile-provenance" aria-labelledby="profile-sources-title">
      <header className="profile-panel-heading">
        <span><Database aria-hidden="true" /></span>
        <div><p>Inspect the evidence</p><h3 id="profile-sources-title">Sources and limitations</h3></div>
      </header>
      {sources.length ? (
        <ul className="profile-source-list">
          {sources.map((source) => (
            <li key={source.id}>
              <span className="profile-source-kind">{source.kindLabel}</span>
              <strong>{source.label}</strong>
              {source.publisher ? <p>{source.publisher}</p> : null}
              <footer>
                <span>{source.checkedAt ? `Checked ${formatProfileDate(source.checkedAt)}` : "Check date unavailable"}{source.reviewState === "needs-maintainer-review" ? " · maintainer review pending" : ""}</span>
                {source.url ? <a href={source.url} target="_blank" rel="noreferrer">Open source <ExternalLink aria-hidden="true" /></a> : <span>Link unavailable</span>}
              </footer>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyProfilePanel title="No profile sources linked yet" icon={Database}>
          Unsourced biography and result claims are intentionally withheld.
        </EmptyProfilePanel>
      )}
      <aside className="profile-limitations">
        <TriangleAlert aria-hidden="true" />
        <div>
          <strong>Read with these constraints</strong>
          {limitations.length ? <ul>{limitations.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No profile-specific limitation note has been published. The prototype-wide verification warning still applies.</p>}
        </div>
      </aside>
    </section>
  );
}

export function CandidateProfileExperience({ candidate, children, className = "", id, profile = {} }) {
  const view = useMemo(() => buildProfileView({ candidate, profile }), [candidate, profile]);
  return (
    <article className={joinClasses("profile-experience", `party-${view.candidate.party}`, className)} id={id ?? view.id}>
      <ProfileHero view={view} />
      <div className="profile-main-grid">
        <ProfileFacts facts={view.facts} identifiers={view.identifiers} sourceById={view.sourceById} />
        <EvidenceCoverage evidence={view.evidence} sourceById={view.sourceById} />
      </div>
      <EvidenceSynthesis synthesis={view.synthesis} sourceById={view.sourceById} />
      <CareerTimeline timeline={view.timeline} sourceById={view.sourceById} />
      <ElectionHistory elections={view.elections} sourceById={view.sourceById} />
      {children ? <div className="profile-extension">{children}</div> : null}
      <ProfileSources limitations={view.limitations} sources={view.sources} />
      <footer className="profile-boundary-note">
        <BadgeCheck aria-hidden="true" />
        <p><strong>Decision support, not a recommendation.</strong> Photo verification, evidence coverage, career length, past vote share, and source count do not measure candidate quality or voter fit.</p>
      </footer>
    </article>
  );
}

export default CandidateProfileExperience;
