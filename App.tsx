
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppStep, MerchantConfig, GarmentType, BodyType, UsageStats, Outfit } from './types';
import { 
  getUserPhotoSession, 
  saveUserPhotoSession, 
  clearUserPhotoSession, 
  getRemainingTime, 
  saveOutfitToSession, 
  getSavedOutfitsSession,
  removeOutfitFromSession
} from './utils/sessionManager';
import { generateAdvancedTryOn, classifyImages } from './services/geminiService';
import PrivacyNotice from './components/PrivacyNotice';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD_USER_PHOTO);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [clothingPhoto, setClothingPhoto] = useState<string | null>(null);
  const [resultPhoto, setResultPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  
  // Outfit Persistence
  const [savedOutfits, setSavedOutfits] = useState<Outfit[]>([]);
  const [isSavingOutfit, setIsSavingOutfit] = useState(false);
  const [outfitName, setOutfitName] = useState('');

  // Mix-and-match memory
  const [appliedTop, setAppliedTop] = useState<string | null>(null);
  const [appliedBottom, setAppliedBottom] = useState<string | null>(null);

  const [merchant, setMerchant] = useState<MerchantConfig>({
    siteId: 'CLIENT_MVP',
    name: 'Enterprise Mirror',
    domain: window.location.hostname,
    plan: 'enterprise',
    limitReached: false,
    buttonPosition: 'inline',
    usage: { today: 0, total: 0, tops: 0, bottoms: 0, outfits: 0, limit: 1000 }
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productImage = params.get('productImage');
    const token = params.get('token');

    if (token) setMerchant(m => ({ ...m, siteId: token }));

    // Mandatory Iframe Auto-Detection
    if (productImage) {
      loadProductImage(productImage);
    } else {
      window.parent.postMessage({ type: 'VTO_FETCH_PRODUCT' }, '*');
    }

    // Restore Session
    const session = getUserPhotoSession();
    if (session) {
      setUserPhoto(session);
      setTimeLeft(getRemainingTime());
      setSavedOutfits(getSavedOutfitsSession());
    }

    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'VTO_SET_PRODUCT_IMAGE') {
        loadProductImage(e.data.url);
      }
    };
    window.addEventListener('message', handleMsg);
    
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  const loadProductImage = (url: string) => {
    if (!url) {
      setError("No product detected on parent page.");
      return;
    }
    setProcessingStatus('Syncing product asset...');
    fetch(url)
      .then(r => r.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setClothingPhoto(reader.result as string);
          setResultPhoto(null);
          setError(null);
          if (getUserPhotoSession()) {
            setStep(AppStep.READY_TO_TRY);
          }
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        setError("Cross-origin restriction: Mirror cannot sync image from host. Check store policy.");
        setStep(AppStep.UPLOAD_USER_PHOTO);
      });
  };

  useEffect(() => {
    if (!userPhoto) return;
    const interval = setInterval(() => {
      const remaining = getRemainingTime();
      if (remaining <= 0) {
        handleReset();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [userPhoto]);

  const handleReset = () => {
    setUserPhoto(null);
    setClothingPhoto(null);
    setResultPhoto(null);
    setAppliedTop(null);
    setAppliedBottom(null);
    setSavedOutfits([]);
    clearUserPhotoSession();
    setStep(AppStep.UPLOAD_USER_PHOTO);
    setError(null);
    window.parent.postMessage({ type: 'VTO_FETCH_PRODUCT' }, '*');
  };

  const handleUserPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Invalid file type. Please upload a JPEG or PNG image.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const b64 = reader.result as string;
        setUserPhoto(b64);
        saveUserPhotoSession(b64);
        setTimeLeft(getRemainingTime());
        setStep(AppStep.READY_TO_TRY);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const startTryOn = async () => {
    if (!userPhoto || !clothingPhoto) {
      setError("Mirror context incomplete. Try refreshing.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setStep(AppStep.PROCESSING);

    try {
      setProcessingStatus('Analyzing framing...');
      const { garmentType, bodyType, hasModel, confidenceScore } = await classifyImages(userPhoto, clothingPhoto);

      if (confidenceScore < 0.3) {
        throw new Error("Confidence Check: This product image is too low quality or complex. Try another product.");
      }

      if ((garmentType === 'bottom' || garmentType === 'full-outfit') && bodyType !== 'full-body') {
        throw new Error("Fitting Rule: Full outfits and pants require a full-body photo (head to toe).");
      }
      
      if (garmentType === 'top' && bodyType === 'lower-body') {
        throw new Error("Fitting Rule: Tops require an upper-body or full-body photo.");
      }

      setProcessingStatus(`Digital Tailoring: ${garmentType.toUpperCase()}...`);
      const result = await generateAdvancedTryOn(
        userPhoto,
        clothingPhoto,
        garmentType,
        hasModel,
        appliedTop || undefined,
        appliedBottom || undefined
      );

      if (garmentType === 'top') setAppliedTop(clothingPhoto);
      else if (garmentType === 'bottom') setAppliedBottom(clothingPhoto);
      else {
        setAppliedTop(null);
        setAppliedBottom(null);
      }

      setResultPhoto(result);
      setStep(AppStep.RESULT);

    } catch (err: any) {
      setError(err.message || "Fitting Room Error: Unable to align garments correctly.");
      setStep(AppStep.READY_TO_TRY);
    } finally {
      setIsLoading(false);
      setProcessingStatus('');
    }
  };

  const handleSaveOutfit = () => {
    if (!resultPhoto || !outfitName.trim()) return;

    const newOutfit: Outfit = {
      id: Math.random().toString(36).substr(2, 9),
      name: outfitName.trim(),
      photoBase64: resultPhoto,
      timestamp: Date.now()
    };

    saveOutfitToSession(newOutfit);
    setSavedOutfits(prev => [...prev, newOutfit]);
    setIsSavingOutfit(false);
    setOutfitName('');
  };

  const handleDeleteOutfit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeOutfitFromSession(id);
    setSavedOutfits(prev => prev.filter(o => o.id !== id));
  };

  const handleRecallOutfit = (outfit: Outfit) => {
    setResultPhoto(outfit.photoBase64);
    setStep(AppStep.RESULT);
  };

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen w-full bg-white flex flex-col overflow-hidden font-sans">
      <header className="px-6 py-4 border-b flex justify-between items-center bg-white z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-black animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Smart Mirror Live</span>
        </div>
        
        <div className="flex items-center gap-6">
          {userPhoto && (
            <>
              <button 
                onClick={() => setStep(AppStep.WARDROBE)}
                className="flex items-center gap-2 text-[10px] font-black text-black uppercase tracking-[0.1em]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Wardrobe ({savedOutfits.length})
              </button>
              <div className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest bg-zinc-50 px-3 py-1 rounded-md border border-zinc-100">
                {formatTime(timeLeft)}
              </div>
              <button onClick={handleReset} className="text-[9px] font-black text-black uppercase tracking-[0.1em] border-b-2 border-black pb-0.5">Reset</button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative bg-[#FAFAFA]">
        {step === AppStep.UPLOAD_USER_PHOTO && (
          <div className="h-full flex flex-col items-center justify-center p-10 space-y-12 bg-white">
             <div className="text-center space-y-4 max-w-sm">
              <h1 className="text-4xl font-black text-black tracking-tighter uppercase italic leading-none">Virtual Clothing Try-On</h1>
              <p className="text-sm text-zinc-500 font-medium leading-relaxed">
                Upload a <strong>full-body photo</strong> to preview any product the store tagged with a Try-On button.
              </p>
            </div>
            
            <div className="w-full max-w-sm grid grid-cols-1 gap-4 text-left">
              {[
                '1) Store adds the embed script and every product image gets a Try-On button.',
                '2) Shoppers tap Try-On and upload a quick photo.',
                '3) The selected outfit is rendered on their photo in seconds.'
              ].map((stepText) => (
                <div key={stepText} className="flex items-start gap-3 text-[11px] text-zinc-500 font-semibold uppercase tracking-widest">
                  <span className="mt-1 h-2 w-2 rounded-full bg-black"></span>
                  <span className="leading-relaxed">{stepText}</span>
                </div>
              ))}
            </div>
            
            <div className="w-full max-w-xs space-y-4">
               <label className="w-full h-16 bg-black text-white rounded-none font-black text-xs uppercase tracking-[0.25em] flex items-center justify-center cursor-pointer hover:bg-zinc-900 transition-all shadow-xl active:scale-95">
                <span>Upload Profile</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleUserPhotoUpload} />
              </label>
              {error && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest text-center animate-pulse">{error}</p>}
            </div>

            <PrivacyNotice />
          </div>
        )}

        {step === AppStep.READY_TO_TRY && (
          <div className="h-full p-8 flex flex-col items-center space-y-10 overflow-y-auto custom-scroll animate-in fade-in">
            <div className="w-full max-w-2xl grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Identity Scan</span>
                <div className="aspect-[3/4] bg-white rounded-[2.5rem] overflow-hidden border border-zinc-100 shadow-sm relative group cursor-pointer" onClick={() => handleReset()}>
                  <img src={userPhoto!} className="w-full h-full object-cover" alt="User" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">Update Photo</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Selected Garment</span>
                <div className="aspect-[3/4] bg-white rounded-[2.5rem] overflow-hidden border border-zinc-100 p-8 flex items-center justify-center shadow-sm relative">
                  {clothingPhoto ? (
                    <img src={clothingPhoto} className="max-w-full max-h-full object-contain mix-blend-multiply" alt="Garment" />
                  ) : (
                    <div className="text-center opacity-30">
                      <p className="text-[9px] font-black uppercase tracking-widest animate-pulse">Waiting for product image...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.3em]">
              Your photo stays in this session and is cleared automatically.
            </p>

            {error && (
              <div className="p-5 bg-red-50 text-[10px] font-bold text-red-600 uppercase tracking-widest border border-red-100 max-w-sm text-center rounded-2xl animate-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <button 
              onClick={startTryOn} 
              disabled={!clothingPhoto || isLoading}
              className="w-full max-w-xs h-16 bg-black text-white font-black text-xs uppercase tracking-[0.3em] disabled:bg-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all active:scale-95"
            >
              Start Fitting
            </button>
          </div>
        )}

        {step === AppStep.PROCESSING && (
          <div className="h-full flex flex-col items-center justify-center p-12 text-center animate-in fade-in bg-white">
            <div className="w-20 h-20 mb-12 relative">
               <div className="absolute inset-0 border-4 border-zinc-50 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-t-black rounded-full animate-spin"></div>
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-black uppercase italic tracking-tighter animate-pulse">Mirror Rendering</h3>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.25em]">{processingStatus}</p>
            </div>
          </div>
        )}

        {step === AppStep.RESULT && (
          <div className="h-full flex flex-col animate-in fade-in">
            <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
              <div className="w-full max-w-md aspect-[3/4] bg-white rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] overflow-hidden border-[15px] border-white relative group">
                <img src={resultPhoto!} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Result" />
                <div className="absolute bottom-8 left-8 px-5 py-2.5 bg-black/10 backdrop-blur-3xl border border-white/20 rounded-full">
                  <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">FITTED MIRROR V3</span>
                </div>
              </div>
            </div>
            
            <div className="p-12 border-t border-zinc-100 flex flex-col items-center space-y-8 bg-white shrink-0 shadow-2xl">
              <div className="flex flex-col gap-4 w-full max-w-sm">
                {!isSavingOutfit ? (
                   <button 
                    onClick={() => setIsSavingOutfit(true)} 
                    className="w-full h-16 bg-zinc-50 border border-zinc-200 font-black text-[10px] uppercase tracking-widest hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Save as Outfit
                  </button>
                ) : (
                  <div className="w-full space-y-2 animate-in slide-in-from-bottom-2">
                    <input 
                      type="text" 
                      placeholder="Name this look..." 
                      className="w-full h-14 border border-black px-4 font-black text-[10px] uppercase tracking-widest outline-none"
                      value={outfitName}
                      onChange={(e) => setOutfitName(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsSavingOutfit(false)}
                        className="flex-1 h-12 border border-zinc-200 font-black text-[10px] uppercase tracking-widest"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveOutfit}
                        className="flex-1 h-12 bg-black text-white font-black text-[10px] uppercase tracking-widest"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <button 
                    onClick={() => { const a = document.createElement('a'); a.href = resultPhoto!; a.download = 'tryon-result.png'; a.click(); }} 
                    className="flex-1 h-16 border border-zinc-200 font-black text-[10px] uppercase tracking-widest hover:bg-zinc-50 transition-colors"
                  >
                    Download
                  </button>
                  <button 
                    onClick={() => setStep(AppStep.READY_TO_TRY)} 
                    className="flex-1 h-16 bg-black text-white font-black text-[10px] uppercase tracking-widest hover:bg-zinc-900 transition-colors"
                  >
                    Try More
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === AppStep.WARDROBE && (
          <div className="h-full flex flex-col bg-white animate-in slide-in-from-right-10">
            <div className="px-8 py-10 flex justify-between items-center border-b">
               <h2 className="text-3xl font-black uppercase italic tracking-tighter">My Wardrobe</h2>
               <button onClick={() => setStep(resultPhoto ? AppStep.RESULT : AppStep.READY_TO_TRY)} className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Back</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scroll">
              {savedOutfits.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                   <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                   <p className="mt-4 font-black uppercase text-xs tracking-widest">No outfits saved yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  {savedOutfits.map(outfit => (
                    <div 
                      key={outfit.id} 
                      className="group cursor-pointer space-y-3"
                      onClick={() => handleRecallOutfit(outfit)}
                    >
                      <div className="aspect-[3/4] bg-zinc-50 rounded-[2rem] overflow-hidden border border-zinc-100 shadow-sm relative transition-all group-hover:shadow-md group-hover:-translate-y-1">
                        <img src={outfit.photoBase64} className="w-full h-full object-cover" alt={outfit.name} />
                        <button 
                          onClick={(e) => handleDeleteOutfit(outfit.id, e)}
                          className="absolute top-4 right-4 w-8 h-8 bg-black/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/40"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                      <div className="px-2">
                        <p className="text-[10px] font-black uppercase tracking-widest truncate">{outfit.name}</p>
                        <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest">{new Date(outfit.timestamp).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
