/**
 * `toolchain init` — the only write-to-disk command.
 * Detects the project, plans via the planner, and applies the plan (with
 * interactive confirmation unless `--yes`, and a `--dry-run` preview mode).
 */

import { confirm, intro, log, outro, cancel, spinner } from "@clack/prompts";
import pc from "picocolors";
import type { InitFlags } from "../types";
import { detectProject } from "../core/detect";
import { planInit, planIsEmpty } from "../core/planner";
import { applyPlan } from "../executor";

export async function runInit(root: string, flags: InitFlags): Promise<number> {
  intro(pc.bold("toolchain init"));

  const ctx = detectProject(root);
  const plan = planInit(ctx, flags);

  if (planIsEmpty(plan) && plan.collisions.length === 0) {
    outro(pc.green("Already set up — nothing to do. ✓"));
    return 0;
  }

  // --- dry-run: preview everything, write nothing ---
  if (flags.dryRun) {
    log.message(pc.cyan("Dry run — nothing will be written."));
    for (const file of plan.files) {
      if (file.unchanged) {
        log.message(`  ${pc.dim("·")} ${file.path} ${pc.dim("(unchanged)")}`);
        continue;
      }
      const action = file.action === "overwrite" ? pc.yellow("overwrite") : pc.green("create");
      log.message(`  ${pc.dim("·")} ${file.path} → ${action}`);
    }
    const s = Object.keys(plan.packageJson.scripts);
    const d = Object.keys(plan.packageJson.devDependencies);
    if (s.length) log.message(`  ${pc.dim("·")} package.json scripts: ${s.join(", ")}`);
    if (d.length) log.message(`  ${pc.dim("·")} package.json devDependencies: ${d.join(", ")}`);
    for (const step of plan.steps) log.message(`  ${pc.dim("$")} ${step.message}`);
    outro("Preview complete.");
    return 0;
  }

  // --- summarize what will change ---
  log.message("Changes:");
  for (const file of plan.files) {
    if (file.unchanged) {
      log.message(`  ${pc.dim("·")} ${file.path} ${pc.dim("(unchanged)")}`);
      continue;
    }
    const action = file.action === "overwrite" ? pc.yellow("overwrite") : pc.green("create");
    log.message(`  ${pc.dim("·")} ${file.path} → ${action}`);
  }
  const sKeys = Object.keys(plan.packageJson.scripts);
  const dKeys = Object.keys(plan.packageJson.devDependencies);
  if (sKeys.length) log.message(`  ${pc.dim("·")} package.json scripts: ${sKeys.join(", ")}`);
  if (dKeys.length)
    log.message(`  ${pc.dim("·")} package.json devDependencies: ${dKeys.join(", ")}`);

  if (plan.collisions.length > 0) {
    log.warn("Existing scripts that differ from the toolchain:");
    for (const c of plan.collisions)
      log.warn(`  ${c.name}: "${c.existing}" → would become "${c.planned}"`);
  }

  // --- confirmation ---
  if (!flags.yes) {
    const ok = await confirm({
      message: "Apply these changes?",
      initialValue: true,
    });
    if (!ok || typeof ok !== "boolean") {
      cancel("Aborted.");
      return 1;
    }
  }

  const s = spinner();
  s.start("Applying…");
  try {
    const result = await applyPlan(root, plan, ctx);
    s.stop("Done.");
    if (result.written.length) log.message(`  ${pc.dim("·")} wrote ${result.written.join(", ")}`);
    if (result.skipped.length)
      log.message(`  ${pc.dim("·")} kept existing: ${result.skipped.join(", ")}`);
    if (result.installed) log.message(`  ${pc.dim("·")} installed devDependencies`);
  } catch (err) {
    s.stop("Failed.");
    cancel(`Error applying plan: ${(err as Error).message}`);
    return 1;
  }

  for (const step of plan.steps) {
    if (step.kind === "install") log.message(pc.dim(`  next: ${step.message}`));
    else log.message(pc.dim(`  note: ${step.message}`));
  }

  outro(pc.green("toolchain is ready. ✓"));
  return 0;
}
