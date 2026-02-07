const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // 允许发送 100MB 以内的数据 (足够存3秒音频了)
});

// 托管 public 文件夹
app.use(express.static("public"));

// 星星的记忆仓库
const drawingHistory = [];
const MAX_HISTORY = 5000;

io.on("connection", (socket) => {
    console.log("新用户连接: " + socket.id);

    // 1. 进场即发送历史记忆
    socket.emit("history", drawingHistory);

    // 2. 接收新星星
    socket.on("drawing", (data) => {
        drawingHistory.push(data);
        if (drawingHistory.length > MAX_HISTORY) drawingHistory.shift();
        
        // 广播给其他人
        socket.broadcast.emit("drawing", data);
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log("服务器启动成功！请访问 http://localhost:" + port);
});