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
  // walk & pet strips are always 4-in-a-row
};

// ── Global sprite cache ──
// breed → { idle: [Canvas], walk: [Canvas,...], sleep: [Canvas], play: [Canvas], pet: [Canvas,...] }
const spriteCache = {};

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
// Background removal via edge flood-fill
// Only removes white pixels connected to image edges,
// preserving white cat fur inside the outline.
// ────────────────────────────────────────────
function removeWhiteBackground(image) {
  const canvas = document.createElement('canvas');
  const w = image.width;
  const h = image.height;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const total = w * h;

  // Helper: check if pixel at flat index is near-white
  const isNearWhite = (pos) => {
    const i = pos * 4;
    return data[i] > 225 && data[i + 1] > 225 && data[i + 2] > 225 && data[i + 3] > 100;
  };

  // Visited & background masks
  const visited = new Uint8Array(total);
  const isBg = new Uint8Array(total);

  // BFS queue (use array + pointer for O(1) dequeue)
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

    // 4-connected neighbors
    const neighbors = [];
    if (x > 0) neighbors.push(pos - 1);
    if (x < w - 1) neighbors.push(pos + 1);
    if (y > 0) neighbors.push(pos - w);
    if (y < h - 1) neighbors.push(pos + w);

    for (const npos of neighbors) {
      if (!visited[npos] && isNearWhite(npos)) {
        visited[npos] = 1;
        isBg[npos] = 1;
        queue.push(npos);
      }
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
        // Edge pixel: reduce alpha for smooth anti-aliasing
        data[i * 4 + 3] = Math.max(60, data[i * 4 + 3] - 80);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
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

/** Extract a single cropped frame from a processed canvas */
function extractFrame(processed, rx, ry, rw, rh) {
  const ctx = processed.getContext('2d');
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
  const processedBase = removeWhiteBackground(baseImg);
  const baseFrames = splitIntoFrames(processedBase, layout.cols, layout.rows, layout.count);
  // baseFrames: [0]=idle/sit, [1]=walk, [2]=sleep, [3]=play

  // Process walk cycle strip → 4 frames
  let walkFrames;
  if (walkImg) {
    const processedWalk = removeWhiteBackground(walkImg);
    walkFrames = splitIntoFrames(processedWalk, 4, 1, 4);
  } else {
    // Fallback: use single walk frame repeated
    walkFrames = [baseFrames[1] || baseFrames[0]];
  }

  // Process pet animation strip → 4 frames
  let petFrames;
  if (petImg) {
    const processedPet = removeWhiteBackground(petImg);
    petFrames = splitIntoFrames(processedPet, 4, 1, 4);
  } else {
    // Fallback: use idle frame with breathing
    petFrames = createBreathingFrames(baseFrames[0]);
  }

  // Build idle frames (2-frame breathing from base idle)
  const idleFrames = createBreathingFrames(baseFrames[0]);

  // Sleep frames (2-frame breathing from sleep sprite)
  const sleepFrames = createBreathingFrames(baseFrames[2] || baseFrames[0]);

  // Play frames: use play sprite + idle for a 2-frame pounce cycle
  const playFrame = baseFrames[3] || baseFrames[1] || baseFrames[0];
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
 * Load ALL breed sprites. Call once before game loop starts.
 */
export async function loadAllSprites() {
  const breeds = Object.keys(BREED_SPRITE_MAP);

  // Process unique breeds first
  const uniqueKeys = [...new Set(Object.values(BREED_SPRITE_MAP))];
  const primaryBreeds = uniqueKeys.map(k => breeds.find(b => BREED_SPRITE_MAP[b] === k));
  await Promise.all(primaryBreeds.map(b => processBreed(b)));

  // Then map shared breeds
  for (const b of breeds) {
    if (!spriteCache[b]) await processBreed(b);
  }

  console.log(`[SpriteLoader] Loaded ${Object.keys(spriteCache).length} breeds with animation frames`);
  return spriteCache;
}

/**
 * Get sprite frames for a breed.
 * Returns { idle: [Canvas,...], walk: [Canvas,...], ... }
 */
export function getSprite(breed) {
  return spriteCache[breed] || spriteCache['tabby'] || null;
}
