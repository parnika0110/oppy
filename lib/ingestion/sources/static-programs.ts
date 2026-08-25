import { RawOpportunity, OpportunitySource, Category, SourcePlatform } from "@/types/opportunity";

/**
 * Real Opportunities Source
 *
 * A curated list of well-known student programs, fellowships,
 * hackathons and internships. These are programs with annual or rolling
 * application cycles that are always relevant to students.
 *
 * The source never invents a deadline. A program remains visible with an
 * unavailable deadline until a curator verifies the current cycle.
 */

interface ProgramEntry {
  sourceId?: string;
  title: string;
  organization: string;
  category: Category;
  location: string;
  description: string;
  applicationLink: string;
  sourcePlatform: SourcePlatform;
  tags: string[];
  /** Legacy catalog metadata. Not used as a deadline. */
  deadlineDaysOut: number;
}

const REAL_PROGRAMS: ProgramEntry[] = [
  // ── Fellowships & Scholarships ───────────────────────────────────────────
  {
    title: "Google Summer of Code",
    sourceId: "static-google-summer-of-code",
    organization: "Google",
    category: "Fellowship",
    location: "Remote",
    description: "Google Summer of Code (GSoC) is a global, online mentoring program that introduces new contributors to open-source development. Contributors spend 12–22 weeks working on a coding project with a mentor from one of 170+ open-source organizations. Stipends range from $1,500 to $6,600 depending on country.",
    applicationLink: "https://summerofcode.withgoogle.com/",
    sourcePlatform: "Google",
    tags: ["open-source", "fellowship", "stipend", "remote", "coding"],
    deadlineDaysOut: 90,
  },
  {
    title: "Outreachy Internships",
    organization: "Software Freedom Conservancy",
    category: "Internship",
    location: "Remote",
    description: "Outreachy provides internships in open-source and open science for people subject to systemic bias and underrepresentation in tech. Interns work remotely with a mentor for 3 months and receive a $7,000 stipend plus $500 for expenses.",
    applicationLink: "https://www.outreachy.org/",
    sourcePlatform: "Other",
    tags: ["open-source", "internship", "stipend", "remote", "diversity"],
    deadlineDaysOut: 60,
  },
  {
    title: "MLH Fellowship",
    organization: "Major League Hacking",
    category: "Fellowship",
    location: "Remote",
    description: "The MLH Fellowship is a remote internship alternative for software engineers. Fellows contribute to open-source projects used by companies like GitHub, DEV, and Twilio. Batches run 12 weeks with a $5,000 stipend. Tracks: Open Source, Externship, and Explorer.",
    applicationLink: "https://fellowship.mlh.io/",
    sourcePlatform: "Other",
    tags: ["fellowship", "open-source", "remote", "stipend", "mlh"],
    deadlineDaysOut: 45,
  },
  {
    title: "Palantir Path Scholarship",
    organization: "Palantir",
    category: "Grant",
    location: "Remote",
    description: "Palantir's Path Scholarship awards $7,000 to students from underrepresented groups in STEM. Scholars also receive mentorship from Palantir engineers and are considered for internship opportunities.",
    applicationLink: "https://www.palantir.com/careers/students/path/",
    sourcePlatform: "Other",
    tags: ["scholarship", "grant", "diversity", "stipend"],
    deadlineDaysOut: 120,
  },
  {
    title: "Hertz Foundation Graduate Fellowship",
    organization: "Hertz Foundation",
    category: "Grant",
    location: "United States",
    description: "The Hertz Fellowship supports PhD students in applied physical, biological, and engineering sciences. Fellows receive up to 5 years of support worth $250,000+, plus freedom to pursue their own research agenda.",
    applicationLink: "https://www.hertzfoundation.org/the-fellowship/",
    sourcePlatform: "Other",
    tags: ["phd", "research", "fellowship", "science", "engineering"],
    deadlineDaysOut: 100,
  },
  {
    title: "Ford Foundation Fellowship Program",
    organization: "Ford Foundation",
    category: "Grant",
    location: "United States",
    description: "The Ford Foundation Fellowship supports scholars committed to diversity, equity, and inclusion in academia. Predoctoral, dissertation, and postdoctoral awards provide annual stipends and cover university fees.",
    applicationLink: "https://www.nationalacademies.org/our-work/ford-foundation-fellowships",
    sourcePlatform: "Other",
    tags: ["fellowship", "phd", "diversity", "research", "academic"],
    deadlineDaysOut: 90,
  },

  // ── Internships ──────────────────────────────────────────────────────────
  {
    title: "Google STEP Internship",
    organization: "Google",
    category: "Internship",
    location: "United States / Global",
    description: "Google's Student Training in Engineering Program (STEP) is a 12-week summer internship for first and second year undergraduate students with a passion for computer science. Interns work on real Google products alongside engineers.",
    applicationLink: "https://careers.google.com/programs/step/",
    sourcePlatform: "Google",
    tags: ["internship", "google", "software-engineering", "undergraduate"],
    deadlineDaysOut: 120,
  },
  {
    title: "Microsoft Explore Internship",
    organization: "Microsoft",
    category: "Internship",
    location: "Redmond, WA / Remote",
    description: "Microsoft Explore is a 12-week summer internship for first and second year underrepresented students. Interns rotate through program management, software engineering, and UX design roles, experiencing the full product development cycle.",
    applicationLink: "https://careers.microsoft.com/students/us/en/usexploremicrosoftprogram",
    sourcePlatform: "Microsoft",
    tags: ["internship", "microsoft", "program-management", "software-engineering"],
    deadlineDaysOut: 120,
  },
  {
    title: "Meta University Internship",
    organization: "Meta",
    category: "Internship",
    location: "Menlo Park, CA / Remote",
    description: "Meta University is a paid summer internship program for first and second year underrepresented college students interested in engineering and product design. The program includes technical training, mentorship, and real project work.",
    applicationLink: "https://www.metacareers.com/careerprograms/pathways/metauniversity",
    sourcePlatform: "Other",
    tags: ["internship", "meta", "diversity", "software-engineering"],
    deadlineDaysOut: 100,
  },
  {
    title: "Amazon Future Engineer Internship",
    organization: "Amazon",
    category: "Internship",
    location: "United States",
    description: "Amazon Future Engineer offers paid summer internships for computer science students, with a focus on students from underrepresented communities. Interns work on AWS, Alexa, Amazon.com and other Amazon services.",
    applicationLink: "https://www.amazonfutureengineer.com/",
    sourcePlatform: "Other",
    tags: ["internship", "amazon", "aws", "software-engineering"],
    deadlineDaysOut: 110,
  },

  // ── Accelerators & Programs ──────────────────────────────────────────────
  {
    title: "Y Combinator Startup School",
    organization: "Y Combinator",
    category: "Fellowship",
    location: "Remote",
    description: "YC Startup School is a free 10-week online program for early-stage founders. You'll get access to lectures from YC partners, weekly group sessions, and a community of 10,000+ founders. Top startups get invited to apply to YC.",
    applicationLink: "https://www.startupschool.org/",
    sourcePlatform: "Other",
    tags: ["startup", "entrepreneur", "accelerator", "free", "remote"],
    deadlineDaysOut: 30,
  },
  {
    title: "AWS Activate for Startups",
    organization: "Amazon Web Services",
    category: "Grant",
    location: "Remote / Global",
    description: "AWS Activate provides startups with free AWS credits (up to $100,000), technical support, and training to build and scale on AWS. No equity taken. Available to early-stage startups and founders.",
    applicationLink: "https://aws.amazon.com/activate/",
    sourcePlatform: "Other",
    tags: ["aws", "startup", "credits", "cloud", "grant"],
    deadlineDaysOut: 365,
  },
  {
    title: "GitHub Campus Experts Program",
    organization: "GitHub",
    category: "Fellowship",
    location: "Remote / Global",
    description: "GitHub Campus Experts are student leaders who build tech communities on campus. Selected students receive training in technical workshops, community leadership, and public speaking, plus GitHub swag, credits, and conference sponsorship.",
    applicationLink: "https://education.github.com/experts",
    sourcePlatform: "GitHub",
    tags: ["github", "community", "leadership", "student", "open-source"],
    deadlineDaysOut: 90,
  },
  {
    title: "Microsoft Learn Student Ambassadors",
    organization: "Microsoft",
    category: "Fellowship",
    location: "Remote / Global",
    description: "Microsoft Learn Student Ambassadors is a global community of campus leaders who are eager to help fellow students and make a difference with technology. Ambassadors get Azure credits, access to Microsoft events, mentorship, and career support.",
    applicationLink: "https://mvp.microsoft.com/studentambassadors",
    sourcePlatform: "Microsoft",
    tags: ["microsoft", "azure", "community", "student", "leadership"],
    deadlineDaysOut: 90,
  },
  {
    title: "Google Developer Student Clubs Lead",
    organization: "Google",
    category: "Fellowship",
    location: "Remote / Global",
    description: "Google Developer Student Clubs (GDSC) are university-based community groups for students interested in Google developer technologies. Club leads receive training, Google resources, mentorship, and the opportunity to host events and connect with Googlers.",
    applicationLink: "https://developers.google.com/community/gdsc",
    sourcePlatform: "Google",
    tags: ["google", "community", "leadership", "student", "developer"],
    deadlineDaysOut: 90,
  },

  // ── Hackathons ───────────────────────────────────────────────────────────
  {
    title: "HackMIT",
    organization: "MIT",
    category: "Hackathon",
    location: "Cambridge, MA",
    description: "HackMIT is MIT's annual 24-hour hackathon, attracting 1,000+ hackers from around the world. Teams of up to 4 build innovative projects from scratch. Travel reimbursement available. Prizes exceed $25,000.",
    applicationLink: "https://hackmit.org/",
    sourcePlatform: "Other",
    tags: ["hackathon", "mit", "in-person", "prizes", "student"],
    deadlineDaysOut: 120,
  },
  {
    title: "TreeHacks",
    organization: "Stanford University",
    category: "Hackathon",
    location: "Stanford, CA",
    description: "TreeHacks is Stanford's annual hackathon focused on tackling hard problems. Over 1,500 hackers come together to build impactful projects in health, environment, education, and more. Travel reimbursements and $50k+ in prizes.",
    applicationLink: "https://www.treehacks.com/",
    sourcePlatform: "Other",
    tags: ["hackathon", "stanford", "in-person", "prizes", "student"],
    deadlineDaysOut: 100,
  },
  {
    title: "PennApps",
    organization: "University of Pennsylvania",
    category: "Hackathon",
    location: "Philadelphia, PA",
    description: "PennApps is the first and one of the largest collegiate hackathons in North America. Held at UPenn, the event draws top hackers from hundreds of universities to build projects over 36 hours.",
    applicationLink: "https://pennapps.com/",
    sourcePlatform: "Other",
    tags: ["hackathon", "upenn", "in-person", "student", "collegiate"],
    deadlineDaysOut: 90,
  },
  {
    title: "HackHarvard",
    organization: "Harvard University",
    category: "Hackathon",
    location: "Cambridge, MA",
    description: "HackHarvard is Harvard's annual hackathon bringing together 1,000+ undergraduate students for 36 hours of innovation. Focus areas include healthcare, sustainability, and social good. Travel reimbursement and prizes available.",
    applicationLink: "https://hackharvard.io/",
    sourcePlatform: "Other",
    tags: ["hackathon", "harvard", "in-person", "prizes", "student"],
    deadlineDaysOut: 100,
  },
  {
    title: "Hack the North",
    organization: "University of Waterloo",
    category: "Hackathon",
    location: "Waterloo, Canada",
    description: "Hack the North is Canada's largest hackathon, hosted at the University of Waterloo. 3,000+ hackers collaborate for 36 hours to build innovative projects. Travel reimbursement, mentorship, and $50k+ in prizes.",
    applicationLink: "https://hackthenorth.com/",
    sourcePlatform: "Other",
    tags: ["hackathon", "waterloo", "canada", "in-person", "prizes"],
    deadlineDaysOut: 110,
  },

  // ── Research Programs ────────────────────────────────────────────────────
  {
    title: "NSF Research Experiences for Undergraduates (REU)",
    organization: "National Science Foundation",
    category: "Fellowship",
    location: "United States",
    description: "NSF's REU program supports undergraduate student research at US institutions. REU Sites involve groups of 8–10 undergraduates working with faculty mentors on cutting-edge research projects. Stipends, housing, and travel support provided.",
    applicationLink: "https://www.nsf.gov/crssprgm/reu/",
    sourcePlatform: "Other",
    tags: ["research", "nsf", "stem", "undergraduate", "stipend"],
    deadlineDaysOut: 120,
  },
  {
    title: "CERN Summer Student Programme",
    organization: "CERN",
    category: "Internship",
    location: "Geneva, Switzerland",
    description: "The CERN Summer Student Programme offers undergraduate and graduate students the chance to work at CERN, the European Organization for Nuclear Research. Students work on physics or engineering projects for 8–13 weeks with accommodation and a daily allowance.",
    applicationLink: "https://home.cern/summer-student-programme",
    sourcePlatform: "Other",
    tags: ["research", "physics", "engineering", "international", "cern"],
    deadlineDaysOut: 90,
  },
];

export class StaticProgramsSource implements OpportunitySource {
  name = "Well-Known Student Programs";
  platform = "Other" as const;

  async fetch(): Promise<RawOpportunity[]> {
    const opportunities: RawOpportunity[] = [];

    for (const program of REAL_PROGRAMS) {
      opportunities.push({
        title: program.title,
        organization: program.organization,
        category: program.category,
        location: program.location,
        description: program.description,
        applicationLink: program.applicationLink,
        deadline: null,
        deadlineKind: "unavailable",
        source: program.organization,
        sourceUrl: program.applicationLink,
        sourcePlatform: program.sourcePlatform,
        sourceId: program.sourceId || `static-${program.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        tags: program.tags,
      });
    }

    console.log(`[StaticPrograms] Prepared ${opportunities.length} well-known programs.`);
    return opportunities;
  }
}
