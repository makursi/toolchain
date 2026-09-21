/**
 * Shared types across the toolchain CLI.
 *
 * The design's single test seam lives in `core/planner.ts`: `planInit` is a
 * pure function that maps a project context + flags to a fully declarative
 * `InitPlan`. Everything the CLI writes must be derived from that plan.
 */

/** Package managers we can detect and drive. */
export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

/** Framework shape detected from the target project. */
export type Framework = "plain" | "react" | "next";

/** What to do with an existing file at the same path. */
export type FileAction = "create" | "overwrite" | "keep-old";

/** A single file the plan wants on disk. */
export interface PlanFile {
  /** Project-relative path, e.g. `.oxlintrc.json`. */
  path: string;
  /** Full rendered contents. */
  content: string;
  /** How this file should be applied relative to what exists. */
  action: FileAction;
  /** Whether an existing file with identical content was found. */
  unchanged: boolean;
}

/** Fingerprint of the target project that the planner needs. */
export interface ProjectContext {
  packageManager: PackageManager;
  framework: Framework;
  /** True when the target looks like a pnpm workspace / npm workspaces monorepo. */
  isMonorepo: boolean;
  /** Whether the target has a package.json (scripts/deps can only merge into one). */
  hasPackageJson: boolean;
  /** Files that already exist, keyed by project-relative path. */
  existingFiles: Map<string, string>;
  /** Scripts already present in the target's package.json (name → command). */
  existingScripts: Map<string, string>;
  /** devDependencies already present (name → version range). */
  existingDevDependencies: Map<string, string>;
}

/** User-supplied flags. */
export interface InitFlags {
  dryRun: boolean;
  yes: boolean;
}

/** The package.json mutations the plan wants to apply. */
export interface PlanPackageJson {
  /** Scripts to add (name → command). */
  scripts: Record<string, string>;
  /** devDependencies to add (name → version range). */
  devDependencies: Record<string, string>;
  /** engines.node line to declare for the generated project. */
  enginesNode: string;
  /** simple-git-hooks block to add when hooking is part of the plan. */
  simpleGitHooks?: Record<string, string>;
  /** lint-staged block to add. */
  lintStaged?: Record<string, string[]>;
}

/** Human-readable step the executor will run after writing files. */
export interface PlanStep {
  kind: "install" | "notice" | "skip";
  message: string;
}

/** The full declarative plan produced by the planner. */
export interface InitPlan {
  files: PlanFile[];
  packageJson: PlanPackageJson;
  /** Scripts that already exist and would collide with plan scripts. */
  collisions: Array<{ name: string; existing: string; planned: string }>;
  steps: PlanStep[];
}
