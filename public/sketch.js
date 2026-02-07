/**
 * STAR WEAVER - POTATO QUALITY VERSION (Ultra Compressed)
 * Features: 6kbps Bitrate (Walkie-talkie vibe)
 * Size: ~2KB per star (Instant upload)
 */

let socket;
let allStars = [];
let myStar = { points: 5, size: 30, haloType: 'circle', haloSize: 1.5 };

// 录音相关
let mic;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

let state = 'DESIGN'; 
let recordTimer = 0;
let orbits = []; 

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("sketch-container");
  
  angleMode(DEGREES);
  colorMode(HSB, 360, 100, 100, 1);
  
  calculateOrbits();

  // --- 1. 连接服务器 ---
  try {
      socket = io();
      
      socket.on("history", (history) => {
          console.log("加载历史星星:", history.length);
          for (let data of history) {
              loadStarFromData(data); 
          }
      });

      socket.on("drawing", (data) => {
          loadStarFromData(data);
      });
  } catch(e) {
      console.log("离线模式");
  }

  // --- 2. 初始化麦克风 ---
  mic = new p5.AudioIn();
  mic.start(() => {
      console.log("麦克风准备就绪");
  });
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
    if (data.audioBlob) {
        // 将极小的二进制数据转回 Blob
        // 注意：这里指明 WebM 格式
        let blob = new Blob([data.audioBlob], { type: 'audio/webm' });
        let url = URL.createObjectURL(blob);
        newSound = loadSound(url);
    }
    allStars.push(new Star(data, newSound));
}

// --- 界面 UI ---
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
    if (frameCount % 60 < 30) circle(-15, 52, 8); 
    text("TRANSMITTING... " + nf((millis() - recordTimer) / 1000, 1, 1) + "s", 0, 55);
  } else if (state === 'GALAXY') {
    text("NETWORK: ONLINE | STARS: " + allStars.length, 0, 55);
    text("HOVER STARS TO DECODE SIGNAL", 0, 75);
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
    
    if (key === ' ' && !isRecording) {
        startNativeRecording();
    }
    
    if (key.toLowerCase() === 'h') {
        let t = ['circle', 'dots', 'lines', 'rings', 'nebula'];
        myStar.haloType = t[(t.indexOf(myStar.haloType)+1)%t.length];
    }
  }
  if (key.toLowerCase() === 'n') state = 'DESIGN';
}

// --- 【关键修改】全损音质配置 ---
function startNativeRecording() {
    userStartAudio();
    
    if (mic && mic.stream) {
        // 这里是关键！配置 MediaRecorder 参数
        const options = {
            mimeType: 'audio/webm', // 使用 WebM 格式
            audioBitsPerSecond: 6000 // ⚠️ 6kbps (极低比特率)，全损音质，文件极小！
        };
        
        try {
            mediaRecorder = new MediaRecorder(mic.stream, options);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };

            mediaRecorder.onstop = saveAndSendStar;

            mediaRecorder.start();
            isRecording = true;
            state = 'RECORDING';
            recordTimer = millis();
            console.log("开始录音: 6kbps 全损模式");
        } catch (err) {
            console.error("录音失败:", err);
            // 如果浏览器不支持 6000 这种超低设置，它会回退到默认，不会报错
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
    // 压缩打包
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    
    // 控制台会打印出文件大小，你可以看到它有多小
    console.log("打包完成! 文件大小:", audioBlob.size, "bytes"); 

    let starData = {
        points: myStar.points, 
        size: myStar.size,
        haloType: myStar.haloType, 
        haloSize: myStar.haloSize,
        orbit: random(orbits), 
        angle: random(360), 
        speed: random(0.04, 0.12),
        audioBlob: audioBlob
    };
    
    if(socket) socket.emit('drawing', starData);
    
    // 本地播放
    let audioUrl = URL.createObjectURL(audioBlob);
    let localSound = loadSound(audioUrl);
    
    allStars.push(new Star(starData, localSound));
    state = 'GALAXY';
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); calculateOrbits(); }