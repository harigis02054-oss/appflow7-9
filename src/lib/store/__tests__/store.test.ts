import { describe, it, expect } from "vitest";
import {
  validateStoreMetadata,
  getDefaultStoreListing,
  saveStoreListing,
  getStoreListing,
} from "../store";

describe("Store Listing Metadata & Validation", () => {
  it("enforces Google Play character limits", () => {
    const validListing = getDefaultStoreListing("test-app", "QuickDrop");
    validListing.googlePlay.title = "A".repeat(31); // max 30

    const result = validateStoreMetadata(validListing.googlePlay, validListing.apple);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "googlePlay.title")).toBe(true);
  });

  it("warns when Privacy Policy URL is missing without blocking testing", () => {
    const listing = getDefaultStoreListing("test-app", "QuickDrop");
    listing.googlePlay.privacyPolicyUrl = "";

    const result = validateStoreMetadata(listing.googlePlay, listing.apple);
    expect(result.valid).toBe(true); // Still valid for local/testing
    expect(result.warnings.some((w) => w.field === "googlePlay.privacyPolicyUrl")).toBe(true);
  });

  it("persists and retrieves store listing records", () => {
    const listing = getDefaultStoreListing("persisted-test-app", "PersistedApp");
    listing.googlePlay.shortDescription = "Fast file sharing.";
    saveStoreListing(listing);

    const loaded = getStoreListing("persisted-test-app");
    expect(loaded).not.toBeNull();
    expect(loaded?.googlePlay.shortDescription).toBe("Fast file sharing.");
  });
});
