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

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
/*
const spaces = {};

const users = {};

// 새로운 스페이스 생성
app.post("/create-space", (req, res) => {
  const { uuid, apiKey } = uuidAPIKey.create();
  spaces[apiKey] = { elements: [], uuid }; // apiKey로 스페이스 저장
  res.status(201).json({ apiKey });
});

// 특정 스페이스 상태 조회
app.get("/space/:apiKey", (req, res) => {
  const { apiKey } = req.params;
  if (uuidAPIKey.isAPIKey(apiKey)) {
    const uuid = uuidAPIKey.toUUID(apiKey);
    if (spaces[apiKey] && spaces[apiKey].uuid === uuid) {
      return res.status(200).json(spaces[apiKey]);
    }
  }
  res.status(404).json({ message: "Invalid or not found space" });
});
*/
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
