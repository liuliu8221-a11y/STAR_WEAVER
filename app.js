const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);

//Import libraries
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

//File path for saving data
const DATA_FILE = path.join(__dirname, "star-history.json");

//Configure Socket IO with large buffer for audio
const io = new Server(server, {
    maxHttpBufferSize: 1e8, 
    cors: { origin: "*" }
});

const port = process.env.PORT || 3000;
app.use(express.static("public"));

//Memory storage
let drawingHistory = [];
const MAX_HISTORY = 100; 

//Load data from file
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const rawData = fs.readFileSync(DATA_FILE, "utf8");
            drawingHistory = JSON.parse(rawData);
            console.log("Data loaded. Stars count: " + drawingHistory.length);
        }
    } catch (error) {
        console.error("Load error:", error);
        drawingHistory = [];
    }
}

//Save data to file
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(drawingHistory, null, 2));
    } catch (error) {
        console.error("Save error:", error);
    }
}

//Load data on startup
loadData();

//Handle connections
io.on("connection", (socket) => {
    console.log("User connected: " + socket.id);

    //Send history
    socket.emit("history", drawingHistory);

    //Handle new star creation
    socket.on("drawing", (data) => {
        drawingHistory.push(data);
        
        //Limit history size
        if(drawingHistory.length > MAX_HISTORY) {
            drawingHistory.shift();
        }

        //Save and broadcast
        saveData(); 
        socket.broadcast.emit("drawing", data);
    });

    //Handle star deletion
    socket.on("delete_star", (idToDelete) => {
        const index = drawingHistory.findIndex(s => s.id === idToDelete);
        
        if (index !== -1) {
            drawingHistory.splice(index, 1);
            saveData();
            io.emit("star_deleted", idToDelete);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

//Start server
server.listen(port, () => {
    console.log("Server running on port: " + port);
});