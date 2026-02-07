const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

// 1. 引入文件系统模块 (用于读写硬盘)
const fs = require("fs");
const path = require("path");

// 2. 定义保存数据的文件名
const DATA_FILE = path.join(__dirname, "star-history.json");

// 设置 Socket.io (保留大文件支持)
const io = new Server(server, {
    maxHttpBufferSize: 1e8, 
    cors: { origin: "*" }
});

const port = process.env.PORT || 3000;
app.use(express.static("public"));

// 记忆仓库 (内存中)
let drawingHistory = [];
const MAX_HISTORY = 100; // 限制存100颗

// --- 3. 关键功能：从硬盘加载数据 ---
function loadData() {
    try {
        // 如果文件存在，就读取它
        if (fs.existsSync(DATA_FILE)) {
            const rawData = fs.readFileSync(DATA_FILE, "utf8");
            drawingHistory = JSON.parse(rawData);
            console.log(`✅ 成功加载了 ${drawingHistory.length} 颗星星的记忆`);
        } else {
            console.log("ℹ️ 没有找到历史存档，创建一个新的宇宙");
        }
    } catch (error) {
        console.error("❌ 读取存档失败:", error);
        drawingHistory = []; // 出错就重置，防止崩坏
    }
}

// --- 4. 关键功能：保存数据到硬盘 ---
function saveData() {
    try {
        // 把内存里的数组转成文本，写入文件
        fs.writeFileSync(DATA_FILE, JSON.stringify(drawingHistory, null, 2));
        // console.log("💾 记忆已保存"); //以此确认保存成功，不想刷屏可以注释掉
    } catch (error) {
        console.error("❌ 保存失败:", error);
    }
}

// 启动时立刻加载一次
loadData();

io.on("connection", (socket) => {
    console.log("用户连接: " + socket.id);

    // 进场发送历史 (从硬盘加载出来的)
    socket.emit("history", drawingHistory);

    // 接收新星星
    socket.on("drawing", (data) => {
        // 存入内存
        drawingHistory.push(data);
        
        // 限制数量
        if(drawingHistory.length > MAX_HISTORY){
            drawingHistory.shift();
        }

        // ⚡️ 关键：数据变了，立刻保存到硬盘！
        saveData();

        // 广播给别人
        socket.broadcast.emit("drawing", data);
    });

    // 处理删除
    socket.on("delete_star", (idToDelete) => {
        const index = drawingHistory.findIndex(s => s.id === idToDelete);
        if (index !== -1) {
            drawingHistory.splice(index, 1);
            
            // ⚡️ 关键：删除了也要保存！
            saveData();
            
            // 告诉所有人删除
            io.emit("star_deleted", idToDelete);
        }
    });

    socket.on("disconnect", () => console.log("用户离开"));
});

server.listen(port, () => {
    console.log("Server running on port: " + port);
});