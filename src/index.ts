#!/usr/bin/env node

/**
 * CLI entry point.
 *
 * Commands:
 *   toolchain init [--dry-run] [-y|--yes]   scaffold the toolchain into a project
 *   toolchain lint                          run oxlint (read-only)
 *   toolchain typecheck                     run tsc --noEmit (read-only)
 *   toolchain fmt                           run oxfmt (read-only)
 */

import { cac } from 'cac'
import { join } from 'node:path'
import { runInit } from './commands/init'
import { runTool } from './commands/run-tool'
import type { InitFlags } from './types'

const cli = cac('toolchain')

cli
  .command('init [dir]', 'Add the toolchain (oxlint + oxfmt + tsconfig) to a project')
  .option('--dry-run', 'Preview what would change without writing anything')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (dir: string | undefined, options: { dryRun?: boolean; yes?: boolean }) => {
    const flags: InitFlags = {
      dryRun: options.dryRun ?? false,
      yes: options.yes ?? false,
    }
    const root = join(process.cwd(), dir ?? '.')
    process.exitCode = await runInit(root, flags)
  })

cli
  .command('lint', 'Run oxlint in the current project (read-only, no install)')
  .action(() => {
    process.exitCode = runTool(process.cwd(), 'lint')
  })

cli
  .command('typecheck', 'Run tsc --noEmit in the current project (read-only)')
  .action(() => {
    process.exitCode = runTool(process.cwd(), 'typecheck')
  })

cli
  .command('fmt', 'Run oxfmt in the current project (read-only, no install)')
  .action(() => {
    process.exitCode = runTool(process.cwd(), 'fmt')
  })

cli.help()
cli.version('0.0.1')
cli.parse()