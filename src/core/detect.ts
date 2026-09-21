/**
 * Project detection: read the target directory and build a `ProjectContext`.
 * This is the only part of init that touches the filesystem for *reading*.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Framework, PackageManager, ProjectContext } from '../types'

const LOCKFILE_TO_PM: Array<[string, PackageManager]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['package-lock.json', 'npm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
]

/** Resolve the project root: absolute path, falling back to `dir` when not a directory. */
export function resolveProjectRoot(dir: string): string {
  return existsSync(dir) ? dir : process.cwd()
}

/** Detect the package manager from lockfiles present in the project root. */
export function detectPackageManager(root: string): PackageManager {
  for (const [lockfile, pm] of LOCKFILE_TO_PM) {
    if (existsSync(join(root, lockfile)))
      return pm
  }
  // Fall back to whatever toolchain install-pkg would pick (npm).
  return 'npm'
}

function readJsonIfPresent(root: string, file: string): Record<string, unknown> | undefined {
  const path = join(root, file)
  if (!existsSync(path))
    return undefined
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  }
  catch {
    return undefined
  }
}

/** Detect framework from package.json deps + config markers. */
export function detectFramework(root: string): Framework {
  const pkg = readJsonIfPresent(root, 'package.json')
  const deps = {
    ...(pkg?.dependencies as Record<string, string> | undefined),
    ...(pkg?.devDependencies as Record<string, string> | undefined),
    ...(pkg?.peerDependencies as Record<string, string> | undefined),
  }
  if (deps.next || existsSync(join(root, 'next.config.js')) || existsSync(join(root, 'next.config.mjs')) || existsSync(join(root, 'next.config.ts')))
    return 'next'
  if (deps.react || deps['react-dom'])
    return 'react'
  return 'plain'
}

/** Detect a workspace/monorepo layout. */
export function detectMonorepo(root: string): boolean {
  if (existsSync(join(root, 'pnpm-workspace.yaml')))
    return true
  const pkg = readJsonIfPresent(root, 'package.json')
  if (pkg && (pkg.workspaces !== undefined || pkg.pnpm !== undefined))
    return true
  return false
}

/** Collect existing file contents under the project root (config files only). */
function existingFiles(root: string, paths: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of paths) {
    const full = join(root, p)
    if (existsSync(full)) {
      try {
        map.set(p, readFileSync(full, 'utf8'))
      }
      catch {
        // unreadable file: treat as absent
      }
    }
  }
  return map
}

/** Collect scripts + devDependencies from the target package.json. */
function existingPkgFields(root: string) {
  const pkg = readJsonIfPresent(root, 'package.json')
  const scripts = new Map<string, string>()
  const devDeps = new Map<string, string>()
  if (pkg) {
    const rawScripts = pkg.scripts as Record<string, string> | undefined
    const rawDev = pkg.devDependencies as Record<string, string> | undefined
    if (rawScripts) {
      for (const [k, v] of Object.entries(rawScripts))
        scripts.set(k, v)
    }
    if (rawDev) {
      for (const [k, v] of Object.entries(rawDev))
        devDeps.set(k, v)
    }
  }
  return { scripts, devDeps }
}

/** Candidate config paths the planner may want to write. */
export const CANDIDATE_PATHS = [
  '.oxlintrc.json',
  '.oxfmtrc.json',
  'tsconfig.json',
  '.gitattributes',
] as const

/** Build the full project context for the planner. Pure data, no side effects. */
export function detectProject(root: string): ProjectContext {
  const files = existingFiles(root, [...CANDIDATE_PATHS])
  const { scripts, devDeps } = existingPkgFields(root)
  return {
    packageManager: detectPackageManager(root),
    framework: detectFramework(root),
    isMonorepo: detectMonorepo(root),
    hasPackageJson: existsSync(join(root, 'package.json')),
    existingFiles: files,
    existingScripts: scripts,
    existingDevDependencies: devDeps,
  }
}

/** List immediate subdirectories (used to guess a src dir for tsconfig include). */
export function listDirectories(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map(e => e.name)
  }
  catch {
    return []
  }
}