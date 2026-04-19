import React from 'react';
import { Mic2, ChevronRight, ArrowRight } from 'lucide-react';
import { POPULAR_ARTISTS } from '../data/entities';

interface ArtistScrollProps {
  onArtistClick: (artistName: string) => void;
  onSeeAll: () => void;
}

// Consistent color gradients for fallback
const gradients = [
  'from-pink-500 to-rose-500',
  'from-purple-500 to-indigo-500',
  'from-yellow-400 to-orange-500',
  'from-emerald-400 to-teal-500',
  'from-cyan-400 to-blue-500',
  'from-fuchsia-500 to-purple-600',
  'from-red-500 to-pink-600',
  'from-amber-400 to-orange-500',
];

export const ArtistScroll: React.FC<ArtistScrollProps> = ({ onArtistClick, onSeeAll }) => {
  // Triple the array to create an infinite scrolling illusion
  const loopArtists = [...POPULAR_ARTISTS, ...POPULAR_ARTISTS, ...POPULAR_ARTISTS];

  return (
    <div className="mb-10 w-full">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <Mic2 className="w-6 h-6 text-emerald-500" />
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white/90">Top Artists</h2>
        </div>
        <button 
          onClick={onSeeAll}
          className="flex items-center gap-1 text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          See more <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      <div className="relative group/scroll bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-6 backdrop-blur-sm shadow-xl">
        <div 
          className="artist-scroll-container flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-2 px-2 scrollbar-hide snap-x"
          style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
        >
          {loopArtists.map((artist, idx) => (
              <button 
                key={`${artist.name}-${idx}`}
                className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-300 snap-start shrink-0 group flex items-center justify-center whitespace-nowrap"
                onClick={() => onArtistClick(artist.name)}
              >
                <span className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors tracking-wide">
                  {artist.name}
                </span>
              </button>
          ))}
          
          <button 
            className="px-6 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-md hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all duration-300 snap-start shrink-0 group flex items-center justify-center gap-2 whitespace-nowrap"
            onClick={onSeeAll}
          >
            <span className="text-sm font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">
              Explore More
            </span>
            <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
          </button>
          
        </div>
        {/* Fading Edges */}
        <div className="absolute top-0 right-0 h-full w-12 sm:w-24 bg-gradient-to-l from-[#0a0a0a]/80 to-transparent pointer-events-none rounded-r-3xl" />
        <div className="absolute top-0 left-0 h-full w-8 sm:w-16 bg-gradient-to-r from-[#0a0a0a]/80 to-transparent pointer-events-none rounded-l-3xl" />
      </div>
    </div>
  );
};
