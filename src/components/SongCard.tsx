import React from 'react';
import { Play, Pause } from 'lucide-react';
import { Song } from '../types';
import { getHighestQualityImage } from '../services/api';

interface SongCardProps {
  song: Song;
  isPlaying: boolean;
  isCurrentSong: boolean;
  onPlay: (song: Song) => void;
}

export const SongCard: React.FC<SongCardProps> = ({ song, isPlaying, isCurrentSong, onPlay }) => {
  const imageUrl = getHighestQualityImage(song.image);
  
  // Decode HTML entities in song name (JioSaavn API sometimes returns &quot; etc)
  const decodeHtml = (html: string) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  return (
    <div 
      onClick={() => onPlay(song)}
      className={`group relative flex flex-col gap-3 p-4 rounded-2xl cursor-pointer transition-all duration-300
        ${isCurrentSong ? 'bg-white/10 border border-white/20' : 'bg-white/5 hover:bg-white/10 border border-transparent'}
      `}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl shadow-lg">
        <img 
          src={imageUrl} 
          alt={song.name} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        
        {/* Play Overlay */}
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300
          ${isCurrentSong ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
        `}>
          <div className="w-12 h-12 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-xl transform transition-transform hover:scale-110">
            {isCurrentSong && isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-1" />
            )}
          </div>
        </div>
      </div>
      
      <div className="flex flex-col">
        <h3 className="font-semibold text-white truncate text-base" title={decodeHtml(song.name)}>
          {decodeHtml(song.name)}
        </h3>
        <p className="text-sm text-gray-400 truncate mt-1" title={decodeHtml(song.primaryArtists || song.featuredArtists || 'Unknown Artist')}>
          {decodeHtml(song.primaryArtists || song.featuredArtists || 'Unknown Artist')}
        </p>
      </div>
    </div>
  );
};
