/**
 * STAR WEAVER - AUDIO NETWORK VERSION
 * Fix: Sends Audio Data via Socket.io (Base64)
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
      
      // --- 接收历史 (含音频数据) ---
      socket.on("history", (history) => {
          console.log("加载历史星星:", history.length);
          for (let data of history) {
              loadStarFromData(data); // 使用新函数加载
          }
      });

      // --- 接收实时新星 (含音频数据) ---
      socket.on("drawing", (data) => {
          console.log("收到新星!");
          loadStarFromData(data); // 使用新函数加载
      });
  } catch(e) {
      console.log("未连接到服务器");
  }

  mic = new p5.AudioIn();
  mic.start(); // 确保麦克风尽早启动
  
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

// --- 辅助函数：从数据还原星星和声音 ---
function loadStarFromData(data) {
    let newSound = null;
    
    // 如果数据里包含音频字符串 (audioData)
    if (data.audioData) {
        // 创建一个临时的 SoundFile
        newSound = new p5.SoundFile();
        // 关键：将 Base64 字符串设置给它
        newSound.setPath(data.audioData);
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

// --- 星体类 ---
class Star {
  constructor(data, soundObj) {
    this.pts = data.points;
    this.sz = data.size;
    this.hType = data.haloType;
    this.hSize = data.haloSize;
    this.orbit = data.orbit || random(orbits);
    this.angle = data.angle || random(360);
    this.speed = data.speed || random(0.04, 0.12);
    this.voice = soundObj; // 存储传入的声音对象
    this.hoverScale = 1.0;
  }
  update() { this.angle += this.speed; }
  display() {
    let x = width/2 + cos(this.angle)*this.orbit;
    let y = height/2 + sin(this.angle)*this.orbit;
    // 检查声音是否正在播放 (增加 isLoaded 检查防止报错)
    let isPlaying = this.voice && this.voice.isLoaded() && this.voice.isPlaying();
    let pulse = isPlaying ? 1.5 : 1.0;
    
    renderStar(x, y, this.sz*this.hoverScale*pulse, this.sz*0.4*this.hoverScale*pulse, this.pts, this.hType, this.hSize, 0.9);
  }
  checkHoverInteraction() {
    let x = width/2 + cos(this.angle)*this.orbit;
    let y = height/2 + sin(this.angle)*this.orbit;
    if (dist(mouseX, mouseY, x, y) < 30*this.hoverScale) {
        this.hoverScale = lerp(this.hoverScale, 1.6, 0.1);
        // 播放逻辑：确保声音存在、已加载、且没有正在播放
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
  // 辉光效果
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
            // 开始录音
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

// --- 关键修改：录音完成后的处理 ---
function finishStar() {
  // 1. 停止录音
  recorder.stop();
  
  // 2. 获取录音的 Blob 对象
  let soundBlob = soundFile.getBlob();
  
  // 3. 将 Blob 转换为 Base64 字符串以便通过 Socket 发送
  let reader = new FileReader();
  reader.readAsDataURL(soundBlob);
  
  reader.onloadend = function() {
      let base64Audio = reader.result; // 这就是音频的“文字版”
      
      let starData = {
        points: myStar.points, 
        size: myStar.size,
        haloType: myStar.haloType, 
        haloSize: myStar.haloSize,
        orbit: random(orbits), 
        angle: random(360), 
        speed: random(0.04, 0.12),
        audioData: base64Audio // 重点：把音频数据放进包里！
      };
      
      // 4. 发送完整数据包
      if(socket) socket.emit('drawing', starData);
      
      // 5. 本地显示
      // 为了本地不需要重新解码，我们直接用刚才录好的 soundFile
      // 但为了逻辑统一，这里其实已经不需要特别处理，因为 .emit 出去后
      // 我们本地也直接存入数组即可。为了性能，我们直接用 soundFile
      allStars.push(new Star(starData, soundFile));
      
      // 6. 重置
      soundFile = new p5.SoundFile();
      state = 'GALAXY';
  }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); calculateOrbits(); }