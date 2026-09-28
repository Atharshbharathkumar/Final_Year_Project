import React from 'react';
import { GlassCard } from '../components/ui/Components';

const PlaceholderPage = ({ title, icon: Icon, description }) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
           {Icon && <Icon size={24} className="text-brand-400" />} {title}
        </h1>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>

      <GlassCard hover={false} className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
         <div className="w-16 h-16 rounded-2xl bg-dark-bg border border-dark-border flex items-center justify-center mb-4 opacity-50">
           {Icon ? <Icon size={28} className="text-slate-500" /> : <div className="text-2xl">🚧</div>}
         </div>
         <h2 className="text-lg font-semibold text-white mb-2">Module Under Construction</h2>
         <p className="text-sm text-slate-400 max-w-sm mx-auto">
            This part of the platform is currently being designed. Please check back later.
         </p>
      </GlassCard>
    </div>
  );
};

export default PlaceholderPage;
