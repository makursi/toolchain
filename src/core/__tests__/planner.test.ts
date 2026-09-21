/**
 * Planner tests — the single test seam.
 *
 * All assertions target external behavior: given a fixture ProjectContext
 * (package manager × framework × existing files), assert the InitPlan's files,
 * package.json mutations, collisions, and steps. No filesystem, no installs.
 */

import { describe, expect, it } from 'vitest'
import { omit } from './test-helpers'
import { makeContext, planInit } from '../planner'
import { ENGINES_NODE, VERSIONS } from '../templates'
import type { ProjectContext } from '../../types'

function plainContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return makeContext(overrides)
}

describe('planInit — fresh plain TS project (pnpm)', () => {
  const ctx = plainContext({ packageManager: 'pnpm', framework: 'plain' })
  const plan = planInit(ctx, { dryRun: false, yes: false })

  it('plans the four config files as creates', () => {
    const paths = plan.files.map(f => [f.path, f.action])
    expect(paths).toEqual([
      ['.oxlintrc.json', 'create'],
      ['.oxfmtrc.json', 'create'],
      ['tsconfig.json', 'create'],
      ['.gitattributes', 'create'],
    ])
  })

  it('renders an oxlint base config (correctness error, no ESLint anywhere)', () => {
    const file = plan.files.find(f => f.path === '.oxlintrc.json')!
    const parsed = JSON.parse(file.content)
    expect(parsed.categories).toEqual({ correctness: 'error', suspicious: 'warn' })
    expect(parsed.rules.eqeqeq).toBe('error')
    expect(file.content).not.toContain('eslint')
  })

  it('renders an oxfmt config with sortImports', () => {
    const file = plan.files.find(f => f.path === '.oxfmtrc.json')!
    expect(JSON.parse(file.content).sortImports).toBe(true)
  })

  it('adds the five scripts and the toolchain devDependencies', () => {
    const scripts = plan.packageJson.scripts
    expect(Object.keys(scripts).sort()).toEqual(['fmt', 'fmt:check', 'lint', 'lint:fix', 'typecheck'])
    const deps = plan.packageJson.devDependencies
    expect(deps.oxlint).toBe(VERSIONS.oxlint)
    expect(deps.oxfmt).toBe(VERSIONS.oxfmt)
    expect(deps.typescript).toBe('7.0.2')
    expect(deps['oxlint-tsgolint']).toBe('7.0.2001')
    expect(deps['lint-staged']).toBe(VERSIONS.lintStaged)
    expect(deps['simple-git-hooks']).toBe(VERSIONS.simpleGitHooks)
  })

  it('writes engines node floor >=22.22.1 into generated projects', () => {
    expect(plan.packageJson.enginesNode).toBe(ENGINES_NODE)
  })

  it('wires simple-git-hooks + lint-staged for pnpm', () => {
    expect(plan.packageJson.simpleGitHooks?.['pre-commit']).toBe('pnpm lint-staged')
    expect(plan.packageJson.lintStaged?.['*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}']).toContain('oxlint --fix')
  })

  it('emits one install step with a pnpm add -D command', () => {
    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]!.kind).toBe('install')
    // expect.any is fine, but assert it mentions the pinned typescript version
    expect(plan.steps[0]!.message).toContain('pnpm add -D')
    expect(plan.steps[0]!.message).toContain('typescript@7.0.2')
  })
})

describe('planInit — framework detection', () => {
  it('adds react/jsx-a11y plugins and browser env for react', () => {
    const plan = planInit(plainContext({ framework: 'react' }), { dryRun: false, yes: false })
    const oxlint = JSON.parse(plan.files.find(f => f.path === '.oxlintrc.json')!.content)
    expect(oxlint.plugins).toEqual(['react', 'jsx-a11y'])
    expect(oxlint.env).toEqual({ browser: true })
    const tsconfig = JSON.parse(plan.files.find(f => f.path === 'tsconfig.json')!.content)
    expect(tsconfig.compilerOptions.jsx).toBe('react-jsx')
  })

  it('adds nextjs plugin and skips tsconfig for next (Next owns it)', () => {
    const plan = planInit(plainContext({ framework: 'next' }), { dryRun: false, yes: false })
    const oxlint = JSON.parse(plan.files.find(f => f.path === '.oxlintrc.json')!.content)
    expect(oxlint.plugins).toEqual(['nextjs', 'react', 'jsx-a11y'])
    expect(plan.files.some(f => f.path === 'tsconfig.json')).toBe(false)
    expect(plan.steps.some(s => s.kind === 'notice' && s.message.includes('Next.js'))).toBe(true)
  })
})

describe('planInit — package manager adaptation', () => {
  it('uses npm i -D for npm projects', () => {
    const plan = planInit(plainContext({ packageManager: 'npm' }), { dryRun: false, yes: false })
    expect(plan.packageJson.simpleGitHooks?.['pre-commit']).toBe('npx lint-staged')
    expect(plan.steps[0]!.message.startsWith('npm i -D')).toBe(true)
    expect(plan.steps[0]!.message).not.toContain('pnpm')
  })

  it('uses yarn add -D for yarn projects', () => {
    const plan = planInit(plainContext({ packageManager: 'yarn' }), { dryRun: false, yes: false })
    expect(plan.steps[0]!.message).toContain('yarn add -D')
  })

  it('uses bun add -d for bun projects', () => {
    const plan = planInit(plainContext({ packageManager: 'bun' }), { dryRun: false, yes: false })
    expect(plan.steps[0]!.message).toContain('bun add -d')
  })
})

describe('planInit — idempotency', () => {
  it('is a no-op when everything already matches', () => {
    const fresh = planInit(plainContext(), { dryRun: false, yes: false })
    const existingFiles = new Map(fresh.files.map(f => [f.path, f.content]))
    const existingScripts = new Map(Object.entries(fresh.packageJson.scripts))
    const existingDevDependencies = new Map(Object.entries(fresh.packageJson.devDependencies))
    const ctx = plainContext({ existingFiles, existingScripts, existingDevDependencies })
    const rerun = planInit(ctx, { dryRun: false, yes: false })
    expect(rerun.files.every(f => f.unchanged)).toBe(true)
    expect(Object.keys(rerun.packageJson.scripts)).toHaveLength(0)
    expect(Object.keys(rerun.packageJson.devDependencies)).toHaveLength(0)
    expect(rerun.steps.filter(s => s.kind === 'install')).toHaveLength(0)
  })

  it('marks a differing existing config as overwrite with --yes, keep-old without', () => {
    const existingFiles = new Map<string, string>([
      ['.oxlintrc.json', '{ "json": "user edits" }\n'],
    ])
    const withYes = planInit(plainContext({ existingFiles }), { dryRun: false, yes: true })
    const oxlintYes = withYes.files.find(f => f.path === '.oxlintrc.json')!
    expect(oxlintYes.action).toBe('overwrite')

    const withoutYes = planInit(plainContext({ existingFiles }), { dryRun: false, yes: false })
    const oxlintNo = withoutYes.files.find(f => f.path === '.oxlintrc.json')!
    expect(oxlintNo.action).toBe('keep-old')
  })
})

describe('planInit — collisions', () => {
  it('reports scripts that differ from the toolchain', () => {
    const existingScripts = new Map<string, string>([['lint', 'eslint .']])
    const plan = planInit(plainContext({ existingScripts }), { dryRun: false, yes: false })
    const lintCollision = plan.collisions.find(c => c.name === 'lint')
    expect(lintCollision).toEqual({ name: 'lint', existing: 'eslint .', planned: 'oxlint' })
    // a collided script is NOT silently added
    expect(plan.packageJson.scripts.lint).toBeUndefined()
  })

  it('adds only missing scripts', () => {
    const existingScripts = new Map<string, string>([['typecheck', 'tsc --noEmit'], ['fmt', 'oxfmt']])
    const plan = planInit(plainContext({ existingScripts }), { dryRun: false, yes: false })
    expect(Object.keys(plan.packageJson.scripts).sort()).toEqual(['fmt:check', 'lint', 'lint:fix'])
  })
})

describe('planInit — monorepo', () => {
  it('still adds toolchain deps but keeps behavior consistent', () => {
    const plan = planInit(plainContext({ isMonorepo: true }), { dryRun: false, yes: false })
    expect(plan.packageJson.devDependencies.oxlint).toBeDefined()
    expect(plan.steps[0]!.message).toContain('pnpm add -D')
  })
})

// Keep `omit` referenced so tree-shaking exercises the helper import path.
describe('test-helpers', () => {
  it('omits keys from an object', () => {
    expect(omit({ a: 1, b: 2 }, ['a'])).toEqual({ b: 2 })
  })
})