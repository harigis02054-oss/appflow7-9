import { NextResponse } from "next/server";
import {
  getBranches,
  GitHubNotConfiguredError,
  GitHubApiError,
} from "@/lib/github/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;
  try {
    const branches = await getBranches(owner, repo);
    return NextResponse.json({
      branches: branches.map((b) => ({ name: b.name, sha: b.commit.sha })),
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
      { error: "Unexpected error listing branches" },
      { status: 500 }
    );
  }
}
