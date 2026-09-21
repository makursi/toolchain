/**
 * Toolchain config templates.
 *
 * License-safe: every template below is written against the *official* schema
 * of the respective tool (oxlint / oxfmt / TypeScript). Nothing is copied
 * verbatim from the makursi/toolbox repository, which is all-rights-reserved.
 */

import type { Framework, PackageManager } from '../types'

/** Version catalog, aligned with the versions the toolbox repo pins. */
export const VERSIONS = {
  oxlint: '^1.82.0',
  oxfmt: '^0.67.0',
  typescript: '7.0.2',
  oxlintTsgolint: '7.0.2001',
  lintStaged: '^17.5.1',
  simpleGitHooks: '^2.14.0',
} as const

/** Node floor written into generated projects (covers lint-staged 17 + pnpm). */
export const ENGINES_NODE = '>=22.22.1'

interface Oxlintrc {
  $schema: string
  categories?: Record<string, string>
  rules?: Record<string, string>
  plugins?: string[]
  env?: Record<string, boolean>
  ignorePatterns?: string[]
}

/** Oxlint base config (categories + default rules + ignores). */
export function oxlintBase(): Oxlintrc {
  return {
    $schema: './node_modules/oxlint/configuration_schema.json',
    categories: {
      correctness: 'error',
      suspicious: 'warn',
    },
    rules: {
      eqeqeq: 'error',
      'no-debugger': 'error',
      'no-console': 'warn',
    },
    ignorePatterns: [
      '**/node_modules',
      '**/.next',
      '**/dist',
      '**/.turbo',
      'next-env.d.ts',
    ],
  }
}

/** Framework-specific oxlint additions (mirrors base + per-package extends). */
export function oxlintFramework(framework: Framework): Oxlintrc {
  switch (framework) {
    case 'next':
      return {
        $schema: './node_modules/oxlint/configuration_schema.json',
        plugins: ['nextjs', 'react', 'jsx-a11y'],
        env: { browser: true },
        rules: { 'react/react-in-jsx-scope': 'off' },
        ignorePatterns: ['.next', 'node_modules', 'next-env.d.ts'],
      }
    case 'react':
      return {
        $schema: './node_modules/oxlint/configuration_schema.json',
        plugins: ['react', 'jsx-a11y'],
        env: { browser: true },
        rules: { 'react/react-in-jsx-scope': 'off' },
        ignorePatterns: ['node_modules', 'dist'],
      }
    default:
      return oxlintBase()
  }
}

/** Oxfmt config (sort imports, no toolchain dirs). */
export function oxfmtBase(): Record<string, unknown> {
  return {
    $schema: './node_modules/oxfmt/configuration_schema.json',
    sortImports: true,
    ignorePatterns: [
      '**/node_modules',
      '**/.next',
      '**/dist',
      '**/.turbo',
      'next-env.d.ts',
      'pnpm-lock.yaml',
    ],
  }
}

/** Shared strict TypeScript baseline for plain TS / React projects. */
export function tsconfigBase(framework: 'plain' | 'react'): Record<string, unknown> {
  return {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      moduleDetection: 'force',
      resolveJsonModule: true,
      isolatedModules: true,
      verbatimModuleSyntax: true,
      esModuleInterop: true,
      strict: true,
      noUncheckedIndexedAccess: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      skipLibCheck: true,
      noEmit: true,
      incremental: true,
      ...(framework === 'react'
        ? {
            lib: ['DOM', 'DOM.Iterable', 'ES2022'],
            jsx: 'react-jsx',
          }
        : {}),
    },
    include: ['src'],
  }
}

/** .gitattributes: LF everywhere so oxfmt (LF-enforcing) never fights CRLF. */
export function gitattributes(): string {
  return '* text=auto eol=lf\n'
}

/** npm scripts the toolchain adds to a project. */
export function toolchainScripts(): Record<string, string> {
  return {
    lint: 'oxlint',
    'lint:fix': 'oxlint --fix',
    typecheck: 'tsc --noEmit',
    fmt: 'oxfmt',
    'fmt:check': 'oxfmt --check',
  }
}

/** devDependencies the toolchain adds to a project. */
export function toolchainDevDependencies(isMonorepo: boolean): Record<string, string> {
  return {
    oxlint: VERSIONS.oxlint,
    oxfmt: VERSIONS.oxfmt,
    typescript: VERSIONS.typescript,
    'oxlint-tsgolint': VERSIONS.oxlintTsgolint,
    'lint-staged': VERSIONS.lintStaged,
    'simple-git-hooks': VERSIONS.simpleGitHooks,
    ...(isMonorepo ? {} : {}),
  }
}

/** lint-staged block; oxfmt --fix is NOT run inside lint-staged (see toolbox ADR-0002 note). */
export function lintStagedConfig(): Record<string, string[]> {
  return {
    '*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}': [
      'oxlint --fix',
      'oxfmt --no-error-on-unmatched-pattern',
    ],
    '*.{json,jsonc,css,md,mdx,yml,yaml,toml,html}': [
      'oxfmt --no-error-on-unmatched-pattern',
    ],
  }
}

/** simple-git-hooks pre-commit, adapted to the project's package manager. */
export function simpleGitHooks(packageManager: PackageManager): Record<string, string> {
  const run = packageManager === 'pnpm' ? 'pnpm' : packageManager === 'yarn' ? 'yarn' : packageManager === 'bun' ? 'bun' : 'npx'
  return {
    'pre-commit': `${run} lint-staged`,
  }
}