import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import crypto from "crypto";
import { getRelease } from "@/lib/release/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const release = getRelease(id);

    if (!release) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    if (!release.artifactPath || !fs.existsSync(release.artifactPath)) {
      return NextResponse.json(
        { message: "Artifact has not been produced yet or is still compiling." },
        { status: 200 }
      );
    }

    const stat = fs.statSync(release.artifactPath);
    let checksum = release.artifactChecksum;

    if (!checksum) {
      const fileBuffer = fs.readFileSync(release.artifactPath);
      checksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    }

    return NextResponse.json({
      releaseId: id,
      artifactId: release.artifactId || release.buildId,
      buildId: release.buildId,
      name: release.artifactName,
      path: release.artifactPath,
      sizeBytes: stat.size,
      sizeMb: (stat.size / (1024 * 1024)).toFixed(2),
      sha256: checksum,
      downloadUrl: release.buildId ? `/api/builds/${release.buildId}/artifact` : null,
      createdAt: release.updatedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
