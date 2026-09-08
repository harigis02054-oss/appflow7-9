# AppFlow Release Flow & Lifecycle

## 1. Release State Machine
AppFlow implements an explicit, non-linear release lifecycle with asynchronous provider states, retry capabilities, and failure branches:

```text
CREATED
   ↓
ANALYZING
   ↓
VALIDATED
   ↓
BUILDING ──(error)──→ FAILED ──(retry)──→ VALIDATED
   ↓
 BUILT
   ↓
 SIGNED
   ↓
 TESTED
   ↓
UPLOADING ──(error)──→ FAILED
   ↓
UPLOADED
   ↓
PROCESSING ──(rejected)──→ FAILED
   ↓
READY_FOR_TESTING
   ↓
 TESTING
   ↓
READY_FOR_REVIEW
   ↓
APPROVED
   ↓
RELEASING
   ↓
RELEASED
```

At any point during execution prior to final publication, a release may be transitioned to `CANCELLED` via `/api/releases/[id]/cancel`, terminating any active child build processes cleanly.

---

## 2. Core Gate Rule: Development vs Testing vs Production
AppFlow separates readiness into 4 distinct gates:

1. **Development Gate**: Requires core compilation files (`pubspec.yaml`, `android/`, `build.gradle`, etc.).
2. **Testing Gate**: Requires valid package/bundle ID. Allows distribution to Internal Testing and TestFlight.
3. **Store Submission Gate**: Warns on missing Privacy Policy URL, store screenshots, and icon assets. Does **not** block testing.
4. **Production Gate**: Requires active Privacy Policy URL, closed testing requirements (e.g. 12 testers / 14 days), and formal team approval before public store release.

---

## 3. Idempotency & Safety Controls
* **Duplicate Prevention**: `checkReleaseIdempotency` checks if an identical release (same app, platform, version, build number) already exists in an active or successful state before starting builds.
* **Child Process Sandboxing**: Child processes execute in a stripped environment where all cloud API keys, tokens, and private material are deleted before execution.
* **Atomic Storage**: Release state is written to a temporary file before atomic renaming to prevent corrupted records on server crash.
