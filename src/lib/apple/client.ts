import crypto from "crypto";
import fs from "fs";

interface AppleConfig {
  issuerId: string;
  keyId: string;
  privateKey: string;
}

export function getAppleConfig(): AppleConfig | null {
  const issuerId = process.env.APPLE_ISSUER_ID;
  const keyId = process.env.APPLE_KEY_ID;
  let privateKey = process.env.APPLE_PRIVATE_KEY;

  if (!privateKey && process.env.APPLE_PRIVATE_KEY_PATH) {
    try {
      privateKey = fs.readFileSync(process.env.APPLE_PRIVATE_KEY_PATH, "utf8");
    } catch {
      // Ignored: fallback to null
    }
  }

  if (!issuerId || !keyId || !privateKey) {
    return null;
  }

  return { issuerId, keyId, privateKey };
}

function encodeBase64Url(buffer: Buffer | string): string {
  const b = typeof buffer === "string" ? Buffer.from(buffer) : buffer;
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function generateAppleJWT(config: AppleConfig): string {
  const header = {
    alg: "ES256",
    kid: config.keyId,
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.issuerId,
    iat: now,
    exp: now + 10 * 60, // 10 minutes (max 20)
    aud: "appstoreconnect-v1",
  };

  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));

  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  // App Store Connect requires IEEE P1363 (raw r || s) signature encoding, not ASN.1 DER.
  const signature = crypto.sign("SHA256", Buffer.from(dataToSign), {
    key: config.privateKey,
    dsaEncoding: "ieee-p1363",
  });

  const encodedSignature = encodeBase64Url(signature);

  return `${dataToSign}.${encodedSignature}`;
}

export async function verifyAppleConnection(config: AppleConfig): Promise<{ valid: boolean; error?: string; issuerIdMasked?: string }> {
  const issuerIdMasked = config.issuerId ? `${config.issuerId.slice(0, 8)}...` : undefined;
  try {
    const token = generateAppleJWT(config);
    const res = await fetch("https://api.appstoreconnect.apple.com/v1/apps?limit=1", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      let errorMsg = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(text);
        if (parsed.errors && parsed.errors[0]) {
          errorMsg = parsed.errors[0].detail || parsed.errors[0].title || errorMsg;
        }
      } catch {
        // fallback
      }
      return { valid: false, error: errorMsg, issuerIdMasked };
    }
    return { valid: true, issuerIdMasked };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Connection error",
      issuerIdMasked,
    };
  }
}

