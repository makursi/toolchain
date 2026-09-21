/**
 * The single test seam of the toolchain CLI.
 *
 * `planInit` is a pure function: given a `ProjectContext` (detected by
 * `core/detect.ts`) and user flags, it returns a fully declarative `InitPlan`
 * describing every file to write, package.json mutation to apply, and step to
 * run. The CLI executor is a thin application layer over this plan.
 *
 * Everything here is deterministic — same inputs, same plan — so tests can
 * drive the whole feature through this one seam.
 */

import type {
  FileAction,
  Framework,
  InitFlags,
  InitPlan,
  PlanFile,
  PlanPackageJson,
  ProjectContext,
} from "../types";
import {
  ENGINES_NODE,
  gitattributes,
  lintStagedConfig,
  oxfmtBase,
  oxlintFramework,
  simpleGitHooks,
  toolchainDevDependencies,
  toolchainScripts,
  tsconfigBase,
} from "./templates";

function renderJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Decide the desired action for a planned file given what exists. */
function decideAction(
  existing: string | undefined,
  planned: string,
  flags: InitFlags,
): { action: FileAction; unchanged: boolean } {
  if (existing === undefined) return { action: "create", unchanged: false };
  if (existing === planned) return { action: "keep-old", unchanged: true };
  return { action: flags.yes ? "overwrite" : "keep-old", unchanged: false };
}

interface PlannedFile {
  path: string;
  content: string;
}

/** Compute the set of files the plan wants, given context + flags. */
function planFiles(ctx: ProjectContext, flags: InitFlags): PlanFile[] {
  const wanted: PlannedFile[] = [];

  // .oxlintrc.json — base for plain, framework-extended for react/next
  wanted.push({
    path: ".oxlintrc.json",
    content: renderJson(oxlintFramework(ctx.framework)),
  });

  // .oxfmtrc.json — always
  wanted.push({
    path: ".oxfmtrc.json",
    content: renderJson(oxfmtBase()),
  });

  // tsconfig.json — skipped for Next.js: Next owns tsconfig generation
  if (ctx.framework !== "next") {
    wanted.push({
      path: "tsconfig.json",
      content: renderJson(tsconfigBase(ctx.framework === "react" ? "react" : "plain")),
    });
  }

  // .gitattributes — LF line endings (oxfmt enforces LF)
  wanted.push({
    path: ".gitattributes",
    content: gitattributes(),
  });

  return wanted.map(({ path, content }) => {
    const { action, unchanged } = decideAction(ctx.existingFiles.get(path), content, flags);
    return { path, content, action, unchanged };
  });
}

/** Compute package.json mutations: only add what's missing; report collisions. */
function planPackageJson(ctx: ProjectContext, hasPackageJson: boolean): PlanPackageJson {
  const scripts: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};
  const toolchain = toolchainScripts();
  const deps = toolchainDevDependencies(ctx.isMonorepo);
  const hasGitHooks = ctx.existingScripts.has("precommit") || ctx.existingScripts.has("prepare");

  for (const [name, command] of Object.entries(toolchain)) {
    if (!ctx.existingScripts.has(name)) scripts[name] = command;
  }
  for (const [name, range] of Object.entries(deps)) {
    if (!ctx.existingDevDependencies.has(name)) devDependencies[name] = range;
  }

  return {
    scripts,
    devDependencies,
    enginesNode: ENGINES_NODE,
    ...(hasPackageJson && !hasGitHooks
      ? {
          simpleGitHooks: simpleGitHooks(ctx.packageManager),
          lintStaged: lintStagedConfig(),
        }
      : {}),
  };
}

/** Collisions: scripts the user already has that a plan script would replace. */
function planCollisions(
  ctx: ProjectContext,
): Array<{ name: string; existing: string; planned: string }> {
  const planned = toolchainScripts();
  const collisions: Array<{ name: string; existing: string; planned: string }> = [];
  for (const [name, command] of Object.entries(planned)) {
    const existing = ctx.existingScripts.get(name);
    if (existing !== undefined && existing !== command)
      collisions.push({ name, existing, planned: command });
  }
  return collisions;
}

/** Steps the executor should run after applying the plan. */
function planSteps(ctx: ProjectContext, pkg: PlanPackageJson): InitPlan["steps"] {
  const steps: InitPlan["steps"] = [];
  const missing = Object.keys(pkg.devDependencies);
  if (missing.length > 0) {
    const withVersions = missing.map((name) => `${name}@${pkg.devDependencies[name]}`).join(" ");
    const pm = ctx.packageManager;
    const add =
      pm === "pnpm"
        ? `pnpm add -D ${withVersions}`
        : pm === "npm"
          ? `npm i -D ${withVersions}`
          : pm === "yarn"
            ? `yarn add -D ${withVersions}`
            : `bun add -d ${withVersions}`;
    steps.push({ kind: "install", message: add });
  }
  if (ctx.framework === "next") {
    steps.push({
      kind: "notice",
      message:
        "Next.js detected: tsconfig.json is managed by Next.js itself, so the toolchain did not touch it.",
    });
  }
  if (!ctx.hasPackageJson && Object.keys(pkg.scripts).length === 0) {
    steps.push({
      kind: "notice",
      message:
        "No package.json found — config files were written, but scripts/deps need a package.json to merge into.",
    });
  }
  return steps;
}

/** The one pure function that defines the whole feature. */
export function planInit(ctx: ProjectContext, flags: InitFlags): InitPlan {
  const files = planFiles(ctx, flags);
  const packageJson = planPackageJson(ctx, ctx.hasPackageJson);
  const collisions = planCollisions(ctx);
  const steps = planSteps(ctx, packageJson);
  return { files, packageJson, collisions, steps };
}

/** Convenience: whether a plan would change anything on disk. */
export function planIsEmpty(plan: InitPlan): boolean {
  const writes = plan.files.filter((f) => f.action !== "keep-old");
  const edits =
    Object.keys(plan.packageJson.scripts).length +
    Object.keys(plan.packageJson.devDependencies).length;
  return writes.length === 0 && edits === 0;
}

/** Fixture helper: build a minimal ProjectContext for tests. */
export function makeContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    packageManager: "pnpm",
    framework: "plain",
    isMonorepo: false,
    hasPackageJson: true,
    existingFiles: new Map(),
    existingScripts: new Map(),
    existingDevDependencies: new Map(),
    ...overrides,
  };
}

/** Export a typed framework helper for template tests. */
export type { Framework };
