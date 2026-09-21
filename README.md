# @choriakiinwel/toolchain

[![npm](https://img.shields.io/npm/v/@choriakiinwel/toolchain?color=444&label=)](https://npmjs.com/package/@choriakiinwel/toolchain)

- Bring the `makursi/toolbox` toolchain — **Oxlint + Oxfmt + a strict TypeScript config** — to any project in one command
- Two ways to use it: temporarily via `npx`, or permanently with `toolchain init`
- Auto-detects your package manager (`pnpm` / `npm` / `yarn` / `bun`) and framework (Next.js / React / plain TS)
- Idempotent: re-running `init` never clobbers your existing configs
- `--dry-run` preview before anything is written, `-y/--yes` to skip prompts
- Cross-platform (Windows / macOS / Linux), pure ESM, single binary
- License-safe configs — re-implemented from the official tool schemas, never copied from the toolbox repo

> [!WARNING]
> This is a **personal CLI** with strong opinions. It installs the exact toolchain
> I use for my own projects: Oxlint + Oxfmt (deliberately **no** ESLint or Prettier
> in downstream projects, per the toolbox's ADR-0002) with `typescript` ⇄
> `oxlint-tsgolint` **exactly pinned**.
>
> If you want more control over the rules, always feel free to fork it. Thanks!

## Usage

### Temporary (no install)

```bash
npx @choriakiinwel/toolchain lint
npx @choriakiinwel/toolchain typecheck
```

Nothing to install, nothing to configure — it runs the tools against the current project and forwards the exit code.

### Install

For a permanent setup, install the package and run `init` once:

```bash
npm i -D @choriakiinwel/toolchain
toolchain init
```

Or preview first:

```bash
toolchain init --dry-run
```

### Commands

| Command               | Description                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toolchain init`      | Add the toolchain to the current project (config files, scripts, devDependencies). `--dry-run` to preview, `-y/--yes` to skip prompts. Idempotent. |
| `toolchain lint`      | Run `oxlint` in the current project (read-only).                                                                                                   |
| `toolchain typecheck` | Run `tsc --noEmit` in the current project (read-only).                                                                                             |
| `toolchain fmt`       | Run `oxfmt` in the current project (read-only).                                                                                                    |

> [!TIP]
> The read-only commands (`lint` / `typecheck` / `fmt`) prefer the project's
> locally installed tools and fall back to `npx` — so `npx @choriakiinwel/toolchain <cmd>`
> works even before the toolchain is installed.

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

## Customization

Everything `init` writes is a plain file you can edit afterwards. The toolchain
is deliberately minimal — two config files (`.oxlintrc.json`, `.oxfmtrc.json`),
one `tsconfig.json`, one `.gitattributes`, plus the scripts and devDeps in your
`package.json`. Change any of them directly; re-running `init` never overwrites
your edits.

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

## Versioning Policy

This project follows [Semantic Versioning](https://semver.org/) for releases. Since this is a personal CLI that embeds config templates and opinions, we don't treat template tweaks as breaking changes.

### Changes Considered as Breaking Changes

- Node.js version requirement changes
- Huge refactors that might break the CLI
- A tool the toolchain installs made a major change that affects the generated configs
- Changes that affect most user projects

### Changes Considered as Non-breaking Changes

- Template/rule tweaks inside `init`
- Version bumps of installed toolchain dependencies
- New read-only commands

## Badge

If you are using this toolchain in your project, here is the badge you can use:

```md
[![toolchain](https://img.shields.io/npm/v/@choriakiinwel/toolchain?color=444&label=toolchain)](https://npmjs.com/package/@choriakiinwel/toolchain)
```

## FAQ

### ESLint? Prettier?

No — downstream projects get **Oxlint + Oxfmt** only, following the toolbox's
[ADR-0002](https://github.com/makursi/toolbox/blob/main/docs/adr/0002-oxlint-oxfmt-over-eslint-prettier.md).
The CLI's _own_ codebase uses `@antfu/eslint-config` (antfu-style) for linting,
which is a separate decision from what `init` installs into user projects.

### Why exactly-pinned `typescript` ⇄ `oxlint-tsgolint`?

Oxlint's type-aware linting is powered by typescript-go; `oxlint-tsgolint`
tracks a specific TypeScript release, so the two must move together. The
toolchain pins both exactly (`7.0.2` / `7.0.2001`) to avoid a version-drift
surprise mid-install.

### How do I update the toolchain?

`npm i -D @choriakiinwel/toolchain@latest`, then re-run `toolchain init` — it
detects what is already there and only adds what is missing.

### I prefer a different rule.

`toolchain init` writes plain files. Edit `.oxlintrc.json` / `.oxfmtrc.json`
directly, or fork the repo and maintain your own copy.

## Check Also

- [makursi/toolbox](https://github.com/makursi/toolbox) — the monorepo this toolchain comes from
- [antfu/eslint-config](https://github.com/antfu/eslint-config) — inspiration for the CLI's own code style

## License

[MIT](./LICENSE) License &copy; 2026 Choriakiinwei
