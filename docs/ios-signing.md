# iOS Signing and TestFlight Deployment in AppFlow

This document outlines the strategy used by AppFlow to securely compile iOS applications and interact with the App Store Connect API.

## Code Signing Approach

Unlike Android, which uses a self-contained `.jks` keystore and `key.properties` for code signing, iOS requires a complex interplay of Certificates, Provisioning Profiles, and the macOS Keychain.

### 1. App Store Connect Authentication
To communicate with the App Store Connect API (for listing apps, creating TestFlight builds, checking status), AppFlow uses a **Custom JWT** signed with an App Store Connect API Private Key (`.p8` file).

**Requirements for the JWT:**
- **Algorithm:** ES256 (Elliptic Curve `prime256v1`)
- **Headers:** Needs `alg: "ES256"`, `kid` (Key ID), and `typ: "JWT"`
- **Payload:** Needs `iss` (Issuer ID), `exp` (Expiration, max 20 minutes from issue), and `aud: "appstoreconnect-v1"`
- **Signature Encoding:** Must be **IEEE P1363** format (`r || s`), **not** ASN.1/DER. Apple's servers will reject standard ASN.1 signatures.

### 2. iOS Compilation Strategy
AppFlow does not aim to reinvent Fastlane. Instead, we use standard Apple tools:

1. **`xcodebuild archive`**: Generates a `.xcarchive` from the Flutter-generated Xcode project.
2. **`xcodebuild -exportArchive`**: Uses an `ExportOptions.plist` to convert the `.xcarchive` into a signed `.ipa` file.

**Important Host Requirements:**
The Mac running AppFlow **must** have:
- Xcode installed.
- CocoaPods installed (often via `brew install cocoapods` or `gem install cocoapods`).
- The necessary Apple Distribution Certificates and Provisioning Profiles installed in the login keychain of the user running AppFlow.

AppFlow relies on Xcode's "Automatically manage signing" or the existing `ios/Runner.xcodeproj` configuration to find these profiles locally.

### 3. API Key Management
For AppFlow to authenticate, you must provide:
- `APPLE_ISSUER_ID`: Your team's Issuer ID.
- `APPLE_KEY_ID`: The specific `.p8` key identifier.
- `APPLE_PRIVATE_KEY_PATH` (or `APPLE_PRIVATE_KEY`): The contents or absolute path to the `.p8` file.

These are stored exclusively on the server in `.env.local` and are never exposed to the client.
