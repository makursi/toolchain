# toolchain (published as @choriakiinwel/toolchain)

> Personal CLI that brings the `makursi/toolbox` toolchain — **Oxlint + Oxfmt + a
> shared strict TypeScript config** — to any project. Two ways to use it:
> temporarily via `npx`, or permanently by installing and running `toolchain init`.

## Why

`makursi/toolbox` is a pnpm + Turborepo monorepo with a carefully chosen dev
toolchain (see its ADR-0002: Oxlint + Oxfmt, deliberately **no** ESLint/Prettier
in user projects). That toolchain was not reusable: the repo is private and
all-rights-reserved, with no "add to my project" mechanism. `toolchain` fixes
that — the configs are re-implemented from the **official tool schemas**, never
copied from the toolbox repo.

## Install

```bash
# permanent — adds the toolchain to your project
npm i -D @choriakiinwel/toolchain
toolchain init

# temporary — no install needed
npx @choriakiinwel/toolchain lint
```

## Commands

| Command               | Description                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toolchain init`      | Add the toolchain to the current project (config files, scripts, devDependencies). `--dry-run` to preview, `-y/--yes` to skip prompts. Idempotent. |
| `toolchain lint`      | Run `oxlint` in the current project (read-only).                                                                                                   |
| `toolchain typecheck` | Run `tsc --noEmit` in the current project (read-only).                                                                                             |
| `toolchain fmt`       | Run `oxfmt` in the current project (read-only).                                                                                                    |

## What `toolchain init` does

- Writes `.oxlintrc.json` (base rules; framework plugins + browser env when it
  detects Next.js / React), `.oxfmtrc.json`, a strict `tsconfig.json` (skipped
  for Next.js, which owns its own), and `.gitattributes` (`eol=lf` so Oxfmt's
  LF enforcement never fights CRLF).
- Adds npm scripts: `lint`, `lint:fix`, `typecheck`, `fmt`, `fmt:check`.
- Adds devDependencies pinned to the toolbox catalog, with `typescript` ⇄
  `oxlint-tsgolint` **exactly pinned** (they move together).
- Declares `engines.node >=22.22.1` (covers lint-staged 17 + pnpm 12 floors).
- Wires `simple-git-hooks` + `lint-staged` (pre-commit runs `lint-staged` via
  your detected package manager: pnpm / npm / yarn / bun).

## Requirements

- Node >= 18.18 to run the CLI itself.
- Node >= 22.22.1 in projects that adopt the toolchain (declared automatically
  by `init`).

## Development

```bash
pnpm install
pnpm test        # Vitest — the planner (single test seam) fixture matrix
pnpm lint        # oxlint --type-aware (CLI dogfoods the oxlint toolchain)
pnpm typecheck   # tsc --noEmit (TypeScript 7)
pnpm build       # tsdown → dist/index.mjs (pure ESM)
```

The CLI's own codebase follows antfu-style conventions (`@antfu/eslint-config`)
for linting; the toolchain it _installs into user projects_ is Oxlint + Oxfmt.

## Release

Publishing is fully automated via GitHub Actions — no manual `npm publish`
needed, and no OTP involved.

1. Set the **`NPM_TOKEN`** secret on the repo (`Settings → Secrets and
   variables → Actions`): an npm **granular access token for
   `@choriakiinwel/toolchain` with bypass-2FA** (token type "Publish").
2. Tag a release (the tag version must match `package.json` version):

   ```bash
   git tag v0.0.1
   git push origin v0.0.1
   ```

   The `Release` workflow runs the full quality gates first, then publishes to
   npm with `--provenance` (signature-backed attestation).

## License

MIT
