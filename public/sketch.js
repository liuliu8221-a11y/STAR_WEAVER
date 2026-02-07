/**
 * STAR WEAVER - BINARY AUDIO VERSION (NO FREEZE)
 * Fix: Sends Audio as Blob directly (Efficient)
 */

let socket;
let allStars = [];
let myStar = { points: 5, size: 30, haloType: 'circle', haloSize: 1.5 };
let mic, recorder, soundFile;
let state = 'DESIGN'; 
let recordTimer = 0;
let orbits = []; 

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("sketch-container");
  
  angleMode(DEGREES);
  colorMode(HSB, 360, 100, 100, 1);
  
  calculateOrbits();

  try {
      socket = io();
      
      // 1. 接收历史 (二进制数据)
      socket.on("history", (history) => {
          console.log("Loading history:", history.length);
          for (let data of history) {
              loadStarFromData(data); 
          }
      });

      // 2. 接收实时新星 (二进制数据)
      socket.on("drawing", (data) => {
          console.log("New star received!");
          loadStarFromData(data);
      });
  } catch(e) {
      console.log("Server offline");
  }

  // 音频初始化
  mic = new p5.AudioIn();
  mic.start();
  recorder = new p5.SoundRecorder();
  recorder.setInput(mic);
  soundFile = new p5.SoundFile();
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

// --- 【关键修改】从数据还原星星 (处理二进制 Blob) ---
function loadStarFromData(data) {
    let newSound = null;
    
    // 如果数据里包含音频 Blob
    if (data.audioBlob) {
        // 1. 将二进制数据转回 Blob 对象
        // 注意：Socket.io 传过来的二进制可能是 ArrayBuffer，需要包一层
        let blob = new Blob([data.audioBlob], { type: 'audio/wav' });
        
        // 2. 创建一个临时的 URL 指向这个 Blob (内存地址)
        let url = URL.createObjectURL(blob);
        
        // 3. 让 p5 加载这个 URL
        newSound = loadSound(url);
    }
    
    // 创建星星，把声音传进去
    allStars.push(new Star(data, newSound));
}

// --- UI 界面 ---
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
    text("> PRESS [SPACE] TO RECORD 3S VOICE", 0, 85);
  } else if (state === 'RECORDING') {
    fill(0, 100, 100);
    text("CAPTURING: " + nf((millis() - recordTimer) / 1000, 1, 1) + "s", 0, 55);
  } else if (state === 'GALAXY') {
    text("NETWORK: ONLINE | STARS: " + allStars.length, 0, 55);
    text("HOVER STARS TO LISTEN", 0, 75);
    fill(255, 0.8);
    text("> PRESS [N] TO WEAVE NEW STAR", 0, 105);
  }
  pop();
}

function drawDesignView() {
  drawOrbitGuides();
  renderStar(width/2, height/2, myStar.size, myStar.size*0.4, myStar.points, myStar.haloType, myStar.haloSize, 1.0);
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
    
    // 检查声音状态
    let isPlaying = this.voice && this.voice.isLoaded() && this.voice.isPlaying();
    let pulse = isPlaying ? 1.5 : 1.0;
    
    renderStar(x, y, this.sz*this.hoverScale*pulse, this.sz*0.4*this.hoverScale*pulse, this.pts, this.hType, this.hSize, 0.9);
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
  if (state === 'DESIGN') {
    if (key >= '1' && key <= '9') myStar.points = int(key);
    if (keyCode === UP_ARROW) myStar.size = min(myStar.size+5, 60);
    if (keyCode === DOWN_ARROW) myStar.size = max(myStar.size-5, 10);
    if (key === ' ') {
        userStartAudio().then(() => {
            recorder.record(soundFile); 
            state = 'RECORDING'; 
            recordTimer = millis(); 
        });
    }
    if (key.toLowerCase() === 'h') {
        let t = ['circle', 'dots', 'lines', 'rings', 'nebula'];
        myStar.haloType = t[(t.indexOf(myStar.haloType)+1)%t.length];
    }
  }
  if (key.toLowerCase() === 'n') state = 'DESIGN';
}

// --- 【关键修改】直接发送 Blob，不转 Base64 ---
function finishStar() {
  recorder.stop();
  
  // 1. 获取原始的音频 Blob (二进制文件)
  let soundBlob = soundFile.getBlob();
  
  let starData = {
    points: myStar.points, 
    size: myStar.size,
    haloType: myStar.haloType, 
    haloSize: myStar.haloSize,
    orbit: random(orbits), 
    angle: random(360), 
    speed: random(0.04, 0.12),
    audioBlob: soundBlob // 直接发送 Blob!
  };
  
  // 2. 发送给服务器 (Socket.io 会自动处理二进制)
  if(socket) socket.emit('drawing', starData);
  
  // 3. 本地显示
  // 为了本地播放，我们需要给 soundFile 创建一个 URL 或者直接用现有的
  // 最简单的方法是直接把刚才录好的 soundFile 对象传进去
  allStars.push(new Star(starData, soundFile));
  
  soundFile = new p5.SoundFile();
  state = 'GALAXY';
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); calculateOrbits(); }