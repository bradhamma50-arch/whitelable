
import React from 'react';

const PrivacyNotice: React.FC = () => {
  return (
    <div className="mt-8 p-5 bg-zinc-50/50 border border-zinc-100 rounded-[1.5rem] text-[11px] text-zinc-400 font-medium leading-relaxed text-center max-w-xs">
      <p className="mb-2 text-zinc-600 font-bold uppercase tracking-wider">Privacy & Security</p>
      <p>
        Images are processed in a secure environment and cached for 10 minutes to allow multiple fittings. 
        Your data is automatically purged thereafter and never stored permanently.
      </p>
    </div>
  );
};

export default PrivacyNotice;
