/**
 * STAR WEAVER - SOCIAL VERSION
 * Features: Naming | Owner Delete | View History First
 */

let socket;
let allStars = [];
// 增加 name 属性
let myStar = { points: 5, size: 30, haloType: 'circle', haloSize: 1.5, name: "UNTITLED" };

// 录音相关
let mic;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// --- 关键修改 1：初始状态改为 GALAXY (先看历史) ---
let state = 'GALAXY'; 
let recordTimer = 0;
let orbits = []; 
let myId = ""; // 存自己的 ID

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("sketch-container");
  
  angleMode(DEGREES);
  colorMode(HSB, 360, 100, 100, 1);
  textAlign(CENTER, CENTER); // 文字居中
  
  calculateOrbits();

  try {
      socket = io();
      
      // 记录自己的 ID
      socket.on("connect", () => {
          myId = socket.id;
          console.log("My ID:", myId);
      });

      // 接收历史
      socket.on("history", (history) => {
          allStars = [];
          for (let data of history) loadStarFromData(data);
      });

      // 接收新星星 (监听 new_star_arrival)
      socket.on("new_star_arrival", (data) => {
          loadStarFromData(data);
      });

      // --- 关键修改 2：监听删除指令 ---
      socket.on("star_deleted", (idToDelete) => {
          // 过滤掉被删的星星
          allStars = allStars.filter(s => s.id !== idToDelete);
      });

  } catch(e) {
      console.log("离线模式");
  }

  mic = new p5.AudioIn();
  mic.start();
}

function draw() {
  background(0); 
  if (state === 'DESIGN' || state === 'RECORDING') {
    drawDesignView();
  } else {
    drawGalaxyView();
  }
  drawUI();
}

// --- 数据加载 ---
function loadStarFromData(data) {
    let newSound = null;
    try {
        if (data.audioBlob) {
            let blob = new Blob([data.audioBlob], { type: 'audio/webm' });
            let url = URL.createObjectURL(blob);
            newSound = loadSound(url);
        }
    } catch (e) {}
    
    // 防止重复添加
    if (!allStars.find(s => s.id === data.id)) {
        allStars.push(new Star(data, newSound));
    }
}

// --- UI ---
function drawUI() {
  push();
  translate(40, 50);
  fill(255); noStroke();
  textFont('Courier New');
  textSize(24); textStyle(BOLD); text("STAR WEAVER", 0, 0);
  
  textStyle(NORMAL); textSize(12); fill(255, 0.6);
  text("Leave your own voice in the star universe.", 0, 25);
  
  textSize(11); fill(255, 0.4);
  if (state === 'DESIGN') {
    text("1-9: POINTS | UP/DOWN: SIZE | H: HALO", 0, 55);
    fill(255, 0.8);
    // 提示语修改
    text("> PRESS [SPACE] TO NAME & RECORD", 0, 85);
    
  } else if (state === 'RECORDING') {
    fill(0, 100, 100);
    if (frameCount % 60 < 30) circle(-15, 52, 8); 
    // 显示正在录制的名字
    text("RECORDING: " + myStar.name, 0, 55);
    
  } else if (state === 'GALAXY') {
    text("NETWORK: ONLINE | STARS: " + allStars.length, 0, 55);
    // 提示删除操作
    text("HOVER & PRESS 'X' TO DELETE YOURS", 0, 75);
    fill(255, 0.8);
    // 提示按 N 创建
    text("> PRESS [N] TO CREATE YOUR STAR", 0, 105);
  }
  pop();
}

function drawDesignView() {
  drawOrbitGuides();
  renderStar(width/2, height/2, myStar.size, myStar.size*0.4, myStar.points, myStar.haloType, myStar.haloSize, 1.0);
  
  // --- 预览名字 ---
  fill(255); noStroke(); 
  textSize(max(10, myStar.size * 0.4)); // 字体随大小变化
  text(myStar.name || "YOUR NAME", width/2, height/2 + myStar.size * 2 + 10);

  if (state === 'RECORDING' && millis() - recordTimer > 3000) finishStar();
}

function drawGalaxyView() {
  drawOrbitGuides();
  for (let s of allStars) {
    s.update(); s.display(); s.checkHoverInteraction();
  }
}

function drawOrbitGuides() {
    noFill(); stroke(255, 0.08);
    for (let r of orbits) ellipse(width/2, height/2, r*2);
}

function calculateOrbits() {
    let m = min(width, height);
    orbits = [m*0.15, m*0.25, m*0.35, m*0.45];
}

class Star {
  constructor(data, soundObj) {
    this.id = data.id;       // 唯一 ID
    this.owner = data.owner; // 主人 ID
    this.name = data.name || "Unknown"; // 星星名字
    
    this.pts = data.points;
    this.sz = data.size;
    this.hType = data.haloType;
    this.hSize = data.haloSize;
    this.orbit = data.orbit || random(orbits);
    this.angle = data.angle || random(360);
    this.speed = data.speed || random(0.04, 0.12);
    this.voice = soundObj; 
    this.hoverScale = 1.0;
  }
  update() { this.angle += this.speed; }
  display() {
    let x = width/2 + cos(this.angle)*this.orbit;
    let y = height/2 + sin(this.angle)*this.orbit;
    
    let isPlaying = this.voice && this.voice.isLoaded() && this.voice.isPlaying();
    let pulse = isPlaying ? 1.5 : 1.0;
    
    renderStar(x, y, this.sz*this.hoverScale*pulse, this.sz*0.4*this.hoverScale*pulse, this.pts, this.hType, this.hSize, 0.9);
    
    // --- 绘制名字 ---
    // 只有鼠标放上去，或者正在播放声音时才显示名字，保持界面整洁
    if (this.hoverScale > 1.1 || isPlaying) {
        push();
        translate(x, y);
        fill(255); noStroke();
        textSize(max(10, this.sz * 0.4)); // 动态字体大小
        text(this.name, 0, this.sz * 2 + 5);
        
        // 如果是自己的星星，显示删除提示
        if (this.owner === myId) {
            fill(0, 100, 100);
            textSize(10);
            text("[X] DELETE", 0, this.sz * 2 + 20);
        }
        pop();
    }
  }
  checkHoverInteraction() {
    let x = width/2 + cos(this.angle)*this.orbit;
    let y = height/2 + sin(this.angle)*this.orbit;
    if (dist(mouseX, mouseY, x, y) < 30*this.hoverScale) {
        this.hoverScale = lerp(this.hoverScale, 1.6, 0.1);
        if (this.voice && this.voice.isLoaded() && !this.voice.isPlaying()) {
            this.voice.play();
        }
    } else {
        this.hoverScale = lerp(this.hoverScale, 1.0, 0.1);
    }
  }
}

function renderStar(x, y, r1, r2, n, halo, hSize, opacity) {
  push(); translate(x, y);
  drawingContext.shadowBlur = 25; 
  drawingContext.shadowColor = 'rgba(255, 255, 255, 0.8)';
  stroke(255, opacity*0.4); noFill();
  if (halo === 'circle') ellipse(0,0, r1*2.8*hSize);
  else if (halo === 'lines') { for(let i=0; i<12; i++){ rotate(30); line(r1*1.3,0, r1*2*hSize,0); } }
  else if (halo === 'dots') { for(let i=0; i<12; i++){ rotate(30); fill(255, opacity*0.6); noStroke(); circle(r1*2*hSize,0, 2.5); } }
  else if (halo === 'rings') { noFill(); stroke(255, opacity*0.3); ellipse(0,0, r1*2.2*hSize); ellipse(0,0, r1*3.2*hSize); }
  else if (halo === 'nebula') { for(let i=0; i<3; i++) { fill(255, opacity*0.1); noStroke(); rotate(frameCount*0.1); ellipse(0,0, r1*4*hSize, r1*1.5*hSize); } }
  fill(255, opacity); noStroke();
  beginShape();
  for (let a = 0; a < 360; a += 360/n) {
    vertex(cos(a)*r2, sin(a)*r2);
    vertex(cos(a+180/n)*r1, sin(a+180/n)*r1);
  }
  endShape(CLOSE);
  pop();
}

function keyPressed() {
  // --- 删除逻辑 ---
  if (state === 'GALAXY' && (key === 'x' || key === 'X')) {
      // 找到鼠标下、属于我的那颗星星
      let starToDelete = null;
      for (let s of allStars) {
          // 计算当前位置
          let x = width/2 + cos(s.angle)*s.orbit;
          let y = height/2 + sin(s.angle)*s.orbit;
          if (dist(mouseX, mouseY, x, y) < 40 && s.owner === myId) {
              starToDelete = s;
              break;
          }
      }
      
      if (starToDelete) {
          // 发送删除请求
          socket.emit("delete_star", starToDelete.id);
      }
  }

  if (state === 'DESIGN') {
    if (key >= '1' && key <= '9') myStar.points = int(key);
    if (keyCode === UP_ARROW) myStar.size = min(myStar.size+5, 60);
    if (keyCode === DOWN_ARROW) myStar.size = max(myStar.size-5, 10);
    
    // --- 关键修改 3：命名并录音 ---
    if (key === ' ' && !isRecording) {
        // 弹出输入框
        let name = prompt("Please name your star:", "My Star");
        if (name) {
            myStar.name = name;
            startNativeRecording();
        }
    }
    
    if (key.toLowerCase() === 'h') {
        let t = ['circle', 'dots', 'lines', 'rings', 'nebula'];
        myStar.haloType = t[(t.indexOf(myStar.haloType)+1)%t.length];
    }
  }
  
  // --- 关键修改 4：按 N 进入创作 ---
  if (key.toLowerCase() === 'n') state = 'DESIGN';
}

// 录音逻辑 (保持不变)
function startNativeRecording() {
    userStartAudio();
    if (mic && mic.stream) {
        const options = { mimeType: 'audio/webm', audioBitsPerSecond: 6000 };
        try {
            mediaRecorder = new MediaRecorder(mic.stream, options);
            audioChunks = [];
            mediaRecorder.ondataavailable = (e) => { if(e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = saveAndSendStar;
            mediaRecorder.start();
            isRecording = true;
            state = 'RECORDING';
            recordTimer = millis();
        } catch (err) {
            mediaRecorder = new MediaRecorder(mic.stream); 
            mediaRecorder.start();
        }
    }
}

function finishStar() {
    if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
    }
}

function saveAndSendStar() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    let starData = {
        name: myStar.name, // 发送名字
        points: myStar.points, size: myStar.size,
        haloType: myStar.haloType, haloSize: myStar.haloSize,
        orbit: random(orbits), angle: random(360), speed: random(0.04, 0.12),
        audioBlob: audioBlob
    };
    
    if(socket) socket.emit('drawing', starData);
    
    // 这里我们不再手动 push，而是等待服务器回传 new_star_arrival
    // 这样能确保我们拿到的星星带有服务器分配的 ID，方便删除
    // 为了体验流畅，可以暂不操作，因为回传非常快
    
    state = 'GALAXY';
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); calculateOrbits(); }