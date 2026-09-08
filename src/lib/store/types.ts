export interface GooglePlayMetadata {
  title: string; // max 30 chars
  shortDescription: string; // max 80 chars
  fullDescription: string; // max 4000 chars
  releaseNotes?: string; // max 500 chars
  category?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
  privacyPolicyUrl?: string;
}

export interface AppleAppStoreMetadata {
  name: string; // max 30 chars
  subtitle?: string; // max 30 chars
  description: string; // max 4000 chars
  keywords?: string; // comma-separated, max 100 chars
  releaseNotes?: string; // What's new in this version
  primaryCategory?: string;
  secondaryCategory?: string;
  supportUrl?: string;
  marketingUrl?: string;
  privacyPolicyUrl?: string;
  copyright?: string;
}

export interface StoreAssetItem {
  id: string;
  type: "icon" | "feature-graphic" | "screenshot-phone" | "screenshot-tablet" | "screenshot-ipad";
  platform: "android" | "ios" | "universal";
  url?: string;
  fileName?: string;
  width?: number;
  height?: number;
  uploadedAt?: string;
}

export interface AppStoreListingRecord {
  appId: string;
  googlePlay: GooglePlayMetadata;
  apple: AppleAppStoreMetadata;
  assets: StoreAssetItem[];
  status: "draft" | "review-ready" | "submitted";
  updatedAt: string;
}

export interface StoreValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
  warnings: { field: string; message: string }[];
}
