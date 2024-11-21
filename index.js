const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const uuidAPIKey = require("uuid-apikey");

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// 스페이스 관리
const spaces = {};

// 새로운 스페이스 생성
app.post("/create-space", (req, res) => {
  const { uuid, apiKey } = uuidAPIKey.create();
  spaces[apiKey] = { elements: [], uuid }; // apiKey로 스페이스 저장
  res.status(201).json({ apiKey });
});

io.on("connection", (socket) => {
  console.log("user connected");

  // 특정 스페이스 참여
  socket.on("join-space", (apiKey) => {
    if (!spaces[apiKey]) {
      socket.emit("error", "Invalid apiKey");
      return;
    }
  });

  socket.join(apiKey);
  console.log(`User joined space: ${apiKey}`);

  // 현재 스페이스 상태 전달
  socket.emit("whiteboard-state", spaces[apiKey].elements);

  socket.on("element-update", (elementData) => {
    updateElementInElements(elementData);

    socket.broadcast.emit("element-update", elementData);
  });

  socket.on("whiteboard-clear", () => {
    elements = [];

    socket.broadcast.emit("whiteboard-clear");
  });

  socket.on("cursor-position", (cursorData) => {
    socket.broadcast.emit("cursor-position", {
      ...cursorData,
      userId: socket.id,
    });
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("user-disconnected", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("Hello server is working");
});

const PORT = process.env.PORT || 3003;

server.listen(PORT, () => {
  console.log("server is running on port", PORT);
});

const updateElementInElements = (elementData) => {
  const index = elements.findIndex((element) => element.id === elementData.id);

  if (index === -1) return elements.push(elementData);

  elements[index] = elementData;
};
