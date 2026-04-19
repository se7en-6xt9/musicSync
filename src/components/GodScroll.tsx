import React from 'react';
import { Sparkles, ChevronRight, ArrowRight } from 'lucide-react';
import { DEVOTIONAL_GODS } from '../data/entities';

interface GodScrollProps {
  onGodClick: (godName: string, query: string) => void;
  onSeeAll: () => void;
}

const gradients = [
  'from-orange-500 to-amber-500',
  'from-yellow-400 to-orange-500',
  'from-red-500 to-orange-600',
  'from-amber-500 to-red-500'
];

export const GodScroll: React.FC<GodScrollProps> = ({ onGodClick, onSeeAll }) => {
  // Triple the array to create an infinite scrolling illusion
  const loopGods = [...DEVOTIONAL_GODS, ...DEVOTIONAL_GODS, ...DEVOTIONAL_GODS];

  return (
    <div className="mb-10 w-full">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-orange-500" />
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white/90">Devotional Spirits</h2>
        </div>
        <button 
          onClick={onSeeAll}
          className="flex items-center gap-1 text-sm font-medium text-orange-500 hover:text-orange-400 transition-colors"
        >
          See more <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      <div className="relative group/scroll bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 backdrop-blur-sm shadow-xl">
        <div 
          className="god-scroll-container flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-2 px-2 scrollbar-hide snap-x"
          style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
        >
          {loopGods.map((god, idx) => (
              <button 
                key={`${god.name}-${idx}`}
                className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 hover:border-orange-500/50 hover:shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all duration-300 snap-start shrink-0 group flex items-center justify-center whitespace-nowrap"
                onClick={() => onGodClick(god.name, god.query)}
              >
                <span className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors tracking-wide">
                  {god.name}
                </span>
              </button>
          ))}
          
          <button 
            className="px-6 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 backdrop-blur-md hover:bg-orange-500/20 hover:shadow-[0_0_15px_rgba(249,115,22,0.4)] transition-all duration-300 snap-start shrink-0 group flex items-center justify-center gap-2 whitespace-nowrap"
            onClick={onSeeAll}
          >
            <span className="text-sm font-bold text-orange-400 group-hover:text-orange-300 transition-colors">
              Explore More
            </span>
            <ArrowRight className="w-4 h-4 text-orange-400 group-hover:translate-x-1 transition-transform" />
          </button>
          
        </div>
        {/* Fading Edges */}
        <div className="absolute top-0 right-0 h-full w-12 sm:w-24 bg-gradient-to-l from-[#0a0a0a]/80 to-transparent pointer-events-none rounded-r-3xl" />
        <div className="absolute top-0 left-0 h-full w-8 sm:w-16 bg-gradient-to-r from-[#0a0a0a]/80 to-transparent pointer-events-none rounded-l-3xl" />
      </div>
    </div>
  );
};
