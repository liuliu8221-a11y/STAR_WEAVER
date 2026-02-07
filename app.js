const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

// 允许大文件传输 (100MB)
const io = new Server(server, {
    maxHttpBufferSize: 1e8, 
    cors: { origin: "*" }
});

const port = process.env.PORT || 3000;
app.use(express.static("public"));

// 记忆仓库
let drawingHistory = [];
const MAX_HISTORY = 100; 

io.on("connection", (socket) => {
    console.log("用户连接: " + socket.id);

    // 1. 发送历史
    socket.emit("history", drawingHistory);

    // 2. 接收新星星
    socket.on("drawing", (data) => {
        // --- 关键修改：贴标签 ---
        // 给星星生成唯一 ID (时间戳 + 随机数)
        data.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        // 标记主人 (Socket ID)
        data.owner = socket.id; 

        // 存入历史
        drawingHistory.push(data);
        if (drawingHistory.length > MAX_HISTORY) drawingHistory.shift();
        
        // --- 关键修改：广播给所有人 (包括发送者) ---
        // 这样发送者也能拿到服务器分配的 ID，用于后续删除
        io.emit("new_star_arrival", data);
    });

    // 3. 处理删除请求
    socket.on("delete_star", (idToDelete) => {
        console.log("请求删除星星:", idToDelete);
        
        // 从历史记录中移除
        drawingHistory = drawingHistory.filter(star => star.id !== idToDelete);
        
        // 广播“删除令”，让所有客户端移除这颗星
        io.emit("star_deleted", idToDelete);
    });

    socket.on("disconnect", () => console.log("用户离开"));
});

server.listen(port, () => {
    console.log("Server running on port: " + port);
});