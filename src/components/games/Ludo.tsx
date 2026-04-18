import React, { useState } from 'react';
import { ArrowLeft, Users, Globe, Monitor, Play, AlertCircle, Check, X, Gamepad2 } from 'lucide-react';

import { LudoBoard } from './LudoBoard';
import { PlayerColor, COLORS, COLOR_CLASSES, BORDER_CLASSES } from './ludoConstants';

type GameState = 'menu' | 'offline-lobby' | 'playing';
type GameMode = 'solo' | 'team';

interface LudoPlayerSetup {
  id: number;
  name: string;
  color: PlayerColor | null;
}

export const LudoGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [gameState, setGameState] = useState<GameState>(() => {
    if (localStorage.getItem('melody_ludo_active_game') && localStorage.getItem('melody_ludo_state_cache')) {
       return 'playing';
    }
    return 'menu';
  });
  const [mode, setMode] = useState<GameMode>('solo');
  const [players, setPlayers] = useState<LudoPlayerSetup[]>([
    { id: 1, name: '', color: 'red' },
    { id: 2, name: '', color: 'green' },
    { id: 3, name: '', color: null },
    { id: 4, name: '', color: null },
  ]);
  const [error, setError] = useState<string | null>(null);

  const handleMenuBack = () => {
    if (gameState === 'playing' || gameState === 'offline-lobby') {
      setGameState('menu');
      setError(null);
    } else {
      onBack();
    }
  };

  const isColorTaken = (color: PlayerColor, playerId: number) => {
    return players.some(p => p.color === color && p.id !== playerId);
  };

  const handleColorSelect = (playerId: number, color: PlayerColor) => {
    if (isColorTaken(color, playerId)) return;
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, color } : p));
    setError(null);
  };

  const handleNameChange = (playerId: number, name: string) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, name } : p));
    setError(null);
  };

  const handleStartGame = () => {
    setError(null);
    const activePlayers = players.filter(p => p.name.trim() !== '' && p.color !== null);
    
    if (activePlayers.length < 2) {
      setError("Minimum 2 players required to start!");
      return;
    }

    if (mode === 'team' && activePlayers.length !== 4) {
      setError("Team mode requires exactly 4 players!");
      return;
    }

    const activeNames = activePlayers.map(p => p.name.trim().toLowerCase());
    const uniqueNames = new Set(activeNames);
    if (uniqueNames.size !== activeNames.length) {
      setError("Players cannot have identical names!");
      return;
    }

    // Move to playing state
    setGameState('playing');
  };

  return (
    <section className="pt-4 px-2 sm:px-0">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={handleMenuBack}
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-md">
          {gameState === 'menu' && "Ludo Sync"}
          {gameState === 'offline-lobby' && "PvP Offline Setup"}
          {gameState === 'playing' && "Ludo Match"}
        </h2>
      </div>

      {gameState === 'menu' && (
        <div className="flex flex-col gap-4 max-w-md mx-auto mt-12 sm:mt-24">
          <button 
            onClick={() => setGameState('offline-lobby')}
            className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-lg font-bold text-white mb-1">Player vs Player</h3>
              <p className="text-sm text-gray-400">Pass & Play with friends on this device</p>
            </div>
          </button>

          <button 
            disabled
            className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 opacity-60 relative overflow-hidden"
          >
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Globe className="w-6 h-6" />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                PvP Online Room
                <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Soon</span>
              </h3>
              <p className="text-sm text-gray-400">Play with room members remotely</p>
            </div>
          </button>

          <button 
            disabled
            className="flex items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/5 opacity-60 relative overflow-hidden"
          >
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400">
              <Monitor className="w-6 h-6" />
            </div>
            <div className="text-left flex-1">
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                Player vs Machine
                <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Soon</span>
              </h3>
              <p className="text-sm text-gray-400">Practice against smart AI</p>
            </div>
          </button>
        </div>
      )}

      {gameState === 'offline-lobby' && (
        <div className="max-w-2xl mx-auto bg-[#121212] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-emerald-500/10 blur-[80px] pointer-events-none"></div>

          {/* Mode Toggle */}
          <div className="flex justify-center mb-8 relative z-10">
            <div className="bg-black/60 p-1.5 rounded-full flex gap-1 border border-white/10">
              <button 
                onClick={() => setMode('solo')}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${mode === 'solo' ? 'bg-emerald-500 text-black shadow-lg scale-105' : 'text-gray-400 hover:text-white'}`}
              >
                Solo (FFA)
              </button>
              <button 
                onClick={() => setMode('team')}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${mode === 'team' ? 'bg-emerald-500 text-black shadow-lg scale-105' : 'text-gray-400 hover:text-white'}`}
              >
                Team (2v2)
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 relative z-10">
            {players.map((player, index) => (
              <div 
                key={player.id} 
                className={`flex flex-col sm:flex-row sm:items-center gap-4 bg-white/5 border ${player.color ? BORDER_CLASSES[player.color] : 'border-white/10'} p-4 rounded-2xl transition-colors duration-300`}
              >
                <div className="flex items-center gap-3 w-32 shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold font-mono text-sm shadow-inner ${player.color ? `${COLOR_CLASSES[player.color]} text-black` : 'bg-gray-800 text-gray-500'}`}>
                    P{player.id}
                  </div>
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    {mode === 'team' ? (index % 2 === 0 ? 'Team A' : 'Team B') : 'Player'}
                  </span>
                </div>
                
                <input 
                  type="text" 
                  maxLength={12}
                  placeholder={`Enter Name (P${player.id})`}
                  value={player.name}
                  onChange={(e) => handleNameChange(player.id, e.target.value)}
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />

                <div className="flex items-center gap-2">
                  {COLORS.map(c => {
                    const taken = isColorTaken(c, player.id);
                    const selected = player.color === c;
                    return (
                      <button
                        key={c}
                        disabled={taken}
                        onClick={() => handleColorSelect(player.id, c)}
                        className={`w-8 h-8 rounded-full transition-all flex items-center justify-center relative
                          ${COLOR_CLASSES[c]} 
                          ${taken ? 'opacity-20 cursor-not-allowed grayscale' : 'hover:scale-110 shadow-lg'}
                          ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#121212] scale-110 z-10' : ''}
                        `}
                      >
                        {selected && <Check className="w-4 h-4 text-black drop-shadow-sm" />}
                        {taken && <X className="w-4 h-4 text-white/50" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-6 bg-red-500/10 border border-red-500/20 text-red-400 py-3 px-4 rounded-xl flex items-center gap-3 text-sm font-medium animate-pulse relative z-10">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          <div className="mt-8 flex justify-center relative z-10">
            <button 
              onClick={handleStartGame}
              className="group relative px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-full text-lg shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all flex items-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <Play className="w-6 h-6 fill-black relative z-10" />
              <span className="relative z-10">START GAME</span>
            </button>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
         <LudoBoard 
           initialState={localStorage.getItem('melody_ludo_state_cache') ? JSON.parse(localStorage.getItem('melody_ludo_state_cache')!) : undefined}
           setupData={players} 
           mode={mode} 
           onBack={() => { 
             localStorage.removeItem('melody_ludo_active_game');
             localStorage.removeItem('melody_ludo_state_cache');
             setGameState('menu'); 
           }} 
         />
      )}
    </section>
  );
};
