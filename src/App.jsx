import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  ExternalLink,
  FileCheck2,
  Info,
  Map,
  MapPin,
  Moon,
  Network,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Vote,
  X,
} from "lucide-react";
import { geoPath } from "d3-geo";
import { candidates, countyNames, election, races, sources } from "./data/seed.js";
import massachusettsCounties from "./data/ma-counties.json";
import {
  EVIDENCE_KEYS,
  buildBallotRows,
  describeEvidence,
  summarizeBallotRows,
} from "./lib/ballot-view.js";

const PARTY_LABELS = {
  all: "Both ballots",
  democratic: "Democratic",
  republican: "Republican",
};

const STATUS_LABELS = {
  verified: "Verified",
  available: "Available",
  queued: "Queued",
  researching: "Researching",
  "not-applicable": "Not applicable",
};

const EVIDENCE_LABELS = {
  ballot: "Ballot identity",
  record: "Public record",
  finance: "Campaign finance",
  positions: "Policy positions",
};

function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(new Date(`${value}T12:00:00`));
}

function daysUntil(value) {
  const now = new Date();
  const target = new Date(`${value}T00:00:00-04:00`);
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
}

function Status({ value }) {
  return <span className={`status status-${value}`}>{STATUS_LABELS[value] ?? value}</span>;
}

function EvidenceCells({ evidence }) {
  return (
    <dl className="evidence-cells" aria-label="Evidence coverage by layer">
      {EVIDENCE_KEYS.map((key) => (
        <div key={key}>
          <dt>{EVIDENCE_LABELS[key]}</dt>
          <dd><Status value={evidence[key]} /></dd>
        </div>
      ))}
    </dl>
  );
}

function EvidenceDots({ evidence }) {
  const description = describeEvidence(evidence, EVIDENCE_LABELS, STATUS_LABELS);
  return (
    <span className="evidence-dots" role="img" aria-label={description}>
      {EVIDENCE_KEYS.map((key) => <i key={key} className={`status-${evidence[key]}`} />)}
    </span>
  );
}

function MassachusettsMap({ selectedCounty, onSelectCounty }) {
  const { counties, offsetX, offsetY, path, scale, transform } = useMemo(() => {
    const massachusetts = massachusettsCounties.features;
    const collection = { type: "FeatureCollection", features: massachusetts };
    const rawPath = geoPath(null);
    const [[x0, y0], [x1, y1]] = rawPath.bounds(collection);
    const width = 680;
    const height = 410;
    const padding = 32;
    const scale = Math.min((width - padding * 2) / (x1 - x0), (height - padding * 2) / (y1 - y0));
    const offsetX = (width - scale * (x1 + x0)) / 2;
    const offsetY = (height - scale * (y1 + y0)) / 2;
    return {
      counties: massachusetts,
      offsetX,
      offsetY,
      path: rawPath,
      scale,
      transform: `translate(${offsetX} ${offsetY}) scale(${scale})`,
    };
  }, []);

  const selectedFeature = counties.find((county) => String(county.id).padStart(5, "0") === selectedCounty);
  const selectedCentroid = selectedFeature ? path.centroid(selectedFeature) : null;
  const selectedScreenCentroid = selectedCentroid
    ? [
        selectedCentroid[0] * scale + offsetX,
        selectedCentroid[1] * scale + offsetY,
      ]
    : null;

  return (
    <div className="map-stage">
      <svg
        className="massachusetts-map"
        viewBox="0 0 680 410"
        role="img"
        aria-labelledby="ma-map-title ma-map-description"
      >
        <title id="ma-map-title">Massachusetts county map</title>
        <desc id="ma-map-description">
          Select a county to establish geographic context. Statewide races appear in every county; district-level ballot resolution is being added.
        </desc>
        <g transform={transform}>
          {counties.map((county) => {
            const id = String(county.id).padStart(5, "0");
            const isSelected = selectedCounty === id;
            return (
              <path
                key={id}
                d={path(county)}
                className={`county-shape${isSelected ? " is-selected" : ""}`}
                vectorEffect="non-scaling-stroke"
                role="button"
                aria-label={`${countyNames[id]} County`}
                aria-pressed={isSelected}
                tabIndex="0"
                onClick={() => onSelectCounty(id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectCounty(id);
                  }
                }}
              />
            );
          })}
        </g>
        {selectedFeature && selectedScreenCentroid ? (
          <g className="county-label" transform={`translate(${selectedScreenCentroid[0]} ${selectedScreenCentroid[1]})`}>
            <circle r="3.5" />
          </g>
        ) : null}
      </svg>
      <div className="map-legend" aria-hidden="true">
        <span><i className="legend-selected" /> Selected region</span>
        <span><i /> Explore a county</span>
      </div>
    </div>
  );
}

function QuickStartPanel({
  activeRace,
  ballot,
  onSelectBallot,
  onSelectCounty,
  regionContext,
  remainingDays,
  selectedCounty,
  visibleCandidateCount,
}) {
  return (
    <aside className="quick-start-card" aria-label="Ballot quick start">
      <div className="quick-status">
        <span><i aria-hidden="true" /> {election.name}</span>
        <strong>{remainingDays} days</strong>
      </div>
      <div className="quick-heading">
        <p>Ballot observatory</p>
        <h2>Set your view in two steps.</h2>
      </div>
      <div className="quick-step">
        <span className="quick-step-number">01</span>
        <label>
          <span>County context</span>
          <select value={selectedCounty} onChange={(event) => onSelectCounty(event.target.value)}>
            {Object.entries(countyNames).sort(([, a], [, b]) => a.localeCompare(b)).map(([id, name]) => (
              <option key={id} value={id}>{name} County</option>
            ))}
          </select>
        </label>
      </div>
      <div className="quick-step">
        <span className="quick-step-number">02</span>
        <div className="quick-ballot-choice">
          <span>Primary ballot lens</span>
          <div className="ballot-switch" role="group" aria-label="Choose quick-start ballot view">
            {Object.entries(PARTY_LABELS).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={ballot === value} onClick={() => onSelectBallot(value)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="quick-result" aria-live="polite">
        <div>
          <small>Ready to inspect · {regionContext}</small>
          <strong>{activeRace.office}</strong>
          <span>{visibleCandidateCount} {visibleCandidateCount === 1 ? "listing" : "listings"} in this view</span>
        </div>
        <a href="#compare" aria-label={`Review ${activeRace.office}`}>Review race <ArrowRight aria-hidden="true" /></a>
      </div>
      <p className="quick-privacy"><ShieldCheck aria-hidden="true" /> Your selections stay on this device · official roster checked {formatDate(sources.ballot.checkedAt)}</p>
    </aside>
  );
}

function AtlasCandidate({ candidate, isSaved, onOpen }) {
  return (
    <button
      className={`atlas-candidate party-${candidate.party}${isSaved ? " is-saved" : ""}`}
      type="button"
      onClick={() => onOpen(candidate)}
      aria-label={`Open ${candidate.name}. ${describeEvidence(candidate.evidence, EVIDENCE_LABELS, STATUS_LABELS)}`}
    >
      <span>{candidate.name}</span>
      <EvidenceDots evidence={candidate.evidence} />
      {isSaved ? <Bookmark aria-hidden="true" /> : null}
    </button>
  );
}

function AtlasLane({ candidates: laneCandidates, emptyLabel, isSaved, onOpen, party }) {
  return (
    <div className={`atlas-lane atlas-lane-${party}`}>
      <span className="atlas-lane-label">{PARTY_LABELS[party]}</span>
      <div className="atlas-candidates">
        {laneCandidates.length ? laneCandidates.map((candidate) => (
          <AtlasCandidate
            key={candidate.id}
            candidate={candidate}
            isSaved={isSaved(candidate.id)}
            onOpen={onOpen}
          />
        )) : <span className="atlas-empty">{emptyLabel}</span>}
      </div>
    </div>
  );
}

function BallotAtlas({
  atlasScope,
  availableRaces,
  hasLocalProof,
  isSaved,
  onOpenCandidate,
  onOpenRace,
  onScopeChange,
}) {
  const rows = useMemo(
    () => buildBallotRows(availableRaces, candidates, atlasScope),
    [atlasScope, availableRaces],
  );
  const summary = useMemo(() => summarizeBallotRows(rows), [rows]);
  const statewideCount = availableRaces.filter((race) => race.scope === "statewide").length;
  const localCount = availableRaces.length - statewideCount;
  const scopeOptions = [
    { id: "available", label: "Available", count: availableRaces.length },
    { id: "statewide", label: "Statewide", count: statewideCount },
    ...(hasLocalProof ? [{ id: "local", label: "Wilmington", count: localCount }] : []),
  ];

  return (
    <section className="atlas-section" id="atlas" aria-labelledby="atlas-title">
      <div className="section-heading atlas-heading">
        <div><p className="section-kicker">Ballot Atlas</p><h2 id="atlas-title">Both ballots. One field of view.</h2></div>
        <p>Scan every available race across equal party lanes. Open a person for evidence, or jump into a focused race comparison—without turning coverage into a candidate score.</p>
      </div>
      <article className="atlas-panel">
        <header className="atlas-toolbar">
          <div className="atlas-stats" aria-live="polite">
            <span><strong>{rows.length}</strong> races</span>
            <span><strong>{summary.listings}</strong> roster listings</span>
            <span><strong>{summary.choiceRaces}</strong> races with a multi-person lane</span>
            <span><strong>{summary.emptyLanes}</strong> empty party lanes</span>
          </div>
          <div className="atlas-scopes" role="group" aria-label="Filter Ballot Atlas scope">
            {scopeOptions.map((option) => (
              <button key={option.id} type="button" aria-pressed={atlasScope === option.id} onClick={() => onScopeChange(option.id)}>
                {option.label} <span>{option.count}</span>
              </button>
            ))}
          </div>
        </header>
        <div className="atlas-column-headings" aria-hidden="true">
          <span>Democratic roster</span><span>Office spine</span><span>Republican roster</span>
        </div>
        <div className="atlas-grid" role="list" aria-label="Available races across both primary ballots">
          {rows.map((row, index) => (
            <div className="atlas-row" role="listitem" key={row.id}>
              <AtlasLane
                candidates={row.democraticCandidates}
                emptyLabel="No nomination listed in checked roster"
                isSaved={isSaved}
                onOpen={onOpenCandidate}
                party="democratic"
              />
              <button className="atlas-office" type="button" onClick={() => onOpenRace(row.id)} aria-label={`Focus ${row.office} comparison`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{row.office}</strong>
                <small>{row.scope}</small>
                <ChevronRight aria-hidden="true" />
              </button>
              <AtlasLane
                candidates={row.republicanCandidates}
                emptyLabel="No nomination listed in checked roster"
                isSaved={isSaved}
                onOpen={onOpenCandidate}
                party="republican"
              />
            </div>
          ))}
        </div>
        <div className="atlas-legend">
          <span>Evidence dots</span>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <span key={value}><i className={`status-${value}`} />{label}</span>
          ))}
          <p>“No nomination listed” reflects the checked roster snapshot, not a prediction or final certification.</p>
        </div>
      </article>
    </section>
  );
}

function CandidateCard({ candidate, isSaved, onToggleSave, onOpen }) {
  return (
    <article className={`candidate-card party-${candidate.party}`}>
      <div className="candidate-card-topline">
        <span className="party-label"><i aria-hidden="true" />{PARTY_LABELS[candidate.party]}</span>
        <button
          className={`save-button${isSaved ? " is-saved" : ""}`}
          type="button"
          aria-label={isSaved ? `Remove ${candidate.name} from private comparison` : `Save ${candidate.name} to private comparison`}
          aria-pressed={isSaved}
          onClick={() => onToggleSave(candidate.id)}
        >
          <Bookmark aria-hidden="true" />
        </button>
      </div>
      <div className="candidate-identity">
        <div className="candidate-avatar" aria-hidden="true">{candidate.initials}</div>
        <div>
          <p>{candidate.office}</p>
          <h3>{candidate.name}</h3>
          <span>{candidate.role} · {candidate.locality}</span>
        </div>
      </div>
      <p className="candidate-summary">{candidate.summary}</p>
      <EvidenceCells evidence={candidate.evidence} />
      <button className="candidate-action" type="button" onClick={() => onOpen(candidate)}>
        Open evidence profile <ArrowRight aria-hidden="true" />
      </button>
    </article>
  );
}

function CandidateLane({ laneCandidates, party, isSaved, onOpen, onToggleSave, single }) {
  return (
    <section className={`candidate-lane party-${party}`} aria-labelledby={`candidate-lane-${party}`}>
      <header className="candidate-lane-header">
        <span className="party-label" id={`candidate-lane-${party}`}><i aria-hidden="true" />{PARTY_LABELS[party]} ballot</span>
        <span>{laneCandidates.length} {laneCandidates.length === 1 ? "listing" : "listings"}</span>
      </header>
      {laneCandidates.length ? (
        <div className={`candidate-lane-stack${single ? " is-single" : ""}`}>
          {laneCandidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              isSaved={isSaved(candidate.id)}
              onToggleSave={onToggleSave}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
        <div className="candidate-lane-empty">
          <CircleHelp aria-hidden="true" />
          <p><strong>No nomination listed.</strong> This describes the checked official roster snapshot, not a final prediction.</p>
        </div>
      )}
    </section>
  );
}

function CompareTray({ profiles, onClear, onOpen }) {
  if (!profiles.length) return null;

  return (
    <aside className="compare-tray" aria-label="Private comparison tray">
      <div className="tray-heading">
        <Bookmark aria-hidden="true" />
        <span><small>Private compare</small><strong aria-live="polite">{profiles.length} saved locally</strong></span>
      </div>
      <div className="tray-profiles" aria-label="Saved candidate profiles">
        {profiles.slice(0, 5).map((candidate) => (
          <button
            className={`party-${candidate.party}`}
            key={candidate.id}
            type="button"
            onClick={() => onOpen(candidate)}
            aria-label={`Open saved profile for ${candidate.name}`}
          >
            <span>{candidate.initials}</span>
          </button>
        ))}
        {profiles.length > 5 ? <span className="tray-more">+{profiles.length - 5}</span> : null}
      </div>
      <a href="#ballot-notes">Review set <ChevronRight aria-hidden="true" /></a>
      <button className="tray-clear" type="button" onClick={onClear}>Clear</button>
    </aside>
  );
}

function CandidateDialog({ candidate, onClose, isSaved, onToggleSave }) {
  const closeButton = useRef(null);
  const dialog = useRef(null);
  const previouslyFocused = useRef(document.activeElement);
  const candidateSource = candidate.party === "democratic"
    ? sources.democraticCandidates
    : sources.republicanCandidates;

  useEffect(() => {
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleDialogKeys = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...dialog.current.querySelectorAll("a[href], button:not([disabled]), select, [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.removeEventListener("keydown", handleDialogKeys);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialog} className={`candidate-dialog party-${candidate.party}`} role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <div className="dialog-header">
          <div className="candidate-avatar large" aria-hidden="true">{candidate.initials}</div>
          <div>
            <span className="party-label"><i aria-hidden="true" />{PARTY_LABELS[candidate.party]} ballot</span>
            <h2 id="profile-title">{candidate.name}</h2>
            <p>{candidate.role} · {candidate.locality}</p>
          </div>
          <button ref={closeButton} className="dialog-close" type="button" aria-label="Close candidate profile" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="dialog-body">
          <section>
            <p className="section-kicker">Current synthesis</p>
            <h3>What the evidence says so far</h3>
            <p>{candidate.summary}</p>
            <div className="prototype-note">
              <Sparkles aria-hidden="true" />
              <p><strong>Interpretation is deliberately limited.</strong> Civics will not infer a position simply to complete a profile. Unknown stays unknown until a source supports it.</p>
            </div>
          </section>
          <section>
            <p className="section-kicker">Evidence coverage</p>
            <h3>Four independent layers</h3>
            <dl className="evidence-list">
              {Object.entries(candidate.evidence).map(([key, value]) => (
                <div key={key}>
                  <dt>{EVIDENCE_LABELS[key]}</dt>
                  <dd><Status value={value} /></dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="source-box">
            <FileCheck2 aria-hidden="true" />
            <div>
              <strong>Official roster listing verified</strong>
              <p>Listed as of {formatDate(candidateSource.checkedAt)} on the Secretary's 2026 state-primary candidate roster. The roster can still receive official corrections or withdrawals.</p>
              <a href={candidateSource.url} target="_blank" rel="noreferrer">Inspect the official source <ExternalLink aria-hidden="true" /></a>
            </div>
          </section>
        </div>
        <div className="dialog-footer">
          <p>This profile is research support—not an endorsement or voting recommendation.</p>
          <button className={`primary-button${isSaved ? " is-saved" : ""}`} type="button" onClick={() => onToggleSave(candidate.id)}>
            {isSaved ? <Check aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
            {isSaved ? "Saved to private compare" : "Save to private compare"}
          </button>
        </div>
      </section>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("civics-theme") ?? "dark");
  const [selectedCounty, setSelectedCounty] = useState("25017");
  const [ballot, setBallot] = useState("all");
  const [atlasScope, setAtlasScope] = useState("available");
  const [selectedRace, setSelectedRace] = useState(races[0].id);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [savedCandidates, setSavedCandidates] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("civics-ballot-notes") ?? "[]"));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("civics-theme", theme);
  }, [theme]);

  const isWilmingtonProof = selectedCounty === "25017";
  const availableRaces = useMemo(
    () => races.filter((race) => race.scope === "statewide" || isWilmingtonProof),
    [isWilmingtonProof],
  );
  const activeRace = availableRaces.find((race) => race.id === selectedRace) ?? availableRaces[0];

  useEffect(() => {
    if (!availableRaces.some((race) => race.id === selectedRace)) {
      setSelectedRace(availableRaces[0].id);
    }
  }, [availableRaces, selectedRace]);

  useEffect(() => {
    if (!isWilmingtonProof && atlasScope === "local") {
      setAtlasScope("available");
    }
  }, [atlasScope, isWilmingtonProof]);

  const visibleCandidateIds = ballot === "all"
    ? [...activeRace.democratic, ...activeRace.republican]
    : activeRace[ballot];
  const visibleCandidates = visibleCandidateIds.map((id) => candidates.find((candidate) => candidate.id === id)).filter(Boolean);
  const candidateGroups = (ballot === "all" ? ["democratic", "republican"] : [ballot]).map((party) => ({
    party,
    candidates: activeRace[party].map((id) => candidates.find((candidate) => candidate.id === id)).filter(Boolean),
  }));
  const selectedCountyName = countyNames[selectedCounty];
  const regionContext = isWilmingtonProof ? "Wilmington proof of concept" : `${selectedCountyName} County`;
  const savedProfiles = candidates.filter((candidate) => savedCandidates.has(candidate.id));
  const remainingDays = daysUntil(election.date);

  function toggleSaved(candidateId) {
    setSavedCandidates((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      localStorage.setItem("civics-ballot-notes", JSON.stringify([...next]));
      return next;
    });
  }

  function clearSaved() {
    setSavedCandidates(new Set());
    localStorage.setItem("civics-ballot-notes", "[]");
  }

  function focusRace(raceId) {
    setSelectedRace(raceId);
    window.requestAnimationFrame(() => document.getElementById("compare")?.scrollIntoView({ behavior: "smooth" }));
  }

  return (
    <div className={`app-shell${savedProfiles.length ? " has-compare-tray" : ""}`}>
      <a className="skip-link" href="#atlas">Skip to Ballot Atlas</a>
      <div className="ambient-field" aria-hidden="true"><span /><span /><span /></div>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Civics home">
          <span className="brand-mark"><Vote aria-hidden="true" /></span>
          <span><strong>civics</strong><small>by Ego Hygiene</small></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#explore">Explore</a>
          <a href="#atlas">Atlas</a>
          <a href="#compare">Compare</a>
          <a href="#method">Method</a>
        </nav>
        <button className="theme-button" type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </button>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span /> Experimental civic intelligence · Massachusetts</p>
            <h1 id="hero-title">See the choice<br /><em>before the ballot.</em></h1>
            <p className="hero-lede">Explore both primary ballots, understand the offices, and follow every interpretation back to evidence—without giving your political preferences to a server.</p>
            <div className="hero-actions">
              <a className="primary-button" href="#atlas">Open the Ballot Atlas <ArrowRight aria-hidden="true" /></a>
              <a className="quiet-button" href="#method">How evidence works <Network aria-hidden="true" /></a>
            </div>
            <p className="privacy-line"><ShieldCheck aria-hidden="true" /> Your region and private comparison stay in this browser.</p>
          </div>
          <QuickStartPanel
            activeRace={activeRace}
            ballot={ballot}
            onSelectBallot={setBallot}
            onSelectCounty={setSelectedCounty}
            regionContext={regionContext}
            remainingDays={remainingDays}
            selectedCounty={selectedCounty}
            visibleCandidateCount={visibleCandidates.length}
          />
        </section>

        <section className="election-strip" aria-label="Election deadlines">
          <div><CalendarDays aria-hidden="true" /><span><small>Election day</small><strong>{formatDate(election.date)}</strong></span></div>
          <div><Clock3 aria-hidden="true" /><span><small>Early voting</small><strong>{election.earlyVoting}</strong></span></div>
          <div><Vote aria-hidden="true" /><span><small>Polls</small><strong>{election.pollingHours}</strong></span></div>
          <div className="strip-notice"><Info aria-hidden="true" /><p>Unenrolled Massachusetts voters may choose either party’s primary ballot without changing enrollment.</p></div>
        </section>

        <section className="explorer-section" id="explore" aria-labelledby="explore-title">
          <div className="section-heading">
            <div><p className="section-kicker">Start with place</p><h2 id="explore-title">Find the shape of your ballot.</h2></div>
            <p>Statewide choices appear everywhere. Middlesex unlocks a clearly labeled Wilmington proof of concept; other local ballots need address-level district resolution.</p>
          </div>
          <div className="explorer-grid">
            <article className="map-panel">
              <div className="panel-heading">
                <div><Map aria-hidden="true" /><span><small>Selected region</small><strong>{regionContext}</strong></span></div>
                <span className="coverage-badge">{isWilmingtonProof ? "Local seed ready" : "Statewide layer"}</span>
              </div>
              <MassachusettsMap selectedCounty={selectedCounty} onSelectCounty={setSelectedCounty} />
              <label className="county-select">
                <span>Accessible county selector</span>
                <select value={selectedCounty} onChange={(event) => setSelectedCounty(event.target.value)}>
                  {Object.entries(countyNames).sort(([, a], [, b]) => a.localeCompare(b)).map(([id, name]) => (
                    <option key={id} value={id}>{name} County</option>
                  ))}
                </select>
              </label>
              <p className="map-source"><MapPin aria-hidden="true" /> Geography derived from U.S. Census cartographic data via us-atlas.</p>
              {isWilmingtonProof ? <p className="map-source"><Info aria-hidden="true" /> District races shown are for Wilmington—not all of Middlesex County.</p> : null}
            </article>

            <article className="ballot-panel">
              <div className="panel-heading stacked">
                <div><Vote aria-hidden="true" /><span><small>Primary ballot lens</small><strong>View the full decision space</strong></span></div>
                <div className="ballot-switch" role="group" aria-label="Choose ballot view">
                  {Object.entries(PARTY_LABELS).map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={ballot === value} onClick={() => setBallot(value)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="race-list" aria-label="Available primary races">
                {availableRaces.map((race) => {
                  const candidateCount = ballot === "all" ? race.democratic.length + race.republican.length : race[ballot].length;
                  return (
                    <button key={race.id} type="button" className={selectedRace === race.id ? "is-active" : ""} onClick={() => setSelectedRace(race.id)}>
                      <span><small>{race.scope}</small><strong>{race.office}</strong></span>
                      <span className="race-count">{candidateCount || "—"}</span>
                      <ChevronRight aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              <div className="ballot-footnote">
                <CircleHelp aria-hidden="true" />
                <p><strong>Why “both ballots”?</strong> You should be able to understand every available choice before an unenrolled voter is asked to select one ballot.</p>
              </div>
            </article>
          </div>
        </section>

        <BallotAtlas
          atlasScope={atlasScope}
          availableRaces={availableRaces}
          hasLocalProof={isWilmingtonProof}
          isSaved={(candidateId) => savedCandidates.has(candidateId)}
          onOpenCandidate={setSelectedCandidate}
          onOpenRace={focusRace}
          onScopeChange={setAtlasScope}
        />

        <section className="compare-section" id="compare" aria-labelledby="compare-title">
          <div className="section-heading comparison-heading">
            <div aria-live="polite"><p className="section-kicker">Race comparison</p><h2 id="compare-title">{activeRace.office}</h2></div>
            <div className="comparison-meta">
              <span>{PARTY_LABELS[ballot]}</span>
              <span>{regionContext}</span>
              <span>{visibleCandidates.length} {visibleCandidates.length === 1 ? "candidate" : "candidates"}</span>
            </div>
          </div>
          {visibleCandidates.length ? (
            <div className={`candidate-lanes${candidateGroups.length === 2 ? " is-split" : " is-single"}`}>
              {candidateGroups.map((group) => (
                <CandidateLane
                  key={group.party}
                  laneCandidates={group.candidates}
                  party={group.party}
                  isSaved={(candidateId) => savedCandidates.has(candidateId)}
                  onToggleSave={toggleSaved}
                  onOpen={setSelectedCandidate}
                  single={candidateGroups.length === 1}
                />
              ))}
            </div>
          ) : (
            <div className="empty-race">
              <Search aria-hidden="true" />
              <h3>No nomination appears in this seed ballot.</h3>
              <p>“No nominations” is represented as missing ballot choice—not as missing research.</p>
              <button type="button" className="quiet-button" onClick={() => setBallot("all")}>Show both ballots</button>
            </div>
          )}

          <div className="evidence-matrix" aria-labelledby="matrix-title">
            <div className="matrix-heading">
              <div><p className="section-kicker">Coverage, not scoring</p><h3 id="matrix-title">What is known—and what is not.</h3></div>
              <p>These states describe research completeness. They do not grade candidates or imply compatibility.</p>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr><th scope="col">Evidence layer</th>{visibleCandidates.map((candidate) => <th scope="col" key={candidate.id}>{candidate.name}</th>)}</tr></thead>
                <tbody>
                  {Object.entries(EVIDENCE_LABELS).map(([key, label]) => (
                    <tr key={key}><th scope="row">{label}</th>{visibleCandidates.map((candidate) => <td key={candidate.id}><Status value={candidate.evidence[key]} /></td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="notes-section" id="ballot-notes" aria-labelledby="notes-title">
          <div>
            <p className="section-kicker">Private decision workspace</p>
            <h2 id="notes-title">Your comparison stays yours.</h2>
            <p>Save profiles while you compare. Nothing is transmitted, no account is created, and clearing browser storage clears the list.</p>
          </div>
          <div className="saved-list">
            {savedProfiles.length ? savedProfiles.map((candidate) => (
              <button className={`party-${candidate.party}`} key={candidate.id} type="button" onClick={() => setSelectedCandidate(candidate)}>
                <span className="saved-avatar" aria-hidden="true">{candidate.initials}</span>
                <span><strong>{candidate.name}</strong><small>{candidate.office} · {PARTY_LABELS[candidate.party]}</small></span>
                <ChevronRight aria-hidden="true" />
              </button>
            )) : (
              <div className="notes-empty"><Bookmark aria-hidden="true" /><p>Use the bookmark on a candidate card to begin a private comparison list.</p></div>
            )}
          </div>
        </section>

        <section className="method-section" id="method" aria-labelledby="method-title">
          <div className="section-heading">
            <div><p className="section-kicker">Evidence before interpretation</p><h2 id="method-title">A civic graph you can inspect.</h2></div>
            <p>Civics separates official identity, observed political evidence, and machine-generated synthesis so confidence never masquerades as fact.</p>
          </div>
          <div className="method-flow" aria-label="Civics data pipeline">
            <div><span>01</span><FileCheck2 aria-hidden="true" /><strong>Official sources</strong><p>Ballots, offices, bills, votes, filings, and boundaries.</p></div>
            <i aria-hidden="true"><ArrowRight /></i>
            <div><span>02</span><Network aria-hidden="true" /><strong>Evidence graph</strong><p>Claims retain dates, provenance, uncertainty, and relationships.</p></div>
            <i aria-hidden="true"><ArrowRight /></i>
            <div><span>03</span><Scale aria-hidden="true" /><strong>Careful synthesis</strong><p>Summaries distinguish statements, actions, conflict, and unknowns.</p></div>
            <i aria-hidden="true"><ArrowRight /></i>
            <div><span>04</span><Vote aria-hidden="true" /><strong>Your judgment</strong><p>The system organizes evidence; the decision remains yours.</p></div>
          </div>
          <aside className="disclaimer">
            <Info aria-hidden="true" />
            <p><strong>Experimental public prototype.</strong> Information may be incomplete, outdated, or incorrectly interpreted. Verify consequential claims using linked primary sources before voting. Civics does not endorse candidates.</p>
          </aside>
        </section>
      </main>

      <footer>
        <div className="footer-brand"><span className="brand-mark"><Vote aria-hidden="true" /></span><div><strong>civics</strong><p>Evidence-linked civic intelligence for human judgment.</p></div></div>
        <nav aria-label="Footer navigation">
          <a href={sources.ballot.url} target="_blank" rel="noreferrer">Official ballot source</a>
          <a href="https://github.com/egohygiene/civics" target="_blank" rel="noreferrer"><Code2 aria-hidden="true" /> Source</a>
          <a href="https://egohygiene.io" target="_blank" rel="noreferrer">Ego Hygiene</a>
        </nav>
        <p>Roster snapshot checked {formatDate(sources.ballot.checkedAt)} · built in public · no tracking</p>
      </footer>

      <CompareTray profiles={savedProfiles} onClear={clearSaved} onOpen={setSelectedCandidate} />

      <nav className="mobile-dock" aria-label="Mobile navigation">
        <a href="#explore"><Map aria-hidden="true" /><small>Map</small></a>
        <a href="#atlas"><Network aria-hidden="true" /><small>Atlas</small></a>
        <a href="#compare"><Scale aria-hidden="true" /><small>Compare</small></a>
        <a href="#method"><FileCheck2 aria-hidden="true" /><small>Method</small></a>
      </nav>

      {selectedCandidate ? (
        <CandidateDialog
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          isSaved={savedCandidates.has(selectedCandidate.id)}
          onToggleSave={toggleSaved}
        />
      ) : null}
    </div>
  );
}

export default App;
