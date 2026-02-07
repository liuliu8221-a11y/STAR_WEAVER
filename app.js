const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
// 1. 引入 Socket.io
const { Server } = require("socket.io");

// 2. 引入文件系统 (用于存盘)
const fs = require("fs");
const path = require("path");

// 定义存档文件路径
const DATA_FILE = path.join(__dirname, "star-history.json");

// 3. 创建 Socket 服务器 (配置大文件支持)
const io = new Server(server, {
    maxHttpBufferSize: 1e8, 
    cors: { origin: "*" }
});

const port = process.env.PORT || 3000;
app.use(express.static("public"));

// 记忆仓库
let drawingHistory = [];
const MAX_HISTORY = 100; 

// --- 从硬盘加载数据 ---
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const rawData = fs.readFileSync(DATA_FILE, "utf8");
            drawingHistory = JSON.parse(rawData);
            console.log(`✅ 已加载 ${drawingHistory.length} 颗星星`);
        } else {
            console.log("ℹ️ 暂无存档，新建宇宙");
        }
    } catch (error) {
        console.error("❌ 读取存档失败:", error);
        drawingHistory = [];
    }
}

// --- 保存数据到硬盘 ---
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(drawingHistory, null, 2));
    } catch (error) {
        console.error("❌ 保存失败:", error);
    }
}

// 启动时加载
loadData();

io.on("connection", (socket) => {
    console.log("用户连接: " + socket.id);

    // 发送历史
    socket.emit("history", drawingHistory);

    // 接收新星星
    socket.on("drawing", (data) => {
        drawingHistory.push(data);
        if(drawingHistory.length > MAX_HISTORY) drawingHistory.shift();

        // 保存并广播
        saveData();
        socket.broadcast.emit("drawing", data);
    });

    // 删除星星
    socket.on("delete_star", (idToDelete) => {
        const index = drawingHistory.findIndex(s => s.id === idToDelete);
        if (index !== -1) {
            drawingHistory.splice(index, 1);
            saveData(); // 删除也要保存
            io.emit("star_deleted", idToDelete);
        }
    });

    socket.on("disconnect", () => console.log("用户离开"));
});

server.listen(port, () => {
    console.log("Server running on port: " + port);
});