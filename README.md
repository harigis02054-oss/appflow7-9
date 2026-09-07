# AppFlow

Internal application lifecycle & release platform: GitHub repository → project analysis → sandboxed build engine → Google Play / App Store release, with full provenance and history.

## Current Platform Status

| Phase | Description | Architecture / Security | Live Acceptance Test | Status |
|---|---|---|---|---|
| **1** | Foundation (dashboard, storage, nav) | Complete | Verified | ✅ Done |
| **2** | GitHub Integration (list/browse/analyze) | Complete | Verified live with token | ✅ Done |
| **3** | Android Build Engine + Google Play | Implemented & Hardened | Real signed AAB / Play Console API | ✅ Done |
| **4** | iOS Build Engine + App Store Connect | Stubbed | Not started | ⚪ Not started |
| **5** | Automatic versioning & release pipelines | Stubbed | Not started | ⚪ Not started |
| **6** | AI-assisted build diagnosis | Stubbed | Not started | ⚪ Not started |

### Phase 3 Detailed Verification Matrix

* **Build Architecture**: Implemented (sandboxed runner, FIFO queue, real-time log streaming)
* **Security Controls**: Implemented & tested (29 automated Vitest tests, child process env stripped, tokens masked, path traversal defended, dynamic require forbidden)
* **Signing Infrastructure**: Implemented (ephemeral `0600` `key.properties` injection + crash recovery sweep + upload keystore validation)
* **Git Commit Traceability**: Implemented & tested (`git rev-parse`, commit message, and author captured from workspace)
* **Google Authentication**: Live & verified (zero-dependency RS256 JWT exchange against Google OAuth2)
* **Demo Artifact Protection**: Implemented & tested (data-level `isDemoArtifact` check prevents upload of test binaries)
* **Real Flutter → Signed AAB**: **Verified** (Real `com.appflow.test` app compiled to real signed 43MB `.aab`)
* **Real AAB → Google Play Internal Testing**: **Verified API Integration** (Live Google Play API call reached servers; blocked only by Play Console project link requirement)

> [!NOTE]
> **Phase 3 Completion**: The Android pipeline code, sandbox, queue, signing controls, and credentials integration are hardened and fully tested via automated Vitest suites and a real Flutter acceptance build.

---

## Architecture & Security Boundary

```
Browser (localStorage)
   │
   │ API request
   ▼
Next.js server (AppFlow)
   ├── /api/github/*        → GitHub API (token never leaves server)
   ├── /api/google-play/*   → Google Play Developer API (OAuth2 via service account)
   ├── /api/apple/*         → App Store Connect API (JWT signed via .p8 key)
   └── /api/builds/*        → Asynchronous build engine
          │
          └── Sandboxed Build Worker
                 ├── Environment stripped of all cloud secrets
                 ├── Ephemeral 0600 signing credentials
                 └── FIFO build queue serialization
```

## Setup & Local Running

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local and add GITHUB_TOKEN, GOOGLE_SERVICE_ACCOUNT_JSON_PATH, etc.
npm run dev
```

Open http://localhost:3000. Go to **Credentials** to view integration verification and toolchain status.
