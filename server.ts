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

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

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

  // Proxy routes for JioSaavn API to bypass CORS/Adblockers
  app.get("/api/jiosaavn/search/songs", async (req, res) => {
    try {
      const { query, page } = req.query;
      const response = await fetch(`https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${encodeURIComponent(query as string)}&page=${page || 1}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error proxying search:', error);
      res.status(500).json({ error: 'Failed to fetch from JioSaavn API' });
    }
  });

  app.get("/api/jiosaavn/modules", async (req, res) => {
    try {
      const response = await fetch(`https://jiosaavn-api-privatecvc2.vercel.app/modules`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error proxying modules:', error);
      res.status(500).json({ error: 'Failed to fetch from JioSaavn API' });
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
