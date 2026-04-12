import React, { useState, useEffect, useRef } from 'react';
import { Search, Music, Loader2, Sparkles, Clock, Flame, HeartCrack, PartyPopper, Disc3, Mic2, ListMusic, X } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { Song, Room, RoomMember, ChatMessage } from './types';
import { searchSongs, getTrendingSongs, getCategorySongs, getSimilarSongs } from './services/api';
import { SongCard } from './components/SongCard';
import { Player } from './components/Player';
import { Navbar } from './components/Navbar';
import { ChatBubble } from './components/ChatBubble';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  
  const [query, setQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [sadSongs, setSadSongs] = useState<Song[]>([]);
  const [partySongs, setPartySongs] = useState<Song[]>([]);
  const [remixSongs, setRemixSongs] = useState<Song[]>([]);
  const [artistSongs, setArtistSongs] = useState<Song[]>([]);
  const [extraSections, setExtraSections] = useState<{title: string, songs: Song[]}[]>([]);
  
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [syncTime, setSyncTime] = useState<number | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  
  const [searchPage, setSearchPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [homeCategoryIndex, setHomeCategoryIndex] = useState(0);
  const extraCategories = ['Romantic', 'Workout', 'Chill', '90s Bollywood', 'Devotional', 'Pop', 'Indie', 'Punjabi', 'Lo-Fi'];

  // Room State
  const [currentUserId] = useState(() => Math.random().toString(36).substring(2, 9));
  const [roomState, setRoomState] = useState<Room | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomInputName, setRoomInputName] = useState('');
  const [roomInputCode, setRoomInputCode] = useState('');
  const [userName, setUserName] = useState('');
  const [reactions, setReactions] = useState<{id: number, reaction: string, userName: string}[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Socket Connection
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || undefined;
    socketRef.current = io(backendUrl);

    socketRef.current.on("room_state_update", (room: Room) => {
      setRoomState(room);
      if (room.messages) {
        setMessages(room.messages);
      }
    });

    socketRef.current.on("kicked", () => {
      setRoomState(null);
      alert("You have been kicked from the room.");
    });

    socketRef.current.on("receive_reaction", (data: {id: number, reaction: string, userName: string}) => {
      setReactions(prev => [...prev, data]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== data.id));
      }, 3000);
    });

    socketRef.current.on("receive_message", (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    });

    socketRef.current.on("sync_playback_update", (playbackState: any) => {
      if (playbackState.currentSong) {
        setCurrentSong(playbackState.currentSong);
      }
      setIsPlaying(playbackState.isPlaying);
      if (playbackState.queue && playbackState.queue.length > 0) {
        setQueue(playbackState.queue);
      }
      // If there's a time update and it's playing, sync it
      if (playbackState.currentTime !== undefined) {
        // We set a special state to let the Player know it needs to seek
        setSyncTime(playbackState.currentTime);
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Sync playback changes to server
  const emitPlaybackSync = (song: Song | null, playing: boolean, q: Song[], time: number = 0) => {
    if (roomState && socketRef.current) {
      socketRef.current.emit("sync_playback", {
        code: roomState.code,
        playbackState: {
          currentSong: song,
          isPlaying: playing,
          queue: q,
          currentTime: time
        }
      });
    }
  };

  // Load initial data
  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      try {
        const [trending, sad, party, remix, artist] = await Promise.all([
          getTrendingSongs(),
          getCategorySongs('sad songs'),
          getCategorySongs('party songs'),
          getCategorySongs('remix'),
          getCategorySongs('Arijit Singh')
        ]);
        
        setTrendingSongs(trending);
        setSadSongs(sad);
        setPartySongs(party);
        setRemixSongs(remix);
        setArtistSongs(artist);
        
        setQueue(trending);
      } catch (error) {
        console.error("Error loading initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    const storedRecent = localStorage.getItem('recentlyPlayed');
    if (storedRecent) {
      try {
        setRecentlyPlayed(JSON.parse(storedRecent));
      } catch (e) {
        console.error("Failed to parse recently played", e);
      }
    }
    
    loadInitial();
  }, []);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !isLoading && !isLoadingMore) {
          loadMoreContent();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [isLoading, isLoadingMore, activeTab, searchPage, homeCategoryIndex, searchResults]);

  const loadMoreContent = async () => {
    setIsLoadingMore(true);
    try {
      if (activeTab === 'search' && searchResults.length > 0) {
        const nextPage = searchPage + 1;
        const moreResults = await searchSongs(query, nextPage);
        
        if (moreResults.length > 0) {
          setSearchResults(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const newUnique = moreResults.filter(s => !existingIds.has(s.id));
            return [...prev, ...newUnique];
          });
          setSearchPage(nextPage);
        } else {
          const similar = await getSimilarSongs(searchResults[0]);
          if (similar.length > 0) {
             setSearchResults(prev => {
                const existingIds = new Set(prev.map(s => s.id));
                const newUnique = similar.filter(s => !existingIds.has(s.id));
                return [...prev, ...newUnique];
             });
          }
        }
      } else if (activeTab === 'home') {
        if (homeCategoryIndex < extraCategories.length) {
          const category = extraCategories[homeCategoryIndex];
          const songs = await getCategorySongs(category);
          if (songs.length > 0) {
            setExtraSections(prev => [...prev, { title: category, songs }]);
          }
          setHomeCategoryIndex(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error("Error loading more content:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Handle Search Input for Suggestions
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (!query.trim()) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      if (searchResults.length > 0 && query === '') {
        setSearchResults([]);
      }
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchSongs(query, 1);
      setSearchSuggestions(results.slice(0, 5));
      setIsSearching(false);
      setShowSuggestions(true);
    }, 400);
    
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query]);

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    
    setActiveTab('search');
    setShowSuggestions(false);
    setIsLoading(true);
    setSearchPage(1);
    const results = await searchSongs(query, 1);
    setSearchResults(results);
    setQueue(results);
    setIsLoading(false);
  };

  const handleSuggestionClick = (song: Song) => {
    setQuery(song.name);
    setShowSuggestions(false);
    setActiveTab('search');
    setSearchPage(1);
    handlePlay(song, searchSuggestions);
    handleSearchSubmit();
  };

  const addToRecentlyPlayed = (song: Song) => {
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(s => s.id !== song.id);
      const updated = [song, ...filtered].slice(0, 10);
      localStorage.setItem('recentlyPlayed', JSON.stringify(updated));
      return updated;
    });
  };

  const handlePlay = (song: Song, contextQueue: Song[] = []) => {
    if (currentSong?.id === song.id) {
      const newIsPlaying = !isPlaying;
      setIsPlaying(newIsPlaying);
      emitPlaybackSync(song, newIsPlaying, queue);
    } else {
      setCurrentSong(song);
      setIsPlaying(true);
      addToRecentlyPlayed(song);
      const newQueue = contextQueue.length > 0 ? contextQueue : queue;
      if (contextQueue.length > 0) {
        setQueue(newQueue);
      }
      emitPlaybackSync(song, true, newQueue);
    }
  };

  const handleNext = () => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    const nextIndex = (currentIndex + 1) % queue.length;
    const nextSong = queue[nextIndex];
    setCurrentSong(nextSong);
    setIsPlaying(true);
    addToRecentlyPlayed(nextSong);
    emitPlaybackSync(nextSong, true, queue);
  };

  const handlePrevious = () => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    const prevSong = queue[prevIndex];
    setCurrentSong(prevSong);
    setIsPlaying(true);
    addToRecentlyPlayed(prevSong);
    emitPlaybackSync(prevSong, true, queue);
  };

  const handlePlayPause = (play: boolean) => {
    setIsPlaying(play);
    emitPlaybackSync(currentSong, play, queue);
  };

  const handleSeek = (time: number) => {
    emitPlaybackSync(currentSong, isPlaying, queue, time);
  };

  // Room Functions
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInputName.trim() || !userName.trim()) return;
    
    if (socketRef.current) {
      socketRef.current.emit("create_room", {
        roomId: currentUserId,
        roomName: roomInputName,
        user: { id: currentUserId, name: userName }
      });
    }
    
    setShowCreateModal(false);
    setRoomInputName('');
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInputCode.trim() || !userName.trim()) return;
    
    if (socketRef.current) {
      socketRef.current.emit("join_room", {
        code: roomInputCode,
        user: { id: currentUserId, name: userName }
      });
    }
    
    setShowJoinModal(false);
    setRoomInputCode('');
  };

  const handleExitRoom = () => {
    if (!roomState) return;
    if (socketRef.current) {
      socketRef.current.emit("leave_room", { code: roomState.code, userId: currentUserId });
    }
    setRoomState(null);
  };

  const handleKickMember = (memberId: string) => {
    if (!roomState) return;
    if (socketRef.current) {
      socketRef.current.emit("kick_member", { code: roomState.code, memberId });
    }
  };

  const handleMakeAdmin = (memberId: string) => {
    if (!roomState) return;
    if (socketRef.current) {
      socketRef.current.emit("make_admin", { code: roomState.code, memberId });
    }
  };

  const handleSendReaction = (reaction: string) => {
    if (!roomState) return;
    const reactionData = { id: Date.now() + Math.random(), reaction, userName };
    setReactions(prev => [...prev, reactionData]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== reactionData.id));
    }, 3000);
    
    if (socketRef.current) {
      socketRef.current.emit("send_reaction", { code: roomState.code, reaction, userName });
    }
  };

  const handleSendMessage = (text: string) => {
    if (!roomState) return;
    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      userId: currentUserId,
      userName: userName,
      text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMessage]);
    if (socketRef.current) {
      socketRef.current.emit("send_message", { code: roomState.code, message: newMessage });
    }
  };

  const renderSongSection = (title: string, icon: React.ReactNode, songs: Song[]) => {
    if (songs.length === 0) return null;
    return (
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          {icon}
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
        <div className="flex overflow-x-auto pb-6 gap-4 sm:gap-6 snap-x hide-scrollbar">
          {songs.map((song) => (
            <div key={song.id} className="min-w-[140px] sm:min-w-[180px] max-w-[140px] sm:max-w-[180px] snap-start">
              <SongCard 
                song={song} 
                isPlaying={isPlaying}
                isCurrentSong={currentSong?.id === song.id}
                onPlay={(s) => handlePlay(s, songs)}
              />
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-24 font-sans selection:bg-emerald-500/30 relative">
      
      <Navbar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        query={query}
        setQuery={setQuery}
        onSearchSubmit={handleSearchSubmit}
        isSearching={isSearching}
        showSuggestions={showSuggestions}
        setShowSuggestions={setShowSuggestions}
        searchSuggestions={searchSuggestions}
        onSuggestionClick={handleSuggestionClick}
        roomState={roomState}
        currentUserId={currentUserId}
        onCreateRoomClick={() => setShowCreateModal(true)}
        onJoinRoomClick={() => setShowJoinModal(true)}
        onExitRoomClick={handleExitRoom}
        onKickMember={handleKickMember}
        onMakeAdmin={handleMakeAdmin}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-8 flex flex-col gap-4 relative z-10">
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-emerald-500">
            <Loader2 className="w-12 h-12 animate-spin" />
            <p className="text-gray-400 text-lg animate-pulse">Curating your vibes...</p>
          </div>
        ) : activeTab === 'search' || searchResults.length > 0 ? (
          // Search Results View
          <section>
            <div className="flex items-center gap-2 mb-8">
              <Search className="w-6 h-6 text-emerald-500" />
              <h2 className="text-3xl font-bold tracking-tight">Search Results</h2>
            </div>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                {searchResults.map((song) => (
                  <SongCard 
                    key={song.id} 
                    song={song} 
                    isPlaying={isPlaying}
                    isCurrentSong={currentSong?.id === song.id}
                    onPlay={(s) => handlePlay(s, searchResults)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-20">No results found. Try searching for something else.</p>
            )}
          </section>
        ) : (
          // Home View
          <div>
            {renderSongSection("Recently Played", <Clock className="w-6 h-6 text-emerald-500" />, recentlyPlayed)}
            {renderSongSection("Trending Now", <Flame className="w-6 h-6 text-orange-500" />, trendingSongs)}
            {renderSongSection("Sad Songs", <HeartCrack className="w-6 h-6 text-blue-500" />, sadSongs)}
            {renderSongSection("Party Anthems", <PartyPopper className="w-6 h-6 text-purple-500" />, partySongs)}
            {renderSongSection("Remixes", <Disc3 className="w-6 h-6 text-pink-500" />, remixSongs)}
            {renderSongSection("Top Artist: Arijit Singh", <Mic2 className="w-6 h-6 text-yellow-500" />, artistSongs)}
            
            {/* Dynamically loaded sections */}
            {extraSections.map((section, idx) => (
              <React.Fragment key={idx}>
                {renderSongSection(section.title, <ListMusic className="w-6 h-6 text-emerald-500" />, section.songs)}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Infinite Scroll Observer Target */}
        {!isLoading && (
          <div ref={observerTarget} className="h-20 w-full flex items-center justify-center mt-8">
            {isLoadingMore && <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />}
          </div>
        )}
      </main>

      {/* Player */}
      <Player 
        currentSong={currentSong}
        queue={queue}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onPlaySong={(s) => handlePlay(s, queue)}
        syncTime={syncTime}
        onSeek={handleSeek}
        onSendReaction={roomState ? handleSendReaction : undefined}
      />

      {/* Floating Reactions */}
      <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-24 right-10 animate-float-up flex flex-col items-center"
            style={{
              left: `${Math.random() * 80 + 10}%`,
              animationDuration: `${2 + Math.random()}s`
            }}
          >
            <span className="text-4xl drop-shadow-lg">{r.reaction}</span>
            <span className="text-xs text-white/70 bg-black/50 px-2 py-1 rounded-full mt-1 backdrop-blur-sm">
              {r.userName}
            </span>
          </div>
        ))}
      </div>

      {/* Chat Bubble */}
      {roomState && (
        <ChatBubble 
          messages={messages}
          currentUserId={currentUserId}
          userName={userName}
          onSendMessage={handleSendMessage}
        />
      )}

      {/* Modals */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold mb-6 text-white">Create a Room</h2>
            <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Your Name</label>
                <input 
                  type="text" 
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Room Name</label>
                <input 
                  type="text" 
                  required
                  value={roomInputName}
                  onChange={(e) => setRoomInputName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="e.g. Chill Vibes Only"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition-colors mt-2">
                Create Room
              </button>
            </form>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setShowJoinModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold mb-6 text-white">Join a Room</h2>
            <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Your Name</label>
                <input 
                  type="text" 
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Room Code</label>
                <input 
                  type="text" 
                  required
                  maxLength={4}
                  value={roomInputCode}
                  onChange={(e) => setRoomInputCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-center text-2xl tracking-widest focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="0000"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition-colors mt-2">
                Join Room
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
