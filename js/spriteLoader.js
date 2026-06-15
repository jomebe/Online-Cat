// js/spriteLoader.js
// Loads cat sprite sheets, removes white background, and extracts per-state frames.

// Breed → sprite file mapping
const BREED_SPRITE_MAP = {
  ginger:   'assets/sprites/ginger.png',
  grey:     'assets/sprites/grey.png',
  tuxedo:   'assets/sprites/tuxedo.png',
  black:    'assets/sprites/tuxedo.png',   // shares tuxedo sprite
  white:    'assets/sprites/white.png',
  calico:   'assets/sprites/calico.png',
  tabby:    'assets/sprites/tabby.png',
  scottish: 'assets/sprites/tabby.png',    // shares tabby sprite
  siamese:  'assets/sprites/siamese.png',
};

// Layout config per sprite sheet: how many columns/rows the poses are arranged in
// Each sprite sheet has 4 poses: idle(sit), walk, sleep, play
const LAYOUT_CONFIG = {
  ginger:  { cols: 3, rows: 2, frameCount: 5 }, // 3 top + 2 bottom
  grey:    { cols: 2, rows: 2, frameCount: 4 },
  tuxedo:  { cols: 4, rows: 1, frameCount: 4 },
  white:   { cols: 4, rows: 1, frameCount: 4 },
  calico:  { cols: 4, rows: 1, frameCount: 4 },
  tabby:   { cols: 4, rows: 1, frameCount: 4 },
  siamese: { cols: 2, rows: 2, frameCount: 4 },
};

// State → frame index mapping (which sprite pose to use for each game state)
const STATE_FRAME_MAP = {
  idle: 0,
  sit:  0,
  pet:  0,
  walk: 1,
  eat:  1,
  sleep: 2,
  play: 3,
};

// Global sprite cache: breed → { idle: Canvas, walk: Canvas, sleep: Canvas, play: Canvas }
const spriteCache = {};

/**
 * Load a single image and return a promise.
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

/**
 * Remove near-white background pixels from an image, making them transparent.
 * Returns an offscreen canvas with transparency applied.
 */
function removeWhiteBackground(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // If pixel is near-white (background), make fully transparent
    if (r > 230 && g > 230 && b > 230) {
      data[i + 3] = 0;
    }
    // Soften edges near white regions for anti-aliasing
    else if (r > 210 && g > 210 && b > 210) {
      data[i + 3] = Math.max(0, data[i + 3] - 120);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Find the tight bounding box of non-transparent pixels in a canvas region.
 */
function findBounds(ctx, rx, ry, rw, rh) {
  const imageData = ctx.getImageData(rx, ry, rw, rh);
  const data = imageData.data;
  let minX = rw, minY = rh, maxX = 0, maxY = 0;

  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const alpha = data[(y * rw + x) * 4 + 3];
      if (alpha > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    // No visible pixels found, return center region
    return { x: rx + rw * 0.25, y: ry + rh * 0.25, w: rw * 0.5, h: rh * 0.5 };
  }

  return {
    x: rx + minX,
    y: ry + minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1
  };
}

/**
 * Extract a single sprite frame from a processed canvas, auto-cropping to content bounds.
 * Returns a tightly cropped canvas.
 */
function extractFrame(processedCanvas, regionX, regionY, regionW, regionH) {
  const ctx = processedCanvas.getContext('2d');
  const bounds = findBounds(ctx, regionX, regionY, regionW, regionH);

  // Add a small padding
  const pad = 4;
  const sx = Math.max(0, bounds.x - pad);
  const sy = Math.max(0, bounds.y - pad);
  const sw = Math.min(processedCanvas.width - sx, bounds.w + pad * 2);
  const sh = Math.min(processedCanvas.height - sy, bounds.h + pad * 2);

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = sw;
  frameCanvas.height = sh;
  const fctx = frameCanvas.getContext('2d');
  fctx.drawImage(processedCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  return frameCanvas;
}

/**
 * Split a processed sprite sheet into individual frames based on layout config.
 */
function splitFrames(processedCanvas, layout) {
  const w = processedCanvas.width;
  const h = processedCanvas.height;
  const { cols, rows } = layout;

  const cellW = w / cols;
  const cellH = h / rows;

  const frames = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (frames.length >= (layout.frameCount || 4)) break;
      frames.push(extractFrame(processedCanvas, c * cellW, r * cellH, cellW, cellH));
    }
  }

  return frames;
}

/**
 * Process a single breed's sprite sheet: load, remove background, split into frames.
 */
async function processBreedSprite(breedKey) {
  const src = BREED_SPRITE_MAP[breedKey];
  if (!src) return null;

  // Check if this sprite file was already processed (shared sprites)
  const existingBreed = Object.keys(spriteCache).find(
    b => BREED_SPRITE_MAP[b] === src && spriteCache[b]
  );
  if (existingBreed) {
    // Reuse already-processed frames
    spriteCache[breedKey] = spriteCache[existingBreed];
    return spriteCache[breedKey];
  }

  const image = await loadImage(src);
  const processedCanvas = removeWhiteBackground(image);

  // Determine layout: use the breed's own config, or fallback to the original breed
  const layoutKey = Object.keys(LAYOUT_CONFIG).find(k => BREED_SPRITE_MAP[k] === src) || breedKey;
  const layout = LAYOUT_CONFIG[layoutKey] || { cols: 2, rows: 2, frameCount: 4 };

  const allFrames = splitFrames(processedCanvas, layout);

  // Map to named states
  const namedFrames = {
    idle:  allFrames[0] || allFrames[0],
    walk:  allFrames[1] || allFrames[0],
    sleep: allFrames[2] || allFrames[0],
    play:  allFrames[3] || allFrames[1] || allFrames[0],
  };

  spriteCache[breedKey] = namedFrames;
  return namedFrames;
}

/**
 * Load and process ALL breed sprites. Call this once before starting the game loop.
 * Returns a promise that resolves when all sprites are ready.
 */
export async function loadAllSprites() {
  // Get unique breed keys that have their own sprite file
  const uniqueBreeds = [...new Set(Object.values(BREED_SPRITE_MAP))];
  const breedKeys = Object.keys(BREED_SPRITE_MAP);

  // Process primary breeds first (those with unique sprite files)
  const primaryBreeds = breedKeys.filter((b, i) => {
    return breedKeys.findIndex(k => BREED_SPRITE_MAP[k] === BREED_SPRITE_MAP[b]) === i;
  });

  // Load primary breeds in parallel
  await Promise.all(primaryBreeds.map(b => processBreedSprite(b)));

  // Then map shared breeds
  for (const breed of breedKeys) {
    if (!spriteCache[breed]) {
      await processBreedSprite(breed);
    }
  }

  console.log(`[SpriteLoader] Loaded sprites for ${Object.keys(spriteCache).length} breeds`);
  return spriteCache;
}

/**
 * Get the sprite frames for a given breed.
 * Returns { idle: Canvas, walk: Canvas, sleep: Canvas, play: Canvas } or null.
 */
export function getSprite(breed) {
  return spriteCache[breed] || spriteCache['tabby'] || null;
}

/**
 * Get the correct frame canvas for a given game state.
 */
export function getFrameForState(breed, state) {
  const sprites = getSprite(breed);
  if (!sprites) return null;

  const frameKey = STATE_FRAME_MAP[state] !== undefined ? 
    ['idle', 'walk', 'sleep', 'play'][STATE_FRAME_MAP[state]] : 'idle';

  return sprites[frameKey] || sprites.idle;
}
