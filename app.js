const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static("public"));

// 【Week 4 记忆功能核心】
const starHistory = []; // 存储所有星星的数组
const MAX_HISTORY = 1000; // 最多存1000颗

io.on("connection", (socket) => {
    console.log("新用户连接: " + socket.id);

    // 只要有新用户进来，就把之前存的所有星星发给他
    socket.emit("history", starHistory);

    socket.on("post_star", (data) => {
        // 存入服务器记忆
        starHistory.push(data);
        if (starHistory.length > MAX_HISTORY) starHistory.shift();

        // 广播给其他在线的人
        socket.broadcast.emit("new_star_arrival", data);
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});