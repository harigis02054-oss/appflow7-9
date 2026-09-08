import fs from "fs";
import path from "path";
import type {
  AppStoreListingRecord,
  GooglePlayMetadata,
  AppleAppStoreMetadata,
  StoreValidationResult,
} from "./types";

const BUILDS_DIR = path.join(process.cwd(), ".builds");
const STORE_LISTINGS_FILE = path.join(BUILDS_DIR, "store_listings.json");

function ensureBuildsDir() {
  if (!fs.existsSync(BUILDS_DIR)) {
    fs.mkdirSync(BUILDS_DIR, { recursive: true });
  }
}

export function listStoreListings(): AppStoreListingRecord[] {
  ensureBuildsDir();
  if (!fs.existsSync(STORE_LISTINGS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(STORE_LISTINGS_FILE, "utf-8");
    return JSON.parse(raw) as AppStoreListingRecord[];
  } catch (err) {
    console.error("[store-listings] Failed to read store_listings.json:", err);
    return [];
  }
}

export function getStoreListing(appId: string): AppStoreListingRecord | null {
  const listings = listStoreListings();
  return listings.find((l) => l.appId === appId) || null;
}

export function getDefaultStoreListing(appId: string, appName: string): AppStoreListingRecord {
  return {
    appId,
    googlePlay: {
      title: appName.slice(0, 30),
      shortDescription: "",
      fullDescription: "",
      releaseNotes: "Initial release.",
      privacyPolicyUrl: "",
    },
    apple: {
      name: appName.slice(0, 30),
      subtitle: "",
      description: "",
      keywords: "",
      releaseNotes: "Initial release.",
      privacyPolicyUrl: "",
      supportUrl: "",
    },
    assets: [],
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
}

export function saveStoreListing(listing: AppStoreListingRecord): void {
  ensureBuildsDir();
  const listings = listStoreListings();
  const idx = listings.findIndex((l) => l.appId === listing.appId);
  if (idx >= 0) {
    listings[idx] = listing;
  } else {
    listings.push(listing);
  }
  const tempFile = `${STORE_LISTINGS_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(listings, null, 2), "utf-8");
  fs.renameSync(tempFile, STORE_LISTINGS_FILE);
}

export function validateStoreMetadata(
  googlePlay: GooglePlayMetadata,
  apple: AppleAppStoreMetadata
): StoreValidationResult {
  const errors: { field: string; message: string }[] = [];
  const warnings: { field: string; message: string }[] = [];

  // Google Play Validation
  if (!googlePlay.title || !googlePlay.title.trim()) {
    errors.push({ field: "googlePlay.title", message: "Google Play App Title is required." });
  } else if (googlePlay.title.length > 30) {
    errors.push({
      field: "googlePlay.title",
      message: `Google Play title exceeds 30 characters (${googlePlay.title.length}/30).`,
    });
  }

  if (googlePlay.shortDescription && googlePlay.shortDescription.length > 80) {
    errors.push({
      field: "googlePlay.shortDescription",
      message: `Google Play short description exceeds 80 characters (${googlePlay.shortDescription.length}/80).`,
    });
  }

  if (googlePlay.fullDescription && googlePlay.fullDescription.length > 4000) {
    errors.push({
      field: "googlePlay.fullDescription",
      message: `Google Play full description exceeds 4000 characters (${googlePlay.fullDescription.length}/4000).`,
    });
  }

  if (!googlePlay.privacyPolicyUrl || !googlePlay.privacyPolicyUrl.trim()) {
    warnings.push({
      field: "googlePlay.privacyPolicyUrl",
      message: "Missing Privacy Policy URL: Required before public production rollout.",
    });
  }

  // Apple App Store Validation
  if (!apple.name || !apple.name.trim()) {
    errors.push({ field: "apple.name", message: "Apple App Store Name is required." });
  } else if (apple.name.length > 30) {
    errors.push({
      field: "apple.name",
      message: `Apple App Store name exceeds 30 characters (${apple.name.length}/30).`,
    });
  }

  if (apple.subtitle && apple.subtitle.length > 30) {
    errors.push({
      field: "apple.subtitle",
      message: `Apple subtitle exceeds 30 characters (${apple.subtitle.length}/30).`,
    });
  }

  if (apple.keywords && apple.keywords.length > 100) {
    errors.push({
      field: "apple.keywords",
      message: `Apple keywords exceed 100 characters (${apple.keywords.length}/100).`,
    });
  }

  if (!apple.supportUrl || !apple.supportUrl.trim()) {
    warnings.push({
      field: "apple.supportUrl",
      message: "Apple App Store requires a Support URL before public store submission.",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
