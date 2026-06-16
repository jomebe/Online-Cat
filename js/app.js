// js/app.js
import { initAudio, playMeow, playChime, startAmbient, stopAmbient, toggleMute, setAmbientVolume } from './audio.js';
import { initEnvironment, updateEnvironment, drawBackground, drawEnvironmentParticles, getTimeOfDay, setEnvironmentTime } from './canvas.js';
import { Cat } from './cat.js';
import { Toy, drawLaserDot } from './toy.js';
import { loadAllSprites } from './spriteLoader.js';
import { supabase, initSupabaseClient, getSupabaseAnonKey, setSupabaseAnonKey } from './supabase.js';

// Application State
const state = {
  cats: [],
  toys: [],
  laser: { x: 0, y: 0, active: false },
  broomActive: false, // broom clean-up tool state
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
  floorY: 0,
  user: null, // supabase authenticated user
  lastSyncTime: 0, // throttle timer for DB stats updates
  camera: {
    x: 0,
    y: 0,
    zoom: 1.0,
    targetCat: null
  }
};

// Canvas Setup
const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  const width = rect.width || canvas.clientWidth || window.innerWidth || 800;
  const height = rect.height || canvas.clientHeight || window.innerHeight || 600;
  
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  
  ctx.scale(dpr, dpr);
  
  state.canvasWidth = width;
  state.canvasHeight = height;
  state.floorY = height * 0.62; // floor level at 62% down
  
  if (!state.camera.targetCat) {
    state.camera.x = state.canvasWidth / 2;
    state.camera.y = state.canvasHeight / 2;
  }
  
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

// Supabase Database Syncing Logic
let isLoadingCats = false;

async function loadCatsFromDatabase() {
  if (!supabase || !state.user) return;
  if (isLoadingCats) {
    console.log('[loadCatsFromDatabase] Already loading cats, skipping concurrent call.');
    return;
  }
  isLoadingCats = true;

  try {
    const { data: dbCats, error } = await supabase
      .from('cats')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (dbCats && dbCats.length > 0) {
      // Clear current cats and instantiate new Cat objects from DB data
      state.cats = dbCats.map(c => {
        const cat = new Cat(c.name, c.breed, { x: c.x || (100 + Math.random() * (state.canvasWidth - 200)) });
        cat.id = c.id; // preserve database UUID
        cat.affection = c.affection;
        cat.hunger = c.hunger;
        cat.energy = c.energy;
        cat.gender = c.gender;
        cat.y = state.floorY - 5;
        return cat;
      });
      addLog(`☁️ Supabase에서 ${dbCats.length}마리의 고양이를 불러왔습니다.`);
    } else {
      // Database is empty. Migrate local cats if any exist, or add default initial cats
      if (state.cats.length === 0) {
        addInitialCats();
      }
      // Save all local cats to DB
      await saveAllCatsToDatabase();
    }
  } catch (err) {
    console.error('Failed to load cats from database:', err.message);
    addLog(`⚠️ 고양이 데이터를 불러오는데 실패했습니다: ${err.message}`);
    // Fallback: if there are no cats, add default ones so the game is playable
    if (state.cats.length === 0) {
      addInitialCats();
    }
  } finally {
    isLoadingCats = false;
  }
}

async function saveAllCatsToDatabase() {
  if (!supabase || !state.user || state.cats.length === 0) return;

  try {
    const catsToInsert = state.cats.map(c => ({
      id: c.id.startsWith('cat_') ? undefined : c.id, // let DB generate UUID if it's a client placeholder
      user_id: state.user.id,
      name: c.name,
      breed: c.breed,
      affection: Math.round(c.affection),
      hunger: Math.round(c.hunger),
      energy: Math.round(c.energy),
      gender: c.gender
    }));

    const { data, error } = await supabase
      .from('cats')
      .upsert(catsToInsert, { onConflict: 'id' })
      .select();

    if (error) throw error;

    // Update client IDs with DB UUIDs if any changed
    if (data) {
      data.forEach((dbCat, index) => {
        if (state.cats[index]) {
          state.cats[index].id = dbCat.id;
        }
      });
    }
    console.log('Successfully saved cats to database');
  } catch (err) {
    console.error('Failed to save cats to database:', err.message);
  }
}

async function saveSingleCat(cat) {
  if (!supabase || !state.user) return;
  const isTempId = cat.id.startsWith('cat_');
  
  try {
    const catData = {
      user_id: state.user.id,
      name: cat.name,
      breed: cat.breed,
      affection: Math.round(cat.affection),
      hunger: Math.round(cat.hunger),
      energy: Math.round(cat.energy),
      gender: cat.gender
    };
    if (!isTempId) {
      catData.id = cat.id;
    }

    const { data, error } = await supabase
      .from('cats')
      .upsert(catData)
      .select();

    if (error) throw error;
    if (data && data[0]) {
      cat.id = data[0].id; // update to UUID
    }
  } catch (err) {
    console.error('Failed to save single cat:', err.message);
  }
}

async function deleteCatFromDatabase(catId) {
  if (!supabase || !state.user || catId.startsWith('cat_')) return;

  try {
    const { error } = await supabase
      .from('cats')
      .delete()
      .eq('id', catId);

    if (error) throw error;
    console.log(`Successfully deleted cat ${catId} from DB`);
  } catch (err) {
    console.error('Failed to delete cat from database:', err.message);
  }
}

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
function clearAllToys() {
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
}

function removeIndividualToy(toy, index) {
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

  state.toys.splice(index, 1);
  
  let koreanName = '장난감';
  if (toy.type === 'yarn') koreanName = '🧶 털실 뭉치';
  else if (toy.type === 'box') koreanName = '📦 상자';
  else if (toy.type === 'treat') koreanName = '🐟 간식';
  
  addLog(`바닥에 놓인 ${koreanName}을(를) 치웠습니다.`);
  playChime();
}

// HTML5 Drag Drop support for spawning from inventory
const toyItems = document.querySelectorAll('.toy-item');
toyItems.forEach(item => {
  // Clear all / individual sweep button
  if (item.id === 'toy-clear-all') {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      initAudio();
      
      state.broomActive = !state.broomActive;
      if (state.broomActive) {
        item.classList.add('active');
        canvas.classList.add('cursor-broom-mode');
        addLog('🧹 빗자루 모드가 활성화되었습니다. 바닥의 장난감을 클릭하여 개별적으로 치울 수 있습니다. (더블 클릭 시 전체 청소)');
        playChime();
        
        // Deactivate laser pointer if active
        if (state.laser.active) {
          state.laser.active = false;
          document.getElementById('toy-laser').classList.remove('active');
        }
      } else {
        item.classList.remove('active');
        canvas.classList.remove('cursor-broom-mode');
        addLog('🧹 빗자루 모드를 비활성화했습니다.');
      }
    });

    item.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      initAudio();
      
      // Deactivate broom mode
      state.broomActive = false;
      item.classList.remove('active');
      canvas.classList.remove('cursor-broom-mode');
      
      clearAllToys();
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
    
    // Spawn at a random horizontal position in the sky
    const rx = 50 + Math.random() * (state.canvasWidth - 100);
    spawnToy(type, rx, 50);
  });
});

canvas.addEventListener('dragover', (e) => {
  e.preventDefault();
});

canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  const itemId = e.dataTransfer.getData('text/plain');
  
  // Calculate canvas local coords (transformed to world space)
  const pos = getMousePos(e);
  const mx = pos.x;
  const my = pos.y;

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
  let clientX = e.clientX;
  let clientY = e.clientY;
  
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  }
  
  const canvasX = clientX - rect.left;
  const canvasY = clientY - rect.top;
  
  // Transform screen to world coordinates using the camera matrix
  const worldX = state.camera.x + (canvasX - state.canvasWidth / 2) / state.camera.zoom;
  const worldY = state.camera.y + (canvasY - state.canvasHeight / 2) / state.camera.zoom;
  
  return {
    x: worldX,
    y: worldY
  };
}

// Mouse Down (Click select / Petting start / Drag start)
function handlePointerDown(e) {
  e.preventDefault();
  initAudio();
  
  const pos = getMousePos(e);
  const mx = pos.x;
  const my = pos.y;

  // 0. If broom mode is active, clicking on a toy deletes it
  if (state.broomActive) {
    const clickedToyIdx = state.toys.findIndex(t => t.isClicked(mx, my));
    if (clickedToyIdx > -1) {
      removeIndividualToy(state.toys[clickedToyIdx], clickedToyIdx);
      return;
    }
  }

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
  // Prevent mobile default scroll/bounce behavior while dragging/petting inside the canvas
  if (e.touches) {
    e.preventDefault();
  }

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
    // Trigger observation mode if dragged past carpet level (floorY + 40)
    if (state.draggedCat.y > state.floorY + 40) {
      if (!state.draggedCat.observationMode) {
        state.draggedCat.observationMode = true;
        addLog(`🔍 <strong>${state.draggedCat.name}</strong> 관찰 모드가 시작되었습니다. 쓰다듬어(Pet) 보세요!`);
        playChime();
      }
    } else if (state.draggedCat.y < state.floorY + 15) { // drag back up above floor
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
      state.draggedCat.leaveBox(); // Leave cardboard box immediately when picked up
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

// Double-click to track a cat, remove a toy, or stop tracking
canvas.addEventListener('dblclick', (e) => {
  const pos = getMousePos(e);
  const mx = pos.x;
  const my = pos.y;

  // 1. Check if clicked a cat (shortcut to start camera tracking)
  const clickedCat = [...state.cats].reverse().find(c => c.isClicked(mx, my));
  if (clickedCat) {
    state.camera.targetCat = clickedCat;
    document.getElementById('camera-target-name').textContent = clickedCat.name;
    document.getElementById('camera-hud').classList.remove('hidden');
    hideCatDetails();
    playChime();
    return;
  }

  // 2. Check if clicked a toy (delete it)
  const clickedToyIdx = state.toys.findIndex(t => t.isClicked(mx, my));
  if (clickedToyIdx > -1) {
    removeIndividualToy(state.toys[clickedToyIdx], clickedToyIdx);
    return;
  }

  // 3. Double click empty space: stop tracking camera
  if (state.camera.targetCat) {
    state.camera.targetCat = null;
    document.getElementById('camera-hud').classList.add('hidden');
    playChime();
  }
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault(); // Prevent standard right-click context menu on canvas
  const pos = getMousePos(e);
  const mx = pos.x;
  const my = pos.y;

  const clickedToyIdx = state.toys.findIndex(t => t.isClicked(mx, my));
  if (clickedToyIdx > -1) {
    removeIndividualToy(state.toys[clickedToyIdx], clickedToyIdx);
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

// Camera & Cinematic UI Elements
const trackBtn = document.getElementById('track-btn');
const showUiBtn = document.getElementById('show-ui-btn');
const hideUiBtn = document.getElementById('hide-ui-btn');
const cameraHud = document.getElementById('camera-hud');
const cameraTargetName = document.getElementById('camera-target-name');
const stopTrackBtn = document.getElementById('stop-track-btn');

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

// Camera Tracking Start
trackBtn.addEventListener('click', () => {
  if (!state.selectedCat) return;
  state.camera.targetCat = state.selectedCat;
  
  // Show tracking HUD
  cameraTargetName.textContent = state.selectedCat.name;
  cameraHud.classList.remove('hidden');
  
  // Close details card to keep the view clean
  hideCatDetails();
  playChime();
});

// Camera Tracking Stop
stopTrackBtn.addEventListener('click', () => {
  state.camera.targetCat = null;
  cameraHud.classList.add('hidden');
  playChime();
});

// Cinematic Mode (Hide UI)
hideUiBtn.addEventListener('click', () => {
  document.body.classList.add('ui-hidden');
  showUiBtn.classList.remove('hidden');
  playChime();
});

// Restore UI (Show UI)
showUiBtn.addEventListener('click', () => {
  document.body.classList.remove('ui-hidden');
  showUiBtn.classList.add('hidden');
  
  // Restoring UI stops camera tracking
  if (state.camera.targetCat) {
    state.camera.targetCat = null;
    cameraHud.classList.add('hidden');
  }
  playChime();
});

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

// Observation Mode Cat Rename
document.getElementById('obs-rename-btn').addEventListener('click', () => {
  const observedCat = state.cats.find(c => c.observationMode);
  if (!observedCat) return;
  
  const newName = prompt('새로운 이름을 지어주세요 (최대 8자):', observedCat.name);
  if (newName && newName.trim().length > 0) {
    const cleaned = newName.trim().substring(0, 8);
    addLog(`<strong>${observedCat.name}</strong>의 이름이 <strong>${cleaned}</strong>(으)로 변경되었습니다.`);
    observedCat.name = cleaned;
    document.getElementById('obs-cat-name').textContent = cleaned;
  }
});

// Release Cat (Adoption Out)
document.getElementById('release-btn').addEventListener('click', () => {
  if (!state.selectedCat) return;
  const cat = state.selectedCat;
  if (confirm(`${cat.name}를 좋은 곳으로 입양 보낼까요?\n언제든 새로운 고양이를 다시 데려올 수 있어요.`)) {
    // Remove cat
    const catId = cat.id;
    state.cats = state.cats.filter(c => c.id !== catId);
    
    // Clear tracking if released cat was targeted
    if (state.camera.targetCat && state.camera.targetCat.id === catId) {
      state.camera.targetCat = null;
      cameraHud.classList.add('hidden');
    }
    
    // Clear any boxes claimed
    state.toys.forEach(t => {
      if (t.claimedBy === catId) {
        t.claimedBy = null;
      }
    });

    addLog(`🐾 <strong>${cat.name}</strong>(이)가 따뜻한 가정으로 입양을 떠났습니다. 행복하렴!`);
    hideCatDetails();
    playChime();

    // Delete from database if logged in
    if (state.user && supabase) {
      deleteCatFromDatabase(catId);
    }
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
    x: 100 + Math.random() * (state.canvasWidth - 200)
  };

  const newCat = new Cat(name, selectedBreed, options);
  newCat.y = state.floorY - 5;
  
  state.cats.push(newCat);
  addLog(`💖 새로운 묘종(<strong>${breedMap[selectedBreed]}</strong>)인 <strong>${name}</strong>(이)가 안식처에 찾아왔습니다!`);
  
  // Sync to database if logged in
  if (state.user && supabase) {
    saveSingleCat(newCat);
  }

  // Reset fields
  catNameInput.value = '';
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

// Minimal Observation Mode exit handler
document.getElementById('exit-obs-btn').addEventListener('click', () => {
  const observedCat = state.cats.find(c => c.observationMode);
  if (observedCat) {
    observedCat.observationMode = false;
    addLog(`🏡 <strong>${observedCat.name}</strong>(이)가 다시 방으로 돌아갔습니다.`);
    playChime();
  }
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

  // Camera tracking interpolation
  let targetX = state.canvasWidth / 2;
  let targetY = state.canvasHeight / 2;
  let targetZoom = 1.0;

  if (state.camera.targetCat) {
    const stillExists = state.cats.some(c => c.id === state.camera.targetCat.id);
    if (!stillExists) {
      state.camera.targetCat = null;
      document.getElementById('camera-hud').classList.add('hidden');
    } else {
      const cat = state.camera.targetCat;
      targetX = cat.x;
      targetY = cat.y - (cat.height * cat.scale) / 2;
      targetZoom = 1.8;
    }
  }

  // Smooth camera lerp
  const lerpSpeed = 0.08;
  state.camera.x += (targetX - state.camera.x) * lerpSpeed;
  state.camera.y += (targetY - state.camera.y) * lerpSpeed;
  state.camera.zoom += (targetZoom - state.camera.zoom) * lerpSpeed;

  // Clamp camera position to prevent seeing outside the room boundaries when zoomed in
  const visibleW = state.canvasWidth / state.camera.zoom;
  const visibleH = state.canvasHeight / state.camera.zoom;
  
  const minX = visibleW / 2;
  const maxX = state.canvasWidth - visibleW / 2;
  const minY = visibleH / 2;
  const maxY = state.canvasHeight - visibleH / 2;

  if (maxX >= minX) {
    state.camera.x = Math.max(minX, Math.min(maxX, state.camera.x));
  } else {
    state.camera.x = state.canvasWidth / 2;
  }

  if (maxY >= minY) {
    state.camera.y = Math.max(minY, Math.min(maxY, state.camera.y));
  } else {
    state.camera.y = state.canvasHeight / 2;
  }

  // 1. Update Environment Physics
  updateEnvironment(state.canvasWidth, state.canvasHeight, state.weather);

  // 1.5 Check flying yarn ball collision with cats
  state.toys.forEach(toy => {
    if (toy.type === 'yarn' && !toy.isDragging) {
      const speed = Math.hypot(toy.vx, toy.vy);
      if (speed > 8.0) { // flying fast enough (throw speed)
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

  ctx.save();
  // Apply camera matrix
  ctx.translate(state.canvasWidth / 2, state.canvasHeight / 2);
  ctx.scale(state.camera.zoom, state.camera.zoom);
  ctx.translate(-state.camera.x, -state.camera.y);

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

  // 6.5 Draw Cat Overlays (name tags, hearts, stars) on top of all toys
  state.cats.forEach(cat => {
    cat.drawOverlay(ctx);
  });

  ctx.restore();

  // 7. Draw Weather Particles (top layer)
  drawEnvironmentParticles(ctx);

  // 8. Update UI displays
  updateDetailsBars();

  // Track and manage observation mode HUD
  const observedCat = state.cats.find(c => c.observationMode);
  const obsHud = document.getElementById('observation-hud');
  if (observedCat) {
    document.body.classList.add('observation-active');
    document.getElementById('obs-cat-name').textContent = observedCat.name;
    
    // Set Breed and Gender details
    const breedText = breedMap[observedCat.breed] || observedCat.breed;
    const genderText = observedCat.gender === 'male' ? '수컷 ♂' : '암컷 ♀';
    document.getElementById('obs-cat-details').textContent = `묘종: ${breedText} · 성별: ${genderText}`;
    
    // Affection
    document.getElementById('obs-bar-affection').style.width = observedCat.affection + '%';
    document.getElementById('obs-label-affection').textContent = Math.round(observedCat.affection) + '%';
    
    // Energy
    document.getElementById('obs-bar-energy').style.width = observedCat.energy + '%';
    document.getElementById('obs-label-energy').textContent = Math.round(observedCat.energy) + '%';
    
    // Hunger
    document.getElementById('obs-bar-hunger').style.width = observedCat.hunger + '%';
    document.getElementById('obs-label-hunger').textContent = Math.round(observedCat.hunger) + '%';
    
    obsHud.classList.add('active');
  } else {
    document.body.classList.remove('observation-active');
    obsHud.classList.remove('active');
  }
  
  // Track and log actions
  trackCatStates();

  // Periodic Supabase sync (every 6 seconds)
  if (state.user && supabase) {
    if (!state.lastSyncTime) state.lastSyncTime = timestamp;
    if (timestamp - state.lastSyncTime > 6000) {
      state.lastSyncTime = timestamp;
      saveAllCatsToDatabase();
    }
  }

  requestAnimationFrame(loop);
}

// Close modals when clicking outside
window.addEventListener('click', (e) => {
  // Sidebar Creator
  if (!sidebar.contains(e.target) && !toggleCreatorBtn.contains(e.target)) {
    sidebar.classList.remove('open');
  }
  // Settings Panel
  if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
    settingsPanel.classList.add('hidden');
  }
  // Login Modal
  const loginModal = document.getElementById('login-modal');
  if (loginModal && !loginModal.contains(e.target) && !authBtn.contains(e.target)) {
    loginModal.classList.add('hidden');
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

// Auth UI elements & Event Listeners
const authBtn = document.getElementById('auth-btn');

function ensureSupabaseInitialized() {
  let key = getSupabaseAnonKey();
  if (!key) {
    key = prompt('Supabase Anon Key를 입력해 주세요 (최초 1회 저장):\n대시보드 > Project Settings > API > anon public key 에서 복사할 수 있습니다.');
    if (key && key.trim()) {
      setSupabaseAnonKey(key.trim());
    } else {
      return false;
    }
  }
  
  if (!supabase) {
    initSupabaseClient();
  }

  if (!supabase) {
    alert('Supabase 클라이언트 초기화에 실패했습니다. 올바른 Anon Key를 입력했는지 확인해 주세요.');
    setSupabaseAnonKey(""); // reset
    return false;
  }
  return true;
}

async function handleAuthClick() {
  if (state.user) {
    // Log out
    if (confirm('계정에서 로그아웃하시겠습니까?')) {
      await supabase.auth.signOut();
    }
  } else {
    // Open Login Modal
    const loginModal = document.getElementById('login-modal');
    loginModal.classList.remove('hidden');
    
    // Auto-focus on email input
    const emailInput = document.getElementById('login-email');
    if (emailInput) {
      emailInput.focus();
    }
  }
}

authBtn.addEventListener('click', handleAuthClick);

// Close login modal btn
document.getElementById('close-login-btn').addEventListener('click', () => {
  document.getElementById('login-modal').classList.add('hidden');
  playChime();
});

// Email/Password Signup
document.getElementById('email-signup-btn').addEventListener('click', async () => {
  if (!ensureSupabaseInitialized()) return;
  
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    alert('이메일과 비밀번호를 모두 입력해 주세요.');
    return;
  }
  
  if (password.length < 6) {
    alert('비밀번호는 최소 6자 이상이어야 합니다.');
    return;
  }
  
  addLog('☁️ 회원가입을 요청 중입니다...');
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (error) {
      alert('회원가입 실패: ' + error.message);
      addLog('❌ 회원가입 실패: ' + error.message);
    } else {
      if (data.session) {
        alert('회원가입 및 로그인에 성공했습니다!');
        document.getElementById('login-modal').classList.add('hidden');
      } else {
        alert('회원가입 완료! 메일함(또는 스팸함)에서 인증 이메일을 확인해 주세요.');
        addLog('✉️ 이메일 인증 메일이 발송되었습니다.');
        document.getElementById('login-modal').classList.add('hidden');
      }
    }
  } catch (err) {
    alert('오류 발생: ' + err.message);
  }
});

// Email/Password Login
document.getElementById('email-login-btn').addEventListener('click', async () => {
  if (!ensureSupabaseInitialized()) return;
  
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    alert('이메일과 비밀번호를 모두 입력해 주세요.');
    return;
  }
  
  addLog('☁️ 로그인을 요청 중입니다...');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      alert('로그인 실패: ' + error.message);
      addLog('❌ 로그인 실패: ' + error.message);
    } else {
      alert('로그인에 성공했습니다!');
      document.getElementById('login-modal').classList.add('hidden');
    }
  } catch (err) {
    alert('오류 발생: ' + err.message);
  }
});

// Google Login OAuth
document.getElementById('google-login-btn').addEventListener('click', async () => {
  if (!ensureSupabaseInitialized()) return;
  
  addLog('☁️ 구글 로그인 창으로 이동 중...');
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    
    if (error) {
      alert('구글 로그인 오류: ' + error.message);
      addLog('❌ 구글 로그인 오류: ' + error.message);
    }
  } catch (err) {
    alert('오류 발생: ' + err.message);
  }
});

function setupAuthListener() {
  if (!supabase) return;

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      state.user = session.user;
      authBtn.textContent = '🚪 로그아웃';
      authBtn.classList.add('logged-in');
      authBtn.title = `로그인 계정: ${session.user.email}`;
      addLog(`🔑 계정(${session.user.email})으로 로그인했습니다.`);
      
      // Load cats from Supabase (non-blocking)
      loadCatsFromDatabase();
    } else {
      state.user = null;
      authBtn.textContent = '🔑 로그인';
      authBtn.classList.remove('logged-in');
      authBtn.title = '로그인';
      
      // Reset to initial cats if user logged out
      if (event === 'SIGNED_OUT') {
        addLog('🚪 계정에서 로그아웃했습니다.');
        state.cats = [];
        addInitialCats();
      }
    }
  });
}

// Load sprites then start the game loop
async function initGame() {
  addLog('🎨 스프라이트를 불러오는 중...');
  try {
    await loadAllSprites();
    addLog('✅ 고양이 스프라이트 로딩 완료!');
  } catch (err) {
    console.warn('Sprite loading failed, using fallback:', err);
    addLog('⚠️ 스프라이트 로딩 실패 - 기본 모드로 실행합니다.');
  }

  // Initialize Supabase if key is present
  const key = getSupabaseAnonKey();
  if (key) {
    initSupabaseClient();
    setupAuthListener();
    
    // Check if there is an active session
    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          state.user = session.user;
          authBtn.textContent = '🚪 로그아웃';
          authBtn.classList.add('logged-in');
          authBtn.title = `로그인 계정: ${session.user.email}`;
          addLog(`🔑 기존 세션(${session.user.email})을 불러왔습니다.`);
          // Load cats from Supabase (non-blocking)
          loadCatsFromDatabase();
        } else {
          addInitialCats();
        }
      } catch (err) {
        console.error('Failed to get session:', err.message);
        addInitialCats();
      }
    } else {
      addInitialCats();
    }
  } else {
    addInitialCats();
  }

  requestAnimationFrame(loop);
  addLog('모카, 코코, 라떼 세 고양이가 한가롭게 노닐고 있습니다. 쓰다듬어보세요!');
}

initGame();

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  // Ignore keyboard shortcuts when typing inside form input fields
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  // Toggle UI mode using 'h' key or Korean layout equivalent 'ㅗ'
  if (e.key === 'h' || e.key === 'H' || e.key === 'ㅗ' || e.key === 'ㅘ') {
    const isHidden = document.body.classList.contains('ui-hidden');
    if (isHidden) {
      // Restore UI
      document.body.classList.remove('ui-hidden');
      showUiBtn.classList.add('hidden');
      if (state.camera.targetCat) {
        state.camera.targetCat = null;
        cameraHud.classList.add('hidden');
      }
    } else {
      // Hide UI
      document.body.classList.add('ui-hidden');
      showUiBtn.classList.remove('hidden');
    }
    playChime();
  }
});
