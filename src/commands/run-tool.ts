/**
 * Read-only toolchain commands: `lint`, `typecheck`, `fmt`.
 * These spawn the project's locally installed tools (oxlint / tsc / oxfmt) and
 * forward exit codes — they never write to disk.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export type ReadonlyTool = "lint" | "typecheck" | "fmt";

interface ToolSpec {
  /** Binary name under node_modules/.bin. */
  bin: string;
  /** Extra CLI args. */
  args: string[];
}

const TOOL_SPECS: Record<ReadonlyTool, ToolSpec> = {
  lint: { bin: "oxlint", args: [] },
  typecheck: { bin: "tsc", args: ["--noEmit"] },
  fmt: { bin: "oxfmt", args: [] },
};

interface ResolvedCommand {
  cmd: string;
  args: string[];
  shell: boolean;
}

/**
 * Resolve the binary to run. Prefers the target project's local install (so
 * `toolchain init` projects use the pinned versions); falls back to `npx` so
 * `npx toolchain lint` works in projects that don't have the toolchain yet.
 */
function resolveCommand(cwd: string, spec: ToolSpec): ResolvedCommand {
  const localBin = join(cwd, "node_modules", ".bin", spec.bin);
  if (existsSync(localBin) || existsSync(`${localBin}.cmd`)) {
    // On Windows, npm/pnpm install .cmd shims that must be spawned via shell.
    return {
      cmd: localBin,
      args: spec.args,
      shell: process.platform === "win32",
    };
  }
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  return {
    cmd: npx,
    args: ["--yes", spec.bin, ...spec.args],
    shell: process.platform === "win32",
  };
}

/** Run one read-only tool and return its exit code. */
export function runTool(cwd: string, tool: ReadonlyTool): number {
  const spec = TOOL_SPECS[tool];
  const command = resolveCommand(cwd, spec);
  const result = spawnSync(command.cmd, command.args, {
    cwd,
    stdio: "inherit",
    shell: command.shell,
  });
  if (result.error) {
    process.stderr.write(`toolchain: failed to run ${tool}: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}
