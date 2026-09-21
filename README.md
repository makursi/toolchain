# toolchain

> Personal CLI that brings the `makursi/toolbox` toolchain (Oxlint + Oxfmt + shared
> TypeScript config) to any project — either temporarily via `npx toolchain <cmd>`,
> or permanently by installing the package and running `toolchain init`.

## Status

Spec in progress — see the project's issue tracker. Not yet published to npm.

## Planned commands

- `toolchain init` — scaffold the toolchain into the current project (config files,
  devDependencies, npm scripts; `--dry-run`, `--yes`, idempotent).
- `toolchain lint` / `toolchain typecheck` / `toolchain fmt` — read-only execution via
  `npx`, no install needed (beyond the npx cache).

## Decisions snapshot

- Toolchain for downstream projects: **Oxlint + Oxfmt** (no ESLint/Prettier in user
  projects) — faithful to the toolbox ADR-0002.
- The CLI's own codebase **dogfoods `@antfu/eslint-config`**.
- CLI: Node + TypeScript, ESM, `cac` + `clack` + `@antfu/install-pkg`, bundled with `tsdown`.
- Engine floors: CLI `>=18.18`; projects scaffolded by `init` get `>=22.22.1`.
- License-safe: config templates are re-implemented from official schemas, never
  copied verbatim from the toolbox repo (which is all-rights-reserved).