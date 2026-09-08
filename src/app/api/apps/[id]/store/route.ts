import { NextRequest, NextResponse } from "next/server";
import {
  getStoreListing,
  saveStoreListing,
  getDefaultStoreListing,
  validateStoreMetadata,
} from "@/lib/store/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let listing = getStoreListing(id);

    if (!listing) {
      listing = getDefaultStoreListing(id, "My Application");
      saveStoreListing(listing);
    }

    const validation = validateStoreMetadata(listing.googlePlay, listing.apple);

    return NextResponse.json({
      listing,
      validation,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { googlePlay, apple, assets, status } = body;

    if (!googlePlay || !apple) {
      return NextResponse.json(
        { error: "Missing required googlePlay or apple metadata in request body." },
        { status: 400 }
      );
    }

    const validation = validateStoreMetadata(googlePlay, apple);

    const updatedListing = {
      appId: id,
      googlePlay,
      apple,
      assets: assets || [],
      status: status || "draft",
      updatedAt: new Date().toISOString(),
    };

    saveStoreListing(updatedListing);

    return NextResponse.json({
      success: true,
      listing: updatedListing,
      validation,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
