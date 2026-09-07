import { NextRequest, NextResponse } from "next/server";
import { analyzeRepository } from "@/lib/github/detect";
import { GitHubNotConfiguredError, GitHubApiError } from "@/lib/github/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;
  const ref = request.nextUrl.searchParams.get("ref") ?? undefined;

  try {
    const analysis = await analyzeRepository(owner, repo, ref);
    return NextResponse.json({ analysis });
  } catch (err) {
    if (err instanceof GitHubNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    if (err instanceof GitHubApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json(
      { error: "Unexpected error analyzing repository" },
      { status: 500 }
    );
  }
}
