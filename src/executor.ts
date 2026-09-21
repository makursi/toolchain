/**
 * Executor: the thin application layer that applies an `InitPlan` to disk.
 * All *decisions* live in the planner; this file only carries them out.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { installPackage } from '@antfu/install-pkg'
import type { InitPlan, ProjectContext } from './types'

export interface ApplyResult {
  written: string[]
  skipped: string[]
  installed: boolean
}

/** Write one planned file, creating parent directories as needed. */
async function writePlanFile(root: string, file: InitPlan['files'][number]): Promise<'written' | 'skipped'> {
  const full = join(root, file.path)
  if (file.action === 'keep-old')
    return 'skipped'
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, file.content, 'utf8')
  return 'written'
}

/** Re-read a JSON file, apply the plan's package.json mutations, write back. */
async function applyPackageJson(root: string, plan: InitPlan): Promise<void> {
  const pkgPath = join(root, 'package.json')
  let pkg: Record<string, any>
  try {
    pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as Record<string, any>
  }
  catch {
    // No readable package.json: create one from scratch.
    pkg = { name: 'toolchain-project', version: '0.0.0', private: true }
  }

  const { packageJson } = plan

  if (Object.keys(packageJson.scripts).length > 0) {
    pkg.scripts = { ...pkg.scripts, ...packageJson.scripts }
  }
  if (Object.keys(packageJson.devDependencies).length > 0) {
    pkg.devDependencies = { ...pkg.devDependencies, ...packageJson.devDependencies }
  }
  // engines.node: only lift (never lower) the declared floor.
  pkg.engines = { node: packageJson.enginesNode, ...pkg.engines }

  if (packageJson.simpleGitHooks)
    pkg['simple-git-hooks'] = packageJson.simpleGitHooks
  if (packageJson.lintStaged)
    pkg['lint-staged'] = packageJson.lintStaged

  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
}

/** Re-apply the plan's exact devDependency versions after install.
 * Package managers may rewrite ranges (e.g. npm turns `7.0.2` into `^7.0.2`),
 * but the toolchain pins typescript ⇄ oxlint-tsgolint exactly — the plan is
 * the single source of truth. */
async function pinExactDevDependencies(root: string, plan: InitPlan): Promise<void> {
  const pinned = Object.entries(plan.packageJson.devDependencies)
  if (pinned.length === 0)
    return
  const pkgPath = join(root, 'package.json')
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as Record<string, any>
  pkg.devDependencies = {
    ...(pkg.devDependencies as Record<string, string> | undefined),
    ...Object.fromEntries(pinned),
  }
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
}

/** Apply the whole plan to disk; returns what was written vs skipped. */
export async function applyPlan(root: string, plan: InitPlan, ctx: ProjectContext): Promise<ApplyResult> {
  const written: string[] = []
  const skipped: string[] = []
  for (const file of plan.files) {
    const result = await writePlanFile(root, file)
    if (result === 'written')
      written.push(file.path)
    else
      skipped.push(file.path)
  }

  await applyPackageJson(root, plan)

  const missing = Object.keys(plan.packageJson.devDependencies)
  let installed = false
  if (missing.length > 0) {
    // Pass the planner-detected package manager explicitly: install decisions
    // live in the planner (single seam); install-pkg must not re-detect.
    await installPackage(missing, {
      dev: true,
      cwd: root,
      packageManager: ctx.packageManager,
    })
    installed = true
    await pinExactDevDependencies(root, plan)
  }

  return { written, skipped, installed }
}