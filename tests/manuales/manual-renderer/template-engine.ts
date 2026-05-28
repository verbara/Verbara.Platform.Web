// Template engine — Fase 0 prototype.
//
// Single responsibility: take a Markdown template containing {{step:ID}}
// placeholders and a map of stepId → screenshot path, and produce the final
// Markdown string with each placeholder replaced by a Markdown image link.
//
// Why this is its own file: substitution is pure (no IO, no Allure
// knowledge), so it's trivially unit-testable and reusable when Fase 1
// introduces more placeholder kinds (e.g. {{cli:command}} for terminal
// snippets, {{api:request}} for HTTP traces).

const STEP_PLACEHOLDER = /\{\{step:([a-zA-Z0-9_-]+)\}\}/g;

export interface RenderInput {
  /** Raw .md.tpl file contents. */
  template: string;
  /**
   * Map from step ID (the value of `{{step:ID}}`) to a path RELATIVE TO THE
   * OUTPUT .md FILE. The engine does not resolve paths; that's the caller's
   * job because relativity depends on the output directory layout.
   */
  screenshots: Record<string, string>;
  /**
   * Alt text generator. Defaults to "Captura — <stepId>" but callers can
   * pass a localized variant.
   */
  altFor?: (stepId: string) => string;
}

export interface RenderResult {
  markdown: string;
  /** Placeholders that had no matching screenshot — surfaced for warnings. */
  missingSteps: string[];
  /** Screenshots present in the input but never referenced in the template. */
  orphanScreenshots: string[];
}

const defaultAlt = (stepId: string) => `Captura — paso ${stepId}`;

export function render({ template, screenshots, altFor = defaultAlt }: RenderInput): RenderResult {
  const referencedSteps = new Set<string>();
  const missingSteps: string[] = [];

  const markdown = template.replace(STEP_PLACEHOLDER, (_full, stepId: string) => {
    referencedSteps.add(stepId);
    const path = screenshots[stepId];
    if (!path) {
      missingSteps.push(stepId);
      return `<!-- step:${stepId} — sin captura disponible -->`;
    }
    return `![${altFor(stepId)}](${path})`;
  });

  const orphanScreenshots = Object.keys(screenshots).filter(
    (stepId) => !referencedSteps.has(stepId),
  );

  return { markdown, missingSteps, orphanScreenshots };
}
