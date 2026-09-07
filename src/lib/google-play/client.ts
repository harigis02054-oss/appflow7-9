import fs from "fs";
import crypto from "crypto";

export interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain?: string;
}

const ANDROID_PUBLISHER_API = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const ANDROID_PUBLISHER_UPLOAD_API =
  "https://androidpublisher.googleapis.com/upload/androidpublisher/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

// In-memory token cache
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export class GooglePlayError extends Error {
  status?: number;
  details?: unknown;
  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "GooglePlayError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Loads and parses the Google service account from env or file path.
 */
export function getServiceAccount(): ServiceAccountKey | null {
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonStr && jsonStr.trim()) {
    try {
      return JSON.parse(jsonStr.trim()) as ServiceAccountKey;
    } catch {
      // Failed to parse string, continue to check path
    }
  }

  const jsonPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;
  if (jsonPath && fs.existsSync(jsonPath.trim())) {
    try {
      const raw = fs.readFileSync(jsonPath.trim(), "utf-8");
      return JSON.parse(raw) as ServiceAccountKey;
    } catch {
      return null;
    }
  }

  return null;
}

export function isGooglePlayConfigured(): boolean {
  return getServiceAccount() !== null;
}

/**
 * Acquires a Google OAuth2 access token for the Android Publisher API using RS256 JWT.
 */
export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.accessToken;
  }

  const sa = getServiceAccount();
  if (!sa) {
    throw new GooglePlayError(
      "Google Play service account is not configured. Add GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_JSON_PATH to .env.local"
    );
  }

  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url");

  const payload = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: GOOGLE_AUTH_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(sa.private_key, "base64url");
  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new GooglePlayError(
      `Google OAuth token exchange failed: ${data.error_description || data.error || res.statusText}`,
      res.status,
      data
    );
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in || 3600),
  };

  return data.access_token;
}

/**
 * Tests live connection and authentication against Google OAuth2.
 */
export async function verifyGooglePlayAuth(): Promise<{
  valid: boolean;
  clientEmail?: string;
  projectId?: string;
  error?: string;
}> {
  const sa = getServiceAccount();
  if (!sa) {
    return { valid: false, error: "No service account configured" };
  }

  try {
    await getAccessToken();
    return {
      valid: true,
      clientEmail: sa.client_email,
      projectId: sa.project_id,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      clientEmail: sa.client_email,
      projectId: sa.project_id,
      error: msg,
    };
  }
}

interface PlayApiResponse {
  id?: string;
  versionCode?: number;
  tracks?: PlayTrack[];
  error?: {
    message?: string;
    code?: number;
  };
}

/**
 * Creates a new edit session for the app.
 */
async function createEdit(packageName: string, token: string): Promise<string> {
  const res = await fetch(
    `${ANDROID_PUBLISHER_API}/applications/${encodeURIComponent(packageName)}/edits`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const text = await res.text();
  let data: PlayApiResponse;
  try {
    data = JSON.parse(text) as PlayApiResponse;
  } catch {
    throw new GooglePlayError(
      `Google Play API returned non-JSON (${res.status}): ${text.slice(0, 300)}`,
      res.status
    );
  }

  if (!res.ok) {
    throw new GooglePlayError(
      data.error?.message || `Failed to create edit for ${packageName}`,
      res.status,
      data
    );
  }

  return data.id;
}

/**
 * Discards an existing edit session.
 */
async function deleteEdit(
  packageName: string,
  editId: string,
  token: string
): Promise<void> {
  try {
    await fetch(
      `${ANDROID_PUBLISHER_API}/applications/${encodeURIComponent(packageName)}/edits/${editId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  } catch {
    // Non-critical cleanup
  }
}

/**
 * Verifies if the service account has access to the specified Android package.
 */
export async function verifyAppAccess(packageName: string): Promise<{
  accessible: boolean;
  message: string;
  details?: unknown;
}> {
  try {
    const token = await getAccessToken();
    const editId = await createEdit(packageName, token);
    await deleteEdit(packageName, editId, token);
    return {
      accessible: true,
      message: `Successfully connected to Google Play for ${packageName}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      accessible: false,
      message: msg,
      details: err instanceof GooglePlayError ? err.details : undefined,
    };
  }
}

export interface PlayTrackRelease {
  name?: string;
  versionCodes?: string[];
  status: string;
}

export interface PlayTrack {
  track: string;
  releases?: PlayTrackRelease[];
}

/**
 * Lists tracks (internal, alpha, beta, production) for an app.
 */
export async function listTracks(packageName: string): Promise<PlayTrack[]> {
  const token = await getAccessToken();
  const editId = await createEdit(packageName, token);

  try {
    const res = await fetch(
      `${ANDROID_PUBLISHER_API}/applications/${encodeURIComponent(packageName)}/edits/${editId}/tracks`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await res.json();
    if (!res.ok) {
      throw new GooglePlayError(
        data.error?.message || `Failed to list tracks for ${packageName}`,
        res.status,
        data
      );
    }

    return (data.tracks || []) as PlayTrack[];
  } finally {
    await deleteEdit(packageName, editId, token);
  }
}

/**
 * Uploads an Android App Bundle (.aab) and publishes it to the specified track.
 */
export async function publishBundle(params: {
  packageName: string;
  track: "internal-testing" | "closed-testing" | "production" | string;
  bundleBuffer: Buffer;
  releaseNotes?: string;
}): Promise<{
  success: boolean;
  versionCode: number;
  editId: string;
  track: string;
}> {
  const { packageName, track, bundleBuffer, releaseNotes } = params;
  const token = await getAccessToken();

  // Map AppFlow track names to Google Play track names
  const playTrack =
    track === "internal-testing"
      ? "internal"
      : track === "closed-testing"
      ? "alpha"
      : track === "production"
      ? "production"
      : track;

  // 1. Create edit
  const editId = await createEdit(packageName, token);

  try {
    // 2. Upload bundle using Google Resumable Upload protocol (required for AABs > 5MB)
    const sessionUrl = `${ANDROID_PUBLISHER_UPLOAD_API}/applications/${encodeURIComponent(
      packageName
    )}/edits/${editId}/bundles?uploadType=resumable`;

    const initRes = await fetch(sessionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Upload-Content-Type": "application/octet-stream",
        "X-Upload-Content-Length": String(bundleBuffer.length),
      },
    });

    if (!initRes.ok) {
      const initErr = await initRes.text();
      throw new GooglePlayError(
        `Failed to initiate resumable upload session (${initRes.status}): ${initErr}`,
        initRes.status
      );
    }

    const uploadUri = initRes.headers.get("location");
    if (!uploadUri) {
      throw new GooglePlayError("Missing resumable upload session location header from Google Play", 500);
    }

    const uploadRes = await fetch(uploadUri, {
      method: "PUT",
      headers: {
        "Content-Length": String(bundleBuffer.length),
        "Content-Type": "application/octet-stream",
      },
      body: bundleBuffer,
    });

    const uploadText = await uploadRes.text();
    let uploadData: PlayApiResponse;
    try {
      uploadData = JSON.parse(uploadText) as PlayApiResponse;
    } catch {
      throw new GooglePlayError(
        `Invalid upload response from Google Play (${uploadRes.status}): ${uploadText.slice(0, 300)}`,
        uploadRes.status
      );
    }

    if (!uploadRes.ok) {
      throw new GooglePlayError(
        uploadData.error?.message || "Failed to upload App Bundle to Google Play",
        uploadRes.status,
        uploadData
      );
    }

    const versionCode = uploadData.versionCode;

    // 3. Update track with the new release
    const trackPayload: {
      track: string;
      releases: Array<{
        versionCodes: string[];
        status: string;
        releaseNotes?: Array<{ language: string; text: string }>;
      }>;
    } = {
      track: playTrack,
      releases: [
        {
          versionCodes: [String(versionCode)],
          status: "completed",
          ...(releaseNotes
            ? {
                releaseNotes: [
                  {
                    language: "en-US",
                    text: releaseNotes,
                  },
                ],
              }
            : {}),
        },
      ],
    };

    const trackRes = await fetch(
      `${ANDROID_PUBLISHER_API}/applications/${encodeURIComponent(
        packageName
      )}/edits/${editId}/tracks/${playTrack}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(trackPayload),
      }
    );

    const trackText = await trackRes.text();
    let trackData: PlayApiResponse;
    try {
      trackData = JSON.parse(trackText) as PlayApiResponse;
    } catch {
      throw new GooglePlayError(
        `Track update returned non-JSON (${trackRes.status}): ${trackText.slice(0, 300)}`,
        trackRes.status
      );
    }

    if (!trackRes.ok) {
      throw new GooglePlayError(
        trackData.error?.message || `Failed to update track ${playTrack}`,
        trackRes.status,
        trackData
      );
    }

    // 4. Commit edit (Google Play requires :commit with a colon, not /commit)
    const commitRes = await fetch(
      `${ANDROID_PUBLISHER_API}/applications/${encodeURIComponent(
        packageName
      )}/edits/${editId}:commit`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const commitText = await commitRes.text();
    let commitData: PlayApiResponse;
    try {
      commitData = JSON.parse(commitText) as PlayApiResponse;
    } catch {
      throw new GooglePlayError(
        `Commit returned non-JSON (${commitRes.status}): ${commitText.slice(0, 300)}`,
        commitRes.status
      );
    }

    if (!commitRes.ok) {
      throw new GooglePlayError(
        commitData.error?.message || "Failed to commit Google Play edit",
        commitRes.status,
        commitData
      );
    }

    return {
      success: true,
      versionCode: Number(versionCode),
      editId,
      track: playTrack,
    };
  } catch (err) {
    await deleteEdit(packageName, editId, token);
    throw err;
  }
}
