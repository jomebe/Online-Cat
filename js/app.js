// js/app.js
import { initAudio, playMeow, playChime, startAmbient, stopAmbient, toggleMute, setAmbientVolume, playCameraSound } from './audio.js';
import { initEnvironment, updateEnvironment, drawBackground, drawEnvironmentParticles, getTimeOfDay, setEnvironmentTime } from './canvas.js';
import { Cat } from './cat.js';
import { Toy, drawLaserDot } from './toy.js';
import { loadAllSprites } from './spriteLoader.js';
import { supabase, initSupabaseClient, getSupabaseAnonKey, setSupabaseAnonKey } from './supabase.js';
import { t, currentLang, applyTranslations } from './i18n.js';

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
  lastToySyncTime: 0, // throttle timer for toy localStorage updates
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
  if (loadCatsFromLocalStorage()) {
    return;
  }

  const nameMocha = currentLang === 'ko' ? '모카' : 'Mocha';
  const nameCoco = currentLang === 'ko' ? '코코' : 'Coco';
  const nameLatte = currentLang === 'ko' ? '라떼' : 'Latte';

  state.cats.push(new Cat(nameMocha, 'ginger', { x: state.canvasWidth * 0.25 }));
  state.cats.push(new Cat(nameCoco, 'tuxedo', { x: state.canvasWidth * 0.5 }));
  state.cats.push(new Cat(nameLatte, 'siamese', { x: state.canvasWidth * 0.7 }));
  
  // Update state positions
  state.cats.forEach(cat => cat.y = state.floorY - 5);
  
  saveCatsToLocalStorage();
}

// LocalStorage Persistence for Placed Toys
function saveToysToLocalStorage() {
  try {
    const toysData = state.toys.map(toy => {
      const data = {
        type: toy.type,
        x: toy.x,
        y: toy.y,
        vx: toy.vx,
        vy: toy.vy
      };
      if (toy.type === 'yarn') {
        data.color = toy.color;
      } else if (toy.type === 'treat') {
        data.bites = toy.bites;
      }
      return data;
    });
    localStorage.setItem('online_cat_toys', JSON.stringify(toysData));
  } catch (err) {
    console.warn('Failed to save toys to localStorage:', err);
  }
}

function loadToysFromLocalStorage() {
  try {
    const savedToysJson = localStorage.getItem('online_cat_toys');
    if (savedToysJson) {
      const savedToysData = JSON.parse(savedToysJson);
      if (Array.isArray(savedToysData)) {
        state.toys = savedToysData.map(data => {
          const toy = new Toy(data.type, data.x, data.y, { color: data.color });
          if (data.bites !== undefined) {
            toy.bites = data.bites;
          }
          if (data.vx !== undefined) toy.vx = data.vx;
          if (data.vy !== undefined) toy.vy = data.vy;
          return toy;
        });
        addLog(t('log_cats_loaded_toys', { count: state.toys.length }));
      }
    }
  } catch (err) {
    console.warn('Failed to load toys from localStorage:', err);
  }
}

// LocalStorage Persistence for Cats (including positions and stats)
function saveCatsToLocalStorage() {
  try {
    // 1. Save local cats list (used when logged out)
    const catsData = state.cats.map(cat => ({
      id: cat.id,
      name: cat.name,
      breed: cat.breed,
      x: cat.x,
      y: cat.y,
      affection: cat.affection,
      hunger: cat.hunger,
      energy: cat.energy,
      gender: cat.gender
    }));
    localStorage.setItem('online_cat_local_cats', JSON.stringify(catsData));

    // 2. Save X coordinates mapping by ID (used for restoring coordinates of DB-synced cats)
    const positions = {};
    state.cats.forEach(cat => {
      positions[cat.id] = cat.x;
    });
    localStorage.setItem('online_cat_positions', JSON.stringify(positions));
  } catch (err) {
    console.warn('Failed to save cats to localStorage:', err);
  }
}

function loadCatsFromLocalStorage() {
  try {
    const savedCatsJson = localStorage.getItem('online_cat_local_cats');
    if (savedCatsJson) {
      const savedCatsData = JSON.parse(savedCatsJson);
      if (Array.isArray(savedCatsData) && savedCatsData.length > 0) {
        state.cats = savedCatsData.map(data => {
          const cat = new Cat(data.name, data.breed, { x: data.x });
          cat.id = data.id;
          cat.affection = data.affection;
          cat.hunger = data.hunger;
          cat.energy = data.energy;
          cat.gender = data.gender;
          cat.y = state.floorY - 5;
          return cat;
        });
        addLog(t('log_cats_loaded_local', { count: state.cats.length }));
        return true;
      }
    }
  } catch (err) {
    console.warn('Failed to load cats from localStorage:', err);
  }
  return false;
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
      // Load position map from localStorage
      let positions = {};
      try {
        const savedPositionsJson = localStorage.getItem('online_cat_positions');
        if (savedPositionsJson) {
          positions = JSON.parse(savedPositionsJson);
        }
      } catch (err) {
        console.warn('Failed to load cat positions map:', err);
      }

      // Clear current cats and instantiate new Cat objects from DB data
      state.cats = dbCats.map(c => {
        const savedX = positions[c.id];
        const cat = new Cat(c.name, c.breed, { x: savedX || (100 + Math.random() * (state.canvasWidth - 200)) });
        cat.id = c.id; // preserve database UUID
        cat.affection = c.affection;
        cat.hunger = c.hunger;
        cat.energy = c.energy;
        cat.gender = c.gender;
        cat.y = state.floorY - 5;
        return cat;
      });
      addLog(t('log_cats_loaded', { count: dbCats.length }));
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
    addLog(t('alert_cats_load_failed', { msg: err.message }));
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
  'sleep': 'cat_state_sleep_default',
  'eat': 'cat_state_eat',
  'play': 'cat_state_play',
  'pet': 'cat_state_pet'
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
        let key = stateLogMap[cat.state];
        if (cat.state === 'sleep' && cat.inBox) {
          key = 'cat_state_sleep';
        }
        const msg = t(key);
        addLog(t('log_cat_state', { name: cat.name, msg: msg }));
      }
    }
  });
}

// Spawning toys
function spawnToy(type, x, y) {
  // Cap toys to avoid cluttering (max 25)
  if (state.toys.length >= 25) {
    const oldestToy = state.toys.shift();
    if (oldestToy && oldestToy.claimedBy) {
      const cat = state.cats.find(c => c.id === oldestToy.claimedBy);
      if (cat) cat.inBox = null;
    }
    addLog(t('log_clear_old'));
  }

  // Random color for yarn
  const colors = ['#ff4757', '#2ed573', '#54a0ff', '#ffa502', '#9b59b6'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  
  const toy = new Toy(type, x, y, { color: randomColor });
  state.toys.push(toy);
  
  let logKey = 'log_spawn_toy';
  if (type === 'yarn') logKey = 'log_spawn_yarn';
  else if (type === 'box') logKey = 'log_spawn_box';
  else if (type === 'treat') logKey = 'log_spawn_treat';

  addLog(t(logKey));
  playChime();
  saveToysToLocalStorage();
}

// HTML5 Drag Drop support for spawning from inventory
function clearAllToys() {
  if (state.toys.length === 0) {
    addLog(t('log_clear_no_toys'));
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
  addLog(t('log_clear_all'));
  playChime();
  saveToysToLocalStorage();
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
  
  const name = t('toy_' + toy.type);
  addLog(t('log_clear_individual', { name: name }));
  playChime();
  saveToysToLocalStorage();
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
        addLog(t('log_broom_on'));
        playChime();
        
        // Deactivate laser pointer if active
        if (state.laser.active) {
          state.laser.active = false;
          document.getElementById('toy-laser').classList.remove('active');
        }
      } else {
        item.classList.remove('active');
        canvas.classList.remove('cursor-broom-mode');
        addLog(t('log_broom_off'));
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
        addLog(t('log_laser_on'));
        playChime();
        // Deactivate other dragging
        state.draggedToy = null;
      } else {
        item.classList.remove('active');
        canvas.style.cursor = 'default';
        addLog(t('log_laser_off'));
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
        addLog(t('log_obs_start', { name: state.draggedCat.name }));
        playChime();
      }
    } else if (state.draggedCat.y < state.floorY + 15) { // drag back up above floor
      if (state.draggedCat.observationMode) {
        state.draggedCat.observationMode = false;
        addLog(t('log_obs_end', { name: state.draggedCat.name }));
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
      addLog(t('log_pet_lift', { name: state.draggedCat.name }));
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
    saveToysToLocalStorage();
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
let lastFocusTime = 0;
window.addEventListener('focus', () => {
  lastFocusTime = Date.now();
});

canvas.addEventListener('dblclick', (e) => {
  // Ignore double clicks that happen immediately after window focus (refocus click noise)
  if (Date.now() - lastFocusTime < 500) {
    return;
  }
  const pos = getMousePos(e);
  const mx = pos.x;
  const my = pos.y;

  // 1. Check if clicked a cat (shortcut to start camera tracking)
  const clickedCat = [...state.cats].reverse().find(c => c.isClicked(mx, my));
  if (clickedCat) {
    state.camera.targetCat = clickedCat;
    document.getElementById('camera-hud-text').innerHTML = t('tracking_hud', { name: clickedCat.name });
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
const takePhotoBtn = document.getElementById('take-photo-btn');
const takePhotoCinematicBtn = document.getElementById('take-photo-cinematic-btn');
const cameraHud = document.getElementById('camera-hud');
const cameraHudText = document.getElementById('camera-hud-text');
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
  detailBreed.textContent = `${t('cat_breed')}: ${t('breed_' + cat.breed)}`;
  detailGender.textContent = `${t('cat_gender')}: ${cat.gender === 'male' ? t('cat_gender_male') : t('cat_gender_female')}`;
  
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
  cameraHudText.innerHTML = t('tracking_hud', { name: state.selectedCat.name });
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
  takePhotoCinematicBtn.classList.remove('hidden');
  playChime();
});

// Restore UI (Show UI)
showUiBtn.addEventListener('click', () => {
  document.body.classList.remove('ui-hidden');
  showUiBtn.classList.add('hidden');
  takePhotoCinematicBtn.classList.add('hidden');
  
  // Restoring UI stops camera tracking
  if (state.camera.targetCat) {
    state.camera.targetCat = null;
    cameraHud.classList.add('hidden');
  }
  playChime();
});

// Photo Taking Feature
const photoModal = document.getElementById('photo-modal');
const photoImg = document.getElementById('photo-img');
const downloadPhotoBtn = document.getElementById('download-photo-btn');
const closePhotoBtn = document.getElementById('close-photo-btn');
const closePhotoBtnBottom = document.getElementById('close-photo-btn-bottom');

function takeSnapshot() {
  initAudio();
  playCameraSound();

  const flash = document.createElement('div');
  flash.className = 'photo-flash';
  document.body.appendChild(flash);
  
  setTimeout(() => {
    flash.style.opacity = '0';
  }, 50);
  
  setTimeout(() => {
    flash.remove();
  }, 600);

  try {
    const dataUrl = canvas.toDataURL('image/png');
    photoImg.src = dataUrl;
    photoModal.classList.remove('hidden');
    
    downloadPhotoBtn.onclick = (e) => {
      e.stopPropagation();
      initAudio();
      
      const link = document.createElement('a');
      const now = new Date();
      const dateStr = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + '_' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
      link.download = `online_cat_${dateStr}.png`;
      link.href = dataUrl;
      link.click();
      
      addLog(t('log_photo_saved'));
      playChime();
    };
  } catch (err) {
    console.error('Failed to capture canvas snapshot:', err);
    alert(t('alert_photo_failed', { msg: err.message }));
  }
}

takePhotoBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  takeSnapshot();
});

takePhotoCinematicBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  takeSnapshot();
});

closePhotoBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  photoModal.classList.add('hidden');
  playChime();
});

closePhotoBtnBottom.addEventListener('click', (e) => {
  e.stopPropagation();
  photoModal.classList.add('hidden');
  playChime();
});

// Cat Rename
document.getElementById('rename-btn').addEventListener('click', () => {
  if (!state.selectedCat) return;
  const newName = prompt(t('prompt_rename'), state.selectedCat.name);
  if (newName && newName.trim().length > 0) {
    const cleaned = newName.trim().substring(0, 8);
    addLog(t('log_name_changed', { oldName: state.selectedCat.name, newName: cleaned }));
    state.selectedCat.name = cleaned;
    detailName.textContent = cleaned;
    
    if (state.user && supabase) {
      saveSingleCat(state.selectedCat);
    }
    saveCatsToLocalStorage();
  }
});

// Observation Mode Cat Rename
document.getElementById('obs-rename-btn').addEventListener('click', () => {
  const observedCat = state.cats.find(c => c.observationMode);
  if (!observedCat) return;
  
  const newName = prompt(t('prompt_rename'), observedCat.name);
  if (newName && newName.trim().length > 0) {
    const cleaned = newName.trim().substring(0, 8);
    addLog(t('log_name_changed', { oldName: observedCat.name, newName: cleaned }));
    observedCat.name = cleaned;
    document.getElementById('obs-cat-name').textContent = cleaned;
    
    if (state.user && supabase) {
      saveSingleCat(observedCat);
    }
    saveCatsToLocalStorage();
  }
});

// Release Cat (Adoption Out)
document.getElementById('release-btn').addEventListener('click', () => {
  if (!state.selectedCat) return;
  const cat = state.selectedCat;
  if (confirm(t('alert_adopt_out_confirm', { name: cat.name }))) {
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

    addLog(t('log_release_success', { name: cat.name }));
    hideCatDetails();
    playChime();

    // Delete from database if logged in
    if (state.user && supabase) {
      deleteCatFromDatabase(catId);
    }
    saveCatsToLocalStorage();
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
    alert(t('alert_name_required'));
    return;
  }
  
  if (state.cats.length >= 6) {
    alert(t('alert_sanctuary_full'));
    return;
  }

  const options = {
    x: 100 + Math.random() * (state.canvasWidth - 200)
  };

  const newCat = new Cat(name, selectedBreed, options);
  newCat.y = state.floorY - 5;
  
  state.cats.push(newCat);
  addLog(t('log_adopt_success', { breed: t('breed_' + selectedBreed), name: name }));
  
  // Sync to database if logged in
  if (state.user && supabase) {
    saveSingleCat(newCat);
  }
  saveCatsToLocalStorage();

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
    addLog(t('log_obs_end', { name: observedCat.name }));
    playChime();
  }
});

const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', () => {
  state.isMuted = !state.isMuted;
  toggleMute(state.isMuted);
  if (state.isMuted) {
    muteBtn.textContent = '🔇';
    addLog(t('log_sound_muted'));
  } else {
    muteBtn.textContent = '🔊';
    addLog(t('log_sound_unmuted'));
    
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
    
    addLog(t('log_time_changed', { time: btn.textContent }));
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
    
    addLog(t('log_weather_changed', { weather: btn.textContent }));
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
            // Use slightly smaller hitboxes for a more forgiving and natural feel (prevent grazing hits in the air)
            const colW = cat.width * cat.scale * 0.8;
            const colH = cat.height * cat.scale * 0.8;
            const colRad = toy.radius * 0.7;
            
            // Check bounding box overlap
            const isOverlap = (
              toy.x + colRad >= cat.x - colW / 2 &&
              toy.x - colRad <= cat.x + colW / 2 &&
              toy.y + colRad >= cat.y - colH &&
              toy.y - colRad <= cat.y
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
              addLog(t('log_cat_surprise', { name: cat.name }));
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
    const breedText = t('breed_' + observedCat.breed);
    const genderText = observedCat.gender === 'male' ? t('cat_gender_male') : t('cat_gender_female');
    document.getElementById('obs-cat-details').textContent = `${t('cat_breed')}: ${breedText} · ${t('cat_gender')}: ${genderText}`;
    
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

  // Periodic local storage save for toys and cats (every 6 seconds)
  if (!state.lastToySyncTime) state.lastToySyncTime = timestamp;
  if (timestamp - state.lastToySyncTime > 6000) {
    state.lastToySyncTime = timestamp;
    saveToysToLocalStorage();
    saveCatsToLocalStorage();
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
  // Photo Modal
  if (photoModal && !photoModal.contains(e.target) && !takePhotoBtn.contains(e.target) && !takePhotoCinematicBtn.contains(e.target)) {
    photoModal.classList.add('hidden');
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
    key = prompt(t('prompt_supabase_key'));
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
    alert(t('alert_supabase_init_failed'));
    setSupabaseAnonKey(""); // reset
    return false;
  }
  return true;
}

async function handleAuthClick() {
  if (state.user) {
    // Log out
    if (confirm(t('confirm_logout'))) {
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
    alert(t('alert_input_email_password'));
    return;
  }
  
  if (password.length < 6) {
    alert(t('alert_password_min_len'));
    return;
  }
  
  addLog(t('log_signup_pending'));
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (error) {
      alert(t('alert_signup_failed_dialog', { msg: error.message }));
      addLog(t('log_signup_failed', { msg: error.message }));
    } else {
      if (data.session) {
        alert(t('alert_signup_success'));
        document.getElementById('login-modal').classList.add('hidden');
      } else {
        alert(t('alert_signup_email_verify'));
        addLog(t('log_signup_email_sent'));
        document.getElementById('login-modal').classList.add('hidden');
      }
    }
  } catch (err) {
    alert(t('alert_error', { msg: err.message }));
  }
});

// Email/Password Login
document.getElementById('email-login-btn').addEventListener('click', async () => {
  if (!ensureSupabaseInitialized()) return;
  
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    alert(t('alert_input_email_password'));
    return;
  }
  
  addLog(t('log_login_pending'));
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      alert(t('alert_login_failed_dialog', { msg: error.message }));
      addLog(t('log_login_failed', { msg: error.message }));
    } else {
      alert(t('alert_login_success'));
      document.getElementById('login-modal').classList.add('hidden');
    }
  } catch (err) {
    alert(t('alert_error', { msg: err.message }));
  }
});

// Google Login OAuth
document.getElementById('google-login-btn').addEventListener('click', async () => {
  if (!ensureSupabaseInitialized()) return;
  
  addLog(t('log_google_pending'));
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    
    if (error) {
      alert(t('alert_google_failed_dialog', { msg: error.message }));
      addLog(t('log_signup_failed', { msg: error.message }));
    }
  } catch (err) {
    alert(t('alert_error', { msg: err.message }));
  }
});

function setupAuthListener() {
  if (!supabase) return;

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      state.user = session.user;
      authBtn.textContent = t('logout');
      authBtn.classList.add('logged-in');
      authBtn.title = t('logged_in_as', { email: session.user.email });
      addLog(t('log_login_success', { email: session.user.email }));
      
      // Load cats from Supabase (non-blocking)
      loadCatsFromDatabase();
    } else {
      state.user = null;
      authBtn.textContent = t('login');
      authBtn.classList.remove('logged-in');
      authBtn.title = t('login');
      
      // Reset to initial cats if user logged out
      if (event === 'SIGNED_OUT') {
        addLog(t('log_logout_success'));
        state.cats = [];
        addInitialCats();
      }
    }
  });
}

// Load sprites and start the game loop
// Strategy: start game loop immediately with default cats,
// then load real sprites in background and sync with DB if logged in.
async function initGame() {
  // Set HTML language attribute dynamically
  document.documentElement.lang = currentLang;

  // Apply translations to static HTML elements
  applyTranslations();

  // Update SEO title and description dynamically
  document.title = t('app_title_seo');
  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) {
    descMeta.setAttribute('content', t('app_desc_seo'));
  }

  // 1. Populate default cats instantly so room is alive immediately
  addInitialCats();
  loadToysFromLocalStorage();
  requestAnimationFrame(loop);

  // 2. Initialize auth/db in parallel
  const key = getSupabaseAnonKey();
  if (key) {
    initSupabaseClient();
    setupAuthListener();
    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          state.user = session.user;
          authBtn.textContent = t('logout');
          authBtn.classList.add('logged-in');
          authBtn.title = t('logged_in_as', { email: session.user.email });
          addLog(t('log_session_loaded', { email: session.user.email }));
          // Load cats from database (will overwrite state.cats dynamically once fetched)
          loadCatsFromDatabase();
        }
      } catch (err) {
        console.error('Failed to get session:', err.message);
      }
    }
  }

  // 3. Load sprites in background (non-blocking for game loop)
  try {
    await loadAllSprites();
    // Sprites ready – cats will pick them up on next draw automatically
  } catch (err) {
    console.warn('Sprite loading failed, using fallback:', err);
  }

  addLog(t('log_default_message'));
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
      takePhotoCinematicBtn.classList.add('hidden');
      if (state.camera.targetCat) {
        state.camera.targetCat = null;
        cameraHud.classList.add('hidden');
      }
    } else {
      // Hide UI
      document.body.classList.add('ui-hidden');
      showUiBtn.classList.remove('hidden');
      takePhotoCinematicBtn.classList.remove('hidden');
    }
    playChime();
  }
});
