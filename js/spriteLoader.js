// js/spriteLoader.js
// Loads cat sprite sheets, removes white background via edge flood-fill,
// and extracts per-state animation frame arrays.

// ── Breed → sprite file mapping ──
const BREED_SPRITE_MAP = {
  ginger:   'ginger',
  grey:     'grey',
  tuxedo:   'tuxedo',
  black:    'tuxedo',
  white:    'white',
  calico:   'calico',
  tabby:    'tabby',
  scottish: 'tabby',
  siamese:  'siamese',
};

// Layout: how poses are arranged in each sprite sheet
const LAYOUT = {
  // base sheets (idle, walk-single, sleep, play)
  ginger:  { cols: 3, rows: 2, count: 5 },
  grey:    { cols: 2, rows: 2, count: 4 },
  tuxedo:  { cols: 4, rows: 1, count: 4 },
  white:   { cols: 4, rows: 1, count: 4 },
  calico:  { cols: 4, rows: 1, count: 4 },
  tabby:   { cols: 4, rows: 1, count: 4 },
  siamese: { cols: 2, rows: 2, count: 4 },
};

// Layout for walk animation sheets
const WALK_LAYOUT = {
  ginger:  { cols: 3, rows: 2, count: 5 }, // Ginger walk sheet has 5 frames in a 3x2 grid
  grey:    { cols: 2, rows: 2, count: 4 },
  tuxedo:  { cols: 4, rows: 1, count: 4 },
  white:   { cols: 4, rows: 1, count: 4 },
  calico:  { cols: 4, rows: 1, count: 4 },
  tabby:   { cols: 4, rows: 1, count: 4 },
  siamese: { cols: 2, rows: 2, count: 4 },
};

// Layout for pet animation sheets
const PET_LAYOUT = {
  ginger:  { cols: 2, rows: 2, count: 4 },
  grey:    { cols: 2, rows: 2, count: 4 },
  tuxedo:  { cols: 2, rows: 2, count: 4 },
  white:   { cols: 2, rows: 2, count: 4 },
  calico:  { cols: 4, rows: 1, count: 4 },
  tabby:   { cols: 2, rows: 2, count: 4 },
  siamese: { cols: 4, rows: 1, count: 4 }, // Siamese pet sheet has 4 frames in a 4x1 grid
};

// ── Global sprite cache ──
// breed → { idle: [Canvas], walk: [Canvas,...], sleep: [Canvas], play: [Canvas], pet: [Canvas,...] }
const spriteCache = {};
const loadingBreeds = {};

// ────────────────────────────────────────────
// Image loading
// ────────────────────────────────────────────
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

function tryLoadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // silently fail
    img.src = src;
  });
}

// ────────────────────────────────────────────
// Background removal via edge flood-fill (Asynchronous using Web Worker)
// Only removes white pixels connected to image edges,
// preserving white cat fur inside the outline.
// ────────────────────────────────────────────
function removeWhiteBackgroundAsync(image) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const w = image.width;
    const h = image.height;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, w, h);

    const workerCode = `
      self.onmessage = function(e) {
        const { imageData, w, h } = e.data;
        const data = imageData.data;
        const total = w * h;

        const isNearWhite = (pos) => {
          const i = pos * 4;
          return data[i] > 225 && data[i + 1] > 225 && data[i + 2] > 225 && data[i + 3] > 100;
        };

        const visited = new Uint8Array(total);
        const isBg = new Uint8Array(total);
        const queue = [];
        let head = 0;

        // Seed: all edge pixels that are near-white
        for (let x = 0; x < w; x++) {
          const top = x, bot = (h - 1) * w + x;
          if (isNearWhite(top) && !visited[top]) { visited[top] = 1; isBg[top] = 1; queue.push(top); }
          if (isNearWhite(bot) && !visited[bot]) { visited[bot] = 1; isBg[bot] = 1; queue.push(bot); }
        }
        for (let y = 1; y < h - 1; y++) {
          const left = y * w, right = y * w + (w - 1);
          if (isNearWhite(left) && !visited[left]) { visited[left] = 1; isBg[left] = 1; queue.push(left); }
          if (isNearWhite(right) && !visited[right]) { visited[right] = 1; isBg[right] = 1; queue.push(right); }
        }

        // BFS flood fill
        while (head < queue.length) {
          const pos = queue[head++];
          const x = pos % w;
          const y = (pos - x) / w;

          if (x > 0) {
            const n = pos - 1;
            if (!visited[n] && isNearWhite(n)) { visited[n] = 1; isBg[n] = 1; queue.push(n); }
          }
          if (x < w - 1) {
            const n = pos + 1;
            if (!visited[n] && isNearWhite(n)) { visited[n] = 1; isBg[n] = 1; queue.push(n); }
          }
          if (y > 0) {
            const n = pos - w;
            if (!visited[n] && isNearWhite(n)) { visited[n] = 1; isBg[n] = 1; queue.push(n); }
          }
          if (y < h - 1) {
            const n = pos + w;
            if (!visited[n] && isNearWhite(n)) { visited[n] = 1; isBg[n] = 1; queue.push(n); }
          }
        }

        // Apply transparency to background pixels
        for (let i = 0; i < total; i++) {
          if (isBg[i]) {
            data[i * 4 + 3] = 0; // fully transparent
          }
        }

        // Anti-alias: soften pixels adjacent to background
        for (let i = 0; i < total; i++) {
          if (!isBg[i] && data[i * 4 + 3] > 0) {
            const x = i % w;
            const y = (i - x) / w;
            let bgNeighbors = 0;
            if (x > 0 && isBg[i - 1]) bgNeighbors++;
            if (x < w - 1 && isBg[i + 1]) bgNeighbors++;
            if (y > 0 && isBg[i - w]) bgNeighbors++;
            if (y < h - 1 && isBg[i + w]) bgNeighbors++;

            if (bgNeighbors >= 2) {
              data[i * 4 + 3] = Math.max(60, data[i * 4 + 3] - 80);
            }
          }
        }

        self.postMessage({ imageData }, [imageData.data.buffer]);
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (e) => {
      ctx.putImageData(e.data.imageData, 0, 0);
      worker.terminate();
      resolve(canvas);
    };

    worker.postMessage({ imageData, w, h }, [imageData.data.buffer]);
  });
}

// ────────────────────────────────────────────
// Frame extraction
// ────────────────────────────────────────────

/** Find tight bounding box of visible pixels in a region */
function findBounds(ctx, rx, ry, rw, rh) {
  const id = ctx.getImageData(rx, ry, rw, rh);
  const d = id.data;
  let minX = rw, minY = rh, maxX = 0, maxY = 0;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (d[(y * rw + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return { x: rx, y: ry, w: rw, h: rh }; // fallback
  return { x: rx + minX, y: ry + minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Trim edge bleed-in pixels from neighboring cells */
function trimCellNoise(ctx, rx, ry, rw, rh) {
  const imgData = ctx.getImageData(rx, ry, rw, rh);
  const data = imgData.data;

  // Helper: check if a column has no active pixels
  const isColEmpty = (x) => {
    for (let y = 0; y < rh; y++) {
      if (data[(y * rw + x) * 4 + 3] > 15) return false;
    }
    return true;
  };

  // Helper: check if a row has no active pixels
  const isRowEmpty = (y) => {
    for (let x = 0; x < rw; x++) {
      if (data[(y * rw + x) * 4 + 3] > 15) return false;
    }
    return true;
  };

  // 1. Scan from left edge inward (up to 8% of width, max 8px)
  let leftCut = 0;
  let hasSeenPixelsLeft = false;
  const maxScanW = Math.min(8, Math.floor(rw * 0.08));
  for (let x = 0; x < maxScanW; x++) {
    const empty = isColEmpty(x);
    if (!empty) {
      hasSeenPixelsLeft = true;
    } else if (empty && hasSeenPixelsLeft) {
      leftCut = x;
    }
  }
  if (leftCut > 0) {
    for (let x = 0; x < leftCut; x++) {
      for (let y = 0; y < rh; y++) {
        data[(y * rw + x) * 4 + 3] = 0;
      }
    }
  }

  // 2. Scan from right edge inward (up to 8% of width, max 8px)
  let rightCut = rw - 1;
  let hasSeenPixelsRight = false;
  const minScanW = rw - maxScanW;
  for (let x = rw - 1; x >= minScanW; x--) {
    const empty = isColEmpty(x);
    if (!empty) {
      hasSeenPixelsRight = true;
    } else if (empty && hasSeenPixelsRight) {
      rightCut = x;
    }
  }
  if (rightCut < rw - 1) {
    for (let x = rightCut + 1; x < rw; x++) {
      for (let y = 0; y < rh; y++) {
        data[(y * rw + x) * 4 + 3] = 0;
      }
    }
  }

  // 3. Scan from top edge inward (up to 8% of height, max 8px)
  let topCut = 0;
  let hasSeenPixelsTop = false;
  const maxScanH = Math.min(8, Math.floor(rh * 0.08));
  for (let y = 0; y < maxScanH; y++) {
    const empty = isRowEmpty(y);
    if (!empty) {
      hasSeenPixelsTop = true;
    } else if (empty && hasSeenPixelsTop) {
      topCut = y;
    }
  }
  if (topCut > 0) {
    for (let y = 0; y < topCut; y++) {
      for (let x = 0; x < rw; x++) {
        data[(y * rw + x) * 4 + 3] = 0;
      }
    }
  }

  // 4. Scan from bottom edge inward (up to 8% of height, max 8px)
  let bottomCut = rh - 1;
  let hasSeenPixelsBottom = false;
  const minScanH = rh - maxScanH;
  for (let y = rh - 1; y >= minScanH; y--) {
    const empty = isRowEmpty(y);
    if (!empty) {
      hasSeenPixelsBottom = true;
    } else if (empty && hasSeenPixelsBottom) {
      bottomCut = y;
    }
  }
  if (bottomCut < rh - 1) {
    for (let y = bottomCut + 1; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        data[(y * rw + x) * 4 + 3] = 0;
      }
    }
  }

  ctx.putImageData(imgData, rx, ry);
}

/** Extract a single cropped frame from a processed canvas */
function extractFrame(processed, rx, ry, rw, rh) {
  rx = Math.round(rx);
  ry = Math.round(ry);
  rw = Math.round(rw);
  rh = Math.round(rh);

  const ctx = processed.getContext('2d');
  trimCellNoise(ctx, rx, ry, rw, rh);
  const b = findBounds(ctx, rx, ry, rw, rh);
  const pad = 2;
  const sx = Math.max(0, b.x - pad);
  const sy = Math.max(0, b.y - pad);
  const sw = Math.min(processed.width - sx, b.w + pad * 2);
  const sh = Math.min(processed.height - sy, b.h + pad * 2);

  const fc = document.createElement('canvas');
  fc.width = sw; fc.height = sh;
  fc.getContext('2d').drawImage(processed, sx, sy, sw, sh, 0, 0, sw, sh);
  return fc;
}

/** Split a processed image into frame array based on grid layout */
function splitIntoFrames(processed, cols, rows, count) {
  const cw = processed.width / cols;
  const ch = processed.height / rows;
  const frames = [];
  for (let r = 0; r < rows && frames.length < count; r++) {
    for (let c = 0; c < cols && frames.length < count; c++) {
      frames.push(extractFrame(processed, c * cw, r * ch, cw, ch));
    }
  }
  return frames;
}

/** Split ginger's hybrid layout (Row 1: 3 cols, Row 2: 2 cols) */
function splitGingerHybrid(processed, count) {
  const frames = [];
  const rh = processed.height / 2;
  
  // Row 1: 3 columns (width 341.33 each)
  const cw1 = processed.width / 3;
  for (let c = 0; c < 3 && frames.length < count; c++) {
    frames.push(extractFrame(processed, c * cw1, 0, cw1, rh));
  }
  
  // Row 2: 2 columns (width 512 each)
  const cw2 = processed.width / 2;
  for (let c = 0; c < 2 && frames.length < count; c++) {
    frames.push(extractFrame(processed, c * cw2, rh, cw2, rh));
  }
  
  return frames;
}

/** Create a mirrored/shifted copy for 2-frame idle breathing */
function createBreathingFrames(singleFrame) {
  // Frame 1: original
  // Frame 2: slightly squished vertically (breathing in)
  const f2 = document.createElement('canvas');
  const squish = 0.97;
  f2.width = singleFrame.width;
  f2.height = singleFrame.height;
  const ctx = f2.getContext('2d');
  const dy = singleFrame.height * (1 - squish);
  ctx.drawImage(singleFrame, 0, dy, singleFrame.width, singleFrame.height * squish);
  return [singleFrame, f2];
}

// ────────────────────────────────────────────
// Main loading logic
// ────────────────────────────────────────────

async function processBreed(breedKey) {
  const spriteKey = BREED_SPRITE_MAP[breedKey];
  if (!spriteKey) return null;

  // Reuse if already processed (shared sprites like black→tuxedo, scottish→tabby)
  if (spriteCache[breedKey]) return spriteCache[breedKey];
  const sharedBreed = Object.keys(spriteCache).find(b => BREED_SPRITE_MAP[b] === spriteKey);
  if (sharedBreed && spriteCache[sharedBreed]) {
    spriteCache[breedKey] = spriteCache[sharedBreed];
    return spriteCache[breedKey];
  }

  const basePath = `assets/sprites/${spriteKey}`;

  // Load base sprite sheet + optional animation strips
  const [baseImg, walkImg, petImg] = await Promise.all([
    loadImage(`${basePath}.png`),
    tryLoadImage(`${basePath}_walk.png`),
    tryLoadImage(`${basePath}_pet.png`),
  ]);

  // Process base sheet
  const layout = LAYOUT[spriteKey] || { cols: 2, rows: 2, count: 4 };
  const processedBase = await removeWhiteBackgroundAsync(baseImg);
  let baseFrames;
  if (spriteKey === 'ginger') {
    baseFrames = splitGingerHybrid(processedBase, layout.count);
  } else {
    baseFrames = splitIntoFrames(processedBase, layout.cols, layout.rows, layout.count);
  }
  // baseFrames: [0]=idle/sit, [1]=walk, [2]=sleep, [3]=play

  // Process walk cycle strip
  let walkFrames;
  if (walkImg) {
    const processedWalk = await removeWhiteBackgroundAsync(walkImg);
    const wLayout = WALK_LAYOUT[spriteKey] || { cols: 4, rows: 1, count: 4 };
    let frames;
    if (spriteKey === 'ginger') {
      frames = splitGingerHybrid(processedWalk, wLayout.count);
      // Ginger walk sheet has 5 frames in a 3x2 grid, where frame 2 is the sleep pose.
      // Skip frame 2 to yield 4 walking cycle poses.
      frames = [frames[0], frames[1], frames[3], frames[4]];
    } else {
      frames = splitIntoFrames(processedWalk, wLayout.cols, wLayout.rows, wLayout.count);
    }
    walkFrames = frames;
  } else {
    // Fallback: use single walk frame repeated
    walkFrames = [baseFrames[1] || baseFrames[0]];
  }

  // Process pet animation strip
  let petFrames;
  if (petImg) {
    const processedPet = await removeWhiteBackgroundAsync(petImg);
    const pLayout = PET_LAYOUT[spriteKey] || { cols: 4, rows: 1, count: 4 };
    petFrames = splitIntoFrames(processedPet, pLayout.cols, pLayout.rows, pLayout.count);
  } else {
    // Fallback: use idle frame with breathing
    petFrames = createBreathingFrames(baseFrames[0]);
  }

  // Build idle frames (2-frame breathing from base idle)
  const idleFrames = createBreathingFrames(baseFrames[0]);

  // Sleep frames (2-frame breathing from sleep sprite)
  const sleepFrames = createBreathingFrames(baseFrames[2] || baseFrames[0]);

  // Play frames: use play sprite + idle for a 2-frame pounce cycle
  // Ginger's play/pounce pose is frame 4 (since it has 5 frames in total, and frame 2/3 are sleep).
  const playFrame = spriteKey === 'ginger' 
    ? (baseFrames[4] || baseFrames[0]) 
    : (baseFrames[3] || baseFrames[1] || baseFrames[0]);
  const playFrames = [playFrame, baseFrames[0]]; // pounce → reset

  const result = {
    idle: idleFrames,
    walk: walkFrames,
    sleep: sleepFrames,
    play: playFrames,
    pet: petFrames,
    eat: walkFrames, // eating uses walk animation
  };

  spriteCache[breedKey] = result;
  return result;
}



/**
 * Load initial startup breed sprites. Call once before game loop starts.
 */
export async function loadAllSprites() {
  // Only preload default/initial breeds to prevent startup lag
  const startupBreeds = ['tabby', 'ginger', 'tuxedo', 'siamese'];
  await Promise.all(startupBreeds.map(b => processBreed(b)));
  
  // Lazily process the other breeds in the background so they are ready soon,
  // but do not block startup. We stagger them to keep main thread smooth.
  const breeds = Object.keys(BREED_SPRITE_MAP);
  let delay = 300;
  for (const b of breeds) {
    if (!spriteCache[b]) {
      const breedToLoad = b;
      setTimeout(() => {
        if (!spriteCache[breedToLoad]) {
          processBreed(breedToLoad).catch(() => {});
        }
      }, delay);
      delay += 300; // stagger next load
    }
  }

  console.log(`[SpriteLoader] Startup breeds loaded`);
  return spriteCache;
}

/**
 * Check if sprite frames for a breed are fully loaded.
 */
export function isSpriteLoaded(breed) {
  return !!spriteCache[breed];
}

/**
 * Get sprite frames for a breed.
 * Returns { idle: [Canvas,...], walk: [Canvas,...], ... }
 * If not loaded, triggers lazy load in the background and returns a temporary fallback.
 */
export function getSprite(breed) {
  if (spriteCache[breed]) {
    return spriteCache[breed];
  }

  // Trigger lazy loading
  if (!loadingBreeds[breed]) {
    loadingBreeds[breed] = true;
    processBreed(breed).then(() => {
      delete loadingBreeds[breed];
    }).catch(err => {
      console.warn(`[SpriteLoader] Failed to lazily load breed "${breed}":`, err);
      delete loadingBreeds[breed];
    });
  }

  // Fallback: return tabby or ginger, but mark as fallback
  const fallback = spriteCache['tabby'] || spriteCache['ginger'] || spriteCache[Object.keys(spriteCache)[0]];
  if (fallback) {
    return {
      ...fallback,
      isFallback: true
    };
  }
  return null;
}
