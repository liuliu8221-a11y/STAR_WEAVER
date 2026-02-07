
let socket;
let allStars = [];
let myStar = { points: 5, size: 20, haloType: 'circle', haloSize: 1.5, name: "" };

//record
let mic;
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let tempAudioBlob = null;
let supportedMimeType = ""; 


let state = 'INTRO'; 
let recordTimer = 0;
let orbits = []; 
let myId = ""; 
let selectedStar = null; 

//God mode
let isAdmin = false;


let btnCreate, btnRecord, btnCancel, btnHalo, btnDelete;
let btnConfirm, btnRerecord;
let sliderSize, sliderPoints;
let inputName;

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("sketch-container");
  
  angleMode(DEGREES);
  colorMode(HSB, 360, 100, 100, 1);
  textAlign(CENTER, CENTER);
  
 
  let params = getURLParams();
  if (params.admin === 'true') {
      isAdmin = true;
      console.log("⚠️ ADMIN MODE ACTIVATED");
  }

  
  checkSupportedMimeType();

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
}


function checkSupportedMimeType() {
    const types = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4", 
        "audio/ogg",
        "" 
    ];
    
    for (let type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            supportedMimeType = type;
            console.log("Using Audio Format: " + (type || "default"));
            return;
        }
    }
}

function draw() {
  background(0); 
  updateUIVisibility();

  if (state === 'INTRO') {
    drawIntroScreen();
  } 
  else if (state === 'GALAXY') {
    drawGalaxyView();
    drawStaticText();
  } 
  else {
    drawDesignView();
    drawStaticText();
  }
}

function drawIntroScreen() {
    let pulse = map(sin(frameCount * 2), -1, 1, 100, 255);
    drawOrbitGuides(height/2);

    fill(255); noStroke();
    textFont('Courier New');
    textSize(32); textStyle(BOLD);
    text("STAR WEAVER", width/2, height/2 - 20);
    
    fill(pulse); 
    textSize(14); textStyle(NORMAL);
    text("[ CLICK ANYWHERE TO ENTER ]", width/2, height/2 + 30);
    
    fill(255, 100); textSize(10);
    text("Microphone access required", width/2, height - 30);
}

function initMobileUI() {
    btnCreate = createButton("+ CREATE STAR");
    btnCreate.class("ui-element ui-button");
    btnCreate.mousePressed(enterDesignMode);

    btnDelete = createButton("DELETE STAR");
    btnDelete.class("ui-element ui-button");
    btnDelete.style('border-color', 'red'); 
    btnDelete.style('color', 'red');
    btnDelete.mousePressed(deleteSelectedStar); 

    inputName = createInput("");
    inputName.attribute("placeholder", "NAME YOUR STAR");
    inputName.class("ui-element ui-input");

    sliderSize = createSlider(5, 50, 20); sliderSize.class("ui-element");
    sliderPoints = createSlider(3, 12, 5, 1); sliderPoints.class("ui-element");
    
    btnHalo = createButton("HALO: CIRCLE");
    btnHalo.class("ui-element ui-button");
    btnHalo.mousePressed(toggleHalo);

    btnRecord = createButton("TAP TO RECORD");
    btnRecord.class("ui-element ui-button");
    btnRecord.style('background', 'white'); btnRecord.style('color', 'black');
    btnRecord.mousePressed(handleRecordPress); 

    btnCancel = createButton("CANCEL");
    btnCancel.class("ui-element ui-button");
    btnCancel.mousePressed(resetToGalaxy);

    btnConfirm = createButton("CONFIRM & WEAVE");
    btnConfirm.class("ui-element ui-button");
    btnConfirm.style('background', '#00ff00'); btnConfirm.style('color', 'black'); btnConfirm.style('border', 'none');
    btnConfirm.mousePressed(uploadStar); 

    btnRerecord = createButton("RERECORD");
    btnRerecord.class("ui-element ui-button");
    btnRerecord.mousePressed(() => { state = 'DESIGN'; audioChunks = []; });

    updateLayout();
}

function updateLayout() {
    let centerX = width / 2;
    if(btnCreate) { btnCreate.size(160, 50); btnCreate.position(centerX - 80, height - 100); }
    if(btnDelete) { btnDelete.size(160, 40); btnDelete.position(centerX - 80, height - 160); }
    if(inputName) { inputName.size(200, 30); inputName.position(centerX - 100, height * 0.15); }
    
    let controlsStart = height * 0.60; let gap = 65; 
    if(sliderSize) { sliderSize.size(240); sliderSize.position(centerX - 120, controlsStart); }
    if(sliderPoints) { sliderPoints.size(240); sliderPoints.position(centerX - 120, controlsStart + gap); }
    if(btnHalo) { btnHalo.size(240, 35); btnHalo.position(centerX - 120, controlsStart + gap * 2); }
    if(btnRecord) { btnRecord.size(240, 50); btnRecord.position(centerX - 120, height - 130); }
    if(btnConfirm) { btnConfirm.size(240, 50); btnConfirm.position(centerX - 120, height - 140); }
    if(btnRerecord) { btnRerecord.size(240, 40); btnRerecord.position(centerX - 120, height - 80); }
    if(btnCancel) { btnCancel.size(240, 40); btnCancel.position(centerX - 120, height - 70); }
}

function updateUIVisibility() {
    btnCreate.hide(); btnDelete.hide(); inputName.hide(); sliderSize.hide(); 
    sliderPoints.hide(); btnHalo.hide(); btnRecord.hide(); btnCancel.hide(); 
    btnConfirm.hide(); btnRerecord.hide();

    if (state === 'INTRO') return;

    if (state === 'GALAXY') {
        btnCreate.show();
        
        if (selectedStar) {
            if (isAdmin || selectedStar.owner === myId) {
                btnDelete.html(isAdmin ? "ADMIN DELETE" : "DELETE MY STAR");
                btnDelete.show();
            }
        }
    } 
    else if (state === 'DESIGN' || state === 'RECORDING') {
        inputName.show(); 
        if (state !== 'RECORDING') {
            sliderSize.show(); sliderPoints.show(); btnHalo.show();
            btnRecord.html("TAP TO RECORD (3s)");
            btnRecord.style('background', 'white'); btnRecord.style('color', 'black');
        } else {
            btnRecord.html("RECORDING... " + nf((3000 - (millis() - recordTimer))/1000, 1, 1) + "s");
            btnRecord.style('background', 'red'); btnRecord.style('color', 'white');
        }
        btnRecord.show();
        btnCancel.show();
    }
    else if (state === 'REVIEW') {
        btnConfirm.show();
        btnRerecord.show();
    }
}

function mousePressed() {
    if (state === 'INTRO') {
        userStartAudio().then(() => { mic.start(); });
        state = 'GALAXY';
        return; 
    }

    
    if (mouseY > height - 150 && state !== 'GALAXY') return; 
    
    //iPhone
    if (state === 'GALAXY' && mouseY > height - 170 && mouseY < height - 120) return;

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

function enterDesignMode() {
    state = 'DESIGN'; myStar.name = ""; inputName.value(""); tempAudioBlob = null;
}

function resetToGalaxy() {
    state = 'GALAXY'; selectedStar = null; isRecording = false;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
}

function handleRecordPress() {
    if (state === 'RECORDING') { finishRecording(); return; }
    let name = inputName.value();
    if (!name || name.trim() === "") { alert("Please name your star first!"); inputName.elt.focus(); return; }
    myStar.name = name;
    startNativeRecording();
}


function startNativeRecording() {
    userStartAudio();
    if (mic && mic.stream) {
        
        const options = { 
            mimeType: supportedMimeType, 
            audioBitsPerSecond: 16000 
        };
        
        try {
            
            if (supportedMimeType) {
                mediaRecorder = new MediaRecorder(mic.stream, options);
            } else {
                mediaRecorder = new MediaRecorder(mic.stream);
            }

            audioChunks = [];
            mediaRecorder.ondataavailable = (e) => { if(e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.onstop = () => {
                
                let blobType = supportedMimeType || 'audio/webm';
                tempAudioBlob = new Blob(audioChunks, { type: blobType });
                state = 'REVIEW'; 
                isRecording = false;
            };
            mediaRecorder.start();
            isRecording = true; state = 'RECORDING'; recordTimer = millis();
        } catch (err) { alert("Mic error: " + err.message); }
    }
}

function finishRecording() {
    if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
}

function uploadStar() {
    if (!tempAudioBlob) return;
    const starId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    let starData = {
        id: starId, owner: myId, name: myStar.name,
        points: myStar.points, size: myStar.size,
        haloType: myStar.haloType, haloSize: myStar.haloSize,
        orbit: random(orbits), angle: random(360), speed: random(0.04, 0.12),
        audioBlob: tempAudioBlob
    };
    let url = URL.createObjectURL(tempAudioBlob);
    allStars.push(new Star(starData, loadSound(url)));
    if(socket) socket.emit('drawing', starData);
    state = 'GALAXY'; selectedStar = null; tempAudioBlob = null;
}

function toggleHalo() {
    let t = ['circle', 'dots', 'lines', 'rings', 'nebula', 'spikes', 'glow', 'shimmer', 'hex', 'cross'];
    myStar.haloType = t[(t.indexOf(myStar.haloType)+1)%t.length];
    btnHalo.html("HALO: " + myStar.haloType.toUpperCase());
}

function deleteSelectedStar() {
    
    if (selectedStar && (isAdmin || selectedStar.owner === myId)) {
        socket.emit("delete_star", selectedStar.id);
        allStars = allStars.filter(s => s.id !== selectedStar.id); 
        selectedStar = null;
    }
}


function getURLParams() {
    let params = {};
    let parts = window.location.search.substring(1).split('&');
    for (let i = 0; i < parts.length; i++) {
        let pair = parts[i].split('=');
        if(pair[0]) params[pair[0]] = decodeURIComponent(pair[1] || '');
    }
    return params;
}

function drawStaticText() {
    push();
    fill(255); noStroke(); textFont('Courier New');
    
    textAlign(LEFT, TOP);
    textSize(18); textStyle(BOLD);
    text("STAR WEAVER", 20, 20);
    textSize(12); textStyle(NORMAL); fill(255, 0.6);
    
    let subtitle = isAdmin ? "⚠️ ADMIN MODE" : (allStars.length + " STARS ONLINE");
    if(isAdmin) fill(255, 0, 0);
    text(subtitle, 20, 45);

    textAlign(RIGHT, TOP);
    textSize(11); fill(255, 0.5);
    let guideText = (width > 400) 
        ? "ABOUT:\nRecord your voice to create a star.\nYour sound is preserved forever.\nClick any star to listen."
        : "Record voice.\nLeave a mark.\nListen to others.";
    text(guideText, width - 20, 20);

    if (state === 'GALAXY' && selectedStar) {
        textAlign(CENTER, BOTTOM);
        fill(255); textSize(14);
        text("SELECTED: " + selectedStar.name, width/2, height - 170); 
        if(!isAdmin && selectedStar.owner !== myId) { fill(255, 0.5); textSize(10); text("(READ ONLY)", width/2, height - 155); }
    }
    
    if (state === 'DESIGN') {
        textAlign(LEFT, BOTTOM); textSize(12); fill(255, 0.8);
        text("SIZE", sliderSize.x, sliderSize.y - 10); 
        text("POINTS", sliderPoints.x, sliderPoints.y - 10);
    }

    if (state === 'REVIEW') {
        textAlign(CENTER, TOP);
        fill(0, 255, 255); textSize(14);
        text("RECORDING COMPLETE!", width/2, height * 0.35 + 80);
    }
    pop();
}

function drawDesignView() {
    let designCenterY = height * 0.35; 
    drawOrbitGuides(designCenterY);
    if (state === 'DESIGN') { myStar.size = sliderSize.value(); myStar.points = sliderPoints.value(); }
    renderStar(width/2, designCenterY, myStar.size, myStar.size*0.4, myStar.points, myStar.haloType, myStar.haloSize, 1.0);
    if (state === 'RECORDING') {
        fill(255, 0, 0); textSize(14); textAlign(CENTER, TOP);
        let timeLeft = 3000 - (millis() - recordTimer);
        text("REC: " + nf(timeLeft / 1000, 1, 1) + "s", width/2, designCenterY + 80);
        if (timeLeft <= 0) finishRecording();
    }
}

function drawGalaxyView() {
  drawOrbitGuides(height/2);
  for (let s of allStars) { s.update(); s.display(); }
}

function loadStarFromData(data) {
    let newSound = null;
    try { if (data.audioBlob) { let b = new Blob([data.audioBlob], {type:'audio/webm'}); newSound = loadSound(URL.createObjectURL(b)); } } catch(e){}
    if (!allStars.find(s => s.id === data.id)) allStars.push(new Star(data, newSound));
}

function drawOrbitGuides(centerY) {
    noFill(); stroke(255, 0.25); 
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
  
  display() {
    let x = width/2 + cos(this.angle)*this.orbit;
    let y = height/2 + sin(this.angle)*this.orbit;
    let isPlaying = this.voice && this.voice.isLoaded() && this.voice.isPlaying();
    let isSelected = (selectedStar && selectedStar.id === this.id);
    let pulse = (isPlaying || isSelected) ? 1.5 : 1.0;
    
    renderStar(x, y, this.sz*pulse, this.sz*0.4*pulse, this.pts, this.hType, this.hSize, 0.9);
    
    push(); translate(x, y); noStroke(); textAlign(CENTER, TOP);
    let textY = this.sz * 2 + 5;
    
    if (isSelected || isPlaying) {
        fill(255, 255); textSize(max(12, this.sz * 0.5)); textStyle(BOLD);
        text(this.name, 0, textY);
        if(isSelected) { noFill(); stroke(255, 0.5); ellipse(0,0, this.sz*4); }
    } else {
        fill(255, 120); textSize(10); textStyle(NORMAL);
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
  else if (halo === 'spikes') { for(let i=0; i<8; i++){ rotate(45); line(r1*1.5,0, r1*2.8*hSize,0); } }
  else if (halo === 'glow') { fill(255, opacity*0.15); noStroke(); circle(0,0, r1*3*hSize); }
  else if (halo === 'shimmer') { for(let i=0; i<16; i++){ rotate(22.5); fill(255, opacity*0.5); circle(r1*2.2*hSize, 0, 1.5); } }
  else if (halo === 'hex') { noFill(); stroke(255, opacity*0.3); beginShape(); for(let i=0; i<6; i++){ vertex(cos(i*60)*r1*2.5*hSize, sin(i*60)*r1*2.5*hSize); } endShape(CLOSE); }
  else if (halo === 'cross') { stroke(255, opacity*0.4); line(-r1*2.5*hSize, 0, r1*2.5*hSize, 0); line(0, -r1*2.5*hSize, 0, r1*2.5*hSize); }

  fill(255, opacity); noStroke();
  beginShape();
  for (let a = 0; a < 360; a += 360/n) { vertex(cos(a)*r2, sin(a)*r2); vertex(cos(a+180/n)*r1, sin(a+180/n)*r1); }
  endShape(CLOSE);
  pop();
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); calculateOrbits(); updateLayout(); }