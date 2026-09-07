import { NextResponse } from "next/server";
import { getKeystoreConfig } from "@/lib/build/signing";
import fs from "fs";

/**
 * Returns non-sensitive signing configuration status.
 * Never leaks server disk paths or unmasked secrets (Finding #1).
 */
export async function GET() {
  const config = getKeystoreConfig();
  const keystorePresent = Boolean(
    config.storeFilePath && fs.existsSync(config.storeFilePath)
  );

  const keyAliasMasked = config.keyAlias
    ? config.keyAlias.length <= 3
      ? "***"
      : `${config.keyAlias.slice(0, 2)}***`
    : null;

  return NextResponse.json({
    configured: config.configured,
    keystorePresent,
    keyAliasMasked,
  });
}
