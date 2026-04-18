import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, RefreshCw, Volume2, VolumeX, Shield, Play } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PlayerColor, 
  COLOR_CLASSES, 
  COLOR_HEX, 
  PLAYER_STYLE_MAPS, 
  PATH_COORDS, 
  HOME_STRETCHES, 
  YARD_COORDS, 
  COLOR_START_OFFSETS, 
  STAR_INDICES 
} from './ludoConstants';

// AUDIO EFFECTS
const playSound = (type: 'roll' | 'move' | 'kill' | 'home') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    if (type === 'roll') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'move') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'kill') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'home') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(554, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch(e) {}
};

interface TokenState {
  id: number;
  position: number; // -1: yard, 0-51: outer track, 52-56: home stretch, 57: home
}

interface LudoPlayer {
  id: number;
  name: string;
  color: PlayerColor;
  tokens: TokenState[];
  isActive: boolean;
}

interface LudoGameState {
  id: string;
  mode: 'solo' | 'team';
  players: LudoPlayer[];
  turnIndex: number;
  diceValue: number | null;
  hasRolled: boolean;
  message: string;
  winner: string | null;
  createdAt?: number;
}

export const LudoBoard: React.FC<{ 
  initialState?: LudoGameState, 
  setupData?: {id:number, name:string, color:PlayerColor|null}[], 
  mode?: 'solo'|'team',
  onBack: () => void 
}> = ({ initialState, setupData, mode = 'solo', onBack }) => {

  const [gameState, setGameState] = useState<LudoGameState>(() => {
    if (initialState) return initialState;
    const activeSetups = setupData!.filter(p => p.color !== null && p.name.trim() !== '');
    const mappedPlayers: LudoPlayer[] = activeSetups.map(s => ({
      id: s.id,
      name: s.name,
      color: s.color as PlayerColor,
      isActive: true,
      tokens: [0, 1, 2, 3].map(tid => ({ id: tid, position: -1 }))
    }));
    const redIndex = mappedPlayers.findIndex(p => p.color === 'red');
    const startIndex = redIndex !== -1 ? redIndex : 0;
    return {
      id: `ludo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      mode,
      players: mappedPlayers,
      turnIndex: startIndex,
      diceValue: null,
      hasRolled: false,
      message: `${mappedPlayers[startIndex].name}'s Turn`,
      winner: null
    };
  });

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const backendUrl = import.meta.env.VITE_BACKEND_URL || undefined;
    const newSocket = io(backendUrl);
    setSocket(newSocket);
    if (!initialState) {
       localStorage.setItem('melody_ludo_active_game', gameState.id);
       newSocket.emit("ludo_create_game", { gameId: gameState.id, gameState });
    } else {
       newSocket.emit("ludo_reconnect", initialState.id, (response: any) => {
         if(response.success && response.gameState) setGameState(response.gameState);
       });
    }
    newSocket.on("ludo_state_update", (newState: LudoGameState) => setGameState(newState));
    return () => { newSocket.disconnect(); };
  }, []);

  useEffect(() => {
    if (socket && isClient && !isAnimating) {
      localStorage.setItem('melody_ludo_state_cache', JSON.stringify(gameState));
      socket.emit("ludo_sync_state", { gameId: gameState.id, gameState });
    }
  }, [gameState, socket, isClient, isAnimating]);

  const currentPlayer = gameState.players[gameState.turnIndex];

  const skipTurn = (state: LudoGameState) => {
     let nextIndex = (state.turnIndex + 1) % state.players.length;
     return {
       ...state,
       turnIndex: nextIndex,
       hasRolled: false,
       diceValue: null,
       message: `${state.players[nextIndex].name}'s Turn`
     };
  };

  const handleRollDice = () => {
    if (gameState.winner || gameState.hasRolled || diceRolling || isAnimating) return;
    playSound('roll');
    setDiceRolling(true);
    
    setTimeout(() => {
      const finalValue = Math.floor(Math.random() * 6) + 1;
      setDiceRolling(false);
      setGameState(prev => {
        const canMove = prev.players[prev.turnIndex].tokens.some(t => {
          if (t.position === -1) return finalValue === 6;
          return t.position + finalValue <= 57;
        });

        if (!canMove) {
          const next = skipTurn({ ...prev, diceValue: finalValue, hasRolled: true, message: `Rolled ${finalValue}. No moves!` });
          return next;
        }
        return { ...prev, diceValue: finalValue, hasRolled: true, message: `Rolled ${finalValue}` };
      });
    }, 600);
  };

  const moveStepByStep = async (pId: number, tId: number, steps: number) => {
    setIsAnimating(true);
    let currentSteps = 0;
    
    const executeStep = () => {
      if (currentSteps >= steps) {
        finishMove(pId, tId, steps);
        return;
      }

      setGameState(prev => {
        const next = JSON.parse(JSON.stringify(prev)) as LudoGameState;
        const player = next.players.find(p => p.id === pId)!;
        const token = player.tokens.find(t => t.id === tId)!;
        
        if (token.position === -1) token.position = 0;
        else token.position += 1;
        
        playSound('move');
        return next;
      });

      currentSteps++;
      setTimeout(executeStep, 250); 
    };

    executeStep();
  };

  const finishMove = (pId: number, tId: number, rolledValue: number) => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as LudoGameState;
      const player = next.players[next.turnIndex];
      const token = player.tokens.find(t => t.id === tId)!;
      
      let killed = false;
      let reachedHome = token.position === 57;

      if (token.position >= 0 && token.position < 52) {
        const absIndex = (COLOR_START_OFFSETS[player.color] + token.position) % 52;
        if (!STAR_INDICES.includes(absIndex)) {
          for (let other of next.players) {
            if (other.id === player.id) continue;
            if (next.mode === 'team') {
              const myTeam = next.players.findIndex(p => p.id === player.id) % 2;
              const theirTeam = next.players.findIndex(p => p.id === other.id) % 2;
              if (myTeam === theirTeam) continue;
            }
            for (let otherToken of other.tokens) {
              if (otherToken.position >= 0 && otherToken.position < 52) {
                const otherAbs = (COLOR_START_OFFSETS[other.color] + otherToken.position) % 52;
                if (otherAbs === absIndex) {
                  otherToken.position = -1;
                  killed = true;
                }
              }
            }
          }
        }
      }

      if (killed) playSound('kill');
      if (reachedHome) playSound('home');

      const allHome = player.tokens.every(t => t.position === 57);
      if (allHome) {
        next.winner = player.name;
        next.message = `${player.name} WINS!`;
      } else {
        if (rolledValue === 6 || killed || reachedHome) {
          next.hasRolled = false;
          next.diceValue = null;
          next.message = `${player.name} gets another turn!`;
        } else {
          return skipTurn(next);
        }
      }
      return next;
    });
    setIsAnimating(false);
  };

  const handleTokenClick = (pId: number, tId: number) => {
    if (gameState.winner || isAnimating || diceRolling) return;
    const moveValue = gameState.diceValue!;
    const player = gameState.players.find(p => p.id === pId)!;
    const token = player.tokens.find(t => t.id === tId)!;

    if (token.position === -1 && moveValue !== 6) return;
    if (token.position !== -1 && token.position + moveValue > 57) return;

    if (token.position === -1) moveStepByStep(pId, tId, 1);
    else moveStepByStep(pId, tId, moveValue);
  };

  const getRenderPos = (pId: number, tId: number, color: string, relativePos: number) => {
    let baseCol = 0, baseRow = 0;
    if (relativePos === -1) {
       const cd = YARD_COORDS[color as PlayerColor][tId];
       baseCol = cd[0]; baseRow = cd[1];
    } else if (relativePos >= 0 && relativePos < 52) {
       const absIdx = (COLOR_START_OFFSETS[color as PlayerColor] + relativePos) % 52;
       baseCol = PATH_COORDS[absIdx][0]; baseRow = PATH_COORDS[absIdx][1];
    } else if (relativePos >= 52 && relativePos < 57) {
       const cd = HOME_STRETCHES[color as PlayerColor][relativePos - 52];
       baseCol = cd[0]; baseRow = cd[1];
    } else if (relativePos === 57) {
       baseCol = 7 + (tId % 2 === 0 ? -0.4 : 0.4);
       baseRow = 7 + (tId < 2 ? -0.4 : 0.4);
    }
    return { baseCol, baseRow };
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto px-4 py-6 items-start justify-center relative min-h-screen font-sans">
      
      {/* Background Glow */}
      <AnimatePresence>
        <motion.div 
          key={gameState.turnIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.25 }}
          exit={{ opacity: 0 }}
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[80vw] max-w-2xl max-h-2xl blur-[120px] rounded-full pointer-events-none transition-colors duration-1000 ${PLAYER_STYLE_MAPS[currentPlayer.color].bg}`}
        />
      </AnimatePresence>

      {/* Header Info Mobile */}
      <div className="lg:hidden flex items-center justify-between w-full mb-4 px-2">
         <button onClick={onBack} className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white"><ArrowLeft className="w-6 h-6"/></button>
         <div className="bg-black/60 px-4 py-2 rounded-2xl border border-white/10 text-emerald-400 font-bold text-sm tracking-widest">{gameState.message}</div>
      </div>

      {/* Left panel / Scoreboard */}
      <div className="hidden lg:flex w-72 bg-[#121212]/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl flex-col z-10 shrink-0 sticky top-10">
        <button onClick={onBack} className="p-3 mb-8 w-fit rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"><ArrowLeft className="w-6 h-6"/></button>
        <h3 className="text-2xl font-black mb-8 text-white tracking-tight flex items-center gap-3">
           PLAYERS
           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mt-1"></span>
        </h3>
        <div className="flex flex-col gap-4 overflow-y-auto max-h-[40vh] pr-2 custom-scrollbar">
          {gameState.players.map((p, idx) => {
             const isTurn = gameState.turnIndex === idx;
             const homeCount = p.tokens.filter(t => t.position === 57).length;
             return (
               <motion.div 
                 key={p.id}
                 animate={{ scale: isTurn ? 1.05 : 1, opacity: isTurn ? 1 : 0.6 }}
                 className={`p-5 rounded-[1.8rem] border transition-all duration-500 ${isTurn ? `${PLAYER_STYLE_MAPS[p.color].border} ${PLAYER_STYLE_MAPS[p.color].bgSoft} scale-105 shadow-[0_10px_30px_rgba(0,0,0,0.4)]` : 'border-white/5 bg-black/40'}`}
               >
                 <div className="flex items-center gap-4">
                   <div className={`w-10 h-10 rounded-2xl ${PLAYER_STYLE_MAPS[p.color].bg} shadow-lg flex items-center justify-center font-black text-black text-lg`}>
                     {p.name.charAt(0).toUpperCase()}
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="text-base font-bold text-white truncate">{p.name}</div>
                     <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-0.5">Home: {homeCount}/4</div>
                   </div>
                   {isTurn && <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2 h-2 rounded-full bg-white"/>}
                 </div>
               </motion.div>
             )
          })}
        </div>
      </div>

      {/* Game Board Section */}
      <div className="flex flex-col items-center gap-8 z-10">
        <div className="bg-[#1e1e1e] p-3 sm:p-6 rounded-[3rem] border-[6px] border-[#2a2a2a] shadow-[0_30px_70px_rgba(0,0,0,0.6),inset_0_2px_20px_rgba(255,255,255,0.05)]">
           <div className="relative w-[340px] h-[340px] sm:w-[500px] sm:h-[500px] grid grid-cols-[repeat(15,1fr)] grid-rows-[repeat(15,1fr)] gap-0.5 bg-[#121212] overflow-hidden rounded-3xl p-1.5 shadow-inner">
              {Array.from({ length: 15 }).map((_, rIdx) => 
                Array.from({ length: 15 }).map((_, cIdx) => {
                  const isRedYard = rIdx < 6 && cIdx < 6;
                  const isGreenYard = rIdx < 6 && cIdx > 8;
                  const isYellowYard = rIdx > 8 && cIdx > 8;
                  const isBlueYard = rIdx > 8 && cIdx < 6;
                  const isCenter = rIdx > 5 && rIdx < 9 && cIdx > 5 && cIdx < 9;
                  const pathIdx = PATH_COORDS.findIndex(p => p[0] === cIdx && p[1] === rIdx);
                  const isSafe = pathIdx !== -1 && STAR_INDICES.includes(pathIdx);
                  
                  let classes = "w-full h-full relative ";
                  if (isRedYard) classes += "bg-red-500/15";
                  else if (isGreenYard) classes += "bg-green-500/15";
                  else if (isYellowYard) classes += "bg-yellow-500/15";
                  else if (isBlueYard) classes += "bg-blue-500/15";
                  else if (isCenter) classes += "bg-white/[0.03]";
                  else {
                    classes += "bg-white/[0.06] border border-white/5";
                    if (pathIdx !== -1) {
                      if (isSafe) classes += " !bg-gray-700/40";
                      if (pathIdx === 0) classes += " !bg-red-500/50";
                      if (pathIdx === 13) classes += " !bg-green-500/50";
                      if (pathIdx === 26) classes += " !bg-yellow-500/50";
                      if (pathIdx === 39) classes += " !bg-blue-500/50";
                    }
                    const isStretch = Object.values(HOME_STRETCHES).some(s => s.some(p => p[0] === cIdx && p[1] === rIdx));
                    if (isStretch) {
                      if (HOME_STRETCHES.red.some(p => p[0] === cIdx && p[1] === rIdx)) classes += " !bg-red-500/40";
                      if (HOME_STRETCHES.green.some(p => p[0] === cIdx && p[1] === rIdx)) classes += " !bg-green-500/40";
                      if (HOME_STRETCHES.yellow.some(p => p[0] === cIdx && p[1] === rIdx)) classes += " !bg-yellow-500/40";
                      if (HOME_STRETCHES.blue.some(p => p[0] === cIdx && p[1] === rIdx)) classes += " !bg-blue-500/40";
                    }
                  }

                  return (
                    <div key={`cell-${rIdx}-${cIdx}`} className={classes}>
                      {isSafe && <Shield className="absolute inset-0 w-full h-full p-1 opacity-20 text-white"/>}
                      {isRedYard && rIdx > 0 && rIdx < 5 && cIdx > 0 && cIdx < 5 && <div className="absolute inset-2 border-2 border-red-500/20 rounded-xl" />}
                      {isCenter && rIdx === 6 && cIdx === 7 && <div className="absolute inset-0 bg-red-500 opacity-20 [clip-path:polygon(0%_0%,100%_0%,50%_100%)]" />}
                      {isCenter && rIdx === 7 && cIdx === 8 && <div className="absolute inset-0 bg-yellow-500 opacity-20 [clip-path:polygon(0%_0%,0%_100%,100%_50%)]" />}
                      {isCenter && rIdx === 8 && cIdx === 7 && <div className="absolute inset-0 bg-green-500 opacity-20 [clip-path:polygon(0%_100%,100%_100%,50%_0%)]" />}
                      {isCenter && rIdx === 7 && cIdx === 6 && <div className="absolute inset-0 bg-blue-500 opacity-20 [clip-path:polygon(100%_0%,100%_100%,0%_50%)]" />}
                    </div>
                  );
              }))}

              {/* Tokens Layer */}
              <div className="absolute inset-1.5 pointer-events-none">
                {gameState.players.map(p => 
                  p.tokens.map(t => {
                    const { baseCol, baseRow } = getRenderPos(p.id, t.id, p.color, t.position);
                    let overlaps = 0, myIdx = 0;
                    gameState.players.forEach(pl => pl.tokens.forEach(tk => {
                      const { baseCol: bC, baseRow: bR } = getRenderPos(pl.id, tk.id, pl.color, tk.position);
                      if (bC === baseCol && bR === baseRow && tk.position !== -1 && tk.position !== 57) {
                        overlaps++; if (pl.id === p.id && tk.id === t.id) myIdx = overlaps - 1;
                      }
                    }));

                    const isTurn = gameState.turnIndex === gameState.players.findIndex(ply => ply.id === p.id);
                    const canMove = isTurn && gameState.hasRolled && !isAnimating && !diceRolling &&
                                    ((t.position === -1 && gameState.diceValue === 6) || (t.position !== -1 && t.position + gameState.diceValue! <= 57));

                    return (
                      <motion.div
                        key={`t-${p.id}-${t.id}`}
                        layout
                        initial={false}
                        animate={{ 
                          left: `${(baseCol / 15) * 100}%`, 
                          top: `${(baseRow / 15) * 100}%`,
                          scale: canMove ? 1.25 : (overlaps > 1 ? 0.75 : 1),
                          x: overlaps > 1 ? (myIdx % 2 === 0 ? '-15%' : '15%') : 0,
                          y: overlaps > 1 ? (myIdx > 1 ? '15%' : '-15%') : 0,
                          zIndex: canMove ? 50 : 20
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className={`absolute w-[6.666%] h-[6.666%] flex items-center justify-center`}
                        onClick={() => { if(canMove) handleTokenClick(p.id, t.id); }}
                        style={{ pointerEvents: canMove ? 'auto' : 'none' }}
                      >
                         <div className={`w-[85%] h-[85%] rounded-full shadow-[0_6px_10px_rgba(0,0,0,0.5),inset_0_-4px_8px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.4)] border-2 border-white/40 ${COLOR_CLASSES[p.color]}`}>
                            {canMove && <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity }} className="absolute inset-0 bg-white/40 rounded-full blur-md" />}
                         </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
           </div>
        </div>

        {/* Dice & Controls Area */}
        <div className="flex flex-col items-center gap-6 mt-4">
           <div className={`text-lg font-black tracking-tight ${gameState.winner ? 'text-emerald-400 animate-bounce' : 'text-white/60 uppercase'}`}>
             {gameState.message}
           </div>
           {!gameState.winner && (
             <motion.button
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               onClick={handleRollDice}
               animate={diceRolling ? { rotate: [0, 10, -10, 10, 0], x: [0, -5, 5, -5, 0] } : {}}
               transition={diceRolling ? { repeat: Infinity, duration: 0.2 } : {}}
               className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center text-5xl font-black shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all relative overflow-hidden
                 ${gameState.hasRolled || diceRolling || isAnimating ? 'bg-white/5 border border-white/10 text-white/20' : `${PLAYER_STYLE_MAPS[currentPlayer.color].bg} text-black cursor-pointer hover:shadow-emerald-500/20`}
               `}
             >
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent opacity-50"/>
                {gameState.diceValue && !diceRolling ? gameState.diceValue : <RefreshCw className={`w-10 h-10 ${diceRolling ? 'animate-spin' : 'opacity-30'}`}/>}
             </motion.button>
           )}
        </div>
      </div>

      {/* Right Stats / Info Desktop */}
      <div className="hidden lg:flex flex-col gap-6 w-72">
         <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8">
            <h4 className="text-white/40 text-[10px] font-black tracking-[0.2em] mb-4 uppercase">Current Status</h4>
            <div className={`text-xl font-bold ${PLAYER_STYLE_MAPS[currentPlayer.color].text}`}>
               {currentPlayer.name}'s Move
            </div>
            <div className="mt-4 text-xs text-gray-500 font-medium leading-relaxed">
               Click a highlighted token to move it {gameState.diceValue} spaces. 
            </div>
         </div>
      </div>

    </div>
  );
};
