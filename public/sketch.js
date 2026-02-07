/**
 * STAR WEAVER - FINAL LOCAL DISPLAY VERSION
 * Fix: Immediate Local Feedback (See your star instantly)
 */

let socket;
let allStars = [];
let myStar = { points: 5, size: 30, haloType: 'circle', haloSize: 1.5, name: "UNTITLED" };

// 录音相关
let mic;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

let state = 'GALAXY'; 
let recordTimer = 0;
let orbits = []; 
let myId = ""; 

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("sketch-container");
  
  angleMode(DEGREES);
  colorMode(HSB, 360, 100, 100, 1);
  
  calculateOrbits();

  try {
      socket = io();
      
      socket.on("connect", () => {
          myId = socket.id;
      });

      // 接收历史
      socket.on("history", (history) => {
          console.log("加载历史:", history.length);
          allStars = [];
          for (let data of history) loadStarFromData(data);
      });

      // 接收别人新画的星星
      socket.on("drawing", (data) => {
          console.log("收到别人的星星");
          loadStarFromData(data);
      });

      // 接收删除指令
      socket.on("star_deleted", (idToDelete) => {
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
  textAlign(CENTER, CENTER);

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
  
  // 自适应边距
  let marginX = constrain(width * 0.05, 20, 40);
  let marginY = constrain(height * 0.06, 30, 50);
  translate(marginX, marginY);
  
  fill(255); noStroke();
  textFont('Courier New');
  textAlign(LEFT, TOP);
  
  let titleSize = constrain(width * 0.05, 18, 24); 
  let bodySize = constrain(width * 0.03, 10, 12);
  
  textSize(titleSize); textStyle(BOLD); 
  text("STAR WEAVER", 0, 0);
  
  textStyle(NORMAL); textSize(bodySize); fill(255, 0.6);
  text("Leave your own voice in the star universe.", 0, titleSize + 5, width - marginX * 2);
  
  textSize(bodySize - 1); fill(255, 0.4);
  let offsetY = titleSize + 30;

  if (state === 'DESIGN') {
    text("1-9: POINTS | UP/DOWN: SIZE | H: HALO", 0, offsetY);
    fill(255, 0.8);
    text("> PRESS [SPACE] TO NAME & RECORD", 0, offsetY + 20);
    
  } else if (state === 'RECORDING') {
    fill(0, 100, 100);
    if (frameCount % 60 < 30) circle(-10, offsetY + 8, 6); 
    text("RECORDING: " + myStar.name, 5, offsetY);
    
  } else if (state === 'GALAXY') {
    text(`STARS: ${allStars.length} | ONLINE`, 0, offsetY);
    text("HOVER & 'X' TO DELETE YOURS", 0, offsetY + 20);
    fill(255, 0.8);
    text("> PRESS [N] TO CREATE", 0, offsetY + 40);
  }
  pop();
}

function drawDesignView() {
  drawOrbitGuides();
  renderStar(width/2, height/2, myStar.size, myStar.size*0.4, myStar.points, myStar.haloType, myStar.haloSize, 1.0);
  
  fill(255); noStroke(); textAlign(CENTER, TOP);
  textSize(max(10, myStar.size * 0.4));
  text(myStar.name || "YOUR NAME", width/2, height/2 + myStar.size * 2 + 10, width * 0.8);

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
    this.id = data.id;      
    this.owner = data.owner; 
    this.name = data.name || "Unknown"; 
    
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
    
    if (this.hoverScale > 1.1 || isPlaying) {
        push();
        translate(x, y);
        fill(255); noStroke();
        textAlign(CENTER, TOP);
        
        let fontSize = max(10, this.sz * 0.4);
        textSize(fontSize);
        text(this.name, 0, this.sz * 2 + 5, 200); 
        
        if (this.owner === myId) {
            fill(0, 100, 100);
            textSize(10);
            text("[X] DELETE", 0, this.sz * 2 + 5 + textAscent() + 15);
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
  if (state === 'GALAXY' && (key === 'x' || key === 'X')) {
      let starToDelete = null;
      for (let s of allStars) {
          let x = width/2 + cos(s.angle)*s.orbit;
          let y = height/2 + sin(s.angle)*s.orbit;
          if (dist(mouseX, mouseY, x, y) < 40 && s.owner === myId) {
              starToDelete = s;
              break;
          }
      }
      if (starToDelete) {
        socket.emit("delete_star", starToDelete.id);
        // 本地立即删除（可选，增强体验）
        allStars = allStars.filter(s => s.id !== starToDelete.id);
      }
  }

  if (state === 'DESIGN') {
    if (key >= '1' && key <= '9') myStar.points = int(key);
    if (keyCode === UP_ARROW) myStar.size = min(myStar.size+5, 60);
    if (keyCode === DOWN_ARROW) myStar.size = max(myStar.size-5, 10);
    
    if (key === ' ' && !isRecording) {
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
  
  if (key.toLowerCase() === 'n') state = 'DESIGN';
}

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

// --- 核心修复：先本地显示，再发送 ---
function saveAndSendStar() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    
    // 1. 本地立即生成数据 (包括ID)
    const starId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    
    let starData = {
        id: starId,        // 本地生成ID
        owner: myId,       // 我的ID
        name: myStar.name,
        points: myStar.points, size: myStar.size,
        haloType: myStar.haloType, haloSize: myStar.haloSize,
        orbit: random(orbits), angle: random(360), speed: random(0.04, 0.12),
        audioBlob: audioBlob
    };
    
    // 2. 马上把星星加到本地列表！(不用等服务器)
    // 创建一个本地 URL 给自己听
    let audioUrl = URL.createObjectURL(audioBlob);
    allStars.push(new Star(starData, loadSound(audioUrl)));
    
    // 3. 然后再发给服务器告诉别人
    if(socket) socket.emit('drawing', starData);
    
    state = 'GALAXY';
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); calculateOrbits(); }