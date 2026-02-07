/**
 * STAR WEAVER - FINAL FIXED VERSION
 * 1. App.js Error Fixed
 * 2. Star Position Moved Up (Red Circle)
 * 3. Names Always Visible
 * 4. UI Perfectly Centered
 */

let socket;
let allStars = [];
let myStar = { points: 5, size: 30, haloType: 'circle', haloSize: 1.5, name: "" };

let mic;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

let state = 'GALAXY'; 
let recordTimer = 0;
let orbits = []; 
let myId = ""; 
let selectedStar = null; 

// UI 变量
let btnCreate, btnRecord, btnCancel, btnHalo, btnDelete;
let sliderSize, sliderPoints;
let inputName;

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("sketch-container");
  
  angleMode(DEGREES);
  colorMode(HSB, 360, 100, 100, 1);
  textAlign(CENTER, CENTER);
  
  calculateOrbits();
  initMobileUI(); 

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
  
  updateUIVisibility();

  if (state === 'DESIGN' || state === 'RECORDING') {
    drawDesignView();
  } else {
    drawGalaxyView();
  }
  
  drawStaticText();
}

function initMobileUI() {
    // 1. 首页按钮
    btnCreate = createButton("+ CREATE STAR");
    btnCreate.class("ui-element ui-button");
    btnCreate.mousePressed(enterDesignMode);

    btnDelete = createButton("DELETE MY STAR");
    btnDelete.class("ui-element ui-button");
    btnDelete.style('border-color', 'red');
    btnDelete.style('color', 'red');
    btnDelete.hide();
    btnDelete.mousePressed(deleteSelectedStar);

    // 2. 设计页控件
    inputName = createInput("");
    inputName.attribute("placeholder", "NAME YOUR STAR");
    inputName.class("ui-element ui-input");
    inputName.hide();

    sliderSize = createSlider(10, 80, 30);
    sliderSize.class("ui-element");
    sliderSize.hide();

    sliderPoints = createSlider(3, 12, 5, 1);
    sliderPoints.class("ui-element");
    sliderPoints.hide();

    btnHalo = createButton("HALO: CIRCLE");
    btnHalo.class("ui-element ui-button");
    btnHalo.mousePressed(toggleHalo);
    btnHalo.hide();

    btnRecord = createButton("HOLD TO RECORD");
    btnRecord.class("ui-element ui-button");
    btnRecord.style('background', 'white'); 
    btnRecord.style('color', 'black');
    btnRecord.mousePressed(handleRecordPress); 
    btnRecord.hide();

    btnCancel = createButton("CANCEL");
    btnCancel.class("ui-element ui-button");
    btnCancel.mousePressed(() => {
        state = 'GALAXY';
        selectedStar = null;
    });
    btnCancel.hide();

    updateLayout();
}

// --- 关键：UI 布局逻辑 ---
function updateLayout() {
    let centerX = width / 2;

    // 1. 首页按钮 (宽160, 居中算法: centerX - 80)
    if(btnCreate) {
        btnCreate.size(160, 50);
        btnCreate.position(centerX - 80, height - 100);
    }
    if(btnDelete) {
        btnDelete.size(160, 40);
        btnDelete.position(centerX - 80, height - 160);
    }

    // 2. 设计页
    // 输入框
    if(inputName) {
        inputName.size(200, 30);
        inputName.position(centerX - 100, height * 0.15);
    }
    
    // 控件区域 (整体下移，给星星留出上半部分空间)
    let controlsStart = height * 0.60; 
    let gap = 65; // 拉大间距，防止文字重叠

    if(sliderSize) {
        sliderSize.size(240);
        sliderSize.position(centerX - 120, controlsStart);
    }
    if(sliderPoints) {
        sliderPoints.size(240);
        sliderPoints.position(centerX - 120, controlsStart + gap);
    }
    if(btnHalo) {
        btnHalo.size(240, 35);
        btnHalo.position(centerX - 120, controlsStart + gap * 2);
    }
    
    // 底部操作按钮
    if(btnRecord) {
        btnRecord.size(240, 50);
        btnRecord.position(centerX - 120, height - 130);
    }
    if(btnCancel) {
        btnCancel.size(240, 40);
        btnCancel.position(centerX - 120, height - 70);
    }
}

function updateUIVisibility() {
    if (state === 'GALAXY') {
        btnCreate.show();
        inputName.hide(); sliderSize.hide(); sliderPoints.hide(); btnHalo.hide(); btnRecord.hide(); btnCancel.hide();
        if (selectedStar && selectedStar.owner === myId) btnDelete.show();
        else btnDelete.hide();
    } else {
        btnCreate.hide(); btnDelete.hide();
        inputName.show(); sliderSize.show(); sliderPoints.show(); btnHalo.show(); btnRecord.show(); btnCancel.show();
        
        if (state === 'RECORDING') {
            btnRecord.html("RECORDING... (TAP TO STOP)");
            btnRecord.style('background', 'red');
            btnRecord.style('color', 'white');
            sliderSize.hide(); sliderPoints.hide(); btnHalo.hide(); inputName.hide();
        } else {
            btnRecord.html(myStar.name ? "TAP TO RECORD" : "ENTER NAME FIRST");
            btnRecord.style('background', 'white');
            btnRecord.style('color', 'black');
        }
    }
}

function enterDesignMode() {
    userStartAudio(); 
    state = 'DESIGN';
    myStar.name = "";
    inputName.value(""); 
}

function handleRecordPress() {
    if (state === 'RECORDING') {
        finishStar();
        return;
    }
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
        allStars = allStars.filter(s => s.id !== selectedStar.id); 
        selectedStar = null;
    }
}

function mousePressed() {
    if (mouseY > height - 150 && state === 'DESIGN') return; 

    if (state === 'GALAXY') {
        let found = false;
        for (let s of allStars) {
            let x = width/2 + cos(s.angle)*s.orbit;
            let y = height/2 + sin(s.angle)*s.orbit;
            if (dist(mouseX, mouseY, x, y) < 40) {
                selectedStar = s;
                if (s.voice && s.voice.isLoaded() && !s.voice.isPlaying()) s.voice.play();
                found = true;
                break;
            }
        }
        if (!found) selectedStar = null; 
    }
}

function drawStaticText() {
    push();
    fill(255); noStroke(); textFont('Courier New');
    
    textAlign(LEFT, TOP);
    textSize(18); textStyle(BOLD);
    text("STAR WEAVER", 20, 20);
    textSize(12); textStyle(NORMAL); fill(255, 0.6);
    text(allStars.length + " STARS ONLINE", 20, 45);

    if (state === 'GALAXY' && selectedStar) {
        textAlign(CENTER, BOTTOM);
        fill(255); textSize(14);
        text("SELECTED: " + selectedStar.name, width/2, height - 170); 
        if(selectedStar.owner !== myId) {
             fill(255, 0.5); textSize(10);
             text("(READ ONLY)", width/2, height - 155);
        }
    }
    
    // 设计模式标签 (随滑块位置)
    if (state === 'DESIGN' && state !== 'RECORDING') {
        textAlign(LEFT, BOTTOM); textSize(12); fill(255, 0.8);
        
        let sliderX = sliderSize.x;
        let sliderY = sliderSize.y;
        text("SIZE", sliderX, sliderY - 10); 

        let pointsY = sliderPoints.y;
        text("POINTS", sliderX, pointsY - 10);
    }
    pop();
}

function drawDesignView() {
    // 【关键修改】星星位置上移至屏幕 35% 处 (对应红色圈圈位置)
    let designCenterY = height * 0.35;

    drawOrbitGuides(designCenterY);
    
    myStar.size = sliderSize.value();
    myStar.points = sliderPoints.value();
    
    renderStar(width/2, designCenterY, myStar.size, myStar.size*0.4, myStar.points, myStar.haloType, myStar.haloSize, 1.0);
    
    if (state === 'RECORDING') {
        fill(255, 0, 0); textSize(14); textAlign(CENTER, TOP);
        text("REC: " + nf((millis() - recordTimer) / 1000, 1, 1) + "s", width/2, designCenterY + 80);
        if (millis() - recordTimer > 3000) finishStar();
    }
}

function drawGalaxyView() {
  drawOrbitGuides(height/2);
  for (let s of allStars) {
    s.update(); s.display(); 
  }
}

function loadStarFromData(data) {
    let newSound = null;
    try { if (data.audioBlob) { let b = new Blob([data.audioBlob], {type:'audio/webm'}); newSound = loadSound(URL.createObjectURL(b)); } } catch(e){}
    if (!allStars.find(s => s.id === data.id)) allStars.push(new Star(data, newSound));
}

function drawOrbitGuides(centerY) {
    noFill(); 
    stroke(255, 0.25); 
    for (let r of orbits) ellipse(width/2, centerY, r*2);
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
  
  // --- 名字显示逻辑 ---
  display() {
    let x = width/2 + cos(this.angle)*this.orbit;
    let y = height/2 + sin(this.angle)*this.orbit;
    let isPlaying = this.voice && this.voice.isLoaded() && this.voice.isPlaying();
    let isSelected = (selectedStar && selectedStar.id === this.id);
    let pulse = (isPlaying || isSelected) ? 1.5 : 1.0;
    
    renderStar(x, y, this.sz*pulse, this.sz*0.4*pulse, this.pts, this.hType, this.hSize, 0.9);
    
    push(); 
    translate(x, y); 
    noStroke(); 
    textAlign(CENTER, TOP);
    let textY = this.sz * 2 + 5;
    
    if (isSelected || isPlaying) {
        // 选中时：高亮、大字
        fill(255, 255); 
        textSize(max(12, this.sz * 0.5));
        textStyle(BOLD);
        text(this.name, 0, textY);
        if(isSelected) { 
            noFill(); stroke(255, 0.5); ellipse(0,0, this.sz*4); 
        }
    } 
    else {
        // 【关键】未选中时：半透明、常驻显示
        fill(255, 120); 
        textSize(10);
        textStyle(NORMAL);
        text(this.name, 0, textY);
    }
    pop();
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
    selectedStar = null; 
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); calculateOrbits(); updateLayout(); }