# AppFlow Platform Architecture

## 1. System Overview
AppFlow is an internal developer and release automation platform designed to take mobile applications from GitHub repositories through repository intelligence, configuration verification, version resolution, compilation, distribution-grade signing, artifact validation, store publishing (Google Play & Apple TestFlight), policy readiness gates, and team audit history.

```text
Team Developer / CI Webhook
            ↓
    GitHub Repository
            ↓
  Deep Repository Analysis (detect framework, bundle IDs, required files, permissions)
            ↓
   Release Policy Engine (evaluate Development, Testing, Store Submission, and Production Gates)
            ↓
  Version Management Engine (semver calculation: patch/minor/major/build-only)
            ↓
  Release Orchestrator & State Machine (CREATED → ANALYZING → VALIDATED → BUILDING → BUILT...)
            ↓
    Server Build Engine (FIFO queue, detached process group, sanitized env)
            ↓
   Native Compilation (Flutter / Gradle / SwiftPM / Xcode)
            ↓
Code Signing Infrastructure (Android Keystore / Apple Distribution Keychain)
            ↓
    Artifact Validation (AAB / IPA container checks & SHA-256 checksum)
            ↓
Store Ingest & Processing (Google Play Resumable Upload / Apple xcrun altool)
            ↓
Testing Distribution (Google Internal Testing / TestFlight)
            ↓
    Immutable Audit Log (.builds/releases.json & audit trail)
```

---

## 2. Component Hierarchy
* **Frontend Web Layer**: Next.js 15 App Router with modular TypeScript/Tailwind components.
* **Release Orchestrator**: `src/lib/release/orchestrator.ts` — Asynchronous state machine driving multi-stage releases with cancellation, retry, and idempotency checks.
* **Server Release Store**: `src/lib/release/store.ts` — Server-side persistent storage in `.builds/releases.json` with file-locking and atomic tempfile renaming.
* **Policy & Readiness Engine**: `src/lib/release/policy.ts` — Evaluates the 4 distinct gate levels (`DEVELOPMENT`, `TESTING`, `STORE_SUBMISSION`, `PRODUCTION`), strictly adhering to Rule #2 (missing production metadata never blocks dev/test).
* **Version Management**: `src/lib/release/versioning.ts` — Resolves semver and build numbers without silent overwrites.
* **Repository Intelligence**: `src/lib/github/analyzer.ts` — Inspects repository structure, extracts permissions, and identifies package/bundle ID provenance.
* **Build Engine**: `src/lib/build/engine.ts` — FIFO build worker, credential-stripped child process sandboxing, native compilation, and ephemeral signing injection.
* **Provider Clients**:
  * `src/lib/apple/client.ts`: IEEE P1363 ES256 JWT auth + `xcrun altool` automated validation and upload.
  * `src/lib/google-play/client.ts`: RS256 JWT service account auth + resumable upload protocol.
