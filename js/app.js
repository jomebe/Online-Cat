// js/app.js
import { initAudio, playMeow, playChime, startAmbient, stopAmbient, toggleMute, setAmbientVolume } from './audio.js';
import { initEnvironment, updateEnvironment, drawBackground, drawEnvironmentParticles, getTimeOfDay, setEnvironmentTime } from './canvas.js';
import { Cat } from './cat.js';
import { Toy, drawLaserDot } from './toy.js';

// Application State
const state = {
  cats: [],
  toys: [],
  laser: { x: 0, y: 0, active: false },
  selectedCat: null,
  draggedToy: null,
  draggedCat: null,
  isCatDragging: false,
  dragOffset: { x: 0, y: 0 },
  pointerStartPos: { x: 0, y: 0 },
  pettingCat: null,
  lastTime: 0,
  weather: 'calm', // 'calm', 'sakura', 'rain'
  isMuted: true, // start muted for web policy, user can unmute
  canvasWidth: 0,
  canvasHeight: 0,
  floorY: 0
};

// Canvas Setup
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  ctx.scale(dpr, dpr);
  
  state.canvasWidth = rect.width;
  state.canvasHeight = rect.height;
  state.floorY = rect.height * 0.62; // floor level at 62% down
  
  // Reinitialize background items
  initEnvironment(state.canvasWidth, state.canvasHeight);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // initial run

// Add 3 default cats with cozy names and diverse breeds
function addInitialCats() {
  state.cats.push(new Cat('모카', 'ginger', { x: state.canvasWidth * 0.25 }));
  state.cats.push(new Cat('코코', 'tuxedo', { x: state.canvasWidth * 0.5 }));
  state.cats.push(new Cat('라떼', 'siamese', { x: state.canvasWidth * 0.7 }));
  
  // Update state positions
  state.cats.forEach(cat => cat.y = state.floorY - 5);
}

addInitialCats();

// Log Manager
const logContent = document.getElementById('log-content');
function addLog(text) {
  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span style="opacity: 0.5; margin-right: 6px;">[${time}]</span> ${text}`;
  logContent.appendChild(entry);
  
  // Limit to 20 entries
  while (logContent.children.length > 20) {
    logContent.removeChild(logContent.firstChild);
  }
  
  logContent.scrollTop = logContent.scrollHeight;
}

// Map Cat states for logging (only major events to prevent spam)
const stateLogMap = {
  'sleep': '💤 낮잠을 자기 시작했습니다.',
  'eat': '🍲 물고기 간식을 맛있게 냠냠 먹고 있습니다.',
  'play': '🧶 신나게 털실 뭉치를 굴리며 놀고 있습니다.',
  'pet': '❤️ 골골송을 부르며 기분 좋게 애교를 부립니다.'
};

// Track old states to log changes
const catPreviousStates = {};

function trackCatStates() {
  state.cats.forEach(cat => {
    const prevState = catPreviousStates[cat.id];
    if (prevState !== cat.state) {
      catPreviousStates[cat.id] = cat.state;
      // Log only interesting major interactions
      if (stateLogMap[cat.state]) {
        let msg = stateLogMap[cat.state];
        if (cat.state === 'sleep' && cat.inBox) {
          msg = '📦 골판지 상자 속으로 쏙 들어가서 낮잠을 잡니다. zZ';
        }
        addLog(`<strong>${cat.name}</strong>(이)가 ${msg}`);
      }
    }
  });
}

// Spawning toys
function spawnToy(type, x, y) {
  // Cap toys to avoid cluttering (max 8)
  if (state.toys.length >= 8) {
    const oldestToy = state.toys.shift();
    if (oldestToy && oldestToy.claimedBy) {
      const cat = state.cats.find(c => c.id === oldestToy.claimedBy);
      if (cat) cat.inBox = null;
    }
    addLog('정리가 필요해 오래된 장난감을 치웠습니다.');
  }

  // Random color for yarn
  const colors = ['#ff4757', '#2ed573', '#54a0ff', '#ffa502', '#9b59b6'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  
  const toy = new Toy(type, x, y, { color: randomColor });
  state.toys.push(toy);
  
  let koreanName = '장난감';
  if (type === 'yarn') koreanName = '🧶 털실 뭉치';
  else if (type === 'box') koreanName = '📦 골판지 상자';
  else if (type === 'treat') koreanName = '🐟 물고기 간식';

  addLog(`바닥에 ${koreanName}를 놓았습니다.`);
  playChime();
}

// HTML5 Drag Drop support for spawning from inventory
const toyItems = document.querySelectorAll('.toy-item');
toyItems.forEach(item => {
  // Clear all toys button
  if (item.id === 'toy-clear-all') {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      initAudio();
      
      if (state.toys.length === 0) {
        addLog('치울 장난감이 없습니다.');
        return;
      }
      
      // Reset cats interacting with toys/boxes
      state.cats.forEach(cat => {
        if (cat.targetToy) {
          cat.targetToy = null;
          if (cat.state === 'play' || cat.state === 'eat') {
            cat.state = 'idle';
            cat.stateTimer = 1;
          }
        }
        if (cat.inBox) {
          cat.inBox = null;
          if (cat.state === 'sleep') {
            cat.state = 'idle';
            cat.stateTimer = 1;
          }
        }
      });
      
      state.toys = [];
      addLog('🧹 방 안의 모든 장난감과 상자를 깨끗이 치웠습니다.');
      playChime();
    });
    return;
  }

  // Laser Pointer is toggleable, not drop-physics
  if (item.id === 'toy-laser') {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      initAudio();
      
      state.laser.active = !state.laser.active;
      if (state.laser.active) {
        item.classList.add('active');
        canvas.style.cursor = 'crosshair';
        addLog('🔦 레이저 포인터를 켰습니다. 마우스를 따라 다닙니다.');
        playChime();
        // Deactivate other dragging
        state.draggedToy = null;
      } else {
        item.classList.remove('active');
        canvas.style.cursor = 'default';
        addLog('🔦 레이저 포인터를 껐습니다.');
      }
    });
    return;
  }

  // Physics toys dragging
  item.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', item.id);
    initAudio();
  });
  
  // Click-to-drop fallback for mobile/non-drag
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();
    
    // Determine type
    let type = 'yarn';
    if (item.id === 'toy-box-item') type = 'box';
    else if (item.id === 'toy-treat') type = 'treat';
    
    // Spawn in the middle sky
    spawnToy(type, state.canvasWidth * 0.4 + Math.random() * 100, 50);
  });
});

canvas.addEventListener('dragover', (e) => {
  e.preventDefault();
});

canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const itemId = e.dataTransfer.getData('text/plain');
  
  // Calculate canvas local coords
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  let type = '';
  if (itemId === 'toy-yarn') type = 'yarn';
  else if (itemId === 'toy-box-item') type = 'box';
  else if (itemId === 'toy-treat') type = 'treat';

  if (type) {
    spawnToy(type, mx, my);
  }
});

// Interactive Click / Drag / Petting Handlers
function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  // Support both mouse and touch events
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

// Mouse Down (Click select / Petting start / Drag start)
function handlePointerDown(e) {
  e.preventDefault();
  initAudio();
  
  const pos = getMousePos(e);
  const mx = pos.x;
  const my = pos.y;

  // 1. Check if clicked a toy (for dragging it)
  if (!state.laser.active) {
    const clickedToy = [...state.toys].reverse().find(t => t.isClicked(mx, my));
    if (clickedToy) {
      state.draggedToy = clickedToy;
      clickedToy.isDragging = true;
      state.dragOffset.x = mx - clickedToy.x;
      state.dragOffset.y = my - clickedToy.y;
      
      // Let go of cat reference in box
      if (clickedToy.claimedBy) {
        const cat = state.cats.find(c => c.id === clickedToy.claimedBy);
        if (cat) cat.inBox = null;
        clickedToy.claimedBy = null;
      }
      return;
    }
  }

  // 2. Check if clicked a cat (priority: Petting / Stats panel selection / Drag start)
  const clickedCat = [...state.cats].reverse().find(c => c.isClicked(mx, my));
  if (clickedCat) {
    // Start Petting
    state.pettingCat = clickedCat;
    clickedCat.startPetting();
    
    // Store drag start info
    state.pointerStartPos = { x: mx, y: my };
    state.isCatDragging = false;
    
    // Select for details panel
    showCatDetails(clickedCat);
    
    // Double click/meow trigger
    if (Math.random() < 0.4) {
      playMeow(clickedCat.breed === 'siamese' ? 'low' : 'happy');
    }
    return;
  }

  // Clicked empty canvas: close panels unless click is inside the panel itself
  if (!e.target.closest('.glass-panel')) {
    hideCatDetails();
    document.getElementById('settings-panel').classList.add('hidden');
  }
}

// Mouse Move (Dragging / Petting motion / Laser pointer tracking)
function handlePointerMove(e) {
  const pos = getMousePos(e);
  const mx = pos.x;
  const my = pos.y;

  // Track Laser pointer position
  if (state.laser.active) {
    state.laser.x = mx;
    state.laser.y = my;
  }

  // 1. Dragging toy
  if (state.draggedToy) {
    const toy = state.draggedToy;
    const nextX = mx - state.dragOffset.x;
    const nextY = my - state.dragOffset.y;
    
    // Calculate throwing velocity based on pointer speed (clamped)
    const rawVx = nextX - toy.x;
    const rawVy = nextY - toy.y;
    const maxVelocity = 18;
    toy.vx = Math.max(-maxVelocity, Math.min(maxVelocity, rawVx));
    toy.vy = Math.max(-maxVelocity, Math.min(maxVelocity, rawVy));

    toy.x = nextX;
    toy.y = nextY;
    return;
  }

  // 2. Dragging cat
  if (state.draggedCat) {
    state.draggedCat.x = mx - state.dragOffset.x;
    state.draggedCat.y = my - state.dragOffset.y;
    
    // Check Y position for close-up observation mode
    // Trigger observation mode if dragged into the bottom 15% of screen
    if (state.draggedCat.y > state.canvasHeight - 110) {
      if (!state.draggedCat.observationMode) {
        state.draggedCat.observationMode = true;
        addLog(`🔍 <strong>${state.draggedCat.name}</strong> 관찰 모드가 시작되었습니다. 쓰다듬어(Pet) 보세요!`);
        playChime();
      }
    } else if (state.draggedCat.y < state.floorY + 20) { // drag back up
      if (state.draggedCat.observationMode) {
        state.draggedCat.observationMode = false;
        addLog(`🏡 <strong>${state.draggedCat.name}</strong>(이)가 다시 방으로 돌아갔습니다.`);
        playChime();
      }
    }
    return;
  }

  // 3. Handle separating petting from dragging
  if (state.pettingCat && !state.isCatDragging) {
    const dist = Math.hypot(mx - state.pointerStartPos.x, my - state.pointerStartPos.y);
    if (dist > 15) { // drag threshold
      state.isCatDragging = true;
      state.draggedCat = state.pettingCat;
      state.draggedCat.isDragging = true;
      state.draggedCat.stopPetting(); // stop purring
      state.dragOffset.x = mx - state.draggedCat.x;
      state.dragOffset.y = my - state.draggedCat.y;
      state.pettingCat = null;
      addLog(`🖐️ <strong>${state.draggedCat.name}</strong>를 안아 올렸습니다.`);
    }
  }

  // Check cursor changes
  let hoverCat = state.cats.find(c => c.isClicked(mx, my));
  let hoverToy = state.toys.find(t => t.isClicked(mx, my));
  
  if (state.laser.active) {
    canvas.style.cursor = 'crosshair';
  } else if (hoverCat) {
    canvas.style.cursor = 'grab'; // petting indicator
  } else if (hoverToy) {
    canvas.style.cursor = 'grab';
  } else {
    canvas.style.cursor = 'default';
  }
}

// Mouse Up (End dragging / End petting)
function handlePointerUp() {
  if (state.draggedToy) {
    state.draggedToy.isDragging = false;
    state.draggedToy = null;
  }
  
  if (state.draggedCat) {
    state.draggedCat.isDragging = false;
    // Snap back to floor height if not in close-up observation mode
    if (!state.draggedCat.observationMode) {
      state.draggedCat.y = state.floorY - 5;
    }
    state.draggedCat = null;
  }
  
  if (state.pettingCat) {
    state.pettingCat.stopPetting();
    state.pettingCat = null;
  }
}

// Attach Pointer Events
canvas.addEventListener('mousedown', handlePointerDown);
canvas.addEventListener('mousemove', handlePointerMove);
window.addEventListener('mouseup', handlePointerUp);

canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
window.addEventListener('touchend', handlePointerUp);

// Double-click to remove an individual toy
canvas.addEventListener('dblclick', (e) => {
  const pos = getMousePos(e);
  const mx = pos.x;
  const my = pos.y;

  const clickedToyIdx = state.toys.findIndex(t => t.isClicked(mx, my));
  if (clickedToyIdx > -1) {
    const toy = state.toys[clickedToyIdx];
    
    // Reset any cat interacting with this toy
    state.cats.forEach(cat => {
      if (cat.targetToy === toy) {
        cat.targetToy = null;
        if (cat.state === 'play' || cat.state === 'eat') {
          cat.state = 'idle';
          cat.stateTimer = 1;
        }
      }
      if (cat.inBox === toy) {
        cat.inBox = null;
        if (cat.state === 'sleep') {
          cat.state = 'idle';
          cat.stateTimer = 1;
        }
      }
    });

    state.toys.splice(clickedToyIdx, 1);
    
    let koreanName = '장난감';
    if (toy.type === 'yarn') koreanName = '🧶 털실 뭉치';
    else if (toy.type === 'box') koreanName = '📦 상자';
    else if (toy.type === 'treat') koreanName = '🐟 간식';
    
    addLog(`바닥에 놓인 ${koreanName}을(를) 치웠습니다.`);
    playChime();
  }
});

// Cat Details Card UI Controller
const detailsCard = document.getElementById('cat-details-card');
const detailName = document.getElementById('detail-name');
const detailBreed = document.getElementById('detail-breed');
const detailGender = document.getElementById('detail-gender');
const barAffection = document.getElementById('bar-affection');
const barEnergy = document.getElementById('bar-energy');
const barHunger = document.getElementById('bar-hunger');
const labelAffection = document.getElementById('label-affection');
const labelEnergy = document.getElementById('label-energy');
const labelHunger = document.getElementById('label-hunger');

const breedMap = {
  tabby: '치즈/실버 태비',
  tuxedo: '턱시도 고양이',
  calico: '삼색 고양이',
  siamese: '샴 고양이',
  ginger: '치즈 태비',
  black: '올블랙 고양이',
  white: '하얀 고양이',
  grey: '러시안 블루',
  scottish: '스코티시 폴드'
};

function showCatDetails(cat) {
  state.selectedCat = cat;
  detailName.textContent = cat.name;
  detailBreed.textContent = `묘종: ${breedMap[cat.breed] || cat.breed}`;
  detailGender.textContent = `성별: ${cat.gender === 'male' ? '수컷 ♂' : '암컷 ♀'}`;
  
  updateDetailsBars();
  detailsCard.classList.remove('hidden');
}

function updateDetailsBars() {
  if (!state.selectedCat) return;
  const cat = state.selectedCat;
  
  barAffection.style.width = `${cat.affection}%`;
  labelAffection.textContent = `${Math.round(cat.affection)}%`;
  
  barEnergy.style.width = `${cat.energy}%`;
  labelEnergy.textContent = `${Math.round(cat.energy)}%`;
  
  barHunger.style.width = `${cat.hunger}%`;
  labelHunger.textContent = `${Math.round(cat.hunger)}%`;
}

function hideCatDetails() {
  state.selectedCat = null;
  detailsCard.classList.add('hidden');
}

document.getElementById('close-card-btn').addEventListener('click', hideCatDetails);

// Cat Rename
document.getElementById('rename-btn').addEventListener('click', () => {
  if (!state.selectedCat) return;
  const newName = prompt('새로운 이름을 지어주세요 (최대 8자):', state.selectedCat.name);
  if (newName && newName.trim().length > 0) {
    const cleaned = newName.trim().substring(0, 8);
    addLog(`<strong>${state.selectedCat.name}</strong>의 이름이 <strong>${cleaned}</strong>(으)로 변경되었습니다.`);
    state.selectedCat.name = cleaned;
    detailName.textContent = cleaned;
  }
});

// Release Cat (Adoption Out)
document.getElementById('release-btn').addEventListener('click', () => {
  if (!state.selectedCat) return;
  const cat = state.selectedCat;
  if (confirm(`${cat.name}를 좋은 곳으로 입양 보낼까요?\n언제든 새로운 고양이를 다시 데려올 수 있어요.`)) {
    // Remove cat
    state.cats = state.cats.filter(c => c.id !== cat.id);
    
    // Clear any boxes claimed
    state.toys.forEach(t => {
      if (t.claimedBy === cat.id) {
        t.claimedBy = null;
      }
    });

    addLog(`🐾 <strong>${cat.name}</strong>(이)가 따뜻한 가정으로 입양을 떠났습니다. 행복하렴!`);
    hideCatDetails();
    playChime();
  }
});

// Sidebar Drawer (Cat Creator) Controller
const sidebar = document.getElementById('sidebar');
const toggleCreatorBtn = document.getElementById('toggle-creator-btn');

toggleCreatorBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  sidebar.classList.toggle('open');
});

// Sidebar selection handlers
let selectedBreed = 'tabby';
const breedSelectorItems = document.querySelectorAll('#breed-selector .grid-item');
breedSelectorItems.forEach(item => {
  item.addEventListener('click', () => {
    breedSelectorItems.forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    selectedBreed = item.dataset.breed;
    playChime();
  });
});

const selectedAccessories = new Set();
const accessorySelectorItems = document.querySelectorAll('#accessory-selector .grid-item');
accessorySelectorItems.forEach(item => {
  item.addEventListener('click', () => {
    const acc = item.dataset.acc;
    if (selectedAccessories.has(acc)) {
      selectedAccessories.delete(acc);
      item.classList.remove('selected');
    } else {
      selectedAccessories.add(acc);
      item.classList.add('selected');
    }
    playChime();
  });
});

// Add Cat button
const createCatBtn = document.getElementById('create-cat-btn');
const catNameInput = document.getElementById('cat-name-input');

createCatBtn.addEventListener('click', () => {
  const name = catNameInput.value.trim();
  if (!name) {
    alert('고양이 이름을 지어주세요!');
    return;
  }
  
  if (state.cats.length >= 6) {
    alert('안식처가 꽉 찼습니다! (최대 6마리)\n일부 고양이를 입양 보낸 뒤 데려와 주세요.');
    return;
  }

  const options = {
    accessories: Array.from(selectedAccessories),
    x: 100 + Math.random() * (state.canvasWidth - 200)
  };

  const newCat = new Cat(name, selectedBreed, options);
  newCat.y = state.floorY - 5;
  
  state.cats.push(newCat);
  addLog(`💖 새로운 묘종(<strong>${breedMap[selectedBreed]}</strong>)인 <strong>${name}</strong>(이)가 안식처에 찾아왔습니다!`);
  
  // Reset fields
  catNameInput.value = '';
  selectedAccessories.clear();
  accessorySelectorItems.forEach(i => i.classList.remove('selected'));
  sidebar.classList.remove('open');
  
  playMeow(selectedBreed === 'siamese' ? 'low' : 'happy');
});

// Top bar controls (Audio / Settings)
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPanel.classList.toggle('hidden');
});

const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
  state.isMuted = !state.isMuted;
  toggleMute(state.isMuted);
  if (state.isMuted) {
    muteBtn.textContent = '🔇';
    addLog('🔊 사운드가 음소거 되었습니다.');
  } else {
    muteBtn.textContent = '🔊';
    addLog('🔊 사운드가 켜졌습니다.');
    
    // Resume weather sounds if active
    if (state.weather === 'rain') {
      startAmbient('rain');
    } else if (state.weather === 'sakura') {
      startAmbient('wind');
    }
  }
});

// Time of Day buttons
const timeBtns = document.querySelectorAll('#time-btns button');
timeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    timeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const timeVal = btn.dataset.time;
    // Set custom hours mock
    let h = 12;
    if (timeVal === 'morning') h = 8;
    else if (timeVal === 'evening') h = 18;
    else if (timeVal === 'night') h = 23;
    
    const mockDate = new Date();
    mockDate.setHours(h);
    setEnvironmentTime(mockDate);
    
    // Change body theme class for CSS
    if (timeVal === 'night') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    
    addLog(`시간을 <strong>${btn.textContent}</strong> 테마로 변경했습니다.`);
    playChime();
  });
});

// Synchronize local time initially
function syncLocalTime() {
  const currentHour = new Date().getHours();
  let timeStr = 'afternoon';
  if (currentHour >= 6 && currentHour < 11) timeStr = 'morning';
  else if (currentHour >= 17 && currentHour < 20) timeStr = 'evening';
  else if (currentHour >= 20 || currentHour < 6) timeStr = 'night';
  
  timeBtns.forEach(btn => {
    if (btn.dataset.time === timeStr) {
      btn.click();
    }
  });
}
syncLocalTime();

// Weather Buttons
const weatherBtns = document.querySelectorAll('#weather-btns button');
weatherBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    weatherBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    state.weather = btn.dataset.weather;
    
    // Play weather ambient sounds
    if (state.weather === 'rain') {
      startAmbient('rain');
    } else if (state.weather === 'sakura') {
      startAmbient('wind');
    } else {
      stopAmbient();
    }
    
    addLog(`날씨를 <strong>${btn.textContent}</strong> 효과로 설정했습니다.`);
    playChime();
  });
});

// Volume slider
const volumeSlider = document.getElementById('volume-slider');
volumeSlider.addEventListener('input', (e) => {
  const vol = parseFloat(e.target.value);
  setAmbientVolume(vol);
});

// Main Animation Loop
function loop(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const delta = (timestamp - state.lastTime) / 1000; // seconds elapsed
  state.lastTime = timestamp;

  // 1. Update Environment Physics
  updateEnvironment(state.canvasWidth, state.canvasHeight, state.weather);

  // 1.5 Check flying yarn ball collision with cats
  state.toys.forEach(toy => {
    if (toy.type === 'yarn' && !toy.isDragging) {
      const speed = Math.hypot(toy.vx, toy.vy);
      if (speed > 2.0) { // flying fast enough
        state.cats.forEach(cat => {
          if (!cat.isDragging && !cat.observationMode && (!cat.hitTimer || cat.hitTimer <= 0)) {
            const catW = cat.width * cat.scale;
            const catH = cat.height * cat.scale;
            
            // Check bounding box overlap
            const isOverlap = (
              toy.x + toy.radius >= cat.x - catW / 2 &&
              toy.x - toy.radius <= cat.x + catW / 2 &&
              toy.y + toy.radius >= cat.y - catH &&
              toy.y - toy.radius <= cat.y
            );
            
            if (isOverlap) {
              // Bounce the yarn ball back and slow it down
              toy.vx = -toy.vx * 0.25;
              toy.vy = -toy.vy * 0.25;
              
              // Trigger hit state on cat
              cat.hitTimer = 0.8; // 0.8 seconds of hit squint & rapid bobbing
              cat.state = 'idle';
              cat.stateTimer = 1.0;
              cat.leaveBox(); // climb out of box if inside
              
              // Surprised meow sound
              playMeow(cat.breed === 'siamese' ? 'low' : 'happy');
              
              // Spawn star particles
              for (let i = 0; i < 4; i++) {
                cat.stars.push({
                  x: cat.x + (Math.random() * 20 - 10),
                  y: cat.y - cat.height * cat.scale - 12,
                  alpha: 1.0,
                  size: 11 + Math.random() * 6,
                  speed: 1.0 + Math.random() * 1.0
                });
              }
              
              // Activity log
              addLog(`💥 <strong>${cat.name}</strong>(이)가 날아온 털뭉치에 맞고 깜짝 놀랐습니다!`);
            }
          }
        });
      }
    }
  });

  // 2. Draw Environment Background
  drawBackground(ctx, state.canvasWidth, state.canvasHeight, state.weather);

  // 3. Draw Box BACK parts (so cats can climb in)
  state.toys.forEach(toy => {
    if (toy.type === 'box') {
      toy.update(state.canvasWidth, state.canvasHeight, state.floorY);
      toy.draw(ctx, true); // draw back flap/walls
    }
  });

  // 4. Sort observed/dragged cats to draw on top, then Update & Draw
  const sortedCats = [...state.cats].sort((a, b) => {
    if (a.isDragging && !b.isDragging) return 1;
    if (!a.isDragging && b.isDragging) return -1;
    if (a.observationMode && !b.observationMode) return 1;
    if (!a.observationMode && b.observationMode) return -1;
    return 0;
  });

  sortedCats.forEach(cat => {
    cat.update(state.canvasWidth, state.canvasHeight, state.floorY, state.toys, state.laser, delta);
    cat.draw(ctx);
  });

  // 5. Draw Box FRONT parts (covers cat body inside box)
  state.toys.forEach(toy => {
    if (toy.type === 'box') {
      const occupant = state.cats.find(c => c.inBox === toy);
      toy.draw(ctx, false, occupant); // draw front flaps/walls
    } else {
      // Other toys (yarn, treats)
      toy.update(state.canvasWidth, state.canvasHeight, state.floorY);
      toy.draw(ctx);
    }
  });

  // 6. Draw Laser Pointer Dot
  if (state.laser.active) {
    drawLaserDot(ctx, state.laser.x, state.laser.y);
  }

  // 7. Draw Weather Particles (top layer)
  drawEnvironmentParticles(ctx);

  // 8. Update UI displays
  updateDetailsBars();
  
  // Track and log actions
  trackCatStates();

  requestAnimationFrame(loop);
}

// Close modals when clicking outside
window.addEventListener('click', (e) => {
  if (!sidebar.contains(e.target) && !toggleCreatorBtn.contains(e.target)) {
    sidebar.classList.remove('open');
  }
});

// Expand Log panel button listener
const expandLogBtn = document.getElementById('expand-log-btn');
const activityLogPanel = document.getElementById('activity-log');
expandLogBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  activityLogPanel.classList.toggle('expanded');
  if (activityLogPanel.classList.contains('expanded')) {
    expandLogBtn.textContent = '🗕';
  } else {
    expandLogBtn.textContent = '↕️';
  }
  playChime();
});

// Start loop
requestAnimationFrame(loop);
addLog('모카, 코코, 라떼 세 고양이가 한가롭게 노닐고 있습니다. 쓰다듬어보세요!');
