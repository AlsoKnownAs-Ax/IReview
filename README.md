# IReview

## STATUS
In progress

[![CI](https://github.com/AlsoKnownAs-Ax/IReview/actions/workflows/ci.yml/badge.svg)](https://github.com/AlsoKnownAs-Ax/IReview/actions/workflows/ci.yml)

A Windows + macOS desktop app for reviewing code — with editing — while coding agents run in parallel beside it.

## Development

Requires Node 24 and pnpm (version pinned in `package.json`).

```sh
pnpm install     # install dependencies
pnpm dev         # run the app with hot reload
pnpm test        # unit tests (Vitest)
pnpm test:e2e    # build and run end-to-end tests (Playwright)
pnpm lint        # ESLint + dependency-cruiser
```
