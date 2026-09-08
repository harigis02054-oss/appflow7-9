import { NextRequest, NextResponse } from "next/server";
import { deepAnalyzeRepository } from "@/lib/github/analyzer";
import { isGitHubConfigured } from "@/lib/github/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  if (!isGitHubConfigured()) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN is not configured on the server." },
      { status: 503 }
    );
  }

  try {
    const { owner, repo } = await params;
    const { searchParams } = new URL(request.url);
    const ref = searchParams.get("ref") || undefined;

    const analysis = await deepAnalyzeRepository(owner, repo, ref);
    return NextResponse.json({ analysis });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
