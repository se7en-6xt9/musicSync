import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, ChevronUp, ChevronDown, ListMusic, Heart, Flame, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Song } from '../types';
import { getHighestQualityAudio, getHighestQualityImage, getSimilarSongs } from '../services/api';
import { SongCard } from './SongCard';

interface PlayerProps {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  onPlayPause: (play: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  onPlaySong: (song: Song) => void;
  syncTime?: number | null;
  onSeek?: (time: number) => void;
  onSendReaction?: (reaction: string) => void;
}

export const Player: React.FC<PlayerProps> = ({ 
  currentSong, 
  queue, 
  isPlaying, 
  onPlayPause, 
  onNext, 
  onPrevious,
  onPlaySong,
  syncTime,
  onSeek,
  onSendReaction
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [similarSongs, setSimilarSongs] = useState<Song[]>([]);

  // Fetch similar songs when current song changes
  useEffect(() => {
    if (currentSong) {
      getSimilarSongs(currentSong).then(setSimilarSongs);
    }
  }, [currentSong]);

  // Handle Play/Pause
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            if (e.name !== 'AbortError') {
              console.error("Playback failed:", e);
            }
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSong]);

  // Handle Sync Time
  useEffect(() => {
    if (syncTime !== undefined && syncTime !== null && audioRef.current) {
      // Only seek if the difference is more than 2 seconds to prevent jitter
      if (Math.abs(audioRef.current.currentTime - syncTime) > 2) {
        audioRef.current.currentTime = syncTime;
        setProgress(syncTime);
      }
    }
  }, [syncTime]);

  // Handle Media Session API
  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      const decodeHtml = (html: string) => {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
      };

      navigator.mediaSession.metadata = new MediaMetadata({
        title: decodeHtml(currentSong.name),
        artist: decodeHtml(currentSong.primaryArtists || 'Unknown Artist'),
        album: decodeHtml(currentSong.album?.name || ''),
        artwork: currentSong.image.map((img: any) => ({
          src: img.link || img.url || 'https://picsum.photos/500/500',
          sizes: img.quality.replace('x', 'x'),
          type: 'image/jpeg'
        }))
      });

      navigator.mediaSession.setActionHandler('play', () => onPlayPause(true));
      navigator.mediaSession.setActionHandler('pause', () => onPlayPause(false));
      navigator.mediaSession.setActionHandler('previoustrack', onPrevious);
      navigator.mediaSession.setActionHandler('nexttrack', onNext);
    }
  }, [currentSong, onPlayPause, onNext, onPrevious]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
      if (onSeek) {
        onSeek(time);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const newMuted = !isMuted;
      audioRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (newMuted) {
        audioRef.current.volume = 0;
        setVolume(0);
      } else {
        audioRef.current.volume = 1;
        setVolume(1);
      }
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentSong) return null;

  const audioUrl = getHighestQualityAudio(currentSong.downloadUrl);
  const imageUrl = getHighestQualityImage(currentSong.image);

  return (
    <>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={isLooping ? undefined : onNext}
        loop={isLooping}
        autoPlay
      />

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col overflow-y-auto hide-scrollbar"
          >
            {/* Expanded Header */}
            <div className="sticky top-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-10">
              <button onClick={() => setIsExpanded(false)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <ChevronDown size={24} />
              </button>
              <span className="text-sm font-medium tracking-widest uppercase text-gray-400">Now Playing</span>
              <div className="w-10"></div> {/* Spacer */}
            </div>

            <div className="flex-1 flex flex-col max-w-md mx-auto w-full p-6 pb-24">
              {/* Large Artwork */}
              <motion.div 
                className="w-full aspect-square rounded-3xl overflow-hidden shadow-2xl mb-8"
                layoutId={`artwork-${currentSong.id}`}
              >
                <img src={imageUrl} alt="Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </motion.div>

              {/* Song Info */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-1" dangerouslySetInnerHTML={{ __html: currentSong.name }} />
                <p className="text-lg text-emerald-500" dangerouslySetInnerHTML={{ __html: currentSong.primaryArtists || 'Unknown Artist' }} />
              </div>

              {/* Progress Bar */}
              <div className="mb-8">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={progress}
                  onChange={handleSeek}
                  className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-2 font-mono">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Main Controls */}
              <div className="flex items-center justify-between mb-12">
                <button onClick={() => setIsLooping(!isLooping)} className={`p-3 rounded-full transition-colors ${isLooping ? 'text-emerald-500 bg-emerald-500/10' : 'text-gray-400 hover:text-white'}`}>
                  <Repeat size={24} />
                </button>
                <button onClick={onPrevious} className="p-3 text-white hover:text-emerald-500 transition-colors">
                  <SkipBack size={32} className="fill-current" />
                </button>
                <button 
                  onClick={() => onPlayPause(!isPlaying)}
                  className="w-20 h-20 flex items-center justify-center bg-emerald-500 text-black rounded-full hover:scale-105 transition-transform shadow-xl shadow-emerald-500/20"
                >
                  {isPlaying ? <Pause size={36} className="fill-current" /> : <Play size={36} className="fill-current ml-2" />}
                </button>
                <button onClick={onNext} className="p-3 text-white hover:text-emerald-500 transition-colors">
                  <SkipForward size={32} className="fill-current" />
                </button>
                <button className="p-3 rounded-full text-gray-400 hover:text-white transition-colors">
                  <Shuffle size={24} />
                </button>
              </div>

              {/* Live Reactions (Premium Feature) */}
              {onSendReaction && (
                <div className="flex justify-center gap-6 mb-8">
                  <button 
                    onClick={() => onSendReaction('❤️')}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-2xl hover:scale-110 active:scale-95"
                  >
                    ❤️
                  </button>
                  <button 
                    onClick={() => onSendReaction('🔥')}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-2xl hover:scale-110 active:scale-95"
                  >
                    🔥
                  </button>
                  <button 
                    onClick={() => onSendReaction('🎉')}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-2xl hover:scale-110 active:scale-95"
                  >
                    🎉
                  </button>
                  <button 
                    onClick={() => onSendReaction('✨')}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-2xl hover:scale-110 active:scale-95"
                  >
                    ✨
                  </button>
                </div>
              )}

              {/* Similar Songs Section */}
              {similarSongs.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-4">
                    <ListMusic className="text-emerald-500 w-5 h-5" />
                    <h3 className="text-lg font-semibold">Similar Songs</h3>
                  </div>
                  <div className="flex flex-col gap-3">
                    {similarSongs.slice(0, 5).map(song => (
                      <div 
                        key={song.id} 
                        onClick={() => {
                          onPlaySong(song);
                          setIsExpanded(false);
                        }}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        <img src={getHighestQualityImage(song.image)} alt="" className="w-12 h-12 rounded-md object-cover" referrerPolicy="no-referrer" />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium text-white truncate" dangerouslySetInnerHTML={{ __html: song.name }} />
                          <span className="text-xs text-gray-400 truncate" dangerouslySetInnerHTML={{ __html: song.primaryArtists || 'Unknown Artist' }} />
                        </div>
                        <Play className="w-4 h-4 text-gray-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini Player (Bottom Bar) */}
      <motion.div 
        className="fixed bottom-0 left-0 right-0 bg-[#121212]/90 backdrop-blur-xl border-t border-white/10 px-4 py-2 z-40 cursor-pointer"
        onClick={() => !isExpanded && setIsExpanded(true)}
        layoutId="player-bar"
      >
        {/* Progress Bar (Top edge of mini player) */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
          <div 
            className="h-full bg-emerald-500 transition-all duration-100 ease-linear"
            style={{ width: `${(progress / (duration || 1)) * 100}%` }}
          />
        </div>

        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 h-14">
          
          {/* Song Info */}
          <div className="flex items-center gap-3 w-1/2 sm:w-1/3 min-w-0">
            <motion.img 
              layoutId={`artwork-${currentSong.id}`}
              src={imageUrl} 
              alt="Cover" 
              className="w-12 h-12 rounded-md object-cover shadow-md"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col min-w-0">
              <h4 className="text-white font-medium truncate text-sm" dangerouslySetInnerHTML={{ __html: currentSong.name }} />
              <p className="text-gray-400 text-xs truncate" dangerouslySetInnerHTML={{ __html: currentSong.primaryArtists || 'Unknown Artist' }} />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-end sm:justify-center gap-4 w-1/2 sm:w-1/3" onClick={e => e.stopPropagation()}>
            <button onClick={onPrevious} className="hidden sm:block text-gray-400 hover:text-white transition-colors">
              <SkipBack size={20} className="fill-current" />
            </button>
            <button 
              onClick={() => onPlayPause(!isPlaying)}
              className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
            </button>
            <button onClick={onNext} className="hidden sm:block text-gray-400 hover:text-white transition-colors">
              <SkipForward size={20} className="fill-current" />
            </button>
          </div>

          {/* Expand Icon (Desktop) */}
          <div className="hidden sm:flex items-center justify-end w-1/3">
            <ChevronUp size={24} className="text-gray-400" />
          </div>
          
        </div>
      </motion.div>
    </>
  );
};
