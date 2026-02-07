/**
 * STAR WEAVER - GALAXY EDITION
 * Multi-Halo | Dynamic Orbits | Global Sync
 */

let socket;
let allStars = [];
let myStar = {
  points: 5,
  size: 30,
  haloType: 'circle',
  haloSize: 1.5
};

let mic, recorder, soundFile;
let state = 'DESIGN'; 
let recordTimer = 0;
const RECORD_DURATION = 3000; 

// 动态轨道数组，确保适配所有屏幕
let orbits = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);
  colorMode(HSB, 360, 100, 100, 1);
  
  // 初始化轨道
  calculateOrbits();

  // --- 联网逻辑：部署后自动连接服务器 ---
  try {
    socket = io(); // 连接服务器
    
    // 1. 进场时：接收服务器保存的“历史星空”
    socket.on('init_galaxy', (data) => {
      console.log("Receiving galaxy data...");
      // 把服务器发来的纯数据转为 Star 对象
      allStars = data.map(s => new Star(s, null)); 
    });

    // 2. 运行时：接收别人新生成的星星
    socket.on('new_star_arrival', (data) => {
      allStars.push(new Star(data, null));
    });
  } catch (e) {
    console.warn("Socket.io not found. Running in offline mode.");
  }

  // 音频初始化
  mic = new p5.AudioIn();
  recorder = new p5.SoundRecorder();
  soundFile = new p5.SoundFile();
}

// 根据窗口大小动态计算轨道半径
function calculateOrbits() {
  let minDim = min(width, height);
  // 创建4条轨道，半径分布在屏幕中心的 15% 到 45% 之间
  orbits = [minDim * 0.15, minDim * 0.25, minDim * 0.35, minDim * 0.45];
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

function drawDesignView() {
  // 绘制背景轨道（暗）
  noFill();
  stroke(255, 0.05);
  for (let r of orbits) ellipse(width / 2, height / 2, r * 2);
  
  // 预览当前的星星
  renderStar(width / 2, height / 2, myStar.size, myStar.size * 0.4, myStar.points, myStar.haloType, myStar.haloSize, 1.0);
  
  if (state === 'RECORDING' && millis() - recordTimer > RECORD_DURATION) {
    finishStar();
  }
}

function drawGalaxyView() {
  // 绘制星轨（稍亮）
  noFill();
  stroke(255, 0.08);
  for (let r of orbits) {
    ellipse(width / 2, height / 2, r * 2);
  }

  // 绘制所有星星
  for (let s of allStars) {
    s.update();
    s.display();
    s.checkHoverInteraction(); 
  }
}

function drawUI() {
  push();
  translate(40, 50);
  fill(255); noStroke();
  textFont('Courier New');
  
  // 标题
  textSize(24); textStyle(BOLD);
  text("STAR WEAVER", 0, 0);
  
  // --- 新增：简介 ---
  textStyle(NORMAL);
  textSize(12); fill(255, 0.5);
  text("Leave your own voice in the star universe.", 0, 25);
  
  // 操作提示
  textSize(11); fill(255, 0.4);
  if (state === 'DESIGN') {
    text("1-9: POINTS | UP/DOWN: SIZE | H: HALO STYLE", 0, 55);
    fill(255, 0.8);
    text("> PRESS [SPACE] TO RECORD 3S VOICE", 0, 85);
  } else if (state === 'RECORDING') {
    fill(0, 100, 100);
    text("CAPTURING: " + nf((millis() - recordTimer) / 1000, 1, 1) + "s", 0, 55);
  } else if (state === 'GALAXY') {
    text("NETWORK: ONLINE | STARS: " + allStars.length, 0, 55);
    text("HOVER STARS TO INTERACT", 0, 75);
    fill(255, 0.8);
    text("> PRESS [N] TO WEAVE NEW STAR", 0, 105);
  }
  pop();
}

function renderStar(x, y, r1, r2, n, halo, hSize, opacity) {
  push();
  translate(x, y);
  drawingContext.shadowBlur = 15;
  drawingContext.shadowColor = 'white';
  
  noFill(); stroke(255, opacity * 0.4);
  
  // --- 多样化的光辉形状 ---
  if (halo === 'circle') {
    ellipse(0, 0, r1 * 2.8 * hSize);
  } else if (halo === 'lines') {
    for (let i = 0; i < 12; i++) {
      rotate(30);
      line(r1 * 1.3, 0, r1 * 2 * hSize, 0);
    }
  } else if (halo === 'dots') {
    for (let i = 0; i < 12; i++) {
      rotate(30);
      fill(255, opacity * 0.6); noStroke();
      circle(r1 * 2 * hSize, 0, 2.5);
    }
  } else if (halo === 'rings') { // 新增：双重环
    noFill(); stroke(255, opacity * 0.3);
    ellipse(0, 0, r1 * 2.2 * hSize);
    ellipse(0, 0, r1 * 3.2 * hSize);
  } else if (halo === 'nebula') { // 新增：星云感
    for(let i=0; i<3; i++) {
      fill(255, opacity * 0.1); noStroke();
      rotate(frameCount * 0.1);
      ellipse(0, 0, r1 * 4 * hSize, r1 * 1.5 * hSize);
    }
  }

  fill(255, opacity); noStroke();
  beginShape();
  let angle = 360 / n;
  let halfAngle = angle / 2.0;
  for (let a = 0; a < 360; a += angle) {
    let sx = cos(a) * r2; let sy = sin(a) * r2; vertex(sx, sy);
    sx = cos(a + halfAngle) * r1; sy = sin(a + halfAngle) * r1; vertex(sx, sy);
  }
  endShape(CLOSE);
  pop();
}

class Star {
  constructor(data, voiceFile) {
    this.pts = data.points;
    this.sz = data.size;
    this.hType = data.haloType;
    this.hSize = data.haloSize;
    // 使用传入的轨道半径，或者随机分配一个
    this.orbit = data.orbit || random(orbits); 
    this.angle = data.angle || random(360);
    this.speed = data.speed || random(0.04, 0.12); // 稍微调慢速度，更优雅
    this.hoverScale = 1.0;
    this.voice = voiceFile; // 只有本地创建的星星才有 voiceFile
  }

  update() {
    this.angle += this.speed;
  }

  display() {
    // 实时计算坐标，防止窗口改变后跑偏，强制约束在 orbits 数组中
    // 简单处理：如果当前 orbit 不在新的 orbits 列表里，找个最近的替换
    // 为了性能，这里假设 orbit 是固定的数值，但在 resize 时我们会重置画布
    let x = width / 2 + cos(this.angle) * this.orbit;
    let y = height / 2 + sin(this.angle) * this.orbit;
    
    let pulse = 1.0;
    if (this.voice && this.voice.isLoaded && this.voice.isPlaying()) {
      pulse = 1.2 + sin(frameCount * 15) * 0.1;
    }
    
    renderStar(x, y, this.sz * this.hoverScale * pulse, this.sz * 0.4 * this.hoverScale * pulse, this.pts, this.hType, this.hSize, 0.9);
  }

  checkHoverInteraction() {
    let x = width / 2 + cos(this.angle) * this.orbit;
    let y = height / 2 + sin(this.angle) * this.orbit;
    if (dist(mouseX, mouseY, x, y) < 30 * this.hoverScale) {
      this.hoverScale = lerp(this.hoverScale, 1.6, 0.1);
      // 只有本地有录音的才播放
      if (this.voice && this.voice.isLoaded() && !this.voice.isPlaying()) {
        this.voice.play();
      }
    } else {
      this.hoverScale = lerp(this.hoverScale, 1.0, 0.1);
    }
  }
}

function keyPressed() {
  if (state === 'DESIGN') {
    if (key >= '1' && key <= '9') myStar.points = int(key);
    if (keyCode === UP_ARROW) myStar.size = min(myStar.size + 5, 60); // 限制最大大小
    if (keyCode === DOWN_ARROW) myStar.size = max(myStar.size - 5, 10);
    if (key.toLowerCase() === 'h') {
      // 循环切换光辉样式
      let t = ['circle', 'dots', 'lines', 'rings', 'nebula'];
      myStar.haloType = t[(t.indexOf(myStar.haloType) + 1) % t.length];
    }
    if (key === ' ') startRecording();
  }
  if (key.toLowerCase() === 'n') state = 'DESIGN';
}

function startRecording() {
  userStartAudio().then(() => {
    mic.start(() => {
        recorder.setInput(mic);
        recorder.record(soundFile);
        state = 'RECORDING';
        recordTimer = millis();
    });
  });
}

function finishStar() {
  recorder.stop();
  let starData = {
    points: myStar.points, 
    size: myStar.size,
    haloType: myStar.haloType, 
    haloSize: myStar.haloSize,
    orbit: random(orbits), // 分配到当前计算好的轨道上
    angle: random(360), 
    speed: random(0.04, 0.12)
  };
  
  // --- 关键：发送给服务器 ---
  if (socket) {
    socket.emit('post_star', starData);
  }

  // 本地生成带声音的星星
  allStars.push(new Star(starData, soundFile));
  soundFile = new p5.SoundFile();
  state = 'GALAXY';
}

// 窗口大小改变时，重置画布和轨道，防止星星跑出去
function windowResized() { 
  resizeCanvas(windowWidth, windowHeight); 
  calculateOrbits(); 
}