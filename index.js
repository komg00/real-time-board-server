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

const spaces = {};

const users = {};

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

    socket.join(apiKey);
    console.log(`User joined space: ${apiKey}`);
    socket.emit("whiteboard-state", spaces[apiKey].elements);

    socket.spaceKey = apiKey; // 소켓에 스페이스 정보 저장
  });

  // 요소 업데이트
  socket.on("element-update", (elementData) => {
    const apiKey = socket.apiKey;
    if (!apiKey || !spaces[apiKey]) return;

    const spaceElements = spaces[apiKey].elements;
    const index = spaceElements.findIndex(
      (element) => element.id === elementData.id
    );

    if (index === -1) {
      spaceElements.push(elementData); // 새 요소 추가
    } else {
      spaceElements[index] = elementData;
    }
    socket.to(apiKey).emit("element-update", elementData);
  });

  // 화이트보드 초기화
  socket.on("whiteboard-clear", () => {
    const apiKey = socket.spaceKey;
    if (!apiKey || !spaces[apiKey]) return;

    spaces[apiKey].elements = [];
    io.to(apiKey).emit("whiteboard-clear");
  });

  socket.on("set-username", (username) => {
    users[socket.id] = { username };
  });

  socket.on("cursor-position", (cursorData) => {
    const user = users[socket.id];
    const apiKey = socket.spaceKey;

    if (user && apiKey) {
      io.to(apiKey).emit("cursor-position", {
        ...cursorData,
        userId: socket.id,
        username: user.username || "Unknown user",
      });
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
  });
});

app.get("/", (req, res) => {
  res.send("Hello server is working");
});

const PORT = process.env.PORT || 3003;

server.listen(PORT, () => {
  console.log("server is running on port", PORT);
});
