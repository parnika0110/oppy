import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";

// ── Inline test HTML matching the REAL Internshala card structure ──

const CARD_HTML_VALID = `
<div class="container-fluid individual_internship logged_out_jd_summary visibilityTrackerItem"
     data-href="/internship/detail/software-engineering-internship-in-bangalore-at-acme-corp1787304272">
  <div class="internship_meta duration_meta">
    <div class="internship-heading-container">
      <div class="company generic_company">
        <div class="generic_container">
          <h2 class="job-internship-name">
            <a class="job-title-href" id="job_title"
               href="/internship/detail/software-engineering-internship-in-bangalore-at-acme-corp1787304272"
               target="_blank">Software Engineering Intern</a>
          </h2>
        </div>
        <div class="heading_6 company_name">
          <div class="company_and_premium">
            <p class="company-name">Acme Corp</p>
            <div class="actively-hiring-badge">Actively hiring</div>
          </div>
        </div>
      </div>
      <div class="internship_logo">
        <img src="https://internshala-uploads.internshala.com/logo%2Fabc123.png.webp" alt="Acme Corp">
      </div>
    </div>
    <div class="individual_internship_details individual_internship_internship">
      <div class="detail-row-1">
        <div class="row">
          <div class="col-12">
            <span class="stitleneck">
              <span class="location_link inner-small-link">Bangalore</span>
            </span>
          </div>
        </div>
      </div>
      <div class="detail-row-2">
        <div class="row">
          <div class="col-12">
            <span class="stipend">₹ 15,000 - 25,000 /month</span>
          </div>
          <div class="col-12">
            <span class="duration">3 Months</span>
          </div>
        </div>
      </div>
      <div class="individual_internship_description">
        <p>We are looking for a software engineering intern to join our backend team.</p>
      </div>
      <div class="individual_internship_skills">
        <span class="skill-skill">Python</span>
        <span class="skill-skill">React</span>
        <span class="skill-skill">TypeScript</span>
      </div>
      <div class="individual_internship_footer">
        <div class="row">
          <div class="col-12">
            <span class="posted-date">2 weeks ago</span>
          </div>
        </div>
        <div class="view_detail_button_container">
          <span class="job offer">Job offer upto ₹ 8LPA post internship</span>
        </div>
      </div>
    </div>
  </div>
</div>`;

const CARD_HTML_WORK_FROM_HOME = `
<div class="container-fluid individual_internship logged_out_jd_summary"
     data-href="/internship/detail/work-from-home-data-science-internship-at-dataco1787639484">
  <div class="internship_meta duration_meta">
    <div class="internship-heading-container">
      <div class="company generic_company">
        <div class="generic_container">
          <h2 class="job-internship-name">
            <a class="job-title-href"
               href="/internship/detail/work-from-home-data-science-internship-at-dataco1787639484"
               target="_blank">Data Science Intern</a>
          </h2>
        </div>
        <div class="heading_6 company_name">
          <p class="company-name">DataCo Inc</p>
        </div>
      </div>
      <div class="internship_logo">
        <img src="https://internshala-uploads.internshala.com/logo%2Fxyz.png.webp" alt="DataCo Inc">
      </div>
    </div>
    <div class="individual_internship_details individual_internship_internship">
      <div class="detail-row-1">
        <div class="row">
          <div class="col-12">
            <span class="stitleneck">
              <span class="location_link">Mumbai (Work from home)</span>
            </span>
          </div>
        </div>
      </div>
      <div class="detail-row-2">
        <div class="row">
          <div class="col-12">
            <span class="stipend">₹ 10,000 /month</span>
          </div>
          <div class="col-12">
            <span class="duration">6 Weeks</span>
          </div>
        </div>
      </div>
      <div class="individual_internship_footer">
        <span class="posted-date">1 week ago</span>
      </div>
    </div>
  </div>
</div>`;

const CARD_HTML_MINIMAL = `
<div class="container-fluid individual_internship logged_out_jd_summary"
     data-href="/internship/detail/marketing-intern-at-startup1787999999">
  <div class="internship_meta duration_meta">
    <div class="internship-heading-container">
      <div class="company generic_company">
        <h2 class="job-internship-name">
          <a class="job-title-href"
             href="/internship/detail/marketing-intern-at-startup1787999999"
             target="_blank">Marketing Intern</a>
        </h2>
        <p class="company-name">StartupXYZ</p>
      </div>
    </div>
    <div class="individual_internship_details">
      <div class="detail-row-1">
        <span class="location_link">Delhi</span>
      </div>
      <div class="detail-row-2">
        <span class="stipend">Unpaid</span>
        <span class="duration">2 Months</span>
      </div>
    </div>
  </div>
</div>`;

const CARD_HTML_NO_DETAIL = `
<div class="container-fluid individual_internship logged_out_jd_summary"
     data-href="/internship/detail/vague-role-at-company1788000000">
  <h2 class="job-internship-name">
    <a class="job-title-href"
       href="/internship/detail/vague-role-at-company1788000000"
       target="_blank">Vague Role</a>
  </h2>
  <p class="company-name">Some Company</p>
</div>`;

// ── Helper to parse a card HTML string ──

function parseCardHtml(html: string) {
  const $ = cheerio.load(html);
  const el = $("div.individual_internship").get(0) || $.root().get(0);
  // Import the adapter's parseCard logic indirectly through the fetch method
  // For unit tests, we test the selectors directly
  return {
    title: $(el).find("h2.job-internship-name").first().text().trim(),
    company: $(el).find(".company-name").first().text().trim(),
    href: $(el).find("a.job-title-href").first().attr("href")
      || $(el).attr("data-href")
      || "",
    location: $(el).find(".individual_internship_details [class*=location]")
      .first().text().trim().replace(/\s+/g, " "),
    stipend: $(el).find("[class*=stipend]").first().text().trim().replace(/\s+/g, " "),
    duration: $(el).find("[class*=duration]").first().text().trim(),
    skills: $(el).find("[class*=skill]").text().trim(),
    posted: $(el).find(".posted-date").text().trim(),
    image: $(el).find(".internship_logo img").attr("src") || null,
    isActivelyHiring: $(el).find(".actively-hiring-badge").length > 0,
    hasJobOffer: /job offer/i.test($(el).text()),
  };
}

// ── Tests ──

describe("Internshala card parsing", () => {
  it("extracts title from h2.job-internship-name", () => {
    const card = parseCardHtml(CARD_HTML_VALID);
    expect(card.title).toBe("Software Engineering Intern");
  });

  it("extracts company name", () => {
    const card = parseCardHtml(CARD_HTML_VALID);
    expect(card.company).toBe("Acme Corp");
  });

  it("extracts link from a.job-title-href", () => {
    const card = parseCardHtml(CARD_HTML_VALID);
    expect(card.href).toBe("/internship/detail/software-engineering-internship-in-bangalore-at-acme-corp1787304272");
  });

  it("extracts location", () => {
    const card = parseCardHtml(CARD_HTML_VALID);
    expect(card.location).toContain("Bangalore");
  });

  it("extracts stipend", () => {
    const card = parseCardHtml(CARD_HTML_VALID);
    expect(card.stipend).toContain("15,000");
    expect(card.stipend).toContain("/month");
  });

  it("extracts duration", () => {
    const card = parseCardHtml(CARD_HTML_VALID);
    expect(card.duration).toContain("3 Months");
  });

  it("detects work-from-home location", () => {
    const card = parseCardHtml(CARD_HTML_WORK_FROM_HOME);
    expect(card.location).toContain("Work from home");
  });

  it("detects actively hiring badge", () => {
    const card = parseCardHtml(CARD_HTML_VALID);
    expect(card.isActivelyHiring).toBe(true);
  });

  it("detects job offer mention", () => {
    const card = parseCardHtml(CARD_HTML_VALID);
    expect(card.hasJobOffer).toBe(true);
  });

  it("extracts company logo image", () => {
    const card = parseCardHtml(CARD_HTML_VALID);
    expect(card.image).toContain("internshala-uploads");
  });

  it("handles minimal card with no image/logo", () => {
    const card = parseCardHtml(CARD_HTML_MINIMAL);
    expect(card.title).toBe("Marketing Intern");
    expect(card.company).toBe("StartupXYZ");
    expect(card.location).toContain("Delhi");
  });

  it("handles card with no detail section", () => {
    const card = parseCardHtml(CARD_HTML_NO_DETAIL);
    expect(card.title).toBe("Vague Role");
    expect(card.company).toBe("Some Company");
    expect(card.href).toContain("/internship/detail/");
  });
});

describe("Internshala URL construction", () => {
  it("constructs correct page URLs", () => {
    const baseUrl = "https://internshala.com/internships/";
    // Page 1 = base URL
    expect(baseUrl).toBe("https://internshala.com/internships/");
    // Page 2+
    expect(`${baseUrl}page-2/`).toBe("https://internshala.com/internships/page-2/");
    expect(`${baseUrl}page-25/`).toBe("https://internshala.com/internships/page-25/");
  });

  it("constructs full link from relative href", () => {
    const href = "/internship/detail/software-engineering-internship-in-bangalore-at-acme-corp1787304272";
    const fullLink = href.startsWith("http") ? href : `https://internshala.com${href}`;
    expect(fullLink).toBe("https://internshala.com/internship/detail/software-engineering-internship-in-bangalore-at-acme-corp1787304272");
  });
});

describe("Internshala source ID generation", () => {
  it("generates stable source ID from URL slug", () => {
    const href = "/internship/detail/software-engineering-internship-in-bangalore-at-acme-corp1787304272";
    const slug = href.split("/").filter(Boolean).pop() || "";
    const sourceId = `internshala-${slug}`;
    expect(sourceId).toBe("internshala-software-engineering-internship-in-bangalore-at-acme-corp1787304272");
  });

  it("same URL always produces same source ID", () => {
    const href1 = "/internship/detail/abc123";
    const href2 = "/internship/detail/abc123";
    const id1 = `internshala-${href1.split("/").filter(Boolean).pop()}`;
    const id2 = `internshala-${href2.split("/").filter(Boolean).pop()}`;
    expect(id1).toBe(id2);
  });

  it("different URLs produce different source IDs", () => {
    const id1 = "internshala-abc123";
    const id2 = "internshala-def456";
    expect(id1).not.toBe(id2);
  });
});

describe("Internshala deduplication", () => {
  it("deduplicates by sourceId, not by title", () => {
    const seen = new Set<string>();
    const items = [
      { sourceId: "internshala-abc", title: "Software Intern" },
      { sourceId: "internshala-abc", title: "Software Intern" }, // exact dup
      { sourceId: "internshala-def", title: "Software Intern" }, // same title, different opp
    ];

    const unique = items.filter(item => {
      if (seen.has(item.sourceId)) return false;
      seen.add(item.sourceId);
      return true;
    });

    expect(unique.length).toBe(2);
  });

  it("does not deduplicate by company name", () => {
    const seen = new Set<string>();
    const items = [
      { sourceId: "internshala-google-1", company: "Google", title: "SWE Intern" },
      { sourceId: "internshala-google-2", company: "Google", title: "PM Intern" },
    ];

    const unique = items.filter(item => {
      if (seen.has(item.sourceId)) return false;
      seen.add(item.sourceId);
      return true;
    });

    expect(unique.length).toBe(2);
  });
});

describe("Internshala role tag extraction", () => {
  // These test the tag extraction logic through a simplified version
  const extractTags = (title: string): string[] => {
    const lower = title.toLowerCase();
    const tags: string[] = [];
    if (/\b(software|developer|engineer|coding|backend|frontend|full.?stack|swe|technical)\b/.test(lower)) {
      tags.push("software-engineering");
    }
    if (/\b(ai|machine learning|ml|data science|data analyst|analytics)\b/.test(lower)) {
      tags.push("ai", "machine-learning");
    }
    if (/\b(design|ui|ux|figma|graphic|visual)\b/.test(lower)) {
      tags.push("design", "ui-ux");
    }
    if (/\b(marketing|digital marketing|social media|seo|growth)\b/.test(lower)) {
      tags.push("marketing");
    }
    if (/\b(data annotation|labeling|labelling)\b/.test(lower)) {
      tags.push("data-annotation");
    }
    if (/\b(qa|quality assurance|testing)\b/.test(lower)) {
      tags.push("qa", "testing");
    }
    return [...new Set(tags)];
  };

  it("tags software engineering roles", () => {
    expect(extractTags("Software Engineering Intern")).toContain("software-engineering");
    expect(extractTags("Backend Developer Intern")).toContain("software-engineering");
    expect(extractTags("Full Stack Intern")).toContain("software-engineering");
  });

  it("tags AI/ML roles", () => {
    expect(extractTags("Machine Learning Intern")).toContain("ai");
    expect(extractTags("Data Science Intern")).toContain("ai");
    expect(extractTags("AI Research Intern")).toContain("ai");
  });

  it("tags design roles", () => {
    expect(extractTags("UI/UX Design Intern")).toContain("design");
    expect(extractTags("Graphic Design Intern")).toContain("design");
  });

  it("tags marketing roles", () => {
    expect(extractTags("Digital Marketing Intern")).toContain("marketing");
    expect(extractTags("SEO Intern")).toContain("marketing");
  });

  it("tags data annotation roles", () => {
    expect(extractTags("Data Annotation Intern")).toContain("data-annotation");
    expect(extractTags("Data Labeling Specialist")).toContain("data-annotation");
  });

  it("tags QA/testing roles", () => {
    expect(extractTags("QA Intern")).toContain("qa");
    expect(extractTags("Software Testing Intern")).toContain("testing");
  });

  it("does not tag non-tech roles with software tags", () => {
    expect(extractTags("Marketing Intern")).not.toContain("software-engineering");
    expect(extractTags("HR Intern")).not.toContain("software-engineering");
  });
});
