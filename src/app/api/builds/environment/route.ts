import { NextResponse } from "next/server";
import { inspectSystemToolchain } from "@/lib/build/preflight";

export async function GET() {
  try {
    const status = inspectSystemToolchain();
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to inspect system toolchain", details: String(err) },
      { status: 500 }
    );
  }
}
