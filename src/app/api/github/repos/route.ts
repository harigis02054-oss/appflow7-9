import { NextResponse } from "next/server";
import {
  listRepositories,
  GitHubNotConfiguredError,
  GitHubApiError,
} from "@/lib/github/client";

export async function GET() {
  try {
    const repos = await listRepositories();
    return NextResponse.json({
      repositories: repos.map((r) => ({
        id: r.full_name,
        owner: r.owner.login,
        name: r.name,
        defaultBranch: r.default_branch,
        private: r.private,
        htmlUrl: r.html_url,
        updatedAt: r.updated_at,
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
      { error: "Unexpected error listing repositories" },
      { status: 500 }
    );
  }
}
