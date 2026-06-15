// js/canvas.js

let particles = [];
let clouds = [];
let stars = [];
let environmentTime = new Date(); // can be overridden by user controls

// Colors for different times of day
const THEMES = {
  morning: {
    skyTop: '#ffafbd',
    skyBottom: '#ffc3a0',
    wall: '#f7ebe1',
    floor: '#e5cbb3',
    rug: '#dfb8a6',
    windowBorder: '#bfa08f',
    lightBeam: 'rgba(255, 235, 204, 0.15)',
    ambientSound: 'none'
  },
  afternoon: {
    skyTop: '#70a1ff',
    skyBottom: '#eccc68',
    wall: '#eae1d8',
    floor: '#d3b79b',
    rug: '#b8997a',
    windowBorder: '#aa8c70',
    lightBeam: 'rgba(255, 255, 255, 0.1)',
    ambientSound: 'none'
  },
  evening: {
    skyTop: '#2c3e50',
    skyBottom: '#fd79a8',
    wall: '#ecd3c1',
    floor: '#cfa88c',
    rug: '#a57e62',
    windowBorder: '#936a4f',
    lightBeam: 'rgba(253, 121, 168, 0.15)',
    ambientSound: 'none'
  },
  night: {
    skyTop: '#0f172a',
    skyBottom: '#1e293b',
    wall: '#b6b9cc',
    floor: '#7f8299',
    rug: '#585a73',
    windowBorder: '#47495e',
    lightBeam: 'rgba(156, 163, 175, 0.05)',
    ambientSound: 'none'
  }
};

// Initialize environment elements (clouds, stars, etc.)
export function initEnvironment(width, height) {
  particles = [];
  clouds = [];
  stars = [];

  // Generate 5 clouds
  for (let i = 0; i < 5; i++) {
    clouds.push({
      x: Math.random() * width,
      y: Math.random() * (height * 0.25) + height * 0.05,
      size: Math.random() * 50 + 40,
      speed: Math.random() * 0.15 + 0.05
    });
  }

  // Generate 40 stars (only visible at night)
  for (let i = 0; i < 40; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * (height * 0.35),
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.8 + 0.2,
      twinkleSpeed: Math.random() * 0.02 + 0.005
    });
  }

  // Spawn initial ambient particles (dust motes)
  for (let i = 0; i < 20; i++) {
    spawnParticle(width, height, true);
  }
}

// Set environment time override
export function setEnvironmentTime(date) {
  environmentTime = date;
}

// Get the current time-of-day key
export function getTimeOfDay() {
  const hours = environmentTime.getHours();
  if (hours >= 6 && hours < 11) return 'morning';
  if (hours >= 11 && hours < 17) return 'afternoon';
  if (hours >= 17 && hours < 20) return 'evening';
  return 'night';
}

// Spawn weather particles (Sakura petals, rain, fireflies, dust)
function spawnParticle(width, height, randomY = false, weatherType = 'calm') {
  const y = randomY ? Math.random() * height : -10;
  const timeOfDay = getTimeOfDay();

  if (weatherType === 'rain') {
    particles.push({
      type: 'rain',
      x: Math.random() * width,
      y: y,
      vx: -1 - Math.random() * 1,
      vy: 10 + Math.random() * 5,
      length: 12 + Math.random() * 8,
      width: 1 + Math.random() * 0.5,
      color: 'rgba(174, 219, 243, 0.4)'
    });
  } else if (weatherType === 'sakura') {
    particles.push({
      type: 'sakura',
      x: Math.random() * width,
      y: y,
      vx: 0.5 + Math.random() * 1.5,
      vy: 1 + Math.random() * 1,
      angle: Math.random() * Math.PI * 2,
      rotationSpeed: Math.random() * 0.02 - 0.01,
      size: 5 + Math.random() * 5,
      color: `rgba(255, ${180 + Math.floor(Math.random() * 40)}, ${200 + Math.floor(Math.random() * 30)}, 0.6)`
    });
  } else {
    // Default: Dust motes for morning/afternoon, fireflies for evening/night
    if (timeOfDay === 'night' || timeOfDay === 'evening') {
      particles.push({
        type: 'firefly',
        x: Math.random() * width,
        y: randomY ? Math.random() * (height * 0.8) : height * 0.8,
        vx: Math.random() * 0.6 - 0.3,
        vy: Math.random() * -0.4 - 0.2,
        size: Math.random() * 2 + 1,
        color: `rgba(180, 255, 100, ${Math.random() * 0.5 + 0.3})`,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        pulseVal: Math.random() * Math.PI
      });
    } else {
      // Dust motes floating in sunbeams
      particles.push({
        type: 'dust',
        x: Math.random() * width,
        y: y,
        vx: Math.random() * 0.4 - 0.2,
        vy: Math.random() * 0.3 + 0.1,
        size: Math.random() * 1.5 + 0.5,
        color: `rgba(255, 240, 200, ${Math.random() * 0.3 + 0.1})`
      });
    }
  }
}

// Update background elements
export function updateEnvironment(width, height, weatherType = 'calm') {
  const timeOfDay = getTimeOfDay();
  const activeTheme = THEMES[timeOfDay];

  // Update clouds
  clouds.forEach(cloud => {
    cloud.x += cloud.speed;
    if (cloud.x - cloud.size > width) {
      cloud.x = -cloud.size * 2;
      cloud.y = Math.random() * (height * 0.25) + height * 0.05;
    }
  });

  // Update stars (twinkle)
  if (timeOfDay === 'night') {
    stars.forEach(star => {
      star.alpha += star.twinkleSpeed;
      if (star.alpha > 0.95 || star.alpha < 0.15) {
        star.twinkleSpeed = -star.twinkleSpeed;
      }
    });
  }

  // Update particles
  particles.forEach((p, idx) => {
    if (p.type === 'rain') {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > height || p.x < 0) {
        particles.splice(idx, 1);
      }
    } else if (p.type === 'sakura') {
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.rotationSpeed;
      if (p.y > height || p.x > width) {
        particles.splice(idx, 1);
      }
    } else if (p.type === 'firefly') {
      p.x += p.vx;
      p.y += p.vy;
      p.pulseVal += p.pulseSpeed;
      if (p.y < height * 0.1 || p.x < 0 || p.x > width) {
        particles.splice(idx, 1);
      }
    } else {
      // dust
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > height || p.x < 0 || p.x > width) {
        particles.splice(idx, 1);
      }
    }
  });

  // Spawn new particles to maintain counts
  const targetCount = weatherType === 'rain' ? 80 : (weatherType === 'sakura' ? 40 : 20);
  if (particles.length < targetCount && Math.random() < 0.3) {
    spawnParticle(width, height, false, weatherType);
  }
}

// Renders the background room scene
export function drawBackground(ctx, width, height, weatherType = 'calm') {
  const timeOfDay = getTimeOfDay();
  const theme = THEMES[timeOfDay];

  // 1. Clear background (Wallpaper)
  ctx.fillStyle = theme.wall;
  ctx.fillRect(0, 0, width, height);

  // 2. Draw Floor
  const floorHeight = height * 0.38; // Floor starts 62% down
  const floorTopY = height - floorHeight;
  ctx.fillStyle = theme.floor;
  ctx.fillRect(0, floorTopY, width, floorHeight);

  // Floor board lines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 2;
  const boardCount = 8;
  const boardWidth = floorHeight / boardCount;
  for (let i = 1; i <= boardCount; i++) {
    const y = floorTopY + i * boardWidth;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 3. Draw Large Window looking into the garden
  const winW = width * 0.58;
  const winH = height * 0.45;
  const winX = (width - winW) / 2;
  const winY = height * 0.1;

  // Window background (Sky)
  const skyGrad = ctx.createLinearGradient(winX, winY, winX, winY + winH);
  skyGrad.addColorStop(0, theme.skyTop);
  skyGrad.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(winX, winY, winW, winH);

  // Draw Stars (Night only)
  if (timeOfDay === 'night') {
    stars.forEach(star => {
      // Only draw if inside window bounds
      if (star.x >= winX && star.x <= winX + winW && star.y >= winY && star.y <= winY + winH) {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Moon
    const moonX = winX + winW * 0.8;
    const moonY = winY + winH * 0.22;
    ctx.fillStyle = 'rgba(255, 255, 230, 0.95)';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset shadow

    // Draw crescent shadow to make a crescent moon
    ctx.fillStyle = theme.skyTop;
    ctx.beginPath();
    ctx.arc(moonX - 6, moonY - 3, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Sun (Daytime)
  if (timeOfDay === 'afternoon' || timeOfDay === 'morning') {
    const sunX = winX + winW * (timeOfDay === 'morning' ? 0.2 : 0.75);
    const sunY = winY + winH * (timeOfDay === 'morning' ? 0.4 : 0.2);
    const sunSize = timeOfDay === 'morning' ? 24 : 30;
    
    ctx.fillStyle = timeOfDay === 'morning' ? 'rgba(255, 220, 160, 0.95)' : 'rgba(255, 253, 230, 0.98)';
    ctx.shadowColor = 'rgba(255, 230, 150, 0.6)';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset shadow
  }

  // Draw Clouds (visible inside window bounds)
  ctx.fillStyle = timeOfDay === 'night' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.4)';
  clouds.forEach(cloud => {
    if (cloud.x + cloud.size * 2 > winX && cloud.x - cloud.size < winX + winW) {
      // Draw fluffy cloud shapes
      ctx.beginPath();
      // Draw cloud centered in window bounds
      const cx = cloud.x;
      const cy = Math.max(winY + 15, Math.min(cloud.y, winY + winH - 35));
      ctx.arc(cx, cy, cloud.size * 0.4, 0, Math.PI * 2);
      ctx.arc(cx + cloud.size * 0.25, cy - cloud.size * 0.1, cloud.size * 0.35, 0, Math.PI * 2);
      ctx.arc(cx + cloud.size * 0.5, cy, cloud.size * 0.3, 0, Math.PI * 2);
      ctx.arc(cx + cloud.size * 0.25, cy + cloud.size * 0.15, cloud.size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Draw outdoor garden silhouette trees/hills at the bottom of the window
  ctx.fillStyle = timeOfDay === 'night' ? '#141b2a' : (timeOfDay === 'evening' ? '#5a3d4f' : '#8da47e');
  ctx.beginPath();
  ctx.moveTo(winX, winY + winH);
  ctx.quadraticCurveTo(winX + winW * 0.25, winY + winH - 25, winX + winW * 0.5, winY + winH - 12);
  ctx.quadraticCurveTo(winX + winW * 0.75, winY + winH - 30, winX + winW, winY + winH);
  ctx.lineTo(winX + winW, winY + winH);
  ctx.lineTo(winX, winY + winH);
  ctx.fill();

  // Glassmorphic overlay for window reflection
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fillRect(winX, winY, winW, winH);

  // Draw window reflections (diagonal glass shine)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(winX + winW * 0.15, winY);
  ctx.lineTo(winX + winW * 0.45, winY + winH);
  ctx.moveTo(winX + winW * 0.25, winY);
  ctx.lineTo(winX + winW * 0.55, winY + winH);
  ctx.stroke();

  // Draw Window Frame & Border
  ctx.strokeStyle = theme.windowBorder;
  ctx.lineWidth = 14;
  ctx.strokeRect(winX, winY, winW, winH);
  // Grid pane bars
  ctx.strokeStyle = theme.windowBorder;
  ctx.lineWidth = 6;
  // Vertical split
  ctx.beginPath();
  ctx.moveTo(winX + winW / 2, winY);
  ctx.lineTo(winX + winW / 2, winY + winH);
  ctx.stroke();
  // Horizontal split
  ctx.beginPath();
  ctx.moveTo(winX, winY + winH * 0.45);
  ctx.lineTo(winX + winW, winY + winH * 0.45);
  ctx.stroke();

  // 4. Draw Cozy Rug in the center of the floor
  const rugW = width * 0.46;
  const rugH = height * 0.15;
  const rugX = (width - rugW) / 2;
  const rugY = floorTopY + floorHeight * 0.35;
  
  ctx.fillStyle = theme.rug;
  ctx.beginPath();
  ctx.ellipse(rugX + rugW / 2, rugY + rugH / 2, rugW / 2, rugH / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rug fringe/border details
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.ellipse(rugX + rugW / 2, rugY + rugH / 2, rugW / 2 - 6, rugH / 2 - 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]); // reset

  // 5. Draw Light Beams (morning/afternoon/sunset) casting from window
  if (timeOfDay !== 'night') {
    ctx.fillStyle = theme.lightBeam;
    ctx.beginPath();
    ctx.moveTo(winX + winW * 0.2, winY + winH);
    ctx.lineTo(winX + winW * 0.8, winY + winH);
    // Beams extend downward diagonally to the floor
    const skew = timeOfDay === 'morning' ? 120 : -80;
    ctx.lineTo(winX + winW * 0.8 + skew + 180, height);
    ctx.lineTo(winX + winW * 0.2 + skew - 100, height);
    ctx.closePath();
    ctx.fill();
  }
}

// Renders the moving background particles (cherry blossoms, raindrops, fireflies, dust)
export function drawEnvironmentParticles(ctx) {
  particles.forEach(p => {
    ctx.save();
    if (p.type === 'rain') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 0.6, p.y + p.vy * 0.6);
      ctx.stroke();
    } else if (p.type === 'sakura') {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      // Draw a tiny cherry blossom leaf/petal shape
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-p.size / 2, -p.size / 2, -p.size, p.size / 3, 0, p.size);
      ctx.bezierCurveTo(p.size, p.size / 3, p.size / 2, -p.size / 2, 0, 0);
      ctx.fill();
    } else if (p.type === 'firefly') {
      const alpha = Math.max(0.1, Math.sin(p.pulseVal) * 0.6 + 0.4);
      ctx.fillStyle = `rgba(190, 255, 120, ${alpha})`;
      ctx.shadowColor = 'rgb(180, 255, 80)';
      ctx.shadowBlur = p.size * 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Dust mote
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}
