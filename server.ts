import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = 3000;

  // Room state
  const rooms = new Map();
  
  // Ludo offline game state
  // key: gameId, value: { state: any, createdAt: number }
  const ludoGames = new Map();

  // Garbage collection: Run every 1 hr to clear 24h old Ludo games
  setInterval(() => {
    const now = Date.now();
    for (const [gameId, gameInfo] of ludoGames.entries()) {
      if (now - gameInfo.createdAt > 24 * 60 * 60 * 1000) {
        ludoGames.delete(gameId);
      }
    }
  }, 60 * 60 * 1000);

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Ludo Sync Events
    socket.on("ludo_create_game", ({ gameId, gameState }) => {
      ludoGames.set(gameId, {
        state: gameState,
        createdAt: Date.now()
      });
      socket.join(gameId); // For syncing and reconnections
    });

    socket.on("ludo_sync_state", ({ gameId, gameState }) => {
      if (ludoGames.has(gameId)) {
        const gameInfo = ludoGames.get(gameId);
        gameInfo.state = gameState;
        // Optionally broadcast if others are watching or for online mode later
        socket.to(gameId).emit("ludo_state_update", gameState);
      }
    });

    socket.on("ludo_reconnect", (gameId, callback) => {
      if (ludoGames.has(gameId)) {
        socket.join(gameId);
        callback({ success: true, gameState: ludoGames.get(gameId).state });
      } else {
        callback({ success: false });
      }
    });

    socket.on("create_room", ({ roomId, roomName, user }) => {
      const room = {
        id: roomId,
        name: roomName,
        code: Math.floor(1000 + Math.random() * 9000).toString(),
        members: [{ ...user, socketId: socket.id, isOnline: true, isAdmin: true }],
        messages: [],
        playbackState: {
          currentSong: null,
          isPlaying: false,
          queue: [],
          currentTime: 0,
          updatedAt: Date.now()
        }
      };
      rooms.set(room.code, room);
      socket.join(room.code);
      io.to(room.code).emit("room_state_update", room);
    });

    socket.on("join_room", ({ code, user }) => {
      const room = rooms.get(code);
      if (room) {
        // Check if user already exists
        const existingMember = room.members.find((m: any) => m.id === user.id);
        if (existingMember) {
          existingMember.isOnline = true;
          existingMember.socketId = socket.id;
          existingMember.name = user.name;
        } else {
          room.members.push({ ...user, socketId: socket.id, isOnline: true, isAdmin: false });
        }
        socket.join(code);
        io.to(code).emit("room_state_update", room);
      } else {
        socket.emit("error", { message: "Room not found" });
      }
    });

    socket.on("leave_room", ({ code, userId }) => {
      const room = rooms.get(code);
      if (room) {
        socket.leave(code);
        room.members = room.members.filter((m: any) => m.id !== userId);
        if (room.members.length === 0) {
          rooms.delete(code);
        } else {
          // Reassign admin if needed
          if (!room.members.some((m: any) => m.isAdmin)) {
            room.members[0].isAdmin = true;
          }
          io.to(code).emit("room_state_update", room);
        }
      }
    });

    socket.on("kick_member", ({ code, memberId }) => {
      const room = rooms.get(code);
      if (room) {
        const member = room.members.find((m: any) => m.id === memberId);
        if (member) {
          io.sockets.sockets.get(member.socketId)?.emit("kicked");
          io.sockets.sockets.get(member.socketId)?.leave(code);
        }
        room.members = room.members.filter((m: any) => m.id !== memberId);
        io.to(code).emit("room_state_update", room);
      }
    });

    socket.on("make_admin", ({ code, memberId }) => {
      const room = rooms.get(code);
      if (room) {
        const member = room.members.find((m: any) => m.id === memberId);
        if (member) {
          member.isAdmin = true;
          io.to(code).emit("room_state_update", room);
        }
      }
    });

    // Sync Events
    socket.on("sync_playback", ({ code, playbackState }) => {
      const room = rooms.get(code);
      if (room) {
        room.playbackState = { ...playbackState, updatedAt: Date.now() };
        // Broadcast to everyone else in the room
        socket.to(code).emit("sync_playback_update", room.playbackState);
      }
    });

    socket.on("send_reaction", ({ code, reaction, userName }) => {
      socket.to(code).emit("receive_reaction", { reaction, userName, id: Date.now() + Math.random() });
    });

    socket.on("send_message", ({ code, message }) => {
      const room = rooms.get(code);
      if (room) {
        room.messages.push(message);
        socket.to(code).emit("receive_message", message);
      }
    });

    socket.on("disconnect", () => {
      rooms.forEach((room, code) => {
        const member = room.members.find((m: any) => m.socketId === socket.id);
        if (member) {
          member.isOnline = false;
          io.to(code).emit("room_state_update", room);
        }
      });
    });
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Request Logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Music API Proxy to bypass CORS and prevent IP blocking in production
  app.get("/api/music/*", async (req: any, res: any) => {
    const musicPath = req.params[0];
    const queryParams = new URLSearchParams(req.query as any).toString();
    const targetUrl = `https://jiosaavn-api-privatecvc2.vercel.app/${musicPath}?${queryParams}`;
    const backupUrl = `https://saavn.dev/api/${musicPath}?${queryParams}`; // Potential mirror
    
    try {
      let response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.jiosaavn.com/'
        }
      });
      
      if (!response.ok) {
        console.warn(`Proxy: Primary failed, trying backup for ${musicPath}`);
        response = await fetch(backupUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        });
      }
      
      if (!response.ok) {
        console.error(`Proxy: Target API error ${response.status} for both URLs`);
        return res.status(response.status).json({ status: "FAILED", message: "Upstream API error" });
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Music API Proxy Critical Error:", error);
      res.status(500).json({ status: "FAILED", message: "Server-side fetch failed", error: (error as any).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
