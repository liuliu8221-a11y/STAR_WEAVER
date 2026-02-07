/**
 * STAR WEAVER - MOBILE UI VERSION
 * Features: Touch Controls | Sliders | Mobile Responsive
 */

let socket;
let allStars = [];
let myStar = { points: 5, size: 30, haloType: 'circle', haloSize: 1.5, name: "" };

// 录音相关
let mic;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

let state = 'GALAXY'; 
let recordTimer = 0;
let orbits = []; 
let myId = ""; 
let selectedStar = null; // 当前选中的星星

// --- UI 控件变量 ---
let btnCreate, btnRecord, btnCancel, btnHalo, btnDelete;
let sliderSize, sliderPoints;
let inputName;
let uiContainer; // 用于存放设计模式的控件

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("sketch-container");
  
  angleMode(DEGREES);
  colorMode(HSB, 360, 100, 100, 1);
  textAlign(CENTER, CENTER);
  
  calculateOrbits();
  initMobileUI(); // 初始化所有按钮

  try {
      socket = io();
      socket.on("connect", () => myId = socket.id);
      socket.on("history", (history) => {
          allStars = [];
          for (let data of history) loadStarFromData(data);
      });
      socket.on("drawing", (data) => loadStarFromData(data));
      socket.on("star_deleted", (id) => {
          allStars = allStars.filter(s => s.id !== id);
          if (selectedStar && selectedStar.id === id) selectedStar = null;
      });
  } catch(e) {}

  mic = new p5.AudioIn();
  mic.start();
}

function draw() {
  background(0); 
  
  // 更新 UI 状态可见性
  updateUIVisibility();

  if (state === 'DESIGN' || state === 'RECORDING') {
    drawDesignView();
  } else {
    drawGalaxyView();
  }
  
  drawStaticText();
}

// --- 初始化所有手机端 UI 控件 ---
function initMobileUI() {
    // 1. [GALAXY] 创建星星按钮 (+)
    btnCreate = createButton("+ CREATE STAR");
    btnCreate.class("ui-element ui-button");
    btnCreate.position(width/2 - 70, height - 80);
    btnCreate.size(140, 50);
    btnCreate.mousePressed(enterDesignMode);

    // 2. [GALAXY] 删除按钮 (默认隐藏)
    btnDelete = createButton("DELETE MY STAR");
    btnDelete.class("ui-element ui-button");
    btnDelete.style('border-color', 'red');
    btnDelete.style('color', 'red');
    btnDelete.position(width/2 - 70, height - 140);
    btnDelete.size(140, 40);
    btnDelete.hide();
    btnDelete.mousePressed(deleteSelectedStar);

    // --- 以下是设计模式控件 ---
    
    // 3. [DESIGN] 名字输入框
    inputName = createInput("");
    inputName.attribute("placeholder", "NAME YOUR STAR");
    inputName.class("ui-element ui-input");
    inputName.position(width/2 - 100, 80);
    inputName.size(200, 30);
    inputName.hide();

    // 4. [DESIGN] 尺寸滑块
    sliderSize = createSlider(10, 80, 30);
    sliderSize.class("ui-element");
    sliderSize.hide();

    // 5. [DESIGN] 角数滑块
    sliderPoints = createSlider(3, 12, 5, 1);
    sliderPoints.class("ui-element");
    sliderPoints.hide();

    // 6. [DESIGN] 切换光晕按钮
    btnHalo = createButton("HALO: CIRCLE");
    btnHalo.class("ui-element ui-button");
    btnHalo.mousePressed(toggleHalo);
    btnHalo.hide();

    // 7. [DESIGN] 录音/完成按钮
    btnRecord = createButton("HOLD TO RECORD");
    btnRecord.class("ui-element ui-button");
    btnRecord.style('background', 'white'); // 初始反色突出
    btnRecord.style('color', 'black');
    btnRecord.mousePressed(handleRecordPress); // 点击处理
    btnRecord.hide();

    // 8. [DESIGN] 取消按钮
    btnCancel = createButton("CANCEL");
    btnCancel.class("ui-element ui-button");
    btnCancel.mousePressed(() => {
        state = 'GALAXY';
        selectedStar = null;
    });
    btnCancel.hide();

    // 第一次布局计算
    updateLayout();
}

// --- 响应式布局更新 ---
function updateLayout() {
    // 底部控制区布局
    let bottomY = height - 60;
    let centerX = width / 2;

    // GALAXY 界面
    if(btnCreate) btnCreate.position(centerX - 70, bottomY - 20);
    if(btnDelete) btnDelete.position(centerX - 70, bottomY - 80);

    // DESIGN 界面
    if(inputName) inputName.position(centerX - 100, height * 0.15);
    
    // 滑块和按钮排布
    let controlsY = height * 0.65;
    if(sliderSize) {
        sliderSize.position(centerX - 120, controlsY);
        sliderSize.size(240);
    }
    if(sliderPoints) {
        sliderPoints.position(centerX - 120, controlsY + 40);
        sliderPoints.size(240);
    }
    if(btnHalo) {
        btnHalo.position(centerX - 120, controlsY + 80);
        btnHalo.size(240, 30);
    }
    
    // 底部大按钮
    if(btnRecord) {
        btnRecord.position(centerX - 120, height - 120);
        btnRecord.size(240, 50);
    }
    if(btnCancel) {
        btnCancel.position(centerX - 120, height - 60);
        btnCancel.size(240, 40);
    }
}

function updateUIVisibility() {
    if (state === 'GALAXY') {
        btnCreate.show();
        inputName.hide(); sliderSize.hide(); sliderPoints.hide(); btnHalo.hide(); btnRecord.hide(); btnCancel.hide();
        
        // 只有选中了自己的星星才显示删除
        if (selectedStar && selectedStar.owner === myId) {
            btnDelete.show();
        } else {
            btnDelete.hide();
        }
    } else {
        // DESIGN MODE
        btnCreate.hide(); btnDelete.hide();
        inputName.show(); sliderSize.show(); sliderPoints.show(); btnHalo.show(); btnRecord.show(); btnCancel.show();
        
        if (state === 'RECORDING') {
            btnRecord.html("RECORDING... (TAP TO STOP)");
            btnRecord.style('background', 'red');
            btnRecord.style('color', 'white');
            // 录音时隐藏其他调整控件，防止干扰
            sliderSize.hide(); sliderPoints.hide(); btnHalo.hide(); inputName.hide();
        } else {
            btnRecord.html(myStar.name ? "TAP TO RECORD" : "ENTER NAME FIRST");
            btnRecord.style('background', 'white');
            btnRecord.style('color', 'black');
        }
    }
}

// --- 交互逻辑 ---

function enterDesignMode() {
    userStartAudio(); // 手机端必须的手势触发
    state = 'DESIGN';
    myStar.name = "";
    inputName.value(""); // 清空输入框
}

function handleRecordPress() {
    // 1. 如果正在录音 -> 停止
    if (state === 'RECORDING') {
        finishStar();
        return;
    }
    
    // 2. 如果准备录音
    // 先检查名字
    let name = inputName.value();
    if (!name || name.trim() === "") {
        alert("Please name your star first!");
        inputName.elt.focus();
        return;
    }
    
    myStar.name = name;
    startNativeRecording();
}

function toggleHalo() {
    let t = ['circle', 'dots', 'lines', 'rings', 'nebula'];
    myStar.haloType = t[(t.indexOf(myStar.haloType)+1)%t.length];
    btnHalo.html("HALO: " + myStar.haloType.toUpperCase());
}

function deleteSelectedStar() {
    if (selectedStar && selectedStar.owner === myId) {
        socket.emit("delete_star", selectedStar.id);
        allStars = allStars.filter(s => s.id !== selectedStar.id); // 本地立即移除
        selectedStar = null;
    }
}

// 手机端触摸选取
function mousePressed() {
    // 如果点击在 UI 控件上，不要触发选星逻辑 (简单判断 Y 轴)
    if (mouseY > height - 150 && state === 'DESIGN') return; 

    if (state === 'GALAXY') {
        let found = false;
        // 寻找点击的星星
        for (let s of allStars) {
            let x = width/2 + cos(s.angle)*s.orbit;
            let y = height/2 + sin(s.angle)*s.orbit;
            if (dist(mouseX, mouseY, x, y) < 40) {
                selectedStar = s;
                // 播放声音
                if (s.voice && s.voice.isLoaded() && !s.voice.isPlaying()) s.voice.play();
                found = true;
                break;
            }
        }
        if (!found) selectedStar = null; // 点击空白处取消选择
    }
}


// --- 绘图逻辑 ---

function drawStaticText() {
    push();
    fill(255); noStroke(); textFont('Courier New');
    
    // 左上角标题
    textAlign(LEFT, TOP);
    textSize(18); textStyle(BOLD);
    text("STAR WEAVER", 20, 20);
    textSize(12); textStyle(NORMAL); fill(255, 0.6);
    text(allStars.length + " STARS ONLINE", 20, 45);

    // 选中提示
    if (state === 'GALAXY' && selectedStar) {
        textAlign(CENTER, BOTTOM);
        fill(255); textSize(14);
        text("SELECTED: " + selectedStar.name, width/2, height - 150);
        if(selectedStar.owner !== myId) {
             fill(255, 0.5); textSize(10);
             text("(READ ONLY)", width/2, height - 135);
        }
    }
    
    // 设计模式下的标签
    if (state === 'DESIGN' && state !== 'RECORDING') {
        textAlign(LEFT, BOTTOM); textSize(12); fill(255, 0.6);
        let sliderX = sliderSize.x;
        let sliderY = sliderSize.y;
        text("SIZE", sliderX, sliderY - 5);
        text("POINTS", sliderX, sliderPoints.y - 5);
    }
    pop();
}

function drawDesignView() {
    drawOrbitGuides();
    
    // 从滑块获取值
    myStar.size = sliderSize.value();
    myStar.points = sliderPoints.value();

    // 渲染预览
    renderStar(width/2, height/2, myStar.size, myStar.size*0.4, myStar.points, myStar.haloType, myStar.haloSize, 1.0);
    
    if (state === 'RECORDING') {
        // 录音时间提示
        fill(255, 0, 0); textSize(14); textAlign(CENTER, TOP);
        text("REC: " + nf((millis() - recordTimer) / 1000, 1, 1) + "s", width/2, height/2 + 80);
        // 超时自动结束
        if (millis() - recordTimer > 3000) finishStar();
    }
}

function drawGalaxyView() {
  drawOrbitGuides();
  for (let s of allStars) {
    s.update(); s.display(); 
  }
}

// ... 保持原有的 loadStarFromData, renderStar, Star class, recording logic ...
// (为了节省篇幅，这里简写，请保留你之前版本里的这些核心函数，它们不需要变)
// 务必保留：loadStarFromData, drawOrbitGuides, calculateOrbits, Star类, renderStar
// 务必保留：startNativeRecording, finishStar, saveAndSendStar, windowResized

// --- 补全原来的核心逻辑 (复制回这里) ---

function loadStarFromData(data) {
    let newSound = null;
    try { if (data.audioBlob) { let b = new Blob([data.audioBlob], {type:'audio/webm'}); newSound = loadSound(URL.createObjectURL(b)); } } catch(e){}
    if (!allStars.find(s => s.id === data.id)) allStars.push(new Star(data, newSound));
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
    this.id = data.id; this.owner = data.owner; this.name = data.name || "Unknown";
    this.pts = data.points; this.sz = data.size; this.hType = data.haloType; this.hSize = data.haloSize;
    this.orbit = data.orbit || random(orbits); this.angle = data.angle || random(360); this.speed = data.speed || random(0.04, 0.12);
    this.voice = soundObj; this.hoverScale = 1.0;
  }
  update() { this.angle += this.speed; }
  display() {
    let x = width/2 + cos(this.angle)*this.orbit;
    let y = height/2 + sin(this.angle)*this.orbit;
    let isPlaying = this.voice && this.voice.isLoaded() && this.voice.isPlaying();
    
    // 如果是选中的星星，放大并画圈
    let isSelected = (selectedStar && selectedStar.id === this.id);
    let pulse = (isPlaying || isSelected) ? 1.5 : 1.0;
    
    renderStar(x, y, this.sz*pulse, this.sz*0.4*pulse, this.pts, this.hType, this.hSize, 0.9);
    
    if (isSelected || isPlaying) {
        push(); translate(x, y); fill(255); noStroke(); textAlign(CENTER, TOP);
        textSize(max(10, this.sz * 0.4)); text(this.name, 0, this.sz*2+5);
        if(isSelected) { noFill(); stroke(255, 0.5); ellipse(0,0, this.sz*4); }
        pop();
    }
  }
}

function renderStar(x, y, r1, r2, n, halo, hSize, opacity) {
  push(); translate(x, y);
  drawingContext.shadowBlur = 25; drawingContext.shadowColor = 'rgba(255, 255, 255, 0.8)';
  stroke(255, opacity*0.4); noFill();
  if (halo === 'circle') ellipse(0,0, r1*2.8*hSize);
  else if (halo === 'lines') { for(let i=0; i<12; i++){ rotate(30); line(r1*1.3,0, r1*2*hSize,0); } }
  else if (halo === 'dots') { for(let i=0; i<12; i++){ rotate(30); fill(255, opacity*0.6); noStroke(); circle(r1*2*hSize,0, 2.5); } }
  else if (halo === 'rings') { noFill(); stroke(255, opacity*0.3); ellipse(0,0, r1*2.2*hSize); ellipse(0,0, r1*3.2*hSize); }
  else if (halo === 'nebula') { for(let i=0; i<3; i++) { fill(255, opacity*0.1); noStroke(); rotate(frameCount*0.1); ellipse(0,0, r1*4*hSize, r1*1.5*hSize); } }
  fill(255, opacity); noStroke();
  beginShape();
  for (let a = 0; a < 360; a += 360/n) { vertex(cos(a)*r2, sin(a)*r2); vertex(cos(a+180/n)*r1, sin(a+180/n)*r1); }
  endShape(CLOSE);
  pop();
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
            isRecording = true; state = 'RECORDING'; recordTimer = millis();
        } catch (err) { mediaRecorder = new MediaRecorder(mic.stream); mediaRecorder.start(); }
    }
}

function finishStar() {
    if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop(); isRecording = false;
    }
}

function saveAndSendStar() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const starId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    let starData = {
        id: starId, owner: myId, name: myStar.name,
        points: myStar.points, size: myStar.size,
        haloType: myStar.haloType, haloSize: myStar.haloSize,
        orbit: random(orbits), angle: random(360), speed: random(0.04, 0.12),
        audioBlob: audioBlob
    };
    let url = URL.createObjectURL(audioBlob);
    allStars.push(new Star(starData, loadSound(url)));
    if(socket) socket.emit('drawing', starData);
    state = 'GALAXY';
    selectedStar = null; // 重置选择
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); calculateOrbits(); updateLayout(); }