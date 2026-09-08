import { NextRequest, NextResponse } from "next/server";
import { getReleaseChanges } from "@/lib/github/changes";
import { isGitHubConfigured } from "@/lib/github/client";
import { listReleases } from "@/lib/release/store";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isGitHubConfigured()) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN is not configured on the server." },
      { status: 503 }
    );
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo");
    let base = searchParams.get("base");
    const head = searchParams.get("head");

    if (!repo) {
      return NextResponse.json(
        { error: "Missing required 'repo' query parameter (e.g. 'owner/repo')." },
        { status: 400 }
      );
    }

    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName) {
      return NextResponse.json({ error: "Invalid repo format. Expected 'owner/repo'." }, { status: 400 });
    }

    // Auto-detect previous release commit if base is not explicitly provided
    if (!base) {
      const appReleases = listReleases(id).filter((r) => r.commitSha);
      if (appReleases.length >= 2) {
        base = appReleases[1].commitSha!;
      }
    }

    if (!base || !head) {
      return NextResponse.json({
        summaryText: "Initial release (no previous commit to compare).",
        totalFilesChanged: 0,
        files: [],
        changelogNotes: "Initial release baseline.",
      });
    }

    const changes = await getReleaseChanges(owner, repoName, base, head);
    if (!changes) {
      return NextResponse.json({
        summaryText: `Compared ${base.slice(0, 7)}...${head.slice(0, 7)}`,
        totalFilesChanged: 0,
        files: [],
        changelogNotes: "No changes detected between commits.",
      });
    }

    return NextResponse.json(changes);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
