
export type AppMode = 'online' | 'offline';

export type GarmentType = 'top' | 'bottom' | 'full-outfit' | 'unknown';
export type BodyType = 'upper-body' | 'lower-body' | 'full-body' | 'unknown';
export type ButtonPosition = 'inline' | 'floating-bottom-right' | 'floating-bottom-left';

export interface Outfit {
  id: string;
  name: string;
  photoBase64: string;
  timestamp: number;
}

export interface UserSession {
  photoBase64: string;
  timestamp: number;
  lastBodyType?: BodyType;
  appliedTop?: string; // base64 of the garment image
  appliedBottom?: string; // base64 of the garment image
  outfits?: Outfit[];
}

export interface UsageStats {
  today: number;
  total: number;
  tops: number;
  bottoms: number;
  outfits: number;
  limit: number;
}

export interface MerchantConfig {
  siteId: string;
  name: string;
  domain: string;
  plan: 'free' | 'pro' | 'enterprise';
  limitReached: boolean;
  buttonPosition: ButtonPosition;
  usage: UsageStats;
}

export enum AppStep {
  UPLOAD_USER_PHOTO,
  READY_TO_TRY,
  PROCESSING,
  RESULT,
  LIMIT_REACHED,
  ADMIN,
  WARDROBE
}

export interface TryOnRequest {
  userPhoto: string;
  garmentPhoto: string;
  garmentType: GarmentType;
  previousTop?: string;
  previousBottom?: string;
}
