import React, { useState, useRef, useEffect } from 'react';
import { Home, Search, Users, LogIn, LogOut, Plus, MoreVertical, Shield, UserMinus, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Song, Room } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  
  query: string;
  setQuery: (q: string) => void;
  onSearchSubmit: (e?: React.FormEvent) => void;
  isSearching: boolean;
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  searchSuggestions: Song[];
  onSuggestionClick: (song: Song) => void;

  roomState: Room | null;
  currentUserId: string;
  onCreateRoomClick: () => void;
  onJoinRoomClick: () => void;
  onExitRoomClick: () => void;
  onKickMember: (memberId: string) => void;
  onMakeAdmin: (memberId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  query,
  setQuery,
  onSearchSubmit,
  isSearching,
  showSuggestions,
  setShowSuggestions,
  searchSuggestions,
  onSuggestionClick,
  roomState,
  currentUserId,
  onCreateRoomClick,
  onJoinRoomClick,
  onExitRoomClick,
  onKickMember,
  onMakeAdmin
}) => {
  const [showMembers, setShowMembers] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const membersRef = useRef<HTMLDivElement>(null);

  const decodeHtml = (html: string) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (membersRef.current && !membersRef.current.contains(event.target as Node)) {
        setShowMembers(false);
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyLink = () => {
    if (roomState) {
      navigator.clipboard.writeText(`Join my room on MusicSync! Code: ${roomState.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const currentUserIsAdmin = roomState?.members.find(m => m.id === currentUserId)?.isAdmin;

  return (
    <div className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl">
      <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative">
        
        {/* Left: Home Button */}
        <button
          onClick={() => {
            setActiveTab('home');
            setQuery('');
          }}
          className={`relative px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium transition-all duration-300 ease-out shrink-0
            ${activeTab === 'home' 
              ? 'text-emerald-400 bg-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]' 
              : 'text-gray-300 hover:text-white hover:bg-white/5'
            }
          `}
        >
          {activeTab === 'home' && (
            <motion.div
              layoutId="nav-pill"
              className="absolute inset-0 rounded-full bg-emerald-500/20 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
          <Home className="w-4 h-4 relative z-10" />
          <span className="relative z-10 hidden sm:inline">Home</span>
        </button>

        {/* Center: Search Bar */}
        <div className="flex-1 relative max-w-2xl">
          <form onSubmit={onSearchSubmit} className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value) setActiveTab('search');
              }}
              onFocus={() => {
                if (query.trim()) setShowSuggestions(true);
                if (query.trim()) setActiveTab('search');
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Search songs, artists, podcasts..."
              className="block w-full pl-10 pr-10 py-2 sm:py-2.5 border border-white/10 rounded-full leading-5 bg-white/5 text-gray-100 placeholder-gray-400 focus:outline-none focus:bg-white/10 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all text-sm"
            />
            {isSearching && (
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </form>

          {/* Suggestions Dropdown */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute mt-2 w-full bg-[#121212]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
              {searchSuggestions.map((song) => (
                <div 
                  key={song.id}
                  onClick={() => onSuggestionClick(song)}
                  className="flex items-center gap-3 p-3 hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <Search className="w-4 h-4 text-gray-400" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-white truncate">{decodeHtml(song.name)}</span>
                    <span className="text-xs text-gray-400 truncate">{decodeHtml(song.primaryArtists || 'Unknown')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Room Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 relative" ref={membersRef}>
          {roomState ? (
            <>
              <button
                onClick={() => setShowMembers(!showMembers)}
                className={`relative px-3 sm:px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium transition-all duration-300 ease-out
                  ${showMembers 
                    ? 'text-emerald-400 bg-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]' 
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                <Users className="w-4 h-4 relative z-10" />
                <span className="relative z-10 hidden sm:inline">Members ({roomState.members.length})</span>
              </button>
              <button
                onClick={onExitRoomClick}
                className="px-3 sm:px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Exit</span>
              </button>

              {/* Members Dropdown */}
              <AnimatePresence>
                {showMembers && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full right-0 mt-4 w-72 bg-[#121212]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col"
                  >
                    <div className="p-4 border-b border-white/10 bg-white/5">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        {roomState.name}
                      </h3>
                    </div>
                    
                    <div className="max-h-64 overflow-y-auto p-2">
                      {roomState.members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-xl group relative">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#121212] ${member.isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-white flex items-center gap-1">
                                {member.name} {member.id === currentUserId && "(You)"}
                                {member.isAdmin && <Shield className="w-3 h-3 text-emerald-500" />}
                              </span>
                              <span className="text-xs text-gray-400">{member.isOnline ? 'Listening' : 'Offline'}</span>
                            </div>
                          </div>

                          {currentUserIsAdmin && member.id !== currentUserId && (
                            <div className="relative">
                              <button 
                                onClick={() => setActiveMenuId(activeMenuId === member.id ? null : member.id)}
                                className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              
                              {activeMenuId === member.id && (
                                <div className="absolute right-0 top-full mt-1 w-36 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                                  <button 
                                    onClick={() => { onMakeAdmin(member.id); setActiveMenuId(null); }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white flex items-center gap-2"
                                  >
                                    <Shield className="w-4 h-4" /> Make Admin
                                  </button>
                                  <button 
                                    onClick={() => { onKickMember(member.id); setActiveMenuId(null); }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                                  >
                                    <UserMinus className="w-4 h-4" /> Kick
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="p-4 border-t border-white/10 bg-white/5 mt-auto">
                      <div className="flex items-center justify-between bg-black/40 rounded-xl p-3 border border-white/5">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-400">Room Code</span>
                          <span className="text-lg font-mono font-bold text-emerald-400 tracking-widest">{roomState.code}</span>
                        </div>
                        <button 
                          onClick={handleCopyLink}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                          title="Copy Join Link"
                        >
                          {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <>
              <button
                onClick={onJoinRoomClick}
                className="px-3 sm:px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Join Room</span>
              </button>
              <button
                onClick={onCreateRoomClick}
                className="px-3 sm:px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create Room</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
