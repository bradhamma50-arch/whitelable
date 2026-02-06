
import { UserSession, Outfit } from '../types';

const SESSION_KEY = 'vto_user_session';
const EXPIRY_TIME_MS = 10 * 60 * 1000; // 10 minutes

export const saveUserPhotoSession = (photoBase64: string) => {
  const stored = localStorage.getItem(SESSION_KEY);
  let outfits: Outfit[] = [];
  if (stored) {
    try {
      const existing = JSON.parse(stored);
      outfits = existing.outfits || [];
    } catch (e) {}
  }

  const session: UserSession = {
    photoBase64,
    timestamp: Date.now(),
    outfits
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const saveOutfitToSession = (outfit: Outfit) => {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return;

  try {
    const session: UserSession = JSON.parse(stored);
    if (!session.outfits) session.outfits = [];
    session.outfits.push(outfit);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error("Failed to save outfit", e);
  }
};

export const removeOutfitFromSession = (outfitId: string) => {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return;

  try {
    const session: UserSession = JSON.parse(stored);
    if (session.outfits) {
      session.outfits = session.outfits.filter(o => o.id !== outfitId);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch (e) {}
};

export const getUserPhotoSession = (): string | null => {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return null;

  try {
    const session: UserSession = JSON.parse(stored);
    const now = Date.now();
    
    if (now - session.timestamp > EXPIRY_TIME_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    
    return session.photoBase64;
  } catch (e) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

export const getSavedOutfitsSession = (): Outfit[] => {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return [];

  try {
    const session: UserSession = JSON.parse(stored);
    return session.outfits || [];
  } catch (e) {
    return [];
  }
};

export const clearUserPhotoSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const getRemainingTime = (): number => {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return 0;
  
  try {
    const session: UserSession = JSON.parse(stored);
    const elapsed = Date.now() - session.timestamp;
    return Math.max(0, EXPIRY_TIME_MS - elapsed);
  } catch (e) {
    return 0;
  }
};
