---
name: Imported project setup
description: Imported artifacts may have metadata on disk without appearing in the artifact registry; a direct workflow can still serve and validate the app.
---

When an imported web project contains a valid artifact manifest but the artifact registry is empty, do not duplicate or recreate the app. Use the existing package scripts and configure the smallest frontend workflow needed; validate through the running port if preview registration is unavailable.

**Why:** The imported AeroRescue project served successfully through its Vite workflow even though registry-based artifact preview lookup was unavailable.

**How to apply:** Prefer the existing artifact service metadata when the platform recognizes it; otherwise use a minimal `Start application` workflow with the app's required `PORT` and `BASE_PATH`.

Imported PNPM workspaces can also arrive with a lockfile but without installed `node_modules`; restore the locked dependency tree before diagnosing a missing executable as a code problem.

**Why:** The imported app's workflow initially failed only because Vite was absent, and `pnpm install --frozen-lockfile` restored the existing workspace without changing dependency versions.

**How to apply:** Use the lockfile-preserving install path first, then restart the existing workflow and inspect its logs.

For imported static web deployments, do not make a Vite development middleware the only path to user-facing documents. External document viewers or a production server route must be the primary path, with development middleware kept as fallback.

**Why:** Development-only Vite middleware is not included when the artifact is served as static files, which can make embedded documents work locally but fail in the published/mobile experience.

**How to apply:** When an imported app embeds remote PDFs or similar files, verify the production-safe URL separately from any local proxy before considering the material flow complete.