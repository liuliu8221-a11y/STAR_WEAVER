const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

// 1. 设置 Socket.io (保留大文件支持)
const io = new Server(server, {
    maxHttpBufferSize: 1e8, 
    cors: { origin: "*" }
});

const port = process.env.PORT || 3000;
app.use(express.static("public"));

// --- 参考文档：服务器状态 ---
// Stores drawing events in memory (session only)
const drawingHistory = [];
// Limits memory usage
const MAX_HISTORY = 100; // 限制存100颗

// --- 参考文档：处理连接 ---
io.on("connection", (socket) => {
    console.log("a user connected: " + socket.id);

    // --- 核心修复：进场即发送历史 ---
    // Immediately sends the full drawing history to the new user.
    socket.emit("history", drawingHistory);

    // --- 参考文档：接收数据 ---
    socket.on("drawing", (data) => {
        // Listens for drawing events and stores in memory
        drawingHistory.push(data);
        
        // Limits history size
        if(drawingHistory.length > MAX_HISTORY){
            drawingHistory.shift();
        }

        // Sends the drawing to all OTHER users (not the sender)
        socket.broadcast.emit("drawing", data);
    });

    // 处理删除 (保留功能)
    socket.on("delete_star", (idToDelete) => {
        // 从记忆中删除
        const index = drawingHistory.findIndex(s => s.id === idToDelete);
        if (index !== -1) {
            drawingHistory.splice(index, 1);
            // 告诉所有人删除
            io.emit("star_deleted", idToDelete);
        }
    });

    socket.on("disconnect", () => console.log("user disconnected"));
});

server.listen(port, () => {
    console.log("listening on: " + port);
});