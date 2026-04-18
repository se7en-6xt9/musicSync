import React, { useState, useEffect, useRef } from 'react';
import { Search, Music, Loader2, Sparkles, Clock, Flame, HeartCrack, PartyPopper, Disc3, Mic2, ListMusic, X, ArrowLeft, Gamepad2 } from 'lucide-react';
import { motion } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { Song, Room, RoomMember, ChatMessage } from './types';
import { searchSongs, getTrendingSongs, getCategorySongs, getSimilarSongs } from './services/api';
import { SongCard } from './components/SongCard';
import { SongSection } from './components/SongSection';
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
  const currentTimeRef = useRef<number>(0);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const gameUrl = import.meta.env.VITE_GAME_URL || 'https://melodygames.vercel.app';
  
  const [searchPage, setSearchPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [homeCategoryIndex, setHomeCategoryIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<{title: string, query: string} | null>(null);
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(false);
  const extraCategories = ['Romantic', 'Workout', 'Chill', '90s Bollywood', 'Devotional', 'Pop', 'Indie', 'Punjabi', 'Lo-Fi'];

  // Room State
  const [currentUserId] = useState(() => {
    let id = localStorage.getItem('music_sync_userId');
    if (!id) {
      id = Math.random().toString(36).substring(2, 9);
      localStorage.setItem('music_sync_userId', id);
    }
    return id;
  });
  const [roomState, setRoomState] = useState<Room | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomInputName, setRoomInputName] = useState('');
  const [roomInputCode, setRoomInputCode] = useState('');
  const [userName, setUserName] = useState(() => localStorage.getItem('music_sync_userName') || '');
  const [reactions, setReactions] = useState<{id: number, reaction: string, userName: string}[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Refs for latest state in socket listeners
  const userNameRef = useRef(userName);
  useEffect(() => { userNameRef.current = userName; }, [userName]);
  
  const roomStateRef = useRef(roomState);
  useEffect(() => { roomStateRef.current = roomState; }, [roomState]);
  
  const isExplicitExitRef = useRef(false);

  // Handle page close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (roomStateRef.current && !isExplicitExitRef.current) {
        localStorage.setItem('music_sync_lastRoom', roomStateRef.current.code);
        localStorage.setItem('music_sync_disconnectTime', Date.now().toString());
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Socket Connection
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || undefined;
    socketRef.current = io(backendUrl);

    socketRef.current.on("connect", () => {
      const lastRoom = localStorage.getItem('music_sync_lastRoom');
      const disconnectTime = localStorage.getItem('music_sync_disconnectTime');
      
      if (lastRoom && disconnectTime) {
        const timeDiff = Date.now() - parseInt(disconnectTime);
        if (timeDiff <= 60000) { // 1 minute
          // Only reconnect if not already in a different room manually
          if (!roomStateRef.current || roomStateRef.current.code === lastRoom) {
            socketRef.current?.emit("join_room", {
              code: lastRoom,
              user: { id: currentUserId, name: userNameRef.current }
            });
          }
        } else {
          // Expired
          localStorage.removeItem('music_sync_lastRoom');
          localStorage.removeItem('music_sync_disconnectTime');
        }
      }
    });

    socketRef.current.on("disconnect", (reason) => {
      if (roomStateRef.current && !isExplicitExitRef.current) {
        localStorage.setItem('music_sync_lastRoom', roomStateRef.current.code);
        localStorage.setItem('music_sync_disconnectTime', Date.now().toString());
      }
    });

    socketRef.current.on("room_state_update", (room: Room) => {
      if (isExplicitExitRef.current) return;
      
      setRoomState(room);
      if (room.messages) {
        setMessages(room.messages);
      }
      
      // Auto-sync playback state on join/reconnect
      if (room.playbackState) {
        if (room.playbackState.currentSong) {
          setCurrentSong(room.playbackState.currentSong);
        }
        setIsPlaying(room.playbackState.isPlaying);
        if (room.playbackState.queue && room.playbackState.queue.length > 0) {
          setQueue(room.playbackState.queue);
        }
        
        if (room.playbackState.isPlaying && room.playbackState.updatedAt) {
           const timeDiff = (Date.now() - room.playbackState.updatedAt) / 1000;
           const exactTime = room.playbackState.currentTime + timeDiff;
           setSyncTime(exactTime);
        } else if (room.playbackState.currentTime !== undefined) {
           setSyncTime(room.playbackState.currentTime);
        }
      }
    });

    socketRef.current.on("kicked", () => {
      isExplicitExitRef.current = true;
      localStorage.removeItem('music_sync_lastRoom');
      localStorage.removeItem('music_sync_disconnectTime');
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
  const emitPlaybackSync = (song: Song | null, playing: boolean, q: Song[], time?: number) => {
    if (roomState && socketRef.current) {
      socketRef.current.emit("sync_playback", {
        code: roomState.code,
        playbackState: {
          currentSong: song,
          isPlaying: playing,
          queue: q,
          currentTime: time !== undefined ? time : currentTimeRef.current
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
  }, [isLoading, isLoadingMore, activeTab, searchPage, homeCategoryIndex, searchResults, activeCategory]);

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
      } else if (activeTab === 'category' && activeCategory) {
        const nextPage = searchPage + 1;
        const fetchQuery = activeCategory.query === 'trending' ? 'top hits' : activeCategory.query;
        const moreResults = await getCategorySongs(fetchQuery, nextPage);
        
        if (moreResults.length > 0) {
          setSearchResults(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const newUnique = moreResults.filter(s => !existingIds.has(s.id));
            return [...prev, ...newUnique];
          });
          setSearchPage(nextPage);
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

  // Handle empty state to trap the back button if we reached the root, keeping PWA alive
  useEffect(() => {
    if (!window.location.hash || window.location.hash === '#') {
       window.history.replaceState(null, '', '#base'); // the floor
       window.history.pushState(null, '', '#home');    // current standard state
    }
  }, []);

  // Handle browser back button via URL Hash mapping
  useEffect(() => {
    const handleHashChange = () => {
      const h = window.location.hash;
      
      // TRAP THE APP! Never close the app on back press if we hit the floor.
      if (h === '#base' || h === '') {
        window.history.pushState(null, '', '#home');
        setActiveTab('home');
        setActiveCategory(null);
        setQuery('');
        return;
      }

      // Modals
      setShowCreateModal(h === '#create-room');
      setShowJoinModal(h === '#join-room');

      // Navbar state integration
      if (h === '#search-suggestions') {
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }

      // (Note: Player #player is handled directly in Player.tsx, #chat in ChatBubble, #members in Navbar)
      if (h === '#player' || h === '#chat' || h === '#members') return;

      // Base Tabs Navigation
      if (h === '#home') {
        setActiveTab('home');
        setActiveCategory(null);
        setQuery('');
      } else if (h === '#search') {
        setActiveTab('search');
      } else if (h === '#category') {
        setActiveTab('category');
      } else if (h === '#games') {
        setActiveTab('games');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Initialize state from current hash immediately
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    
    // Check if we are currently looking at search suggestions hash
    if (window.location.hash === '#search-suggestions') {
       window.location.replace('#search');
    } else if (window.location.hash !== '#search') {
      window.location.hash = 'search';
    }

    setActiveTab('search');
    setActiveCategory(null);
    setShowSuggestions(false);
    setIsLoading(true);
    setSearchPage(1);
    const results = await searchSongs(query, 1);
    setSearchResults(results);
    setQueue(results);
    setIsLoading(false);
  };

  const handleSuggestionClick = (song: Song) => {
    const songName = song.name;
    setQuery(songName);
    setShowSuggestions(false);
    
    // Check if we are currently looking at search suggestions hash
    if (window.location.hash === '#search-suggestions') {
       // Since the next step is looking at #search results, just replace it instead of back -> forward
       window.location.replace('#search');
    } else if (window.location.hash !== '#search') {
      window.location.hash = 'search';
    }

    setActiveTab('search');
    setActiveCategory(null);
    setSearchPage(1);
    handlePlay(song, searchSuggestions);
    // Explicitly search the literal songName
    (async () => {
      setIsLoading(true);
      const results = await searchSongs(songName, 1);
      setSearchResults(results);
      setQueue(results);
      setIsLoading(false);
    })();
  };

  const handleSeeMore = (title: string, categoryQuery: string, initialSongs: Song[]) => {
    if (window.location.hash !== '#category') {
      window.location.hash = 'category';
    }
    setActiveTab('category');
    setActiveCategory({ title, query: categoryQuery });
    setSearchResults(initialSongs);
    setSearchPage(1);
    window.scrollTo(0, 0);
  };

  const handleUIBack = () => {
    window.history.back(); // This hands off cleanly to browser back logic
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
      emitPlaybackSync(song, true, newQueue, 0);
    }
  };

  const autoplayStateRef = useRef({ query: '', page: 1 });

  const fetchAndAppendUpNext = async (currentQ: Song[]): Promise<Song[]> => {
    if (currentQ.length === 0) return [];

    let newSongsOut: Song[] = [];

    // Tries to fetch seeds branching off up to the last 3 songs
    for (let offset = 1; offset <= Math.min(3, currentQ.length); offset++) {
      const seedSong = currentQ[currentQ.length - offset];
      
      let artistName = '';
      if (typeof seedSong.primaryArtists === 'string') {
        artistName = seedSong.primaryArtists.split(',')[0].trim();
      } else if (Array.isArray(seedSong.primaryArtists) && seedSong.primaryArtists.length > 0) {
        const firstArtist = seedSong.primaryArtists[0];
        artistName = typeof firstArtist === 'string' ? firstArtist : (firstArtist.name || '');
      }

      if (!artistName) artistName = 'bollywood';

      let pageToFetch = 1;
      if (autoplayStateRef.current.query === artistName) {
         pageToFetch = autoplayStateRef.current.page + 1;
      }

      try {
         const results = await searchSongs(artistName, pageToFetch);
         const existingIds = new Set(currentQ.map(s => s.id));
         const newUnique = results.filter(s => !existingIds.has(s.id));

         if (newUnique.length > 0) {
            autoplayStateRef.current = { query: artistName, page: pageToFetch };
            newSongsOut = newUnique;

            setQueue(prevQueue => {
                const finalExistingIds = new Set(prevQueue.map(s => s.id));
                const finalUnique = results.filter(s => !finalExistingIds.has(s.id));
                if (finalUnique.length > 0) {
                    const newQueue = [...prevQueue, ...finalUnique];
                    emitPlaybackSync(currentSong, isPlaying, newQueue, undefined);
                    return newQueue;
                }
                return prevQueue;
            });
            break; // Stop branching, we found new songs
         } else {
            // Found results but all duplicates, or no results. Mark the page checked
            autoplayStateRef.current = { query: artistName, page: pageToFetch };
         }
      } catch (err) {
         console.error("Autoplay fetch error", err);
      }
    }

    // Ultimate chain reaction fallback: random trending picks if artist search fails
    if (newSongsOut.length === 0) {
        try {
           const fallbackQueries = ['top hits', 'trending', 'party', 'lofi indie'];
           const fq = fallbackQueries[Math.floor(Math.random() * fallbackQueries.length)];
           const results = await searchSongs(fq, 1);
           const existingIds = new Set(currentQ.map(s => s.id));
           const newUnique = results.filter(s => !existingIds.has(s.id));

           if (newUnique.length > 0) {
                autoplayStateRef.current = { query: fq, page: 1 };
                newSongsOut = newUnique;
                setQueue(prevQueue => {
                    const finalExistingIds = new Set(prevQueue.map(s => s.id));
                    const finalUnique = results.filter(s => !finalExistingIds.has(s.id));
                    const newQueue = [...prevQueue, ...finalUnique];
                    emitPlaybackSync(currentSong, isPlaying, newQueue, undefined);
                    return newQueue;
                });
           }
        } catch(e) {}
    }

    return newSongsOut;
  };

  const handleNext = async () => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    let currentQueueToUse = queue;
    
    // Infinite Autoplay: Fetch right before switching if we reached the end
    if (currentIndex === queue.length - 1 || currentIndex === -1) {
      const newSongs = await fetchAndAppendUpNext(queue);
      if (newSongs.length > 0) {
         currentQueueToUse = [...queue, ...newSongs];
      }
    }

    const nextIndex = (currentQueueToUse.findIndex(s => s.id === currentSong.id) + 1) % currentQueueToUse.length;
    const nextSong = currentQueueToUse[nextIndex];
    setCurrentSong(nextSong);
    setIsPlaying(true);
    addToRecentlyPlayed(nextSong);
    emitPlaybackSync(nextSong, true, currentQueueToUse, 0);
  };

  const handlePrevious = () => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    const prevSong = queue[prevIndex];
    setCurrentSong(prevSong);
    setIsPlaying(true);
    addToRecentlyPlayed(prevSong);
    emitPlaybackSync(prevSong, true, queue, 0);
  };

  const handleLoadMoreUpNext = async () => {
    await fetchAndAppendUpNext(queue);
  };

  const handlePlayPause = (play: boolean, time?: number) => {
    setIsPlaying(play);
    emitPlaybackSync(currentSong, play, queue, time);
  };

  const handleSeek = (time: number) => {
    emitPlaybackSync(currentSong, isPlaying, queue, time);
  };

  // Room Functions
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInputName.trim() || !userName.trim()) return;
    
    localStorage.setItem('music_sync_userName', userName);
    isExplicitExitRef.current = false;
    localStorage.removeItem('music_sync_lastRoom');
    localStorage.removeItem('music_sync_disconnectTime');
    
    if (socketRef.current) {
      socketRef.current.emit("create_room", {
        roomId: currentUserId,
        roomName: roomInputName,
        user: { id: currentUserId, name: userName }
      });
    }
    
    if (window.location.hash === '#create-room') window.history.back();
    else setShowCreateModal(false);
    setRoomInputName('');
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInputCode.trim() || !userName.trim()) return;
    
    localStorage.setItem('music_sync_userName', userName);
    isExplicitExitRef.current = false;
    localStorage.removeItem('music_sync_lastRoom');
    localStorage.removeItem('music_sync_disconnectTime');
    
    if (socketRef.current) {
      socketRef.current.emit("join_room", {
        code: roomInputCode,
        user: { id: currentUserId, name: userName }
      });
    }
    
    if (window.location.hash === '#join-room') window.history.back();
    else setShowJoinModal(false);
    setRoomInputCode('');
  };

  const handleExitRoom = () => {
    if (!roomState) return;
    isExplicitExitRef.current = true;
    localStorage.removeItem('music_sync_lastRoom');
    localStorage.removeItem('music_sync_disconnectTime');
    
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-24 font-sans selection:bg-emerald-500/30 relative">
      
      {/* Draggable Bubble (when Navbar is collapsed) */}
      {isNavbarCollapsed && activeTab === 'games' && (
        <motion.div
          drag
          dragMomentum={false}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="fixed top-24 right-6 z-[100] w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.5)] cursor-pointer hover:scale-105 active:scale-95 transition-transform"
          onClick={() => setIsNavbarCollapsed(false)}
        >
          <Music className="text-black" size={26} />
        </motion.div>
      )}

      {/* Main Navbar */}
      <div style={{ display: isNavbarCollapsed && activeTab === 'games' ? 'none' : 'block' }}>
        <Navbar 
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            if (tab === 'home') setActiveCategory(null);
          }}
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
          onCreateRoomClick={() => { window.location.replace('#create-room'); }}
          onJoinRoomClick={() => { window.location.replace('#join-room'); }}
          onExitRoomClick={handleExitRoom}
          onKickMember={handleKickMember}
          onMakeAdmin={handleMakeAdmin}
          currentSong={currentSong}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onCollapseNav={() => setIsNavbarCollapsed(true)}
        />
      </div>

      {/* Main Content */}
      <main 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-8 flex flex-col gap-4 relative z-10"
        style={{ display: activeTab === 'games' ? 'none' : 'flex' }}
      >
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-emerald-500">
            <Loader2 className="w-12 h-12 animate-spin" />
            <p className="text-gray-400 text-lg animate-pulse">Curating your vibes...</p>
          </div>
        ) : activeTab === 'search' || searchResults.length > 0 ? (
          // Search Results View
          <section>
            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={handleUIBack}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                title="Go Back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-2">
                <Search className="w-6 h-6 text-emerald-500" />
                <h2 className="text-3xl font-bold tracking-tight">Search Results</h2>
              </div>
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
        ) : activeTab === 'category' && activeCategory ? (
          // Category Full View
          <section>
            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={handleUIBack}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                title="Go Back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-2">
                <ListMusic className="w-6 h-6 text-emerald-500" />
                <h2 className="text-3xl font-bold tracking-tight">{activeCategory.title}</h2>
              </div>
            </div>
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
          </section>
        ) : activeTab === 'games' ? (
          // Games View is now handled globally via Iframe
          <div className="hidden" />
        ) : (
          // Home View
          <div>
            <SongSection title="Recently Played" icon={<Clock className="w-6 h-6 text-emerald-500" />} initialSongs={recentlyPlayed} query="recent" isPlaying={isPlaying} currentSong={currentSong} onPlay={handlePlay} onSeeMore={handleSeeMore} />
            <SongSection title="Trending Now" icon={<Flame className="w-6 h-6 text-orange-500" />} initialSongs={trendingSongs} query="trending" isPlaying={isPlaying} currentSong={currentSong} onPlay={handlePlay} onSeeMore={handleSeeMore} />
            <SongSection title="Sad Songs" icon={<HeartCrack className="w-6 h-6 text-blue-500" />} initialSongs={sadSongs} query="sad songs" isPlaying={isPlaying} currentSong={currentSong} onPlay={handlePlay} onSeeMore={handleSeeMore} />
            <SongSection title="Party Anthems" icon={<PartyPopper className="w-6 h-6 text-purple-500" />} initialSongs={partySongs} query="party songs" isPlaying={isPlaying} currentSong={currentSong} onPlay={handlePlay} onSeeMore={handleSeeMore} />
            <SongSection title="Remixes" icon={<Disc3 className="w-6 h-6 text-pink-500" />} initialSongs={remixSongs} query="remix" isPlaying={isPlaying} currentSong={currentSong} onPlay={handlePlay} onSeeMore={handleSeeMore} />
            <SongSection title="Top Artist: Arijit Singh" icon={<Mic2 className="w-6 h-6 text-yellow-500" />} initialSongs={artistSongs} query="Arijit Singh" isPlaying={isPlaying} currentSong={currentSong} onPlay={handlePlay} onSeeMore={handleSeeMore} />
            
            {/* Dynamically loaded sections */}
            {extraSections.map((section, idx) => (
              <React.Fragment key={idx}>
                <SongSection title={section.title} icon={<ListMusic className="w-6 h-6 text-emerald-500" />} initialSongs={section.songs} query={section.title} isPlaying={isPlaying} currentSong={currentSong} onPlay={handlePlay} onSeeMore={handleSeeMore} />
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

      {/* Games Global Layer */}
      <div 
        className="fixed inset-0 w-full h-full z-0 bg-transparent"
        style={{ display: activeTab === 'games' ? 'block' : 'none' }}
      >
        <iframe
          ref={iframeRef}
          src={gameUrl}
          style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}
          className="border-none bg-transparent"
          title="Melody Games"
          allow="microphone; camera; display-capture; autoplay"
          onLoad={() => {
            if (iframeRef.current && iframeRef.current.contentWindow) {
              const targetOrigin = gameUrl.startsWith('http') ? new URL(gameUrl).origin : '*';
              iframeRef.current.contentWindow.postMessage({
                type: 'AUTH_SYNC',
                id: currentUserId,
                username: userName || 'Guest'
              }, targetOrigin);
            }
          }}
        />
      </div>

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
        onTimeUpdate={(time) => { currentTimeRef.current = time; }}
        onSendReaction={roomState ? handleSendReaction : undefined}
        onLoadMoreUpNext={handleLoadMoreUpNext}
        hideMiniPlayer={activeTab === 'games'}
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
            <button onClick={() => {
              if (window.location.hash === '#create-room') window.history.back();
              else setShowCreateModal(false);
            }} className="absolute top-4 right-4 text-gray-400 hover:text-white">
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
            <button onClick={() => {
              if (window.location.hash === '#join-room') window.history.back();
              else setShowJoinModal(false);
            }} className="absolute top-4 right-4 text-gray-400 hover:text-white">
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
