import { prisma } from "@/lib/db";
import { startResumeGeneration, type ExperienceForPrompt, type PersonalInfoForPrompt } from "./resumeGen";
import { runConvergenceLoop, MIN_FILL_RATIO } from "./autoConverge";
import { measureRealPageHeight } from "./typstServerCompile";
import { narrowRange, type CharRange } from "./charRange";

export type { CharRange } from "./charRange";

export type TemplateCalibration = {
  charRangeLow: number | null;
  charRangeHigh: number | null;
  realPageHeightPt: number;
  calibratedAt: string;
};

const FAKE_PERSONAL_INFO: PersonalInfoForPrompt = {
  name: "Analysis Placeholder",
  phone: "000-000-0000",
  email: "placeholder@example.com",
  location: "Remote",
  github: "",
  linkedin: "",
  educations: [
    {
      school: "Analysis University",
      degree: "Bachelor of Science",
      major: "Computer Science",
      startDate: "2018",
      endDate: "2022",
      region: "",
      relevantCourses: "Algorithms, Systems, Databases",
      gpa: "",
    },
  ],
  skills: [
    { name: "Python", category: "Languages" },
    { name: "Go", category: "Languages" },
    { name: "Docker", category: "Cloud & Infrastructure" },
    { name: "Kubernetes", category: "Cloud & Infrastructure" },
    { name: "PostgreSQL", category: "Databases & Messaging" },
  ],
};

function fakeHighlight(id: string, title: string, bullet: string, tags: string[]) {
  return { id, title, situation: "", task: "", action: "", result: "", quantify: "", resumeBullet: bullet, tags };
}

// Deliberately generic/placeholder content, not real experience — only used
// to give the model real structural material to select from and expand/trim
// while probing a template's char-count capacity. Rich enough (4 entries,
// ~11 highlights) that the model can plausibly produce anywhere from a very
// short resume to one that overflows two pages, without needing to invent
// anything beyond what's here.
const FAKE_EXPERIENCES: ExperienceForPrompt[] = [
  {
    id: "fake-1",
    title: "Software Engineer",
    org: "Example Corp",
    type: "intern",
    startDate: "2023-06",
    endDate: "2023-08",
    location: "",
    highlights: [
      fakeHighlight(
        "f1a",
        "Backend service",
        "Built and shipped a backend service handling authenticated API requests against a relational database, improving reliability and reducing response latency for downstream clients.",
        ["backend"]
      ),
      fakeHighlight(
        "f1b",
        "Monitoring",
        "Instrumented request logging and built dashboards tracking error rates, enabling faster incident triage across the team.",
        ["observability"]
      ),
      fakeHighlight(
        "f1c",
        "Testing",
        "Wrote integration tests covering critical API paths, catching regressions before deployment and reducing production incidents.",
        ["quality"]
      ),
    ],
  },
  {
    id: "fake-2",
    title: "Software Engineering Intern",
    org: "Sample Inc.",
    type: "intern",
    startDate: "2022-06",
    endDate: "2022-08",
    location: "",
    highlights: [
      fakeHighlight(
        "f2a",
        "Frontend feature",
        "Implemented a user-facing dashboard feature with a modern frontend framework, coordinating with design to deliver a responsive, accessible interface.",
        ["frontend"]
      ),
      fakeHighlight(
        "f2b",
        "Performance",
        "Profiled and optimized a slow page-load path, cutting load time meaningfully and improving user-reported satisfaction.",
        ["performance"]
      ),
      fakeHighlight(
        "f2c",
        "Accessibility",
        "Audited key user flows against accessibility guidelines and fixed the gaps found, bringing the product closer to compliance.",
        ["accessibility"]
      ),
    ],
  },
  {
    id: "fake-3",
    title: "Distributed Queue Service",
    org: "Independent",
    type: "project",
    startDate: "2021-09",
    endDate: "2022-01",
    location: "",
    highlights: [
      fakeHighlight(
        "f3a",
        "System design",
        "Designed and built a small distributed system from scratch, handling concurrent requests through a queue-based architecture.",
        ["distributed systems"]
      ),
      fakeHighlight(
        "f3b",
        "Deployment",
        "Deployed the system to a cloud provider with a basic CI/CD pipeline, automating what had been a manual release process.",
        ["devops"]
      ),
      fakeHighlight(
        "f3c",
        "Documentation",
        "Wrote developer documentation and a contribution guide, lowering the barrier for others to extend the project.",
        ["documentation"]
      ),
    ],
  },
  {
    id: "fake-4",
    title: "Data Pipeline Tooling",
    org: "Independent",
    type: "project",
    startDate: "2020-06",
    endDate: "2020-12",
    location: "",
    highlights: [
      fakeHighlight(
        "f4a",
        "Pipeline",
        "Built a data pipeline tool that automated a previously manual weekly export process, saving hours of repetitive work each cycle.",
        ["data engineering"]
      ),
      fakeHighlight(
        "f4b",
        "Reliability",
        "Added retry and alerting logic to the pipeline after a silent failure went unnoticed for days, preventing repeat incidents.",
        ["reliability"]
      ),
    ],
  },
];

const FAKE_JD = `Generic Software Engineer role. We're looking for someone with solid full-stack fundamentals, experience shipping real features end-to-end, and good engineering judgment across backend, frontend, and infrastructure work. Any relevant background is a plus.`;

/**
 * Cold-start / refresh calibration: generates one resume with fake
 * placeholder data through the real generation pipeline, runs it through
 * the same fill/shorten convergence loop used in production, and narrows
 * the char-count range using every round's real sample (not just the last
 * one) — reusing `existingRange` as the starting point so repeated calls
 * refine rather than reset.
 */
export async function analyzeTemplate(
  templateSource: string,
  existingRange: CharRange = { low: null, high: null }
): Promise<TemplateCalibration | null> {
  const realPageHeightPt = await measureRealPageHeight(templateSource);
  if (realPageHeightPt === null) return null;

  const seedCalibration: TemplateCalibration | null =
    existingRange.low !== null || existingRange.high !== null
      ? { charRangeLow: existingRange.low, charRangeHigh: existingRange.high, realPageHeightPt, calibratedAt: "" }
      : null;

  const first = await startResumeGeneration({
    jdText: FAKE_JD,
    jdIsUrl: false,
    personalInfo: FAKE_PERSONAL_INFO,
    experiences: FAKE_EXPERIENCES,
    templateSource,
    calibration: seedCalibration,
  });

  if (first.isError || !first.typstSource) return null;

  const { fits } = await runConvergenceLoop(first, realPageHeightPt);

  let range = existingRange;
  for (const fit of fits) {
    range = narrowRange(range, fit, MIN_FILL_RATIO);
  }

  return {
    charRangeLow: range.low,
    charRangeHigh: range.high,
    realPageHeightPt,
    calibratedAt: new Date().toISOString(),
  };
}

export async function analyzeAndStoreTemplate(templateId: string, templateSource: string): Promise<TemplateCalibration | null> {
  const existing = await prisma.resumeTemplate.findUnique({ where: { id: templateId }, select: { calibration: true } });
  const existingCalibration: TemplateCalibration | null = existing?.calibration ? JSON.parse(existing.calibration) : null;
  const existingRange: CharRange = existingCalibration
    ? { low: existingCalibration.charRangeLow, high: existingCalibration.charRangeHigh }
    : { low: null, high: null };

  const calibration = await analyzeTemplate(templateSource, existingRange);
  if (!calibration) return null;

  await prisma.resumeTemplate.update({
    where: { id: templateId },
    data: { calibration: JSON.stringify(calibration) },
  });
  return calibration;
}
