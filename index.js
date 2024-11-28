const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const uuidAPIKey = require("uuid-apikey");

app.use(cors());
app.use(express.json());

const roomElements = {};
const validRooms = new Set(); // 유효한 방 ID 목록

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// 방 생성 및 검증 통합 API
app.get("/api/room/:roomId?", (req, res) => {
  const { roomId } = req.params;

  if (roomId) {
    // 방 유효성 검증
    if (validRooms.has(roomId)) {
      res.json({ valid: true, message: "Valid Room ID" });
    } else {
      res.status(404).json({ valid: false, message: "Invalid Room ID" });
    }
  } else {
    // 새로운 방 생성
    const { uuid } = uuidAPIKey.create();
    validRooms.add(uuid);
    res.json({ roomId: uuid, message: "New Room Created" });
  }
});

io.on("connection", (socket) => {
  console.log("user connected ", socket.id);

  // room 참여
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);

    if (!roomElements[roomId]) roomElements[roomId] = [];
    io.to(socket.id).emit("whiteboard-state", roomElements[roomId]);
  });

  socket.on("element-update", ({ roomId, elementData }) => {
    if (!roomElements[roomId]) roomElements[roomId] = [];
    updateElementInRoom(roomId, elementData);

    socket.to(roomId).emit("element-update", elementData);
  });

  socket.on("whiteboard-clear", (roomId) => {
    if (roomElements[roomId]) roomElements[roomId] = [];

    socket.to(roomId).emit("whiteboard-clear");
  });

  socket.on("cursor-position", ({ roomId, cursorData }) => {
    socket.to(roomId).emit("cursor-position", {
      ...cursorData,
      userId: socket.id,
    });
  });

  socket.on("disconnecting", () => {
    const rooms = Array.from(socket.rooms).filter((room) => room !== socket.id); // 유저가 속한 모든 Room 가져오기
    rooms.forEach((roomId) => {
      socket.to(roomId).emit("user-disconnected", socket.id);
    });
    console.log(`User ${socket.id} disconnected from rooms: ${rooms}`);
  });
});

app.get("/", (req, res) => {
  res.send("Hello server is working");
});

const PORT = process.env.PORT || 3003;

server.listen(PORT, () => {
  console.log("server is running on port", PORT);
});

// room별 element 업데이트 함수
const updateElementInRoom = (roomId, elementData) => {
  const elements = roomElements[roomId];
  const index = elements.findIndex((element) => element.id === elementData.id);

  if (index === -1) return elements.push(elementData);

  elements[index] = elementData;
};
