import OpportunityCard from "@/components/OpportunityCard";
import DiscoveryWizard from "@/components/DiscoveryWizard";
import AnimatedHeadline from "@/components/AnimatedHeadline";

import ThemedOppyOrb from "@/components/ThemedOppyOrb";
import SearchBar from "@/components/SearchBar";
import { OpportunityDocument } from "@/types/opportunity";

// ── Hero card helpers ───────────────────────────────────────────────────

/** Category → pastel background + text color for hero cards. */
const HERO_CAT_COLORS: Record<string, { bg: string; fg: string }> = {
  Hackathon:   { bg: "var(--lavender)", fg: "#4A3F8A" },
  Fellowship:  { bg: "var(--sage)",     fg: "#2E5A28" },
  Internship:  { bg: "var(--peach)",    fg: "#7A4A1A" },
  Event:       { bg: "#F0E8FF",         fg: "#5B3D8A" },
  Scholarship: { bg: "var(--blue)",     fg: "#1F4A62" },
  Grant:       { bg: "var(--blue)",     fg: "#1F4A62" },
  Job:         { bg: "var(--sage)",     fg: "#1F5A3A" },
};

const DEFAULT_HERO_COLOR = { bg: "var(--lavender)", fg: "#4A3F8A" };

/** Rotations for each card slot (keeps the scattered feel). */
const HERO_ROTATIONS = ["-2deg", "2deg", "-1deg", "3deg", "-2deg"];

/** Format a short location string for the hero card meta line. */
function heroMeta(opp: OpportunityDocument): string {
  const loc = opp.location || "";
  // Show location, or a deadline hint
  if (opp.eventDate) {
    try {
      const d = new Date(opp.eventDate);
      const now = new Date();
      const diff = d.getTime() - now.getTime();
      if (diff > 0 && diff < 7 * 24 * 60 * 60 * 1000) return `${loc || "Online"} · This week`;
      return `${loc || "Online"} · ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(d)}`;
    } catch { /* fall through */ }
  }
  if (opp.applicationDeadline || opp.deadline) {
    try {
      const dl = new Date(opp.applicationDeadline || opp.deadline!);
      const now = new Date();
      const diff = dl.getTime() - now.getTime();
      if (diff > 0 && diff < 7 * 24 * 60 * 60 * 1000) return `${loc || ""} · Closing soon`;
      if (diff > 0) return `${loc || ""} · ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(dl)}`;
    } catch { /* fall through */ }
  }
  return loc || "Various locations";
}

/**
 * Select up to 5 diverse opportunities for the hero cards.
 * Strategy: pick one from each preferred category if available,
 * then fill remaining slots with any high-scored opportunities.
 */
function selectHeroCards(opps: OpportunityDocument[]): OpportunityDocument[] {
  if (opps.length === 0) return [];
  const preferred = ["Hackathon", "Fellowship", "Internship", "Event", "Scholarship"];
  const used = new Set<string>();
  const selected: OpportunityDocument[] = [];

  // Pass 1: one per preferred category
  for (const cat of preferred) {
    if (selected.length >= 5) break;
    const match = opps.find(o => o.category === cat && !used.has(o._id));
    if (match) { selected.push(match); used.add(match._id); }
  }

  // Pass 2: fill remaining slots from any remaining opps
  for (const opp of opps) {
    if (selected.length >= 5) break;
    if (!used.has(opp._id)) { selected.push(opp); used.add(opp._id); }
  }

  return selected;
}

const CATEGORIES = [
  "Internships",
  "Hackathons",
  "Jobs",
  "Fellowships",
  "Scholarships",
  "Events",
  "Open Source",
  "Grants",
];



export default function LandingPage({ liveOpps, activeCount }: { liveOpps: OpportunityDocument[]; activeCount: number }) {
  const heroOppCount = activeCount;

  return (
    <div className="lp">
      {/* ════════════════════════════════════════════════════════════════
          HERO
          ════════════════════════════════════════════════════════════════ */}
      <section className="lp-hero">
        <div className="lp-hero-grid">
          {/* Left: copy */}
          <div className="lp-hero-copy">
            <p className="eyebrow" style={{ marginBottom: "1rem", letterSpacing: "0.08em" }}>
              Real opportunity discovery
            </p>
            <h1 className="lp-headline">
              Good opportunities
              <br />
              shouldn&apos;t be this
              <br />
              <span style={{ color: "var(--accent-deep)" }}>hard to find.</span>
            </h1>
            <p className="lp-subhead">
              OPPY brings internships, jobs, hackathons, fellowships, events and
              more into one place — so you spend less time searching and more time
              doing.
            </p>
            <div className="lp-hero-ctas">
              <a href="#discover" className="lp-btn-primary">
                Find my opportunities →
              </a>
              <a href="/?sort=newest" className="lp-btn-secondary">
                Browse everything
              </a>
            </div>
            {heroOppCount > 0 && (
              <p className="lp-hero-stat">
                <span className="lp-stat-dot" />
                <span className="font-mono">{heroOppCount} active opportunities</span>
              </p>
            )}
          </div>

          {/* Right: floating opportunity cards — real active opportunities */}
          <div className="lp-hero-visual">
            {selectHeroCards(liveOpps).map((opp, i) => {
              const colors = HERO_CAT_COLORS[opp.category] || DEFAULT_HERO_COLOR;
              return (
                <div
                  key={opp._id}
                  className="lp-hero-card"
                  style={{ transform: `rotate(${HERO_ROTATIONS[i] || "0deg"})` }}
                >
                  <span className="lp-hero-card-cat" style={{ background: colors.bg, color: colors.fg }}>
                    {opp.category}
                  </span>
                  <p className="lp-hero-card-title">{opp.title}</p>
                  <p className="lp-hero-card-meta">{heroMeta(opp)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          QUICK SEARCH
          ════════════════════════════════════════════════════════════════ */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <p className="eyebrow" style={{ textAlign: 'center', marginBottom: '0.75rem' }}>Quick search — press Enter to find</p>
          <SearchBar />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          DISCOVERY STRIP
          ════════════════════════════════════════════════════════════════ */}
      <section className="lp-strip" aria-label="Categories">
        <div className="lp-strip-inner">
          {[...CATEGORIES, ...CATEGORIES].map((cat, i) => (
            <a
              key={i}
              href={`/?category=${encodeURIComponent(cat)}&sort=recommended`}
              className="lp-strip-item"
              style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}
            >
              {cat}
              <span className="lp-strip-dot">·</span>
            </a>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          DISCOVERY WIZARD
          ════════════════════════════════════════════════════════════════ */}
      <section id="discover" className="lp-section" style={{ background: 'var(--paper-2)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <ThemedOppyOrb mood="curious" size={40} />
          </div>
          <p className="eyebrow" style={{ marginBottom: '0.75rem' }}>Discover</p>
          <h2 className="lp-section-headline" style={{ fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)' }}>
            Ask Oppy what you're looking for
            <br />
            <span style={{ color: 'var(--accent-deep)' }}>in your language.</span>
          </h2>
        </div>
        <DiscoveryWizard />
      </section>

      {/* ════════════════════════════════════════════════════════════════
          THE PROBLEM
          ════════════════════════════════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-problem">
          <div className="lp-problem-left">
            <p className="eyebrow" style={{ marginBottom: "1.25rem" }}>The problem</p>
            <AnimatedHeadline />
          </div>
          <div className="lp-problem-right">
            <div className="lp-tabs-visual">
              {["Job boards", "Event pages", "Community posts", "Program sites", "Dev communities"].map(
                (label, i) => (
                  <div
                    key={i}
                    className="lp-tab"
                    style={{
                      transform: `rotate(${(i - 2) * 2.5}deg)`,
                      zIndex: 5 - i,
                    }}
                  >
                    <span className="lp-tab-label">{label}</span>
                  </div>
                )
              )}
              <div className="lp-tab-merge">
                <span className="lp-tab-merge-label">OPPY</span>
              </div>
            </div>
            <p className="lp-problem-copy">
              The opportunity already exists. The hard part is finding it
              before the deadline passes.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          LIVE OPPORTUNITIES
          ════════════════════════════════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-live-header">
          <div>
            <h2 className="lp-section-headline">Fresh finds.</h2>
            <p className="lp-section-sub">
              Recently discovered opportunities worth a look.
            </p>
          </div>
          <a href="/?sort=newest" className="lp-text-link">
            Explore all opportunities →
          </a>
        </div>
        {liveOpps.length > 0 ? (
          <div className="lp-live-grid">
            {liveOpps.map((opp) => (
              <OpportunityCard key={opp._id} opportunity={opp} />
            ))}
          </div>
        ) : (
          <div className="lp-live-empty">
            <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>
              Opportunities appear here once discovered. Check back soon.
            </p>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════
          HOW IT WORKS
          ════════════════════════════════════════════════════════════════ */}
      <section className="lp-section">
        <p className="eyebrow" style={{ marginBottom: "1rem" }}>How it works</p>
        <h2 className="lp-section-headline" style={{ marginBottom: "3rem" }}>
          From the web
          <br />
          to your feed.
        </h2>
        <div className="lp-steps">
          {[
            {
              num: "01",
              label: "Discover",
              text: "OPPY watches useful sources across the web — job boards, hackathon platforms, program sites, community feeds.",
            },
            {
              num: "02",
              label: "Understand",
              text: "Each opportunity is cleaned, classified, scored and organized with verified dates and metadata.",
            },
            {
              num: "03",
              label: "Match",
              text: "Your interests, skills and preferences help surface what matters to you — not everything to everyone.",
            },
            {
              num: "04",
              label: "Act",
              text: "Save it, apply, register, or bookmark it for later. You decide when you're ready.",
            },
          ].map((step, i) => (
            <div key={i} className="lp-step">
              <span className="lp-step-num">{step.num}</span>
              <div className="lp-step-content">
                <h3 className="lp-step-label">{step.label}</h3>
                <p className="lp-step-text">{step.text}</p>
              </div>
              {i < 3 && <span className="lp-step-arrow" aria-hidden="true">↓</span>}
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          PERSONALIZATION
          ════════════════════════════════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-personalize">
          <div className="lp-personalize-left">
            <p className="eyebrow" style={{ marginBottom: "1rem" }}>For you</p>
            <h2 className="lp-section-headline">
              Not every opportunity
              <br />
              is <span style={{ color: "var(--accent-deep)" }}>your</span> opportunity.
            </h2>
            <p className="lp-section-sub" style={{ maxWidth: "28rem" }}>
              Tell OPPY what you care about — skills, interests, experience,
              location — and it surfaces opportunities that make sense for you.
            </p>
            <a href="/signup" className="lp-btn-primary" style={{ marginTop: "1.5rem" }}>
              Create your feed →
            </a>
          </div>
          <div className="lp-personalize-right">
            {/* Profile card */}
            <div className="lp-profile-card">
              <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>Your profile</p>
              <div className="lp-profile-tags">
                {["Python", "AI", "Startups", "Beginner", "Remote"].map((tag) => (
                  <span key={tag} className="lp-profile-tag">{tag}</span>
                ))}
              </div>
            </div>
            {/* Arrow */}
            <div className="lp-personalize-arrow" aria-hidden="true">
              <svg width="24" height="40" viewBox="0 0 24 40" fill="none">
                <path d="M12 0V36M12 36L4 28M12 36L20 28" stroke="var(--accent-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {/* Feed preview */}
            <div className="lp-feed-preview">
              <p className="eyebrow" style={{ marginBottom: "0.75rem" }}>Your feed</p>
              <div className="lp-feed-items">
                {[
                  { cat: "Internship", title: "Python Developer Intern", tag: "Remote" },
                  { cat: "Hackathon", title: "AI Builders Challenge", tag: "Bengaluru" },
                  { cat: "Fellowship", title: "Open Source Mentorship", tag: "Global" },
                ].map((item, i) => (
                  <div key={i} className="lp-feed-item">
                    <span className="lp-feed-cat">{item.cat}</span>
                    <span className="lp-feed-title">{item.title}</span>
                    <span className="lp-feed-tag">{item.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          DEADLINE / FRESHNESS
          ════════════════════════════════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-freshness">
          <div className="lp-freshness-left">
            <p className="eyebrow" style={{ marginBottom: "1rem" }}>Freshness matters</p>
            <h2 className="lp-section-headline">
              Because finding an opportunity
              <br />
              after it closes isn&apos;t very useful.
            </h2>
          </div>
          <div className="lp-freshness-right">
            {[
              { time: "Today", event: "New opportunity discovered", accent: "var(--sage-deep)" },
              { time: "3 days", event: "Application closing soon", accent: "var(--peach-deep)" },
              { time: "This weekend", event: "Event happening", accent: "var(--lavender-deep)" },
            ].map((item, i) => (
              <div key={i} className="lp-freshness-item">
                <span className="lp-freshness-time" style={{ color: item.accent }}>
                  {item.time}
                </span>
                <span className="lp-freshness-event">{item.event}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          FINAL CTA
          ════════════════════════════════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-final-cta">
          <h2 className="lp-final-headline">
            There&apos;s probably something
            <br />
            worth finding.
          </h2>
          <p className="lp-final-sub">Start exploring.</p>
          <div className="lp-final-buttons">
            <a href="/?sort=newest" className="lp-btn-primary">
              Explore opportunities →
            </a>
            <a href="/signup" className="lp-btn-secondary">
              Create your account
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
