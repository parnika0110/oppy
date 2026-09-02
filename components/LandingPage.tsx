import OpportunityCard from "@/components/OpportunityCard";
import DiscoveryWizard from "@/components/DiscoveryWizard";

import ThemedOppyOrb from "@/components/ThemedOppyOrb";
import SearchBar from "@/components/SearchBar";
import { OpportunityDocument } from "@/types/opportunity";

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

          {/* Right: floating opportunity cards */}
          <div className="lp-hero-visual">
            <div className="lp-hero-cards">
              {/* Card 1 — Hackathon */}
              <div className="lp-hero-card" style={{ transform: "rotate(-3deg) translateY(0)", zIndex: 3 }}>
                <span className="lp-hero-card-cat" style={{ background: "var(--lavender)", color: "#4A3F8A" }}>Hackathon</span>
                <p className="lp-hero-card-title">AI Builders Challenge</p>
                <p className="lp-hero-card-meta">Bengaluru · Jan 2027</p>
              </div>
              {/* Card 2 — Fellowship */}
              <div className="lp-hero-card" style={{ transform: "rotate(2deg) translate(20px, -12px)", zIndex: 2 }}>
                <span className="lp-hero-card-cat" style={{ background: "var(--sage)", color: "#2E5A28" }}>Fellowship</span>
                <p className="lp-hero-card-title">Open Source Mentorship</p>
                <p className="lp-hero-card-meta">Remote · Global</p>
              </div>
              {/* Card 3 — Internship */}
              <div className="lp-hero-card" style={{ transform: "rotate(-1deg) translate(8px, 16px)", zIndex: 4 }}>
                <span className="lp-hero-card-cat" style={{ background: "var(--peach)", color: "#7A4A1A" }}>Internship</span>
                <p className="lp-hero-card-title">Python Developer Intern</p>
                <p className="lp-hero-card-meta">Remote · Beginner</p>
              </div>
              {/* Card 4 — Event */}
              <div className="lp-hero-card" style={{ transform: "rotate(3deg) translate(-10px, 28px)", zIndex: 1 }}>
                <span className="lp-hero-card-cat" style={{ background: "#F0E8FF", color: "#5B3D8A" }}>Event</span>
                <p className="lp-hero-card-title">React Summit 2027</p>
                <p className="lp-hero-card-meta">Amsterdam · Mar 2027</p>
              </div>
              {/* Card 5 — Scholarship */}
              <div className="lp-hero-card" style={{ transform: "rotate(-2deg) translate(30px, 6px)", zIndex: 5 }}>
                <span className="lp-hero-card-cat" style={{ background: "var(--blue)", color: "#1F4A62" }}>Scholarship</span>
                <p className="lp-hero-card-title">Google Generation Scholarship</p>
                <p className="lp-hero-card-meta">Global · Deadline Soon</p>
              </div>
            </div>
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
            <h2 className="lp-section-headline">
              You shouldn&apos;t need
              <br />
              17 tabs to find one
              <br />
              <span style={{ color: "var(--accent-deep)" }}>good opportunity.</span>
            </h2>
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
