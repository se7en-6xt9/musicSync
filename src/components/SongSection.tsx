import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Song } from '../types';
import { SongCard } from './SongCard';
import { getCategorySongs } from '../services/api';

interface SongSectionProps {
  title: string;
  icon: React.ReactNode;
  initialSongs: Song[];
  query: string;
  isPlaying: boolean;
  currentSong: Song | null;
  onPlay: (song: Song, queue: Song[]) => void;
  onSeeMore: (title: string, query: string, songs: Song[]) => void;
}

export const SongSection: React.FC<SongSectionProps> = ({
  title, icon, initialSongs, query, isPlaying, currentSong, onPlay, onSeeMore
}) => {
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [hasFetchedInitial, setHasFetchedInitial] = useState(initialSongs.length > 0);

  useEffect(() => {
    if (initialSongs.length > 0) {
      setSongs(initialSongs);
      setHasFetchedInitial(true);
    }
  }, [initialSongs]);

  useEffect(() => {
    if (hasFetchedInitial || query === 'recent' || query === 'trending') return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setIsLoading(true);
        const fetchQuery = query === 'trending' ? 'top hits' : query;
        getCategorySongs(fetchQuery, 1).then(newSongs => {
          if (newSongs.length > 0) {
            setSongs(newSongs);
          }
          setHasFetchedInitial(true);
          setIsLoading(false);
        }).catch(() => {
          setHasFetchedInitial(true);
          setIsLoading(false);
        });
        observer.disconnect();
      }
    }, { rootMargin: "600px" });

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [hasFetchedInitial, query]);

  const handleScroll = async () => {
    if (!scrollContainerRef.current || isLoading || query === 'recent') return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    // Load more when user is within 200px of the right edge
    if (scrollWidth - scrollLeft - clientWidth < 200) {
      setIsLoading(true);
      try {
        const nextPage = page + 1;
        // Trending doesn't paginate well with the same query if it's a special endpoint, 
        // fallback to searching "top hits"
        const fetchQuery = query === 'trending' ? 'top hits' : query;
        const newSongs = await getCategorySongs(fetchQuery, nextPage);
        
        if (newSongs.length > 0) {
          setSongs(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const unique = newSongs.filter(s => !existingIds.has(s.id));
            return [...prev, ...unique];
          });
          setPage(nextPage);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if(!hasFetchedInitial && songs.length === 0 && query !== 'recent' && query !== 'trending') {
    return (
      <section ref={sectionRef} className="mb-12">
        <div className="flex items-center gap-2 mb-6 px-2">
          {icon}
          <div className="h-8 bg-white/10 rounded w-48 animate-pulse"></div>
        </div>
        <div className="flex gap-4 sm:gap-6 overflow-x-hidden pb-6 pt-2 px-2 animate-pulse">
          {[...Array(6)].map((_, i) => (
             <div key={i} className="flex-none w-[160px] sm:w-[200px] h-[220px] sm:h-[280px] bg-white/5 rounded-xl"></div>
          ))}
        </div>
      </section>
    );
  }

  if (songs.length === 0) return null;

  return (
    <section ref={sectionRef} className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
        <button 
          onClick={() => onSeeMore(title, query, songs)}
          className="flex items-center gap-1 text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          See more <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto pb-6 gap-4 sm:gap-6 snap-x hide-scrollbar relative"
      >
        {songs.map((song) => (
          <div key={song.id} className="min-w-[140px] sm:min-w-[180px] max-w-[140px] sm:max-w-[180px] snap-start">
            <SongCard 
              song={song} 
              isPlaying={isPlaying}
              isCurrentSong={currentSong?.id === song.id}
              onPlay={(s) => onPlay(s, songs)}
            />
          </div>
        ))}
        {isLoading && (
          <div className="min-w-[140px] sm:min-w-[180px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        )}
      </div>
    </section>
  );
};
