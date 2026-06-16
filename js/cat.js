// js/cat.js
import { playMeow, startPurr, stopPurr } from './audio.js';
import { getSprite, getAccessorySprite } from './spriteLoader.js';

const ACCESSORY_OFFSETS = {
  default: {
    collar:  { dx: -0.18, dy: -0.36, ds: 0.28 },
    ribbon:  { dx: -0.18, dy: -0.36, ds: 0.28 },
    hat:     { dx: -0.20, dy: -0.82, ds: 0.38 },
    glasses: { dx: -0.28, dy: -0.52, ds: 0.28 },
  },
  ginger: {
    collar:  { dx: -0.15, dy: -0.36, ds: 0.28 },
    ribbon:  { dx: -0.15, dy: -0.36, ds: 0.28 },
    hat:     { dx: -0.18, dy: -0.82, ds: 0.38 },
    glasses: { dx: -0.26, dy: -0.54, ds: 0.28 },
  },
  siamese: {
    collar:  { dx: -0.16, dy: -0.36, ds: 0.28 },
    ribbon:  { dx: -0.16, dy: -0.36, ds: 0.28 },
    hat:     { dx: -0.20, dy: -0.84, ds: 0.38 },
    glasses: { dx: -0.28, dy: -0.54, ds: 0.28 },
  },
  grey: {
    collar:  { dx: -0.15, dy: -0.36, ds: 0.28 },
    ribbon:  { dx: -0.15, dy: -0.36, ds: 0.28 },
    hat:     { dx: -0.20, dy: -0.84, ds: 0.38 },
    glasses: { dx: -0.26, dy: -0.54, ds: 0.28 },
  }
};

export class Cat {
  constructor(name, breed, options = {}) {
    this.id = 'cat_' + Math.random().toString(36).substr(2, 9);
    this.name = name || 'Nabi';
    this.breed = breed || 'tabby'; // tabby, tuxedo, calico, siamese, black, white, ginger, grey
    this.accessories = options.accessories || []; // 'collar', 'ribbon', 'hat', 'glasses'
    this.gender = options.gender || (Math.random() > 0.5 ? 'male' : 'female');
    this.spriteFrames = null; // Set after sprites load

    // Position & Physics
    this.x = options.x || 100 + Math.random() * 400;
    this.y = 0; // calculated based on floor
    this.vx = 0;
    this.vy = 0;
    this.width = 65;
    this.height = 42;
    this.scale = 1.0;

    // Stats (0 to 100)
    this.affection = options.affection || 50;
    this.hunger = options.hunger || 30; // 0 = full, 100 = starving
    this.energy = options.energy || 70 + Math.random() * 30; // 0 = exhausted, 100 = energetic

    // AI & States
    // States: 'idle', 'walk', 'sit', 'sleep', 'play', 'eat', 'pet'
    this.state = 'idle';
    this.direction = Math.random() > 0.5 ? 1 : -1; // 1 = right, -1 = left
    this.stateTimer = 2 + Math.random() * 4; // seconds in current state
    this.targetX = this.x;
    this.targetToy = null;
    this.inBox = null; // Reference to a box toy they are occupying

    // Animation variables
    this.animTime = Math.random() * 100;
    this.legCycle = 0;
    this.tailWag = 0;
    this.earWiggle = 0;
    this.isSleeping = false;
    this.isBeingPet = false;
    this.isDragging = false;
    this.observationMode = false;
    this.laserInterested = null;
    this.hearts = []; // list of rising hearts [{x, y, alpha, size, speed}]
    this.hitTimer = 0;
    this.stars = []; // list of rising stars [{x, y, alpha, size, speed}]

    // Specific breed colors
    this.colors = this.getBreedColors();
  }

  // Get color schemes based on breed
  getBreedColors() {
    switch (this.breed) {
      case 'tuxedo':
        return { body: '#2f3542', chest: '#ffffff', paws: '#ffffff', eyes: '#7bed9f', stripes: null, nose: '#ffb8b8' };
      case 'calico':
        return { body: '#ffffff', orangePatches: '#f0932b', blackPatches: '#2f3542', eyes: '#f9ca24', nose: '#ffb8b8' };
      case 'siamese':
        return { body: '#f1f2f6', points: '#57606f', eyes: '#70a1ff', nose: '#2f3542' }; // points = face, ears, tail, paws
      case 'ginger':
        return { body: '#ff9f43', stripes: '#ee5253', chest: '#fff2e6', paws: '#fff2e6', eyes: '#2ed573', nose: '#ffb8b8' };
      case 'black':
        return { body: '#2f3542', eyes: '#ffa502', nose: '#2f3542' };
      case 'white':
        return { body: '#ffffff', eyes: '#70a1ff', nose: '#ffb8b8' };
      case 'grey':
        return { body: '#a4b0be', chest: '#ced6e0', stripes: '#747d8c', eyes: '#ffa502', nose: '#ffb8b8' };
      case 'tabby':
      default:
        return { body: '#ced6e0', stripes: '#747d8c', chest: '#f1f2f6', eyes: '#2ed573', nose: '#ffb8b8' };
    }
  }

  leaveBox() {
    if (this.inBox) {
      if (this.inBox.claimedBy === this.id) {
        this.inBox.claimedBy = null;
      }
      this.inBox = null;
    }
  }

  update(width, height, floorY, toys, laser, delta) {
    this.animTime += delta;

    // Handle scale LERP based on observation mode
    this.targetScale = this.observationMode ? 3.2 : 1.0;
    this.scale += (this.targetScale - this.scale) * 0.12;

    // Stat changes over time
    this.hunger = Math.min(100, this.hunger + delta * 0.4); // hunger increases
    this.energy = Math.max(0, this.energy - (this.state === 'sleep' ? -delta * 4.5 : delta * 0.25)); // energy drains (restores during sleep)
    this.affection = Math.max(0, this.affection - delta * 0.1); // affection slowly decays

    // Update floating petting hearts
    this.hearts.forEach((h, idx) => {
      h.y -= h.speed;
      h.x += Math.sin(h.y * 0.05) * 0.5;
      h.alpha -= delta * 0.8;
      if (h.alpha <= 0) {
        this.hearts.splice(idx, 1);
      }
    });

    // Update hit timer
    if (this.hitTimer > 0) {
      this.hitTimer -= delta;
      this.vx = 0;
      this.vy = 0;
    }

    // Update stars
    this.stars.forEach((s, idx) => {
      s.y -= s.speed;
      s.x += Math.sin(this.animTime * 6 + idx) * 0.5;
      s.alpha -= delta * 1.5;
      if (s.alpha <= 0) {
        this.stars.splice(idx, 1);
      }
    });

    // Handle hit state
    if (this.hitTimer > 0) {
      this.vx = 0;
      return; // Freeze AI while hit
    }

    // Handle dragging state
    if (this.isDragging) {
      this.vx = 0;
      this.vy = 0;
      this.leaveBox();
      return;
    }

    // Handle petting state
    if (this.isBeingPet) {
      this.state = 'pet';
      this.vx = 0;
      this.leaveBox();
      if (Math.random() < 0.08) {
        this.hearts.push({
          x: this.x + (Math.random() * 40 - 20),
          y: this.y - this.height * this.scale - 10,
          alpha: 1.0,
          size: 6 * this.scale + Math.random() * 6,
          speed: 1 + Math.random() * 1
        });
      }
      return; // Freeze AI while petting
    }

    // Set height based on floor level, box, or observation mode
    const baseFloorY = floorY - 5;
    if (this.observationMode) {
      const floorHeight = height * 0.38;
      const rugY = floorY + floorHeight * 0.35;
      const rugH = height * 0.15;
      this.y = rugY + rugH * 0.8; // Align cat feet on the cozy rug/carpet
      this.vx = 0;
      this.vy = 0;
      
      // Simple AI state machine in observation mode (mostly sit, look around, purr)
      if (this.stateTimer <= 0) {
        this.state = Math.random() > 0.45 ? 'sit' : 'idle';
        this.stateTimer = 3 + Math.random() * 5;
      }
      this.stateTimer -= delta;

      // Restrict horizontal bounds in observation mode
      if (this.x < 60) this.x = 60;
      if (this.x > width - 60) this.x = width - 60;
      return;
    }

    if (this.inBox) {
      if (this.state === 'sit') {
        this.y = this.inBox.y - 40; // Sitting higher to look out
      } else {
        this.y = this.inBox.y - 34; // Sleep peeking out
      }
      this.x = this.inBox.x;
    } else {
      this.y = baseFloorY;
    }

    // Check Laser Pointer (takes top priority if cat is awake)
    if (laser.active && this.state !== 'sleep') {
      // Roll a random interest chance once when the laser is first turned on
      if (this.laserInterested === undefined || this.laserInterested === null) {
        this.laserInterested = Math.random() < 0.65; // 65% chance of chasing the laser
      }

      if (this.laserInterested) {
        this.leaveBox(); // get out of box to play!
        
        // Initialize reaction timer if not set (makes them watch it for a moment first)
        if (this.laserReactTimer === undefined || this.laserReactTimer === null) {
          this.laserReactTimer = 0.6 + Math.random() * 1.0; // 0.6 to 1.6 seconds delay
        }

        this.direction = laser.x > this.x ? 1 : -1;
        this.targetToy = null;
        this.vx = 0;

        if (this.laserReactTimer > 0) {
          // Look at the laser in curiosity
          this.laserReactTimer -= delta;
          this.state = 'idle';
          return;
        }

        // Chase laser
        this.state = 'play';
        const speed = 2.6;
        const dist = Math.abs(this.x - laser.x);
        if (dist > 15) {
          this.vx = this.direction * speed;
          this.x += this.vx; // Actually move the cat!
        } else {
          this.vx = 0;
          // Pounce/pat animation triggers meow occasionally
          if (Math.random() < 0.02) {
            playMeow(this.breed === 'siamese' ? 'low' : 'happy');
          }
        }
        return;
      }
    } else {
      // Reset reaction timer and interest when laser is off
      this.laserReactTimer = null;
      this.laserInterested = null;
    }

    // AI Logic
    this.stateTimer -= delta;

    // State Transitions
    if (this.stateTimer <= 0) {
      this.chooseNewState(toys, width);
    }

    // AI Actions
    switch (this.state) {
      case 'idle':
        this.vx = 0;
        break;

      case 'walk':
        const walkSpeed = 0.85;
        const distToTarget = Math.abs(this.x - this.targetX);
        if (distToTarget > 10) {
          this.direction = this.targetX > this.x ? 1 : -1;
          this.vx = this.direction * walkSpeed;
          this.x += this.vx;
        } else {
          this.vx = 0;
          
          // Check if they walked to a box
          if (this.targetToy && this.targetToy.type === 'box' && !this.targetToy.claimedBy && !this.targetToy.isDragging) {
            this.inBox = this.targetToy;
            this.targetToy.claimedBy = this.id;
            this.state = Math.random() > 0.4 ? 'sleep' : 'sit';
            this.stateTimer = 12 + Math.random() * 10;
            this.targetToy = null;
          } else {
            this.state = 'idle';
            this.stateTimer = 1 + Math.random() * 3;
            this.targetToy = null;
          }
        }
        break;

      case 'sleep':
        this.vx = 0;
        if (this.energy > 95) {
          this.state = 'idle';
          this.stateTimer = 2;
          playMeow('happy');
        }
        break;

      case 'sit':
        this.vx = 0;
        break;

      case 'eat':
        // Head towards a fish treat
        if (!this.targetToy || this.targetToy.bites <= 0 || !toys.includes(this.targetToy)) {
          this.state = 'idle';
          this.stateTimer = 1;
          this.targetToy = null;
          break;
        }

        const runSpeed = 2.2;
        const distToFood = Math.abs(this.x - this.targetToy.x);
        this.direction = this.targetToy.x > this.x ? 1 : -1;

        if (distToFood > 25) {
          this.vx = this.direction * runSpeed;
          this.x += this.vx;
        } else {
          // Eat the food
          this.vx = 0;
          this.targetToy.bites -= 1;
          this.hunger = Math.max(0, this.hunger - 35);
          this.energy = Math.min(100, this.energy + 10);
          
          playMeow('happy');

          if (this.targetToy.bites <= 0) {
            const foodIdx = toys.indexOf(this.targetToy);
            if (foodIdx > -1) toys.splice(foodIdx, 1);
            this.state = 'idle';
            this.stateTimer = 2;
            this.targetToy = null;
          } else {
            this.stateTimer = 1.2; // keep eating next bite
          }
        }
        break;

      case 'play':
        // Head towards a yarn ball
        if (!this.targetToy || !toys.includes(this.targetToy)) {
          this.state = 'idle';
          this.stateTimer = 1;
          this.targetToy = null;
          break;
        }

        const playRunSpeed = 2.0;
        const distToYarn = Math.abs(this.x - this.targetToy.x);
        this.direction = this.targetToy.x > this.x ? 1 : -1;

        if (distToYarn > 30) {
          this.vx = this.direction * playRunSpeed;
          this.x += this.vx;
        } else {
          // Play with the yarn (kick/bat it)
          this.vx = 0;
          this.targetToy.vx = this.direction * (4 + Math.random() * 4);
          this.targetToy.vy = -2 - Math.random() * 3;
          this.energy = Math.max(10, this.energy - 8);
          this.affection = Math.min(100, this.affection + 5);

          if (Math.random() < 0.3) {
            playMeow('kitten');
          }

          this.state = 'idle';
          this.stateTimer = 1.5 + Math.random() * 2;
          this.targetToy = null;
        }
        break;
    }

    // Keep cat on screen
    if (this.x < 30) {
      this.x = 30;
      this.vx = 0;
      if (this.state === 'walk') this.state = 'idle';
    } else if (this.x > width - 30) {
      this.x = width - 30;
      this.vx = 0;
      if (this.state === 'walk') this.state = 'idle';
    }
  }

  // Choose a new state based on stats and environment
  chooseNewState(toys, canvasWidth) {
    // If already inside a cardboard box, prioritize staying cozy!
    if (this.inBox) {
      // 1. Check hunger first: if extremely hungry, they must leave the box to eat
      if (this.hunger > 75) {
        const foods = toys.filter(t => t.type === 'treat' && t.bites > 0 && !t.isDragging);
        if (foods.length > 0) {
          this.leaveBox();
          // proceed to hunger handling below
        }
      } else {
        // 70% chance of staying cozy inside the box
        if (Math.random() < 0.70) {
          this.state = Math.random() > 0.4 ? 'sleep' : 'sit';
          this.stateTimer = 10 + Math.random() * 10;
          return;
        } else {
          // 30% chance they choose to leave the box
          this.leaveBox();
        }
      }
    }

    // 1. Check hunger
    if (this.hunger > 60) {
      const foods = toys.filter(t => t.type === 'treat' && t.bites > 0 && !t.isDragging);
      if (foods.length > 0) {
        let closestFood = foods[0];
        let minDist = Math.abs(this.x - closestFood.x);
        for (let i = 1; i < foods.length; i++) {
          const dist = Math.abs(foods[i].x - this.x); // Wait, make sure we use distance to this cat!
          if (dist < minDist) {
            minDist = dist;
            closestFood = foods[i];
          }
        }
        this.state = 'eat';
        this.targetToy = closestFood;
        this.stateTimer = 10;
        return;
      }
    }

    // 2. Cats LOVE boxes! Check if unoccupied cardboard box exists.
    // If a box is present and they aren't already in one, they have a high chance (50%) of wanting to crawl in
    const boxes = toys.filter(t => t.type === 'box' && !t.isDragging && !t.claimedBy);
    if (boxes.length > 0 && !this.inBox && Math.random() < 0.50) {
      let closestBox = boxes[0];
      let minDist = Math.abs(this.x - closestBox.x);
      for (let i = 1; i < boxes.length; i++) {
        const dist = Math.abs(boxes[i].x - this.x);
        if (dist < minDist) {
          minDist = dist;
          closestBox = boxes[i];
        }
      }
      this.state = 'walk';
      this.targetX = closestBox.x;
      this.targetToy = closestBox;
      this.stateTimer = 6;
      return;
    }

    // 3. Check energy (sleepy) - if very tired, curl up to sleep on the floor
    if (this.energy < 35) {
      this.state = 'sleep';
      this.stateTimer = 12 + Math.random() * 8;
      this.leaveBox();
      return;
    }

    // 3. Play if energized and yarn exists
    if (this.energy > 40 && Math.random() < 0.5) {
      const yarns = toys.filter(t => t.type === 'yarn' && !t.isDragging);
      if (yarns.length > 0) {
        let closestYarn = yarns[0];
        let minDist = Math.abs(this.x - closestYarn.x);
        for (let i = 1; i < yarns.length; i++) {
          const dist = Math.abs(yarns[i].x - this.x);
          if (dist < minDist) {
            minDist = dist;
            closestYarn = yarns[i];
          }
        }
        this.state = 'play';
        this.targetToy = closestYarn;
        this.stateTimer = 8;
        return;
      }
    }

    // 4. Default behaviors
    const roll = Math.random();
    if (roll < 0.4) {
      // Walk somewhere
      this.state = 'walk';
      this.targetX = 50 + Math.random() * (canvasWidth - 100);
      this.stateTimer = 6;
      this.leaveBox(); // leaves box
    } else if (roll < 0.75) {
      // Sit
      this.state = 'sit';
      this.stateTimer = 2 + Math.random() * 4;
    } else {
      // Idle
      this.state = 'idle';
      this.stateTimer = 1 + Math.random() * 3;
    }
  }

  // Draw the cat using animated sprites
  draw(ctx) {
    // Lazy-load sprite frames if not yet set
    if (!this.spriteFrames) {
      this.spriteFrames = getSprite(this.breed);
    }

    // Determine which animation to use based on current state
    let frameKey = 'idle';
    let animFPS = 1.5; // frames per second for cycling

    if (this.state === 'walk') {
      frameKey = 'walk'; animFPS = 6;
    } else if (this.state === 'eat') {
      frameKey = 'eat'; animFPS = 5;
    } else if (this.state === 'sleep') {
      frameKey = 'sleep'; animFPS = 0.8;
    } else if (this.state === 'play') {
      frameKey = 'play'; animFPS = 5;
    } else if (this.state === 'pet' || this.isBeingPet) {
      frameKey = 'pet'; animFPS = 3;
    } else if (this.state === 'sit') {
      frameKey = 'idle'; animFPS = 1.2;
    }
    // idle uses default

    // Get frame array for this state
    const frames = this.spriteFrames ? this.spriteFrames[frameKey] : null;

    if (!frames || frames.length === 0) {
      // Placeholder while loading
      ctx.save();
      ctx.fillStyle = '#ddd';
      ctx.beginPath();
      ctx.arc(this.x, this.y - 20 * this.scale, 15 * this.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Pick current frame from the animation cycle
    const frameIndex = Math.floor(this.animTime * animFPS) % frames.length;
    const frame = frames[frameIndex];

    // Calculate animation offsets
    let bodyYOffset = 0;
    let scaleXMod = 1.0;
    let scaleYMod = 1.0;
    let rotation = 0;
    let shakeX = 0;

    if (this.hitTimer > 0) {
      shakeX = Math.sin(this.animTime * 45) * 3;
      scaleYMod = 1.0 + Math.sin(this.animTime * 30) * 0.08;
      scaleXMod = 1.0 - Math.sin(this.animTime * 30) * 0.05;
    } else if (this.isDragging) {
      bodyYOffset = -5;
      rotation = Math.sin(this.animTime * 2.5) * 0.06;
    } else if (this.state === 'walk' || this.state === 'eat') {
      bodyYOffset = Math.sin(this.animTime * 11) * 1.5;
    } else if (this.state === 'play') {
      bodyYOffset = Math.sin(this.animTime * 8) * 2.5;
      scaleYMod = 1.0 + Math.sin(this.animTime * 8) * 0.04;
    } else if (this.state === 'pet' || this.isBeingPet) {
      bodyYOffset = Math.sin(this.animTime * 5) * 1.0;
      scaleYMod = 1.0 + Math.sin(this.animTime * 4.5) * 0.02;
    } else if (this.state === 'sleep') {
      scaleYMod = 1.0 + Math.sin(this.animTime * 1.5) * 0.03;
      bodyYOffset = 2;
    } else {
      // Idle/sit: subtle breathing
      scaleYMod = 1.0 + Math.sin(this.animTime * 2.2) * 0.02;
      bodyYOffset = Math.sin(this.animTime * 2.2) * 0.8;
    }

    // Sprite render dimensions
    const baseRenderH = 70;
    const aspect = frame.width / frame.height;
    const baseRenderW = baseRenderH * aspect;

    const renderW = baseRenderW * this.scale * scaleXMod;
    const renderH = baseRenderH * this.scale * scaleYMod;

    ctx.save();
    ctx.translate(this.x + shakeX, this.y + bodyYOffset);
    ctx.rotate(rotation);
    ctx.scale(this.direction, 1); // flip based on direction

    const drawX = -renderW / 2;
    const drawY = -renderH;

    // Hit state: red tint overlay
    if (this.hitTimer > 0) {
      ctx.drawImage(frame, drawX, drawY, renderW, renderH);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255, 90, 90, 0.2)'; // Softer, lighter red tint
      ctx.fillRect(drawX, drawY, renderW, renderH);
      ctx.restore();
    } else {
      ctx.drawImage(frame, drawX, drawY, renderW, renderH);
    }

    // Shadow under cat
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 0, renderW * 0.35, 5 * this.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Accessories overlay
    if (this.accessories.length > 0) {
      this.drawAccessories(ctx, renderW, renderH);
    }

    ctx.restore();

    // Draw Name text overlay (always in screen space, not flipped)
    ctx.save();
    ctx.fillStyle = '#2f3542';
    ctx.font = `500 ${Math.max(11, 12 * this.scale)}px "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255,255,255,0.85)';
    ctx.shadowBlur = 4;

    let displayName = this.name;
    if (this.state === 'sleep') displayName = '💤 ' + this.name;
    else if (this.state === 'eat') displayName = '🍲 ' + this.name;
    else if (this.state === 'play') displayName = '🎾 ' + this.name;

    ctx.fillText(displayName, this.x, this.y - renderH - 8);
    ctx.restore();

    // Render rising hearts
    this.hearts.forEach(h => {
      ctx.save();
      ctx.fillStyle = `rgba(255, 107, 129, ${h.alpha})`;
      ctx.translate(h.x, h.y);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-h.size / 2, -h.size / 2, -h.size, h.size / 3, 0, h.size);
      ctx.bezierCurveTo(h.size, h.size / 3, h.size / 2, -h.size / 2, 0, 0);
      ctx.fill();
      ctx.restore();
    });

    // Render rising stars
    this.stars.forEach(s => {
      ctx.save();
      ctx.fillStyle = `rgba(253, 203, 110, ${s.alpha})`;
      ctx.translate(s.x, s.y);
      ctx.font = `${s.size}px "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⭐', 0, 0);
      ctx.restore();
    });
  }

  // Draw accessories using generated sprite images
  drawAccessories(ctx, renderW, renderH) {
    this.accessories.forEach(acc => {
      const img = getAccessorySprite(acc);
      if (!img) return;

      const offsets = (ACCESSORY_OFFSETS[this.breed] || ACCESSORY_OFFSETS.default)[acc] || ACCESSORY_OFFSETS.default[acc];
      
      const aw = renderW * offsets.ds;
      const ah = aw * (img.height / img.width);
      const ax = renderW * offsets.dx - aw * 0.5;
      const ay = -renderH * Math.abs(offsets.dy) - ah * 0.5;

      ctx.drawImage(img, ax, ay, aw, ah);
    });
  }

  // Check if click coordinates hit the cat body bounds (scaled proportionally)
  isClicked(mx, my) {
    // Use sprite render dimensions for hitbox
    const spriteH = 70 * this.scale;
    const spriteW = 60 * this.scale; // approximate width
    const rx = this.x - spriteW / 2;
    const ry = this.y - spriteH;
    return (
      mx >= rx &&
      mx <= rx + spriteW &&
      my >= ry &&
      my <= ry + spriteH + 5 * this.scale
    );
  }

  // Pet the cat
  startPetting() {
    if (!this.isBeingPet) {
      this.isBeingPet = true;
      this.state = 'pet';
      startPurr();
      // Increase stats on petting
      this.affection = Math.min(100, this.affection + 25);
      this.energy = Math.min(100, this.energy + 2);
    }
  }

  stopPetting() {
    if (this.isBeingPet) {
      this.isBeingPet = false;
      stopPurr();
      this.state = 'idle';
      this.stateTimer = 1.5;
    }
  }
}
