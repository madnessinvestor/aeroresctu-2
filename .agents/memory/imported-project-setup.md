---
name: Imported project setup
description: Imported artifacts may have metadata on disk without appearing in the artifact registry; a direct workflow can still serve and validate the app.
---

When an imported web project contains a valid artifact manifest but the artifact registry is empty, do not duplicate or recreate the app. Use the existing package scripts and configure the smallest frontend workflow needed; validate through the running port if preview registration is unavailable.

**Why:** The imported AeroRescue project served successfully through its Vite workflow even though registry-based artifact preview lookup was unavailable.

**How to apply:** Prefer the existing artifact service metadata when the platform recognizes it; otherwise use a minimal `Start application` workflow with the app's required `PORT` and `BASE_PATH`.