import { NextRequest, NextResponse } from "next/server";
import {
  getCommits,
  GitHubNotConfiguredError,
  GitHubApiError,
} from "@/lib/github/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;
  const branch = request.nextUrl.searchParams.get("branch") ?? "main";
  try {
    const commits = await getCommits(owner, repo, branch);
    return NextResponse.json({
      commits: commits.map((c) => ({
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: c.commit.message.split("\n")[0],
        author: c.commit.author.name,
        date: c.commit.author.date,
        url: c.html_url,
      })),
    });
  } catch (err) {
    if (err instanceof GitHubNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 501 });
    }
    if (err instanceof GitHubApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json(
      { error: "Unexpected error listing commits" },
      { status: 500 }
    );
  }
}
