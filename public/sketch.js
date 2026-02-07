/**
 * STAR WEAVER - FINAL LOCAL VERSION
 * 包含：原版UI + 记忆功能 + 简介文字 + 动态轨道
 */

let socket;
let allStars = [];
let myStar = { points: 5, size: 30, haloType: 'circle', haloSize: 1.5 };
let mic, recorder, soundFile;
let state = 'DESIGN'; 
let recordTimer = 0;
let orbits = []; // 动态轨道

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("sketch-container");
  
  angleMode(DEGREES);
  colorMode(HSB, 360, 100, 100, 1);
  
  calculateOrbits();

  // --- 核心：连接服务器 ---
  // 这里 socket = io() 会自动寻找 localhost:3000
  try {
      socket = io();
      
      // 接收历史记忆
      socket.on("history", (history) => {
          console.log("加载历史:", history.length);
          for (let data of history) {
              allStars.push(new Star(data, null));
          }
      });

      // 接收实时新星
      socket.on("drawing", (data) => {
          allStars.push(new Star(data, null));
      });
  } catch(e) {
      console.log("未连接到服务器");
  }

  mic = new p5.AudioIn();
  recorder = new p5.SoundRecorder();
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

// --- 界面 UI ---
function drawUI() {
  push();
  translate(40, 50);
  fill(255); noStroke();
  textFont('Courier New');
  
  textSize(24); textStyle(BOLD); text("STAR WEAVER", 0, 0);
  
  // 你要求的简介
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

// --- 逻辑与绘制 ---
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
  constructor(data, voiceFile) {
    this.pts = data.points;
    this.sz = data.size;
    this.hType = data.haloType;
    this.hSize = data.haloSize;
    this.orbit = data.orbit || random(orbits);
    this.angle = data.angle || random(360);
    this.speed = data.speed || random(0.04, 0.12);
    this.voice = voiceFile; 
    this.hoverScale = 1.0;
  }
  update() { this.angle += this.speed; }
  display() {
    let x = width/2 + cos(this.angle)*this.orbit;
    let y = height/2 + sin(this.angle)*this.orbit;
    let pulse = (this.voice && this.voice.isPlaying()) ? 1.2 : 1.0;
    renderStar(x, y, this.sz*this.hoverScale*pulse, this.sz*0.4*this.hoverScale*pulse, this.pts, this.hType, this.hSize, 0.9);
  }
  checkHoverInteraction() {
    let x = width/2 + cos(this.angle)*this.orbit;
    let y = height/2 + sin(this.angle)*this.orbit;
    if (dist(mouseX, mouseY, x, y) < 30*this.hoverScale) {
        this.hoverScale = lerp(this.hoverScale, 1.6, 0.1);
        if (this.voice && !this.voice.isPlaying()) this.voice.play();
    } else {
        this.hoverScale = lerp(this.hoverScale, 1.0, 0.1);
    }
  }
}

// --- 核心渲染函数：带辉光特效 ---
function renderStar(x, y, r1, r2, n, halo, hSize, opacity) {
  push();
  translate(x, y);

  // ==========================================
  // ✨ 关键修复：找回“辉光” ✨
  // 这两行代码让线条产生类似霓虹灯的发光效果
  drawingContext.shadowBlur = 25;  // 光晕扩散范围 (数值越大越朦胧)
  drawingContext.shadowColor = 'rgba(255, 255, 255, 0.8)'; // 光晕颜色
  // ==========================================
  
  // 1. 绘制光晕 (Halo)
  stroke(255, opacity * 0.4); 
  noFill();
  
  if (halo === 'circle') {
      ellipse(0, 0, r1 * 2.8 * hSize);
  } else if (halo === 'lines') {
      for(let i=0; i<12; i++){ 
          rotate(30); 
          line(r1 * 1.3, 0, r1 * 2 * hSize, 0); 
      }
  } else if (halo === 'dots') {
      for(let i=0; i<12; i++){ 
          rotate(30); 
          fill(255, opacity * 0.6); noStroke(); 
          circle(r1 * 2 * hSize, 0, 3); 
      }
  } else if (halo === 'rings') { // 双重环
      noFill(); stroke(255, opacity * 0.3);
      ellipse(0, 0, r1 * 2.2 * hSize);
      ellipse(0, 0, r1 * 3.2 * hSize);
  } else if (halo === 'nebula') { // 旋转星云
      for(let i=0; i<3; i++) {
          fill(255, opacity * 0.1); 
          noStroke(); 
          rotate(frameCount * 0.1); // 让光晕缓慢旋转
          ellipse(0, 0, r1 * 4 * hSize, r1 * 1.5 * hSize);
      }
  }

  // 2. 绘制星星本体
  fill(255, opacity); 
  noStroke();
  
  beginShape();
  for (let a = 0; a < 360; a += 360/n) {
    let sx = cos(a) * r2;
    let sy = sin(a) * r2;
    vertex(sx, sy);
    sx = cos(a + 180/n) * r1;
    sy = sin(a + 180/n) * r1;
    vertex(sx, sy);
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
            mic.start(() => { recorder.setInput(mic); recorder.record(soundFile); state = 'RECORDING'; recordTimer = millis(); });
        });
    }
    if (key.toLowerCase() === 'h') {
        let t = ['circle', 'dots', 'lines'];
        myStar.haloType = t[(t.indexOf(myStar.haloType)+1)%t.length];
    }
  }
  if (key.toLowerCase() === 'n') state = 'DESIGN';
}

function finishStar() {
  recorder.stop();
  let starData = {
    points: myStar.points, size: myStar.size,
    haloType: myStar.haloType, haloSize: myStar.haloSize,
    orbit: random(orbits), angle: random(360), speed: random(0.04, 0.12)
  };
  if(socket) socket.emit('drawing', starData);
  allStars.push(new Star(starData, soundFile));
  soundFile = new p5.SoundFile();
  state = 'GALAXY';
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); calculateOrbits(); }