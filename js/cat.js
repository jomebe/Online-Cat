// js/cat.js
import { playMeow, startPurr, stopPurr } from './audio.js';

export class Cat {
  constructor(name, breed, options = {}) {
    this.id = 'cat_' + Math.random().toString(36).substr(2, 9);
    this.name = name || 'Nabi';
    this.breed = breed || 'tabby'; // tabby, tuxedo, calico, siamese, black, white, ginger, grey
    this.accessories = options.accessories || []; // 'collar', 'ribbon', 'hat', 'glasses'
    this.gender = options.gender || (Math.random() > 0.5 ? 'male' : 'female');

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
      this.y = height - 12; // Snap sitting Y to the very bottom
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

  // Draw the cat procedurally
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.direction * this.scale, this.scale); // flip based on direction

    // Determine key rotation/translation based on states
    let bodyYOffset = 0;
    let headXOffset = 22;
    let headYOffset = -18;
    let headRotation = 0;
    let tailAngle = 0;
    let legsDrawn = true;
    let sleepPose = false;

    // Apply animation cycles
    if (this.hitTimer > 0) {
      bodyYOffset = Math.sin(this.animTime * 45) * 2.2; // rapid vibration squish
      headRotation = Math.sin(this.animTime * 35) * 0.25; // dizzy head tilt
      legsDrawn = false; // tuck legs in surprise!
      tailAngle = Math.sin(this.animTime * 25) * 0.4; // fast tail wiggle
    } else if (this.isDragging) {
      bodyYOffset = -4;
      headYOffset = -14;
      headRotation = 0.05;
      tailAngle = Math.PI * 0.45 + Math.sin(this.animTime * 3.5) * 0.08; // hanging tail sways slowly
    } else if (this.state === 'walk' || this.state === 'play' || this.state === 'eat') {
      bodyYOffset = Math.sin(this.animTime * 11) * 1.5;
      headYOffset = -18 + Math.sin(this.animTime * 11) * 0.8;
      tailAngle = Math.sin(this.animTime * 6) * 0.25;
    } else if (this.state === 'idle') {
      bodyYOffset = Math.sin(this.animTime * 2.2) * 0.5; // breathing
      tailAngle = Math.sin(this.animTime * 1.5) * 0.15;
    } else if (this.state === 'pet') {
      bodyYOffset = 1.5 + Math.sin(this.animTime * 4.5) * 0.3; // purr vibrate
      headYOffset = -15; // tilted down slightly for petting
      headRotation = 0.05;
      tailAngle = Math.sin(this.animTime * 14) * 0.35; // happy tail wag
    } else if (this.state === 'sleep' || this.state === 'sit') {
      sleepPose = true;
      legsDrawn = false;
      bodyYOffset = 5 + Math.sin(this.animTime * 1.5) * 0.5; // lowered, slow breathing
      headXOffset = 15;
      headYOffset = -10;
      tailAngle = -Math.PI * 0.7 + Math.sin(this.animTime * 0.8) * 0.05; // curled
    }

    // 1. Draw Tail (drawn behind body)
    ctx.save();
    ctx.translate(-24, -8 + bodyYOffset);
    ctx.rotate(tailAngle);
    
    // Tail Shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 9.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.quadraticCurveTo(-15, -15, -10, -32);
    ctx.stroke();

    // Tail fill
    ctx.strokeStyle = this.breed === 'siamese' ? this.colors.points : this.colors.body;
    ctx.lineWidth = 7.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-15, -20, -10, -35);
    ctx.stroke();
    
    // Calico tail patches
    if (this.breed === 'calico') {
      ctx.strokeStyle = this.colors.orangePatches;
      ctx.lineWidth = 7.5;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-15, -20, -10, -35);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    // 2. Draw Legs (if standing/walking)
    if (legsDrawn) {
      const legW = 6;
      const legH = 14;
      const legSpread = 12;
      
      let frontLegSwing = 0;
      let backLegSwing = 0;

      if (this.isDragging) {
        // Legs hang loose, swing very slowly like a pendulum
        frontLegSwing = Math.sin(this.animTime * 3) * 6;
        backLegSwing = -Math.sin(this.animTime * 3) * 6;
      } else {
        const cycle = this.animTime * 11;
        frontLegSwing = Math.sin(cycle) * 7;
        backLegSwing = -Math.sin(cycle) * 7;
      }

      ctx.fillStyle = this.breed === 'siamese' ? this.colors.points : this.colors.body;

      // Back Leg 1
      ctx.save();
      ctx.translate(-16, 2);
      ctx.rotate(backLegSwing * Math.PI / 180);
      ctx.fillRect(-legW/2, 0, legW, legH);
      // Paws (white socks for tuxedo/tabby)
      if (this.colors.paws) {
        ctx.fillStyle = this.colors.paws;
        ctx.fillRect(-legW/2, legH - 3, legW, 4.5);
      }
      ctx.restore();

      // Back Leg 2
      ctx.save();
      ctx.translate(-8, 2);
      ctx.rotate(-backLegSwing * Math.PI / 180);
      ctx.fillRect(-legW/2, 0, legW, legH);
      if (this.colors.paws) {
        ctx.fillStyle = this.colors.paws;
        ctx.fillRect(-legW/2, legH - 3, legW, 4.5);
      }
      ctx.restore();

      // Front Leg 1
      ctx.save();
      ctx.translate(10, 2);
      ctx.rotate(frontLegSwing * Math.PI / 180);
      ctx.fillRect(-legW/2, 0, legW, legH);
      if (this.colors.paws) {
        ctx.fillStyle = this.colors.paws;
        ctx.fillRect(-legW/2, legH - 3, legW, 4.5);
      }
      ctx.restore();

      // Front Leg 2
      ctx.fillStyle = this.breed === 'siamese' ? this.colors.points : this.colors.body;
      ctx.save();
      ctx.translate(18, 2);
      ctx.rotate(-frontLegSwing * Math.PI / 180);
      ctx.fillRect(-legW/2, 0, legW, legH);
      if (this.colors.paws) {
        ctx.fillStyle = this.colors.paws;
        ctx.fillRect(-legW/2, legH - 3, legW, 4.5);
      }
      ctx.restore();
    }

    // 3. Draw Body
    ctx.save();
    ctx.translate(0, bodyYOffset);

    // Body shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 28, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body fill
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    if (sleepPose) {
      // Sleeps curled up: wider, flatter oval
      ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(0, -2, 27, 13, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    // Draw Tabby/Grey stripes on body
    if (this.colors.stripes) {
      ctx.fillStyle = this.colors.stripes;
      ctx.beginPath();
      // Draw 3 stripes on back
      ctx.fillRect(-12, -14, 3, 6);
      ctx.fillRect(-4, -15, 3.5, 7);
      ctx.fillRect(4, -14, 3, 6);
    }

    // Draw Calico patches
    if (this.breed === 'calico') {
      ctx.fillStyle = this.colors.orangePatches;
      ctx.beginPath();
      ctx.arc(-10, -7, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.colors.blackPatches;
      ctx.beginPath();
      ctx.arc(8, -8, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Tuxedo white chest
    if (this.colors.chest) {
      ctx.fillStyle = this.colors.chest;
      ctx.beginPath();
      ctx.ellipse(14, -4, 9, 10, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 4. Draw Head
    ctx.save();
    ctx.translate(headXOffset, headYOffset + bodyYOffset);
    ctx.rotate(headRotation);

    // Head Base
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    // Siamese face mask
    if (this.breed === 'siamese') {
      ctx.fillStyle = this.colors.points;
      ctx.beginPath();
      ctx.ellipse(2, 2, 11, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grey / Tabby forehead stripes
    if (this.colors.stripes) {
      ctx.fillStyle = this.colors.stripes;
      ctx.fillRect(-3, -16, 2, 5);
      ctx.fillRect(1, -16, 2, 5);
    }

    // Calico face patch
    if (this.breed === 'calico') {
      ctx.fillStyle = this.colors.orangePatches;
      ctx.beginPath();
      ctx.arc(-8, -6, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Ears
    const isFolded = this.breed === 'scottish'; // Scottish Fold ear style
    ctx.fillStyle = this.breed === 'siamese' ? this.colors.points : this.colors.body;
    
    // Left Ear
    ctx.beginPath();
    if (isFolded) {
      ctx.moveTo(-13, -8);
      ctx.quadraticCurveTo(-14, -13, -9, -13);
      ctx.lineTo(-4, -14);
    } else {
      ctx.moveTo(-13, -7);
      ctx.lineTo(-14, -20);
      ctx.lineTo(-4, -13);
    }
    ctx.fill();
    // Inner left ear (pink)
    ctx.fillStyle = '#ffc0cb';
    ctx.beginPath();
    if (!isFolded) {
      ctx.moveTo(-11, -8);
      ctx.lineTo(-12, -17);
      ctx.lineTo(-6, -12);
      ctx.fill();
    }

    // Right Ear
    ctx.fillStyle = this.breed === 'siamese' ? this.colors.points : this.colors.body;
    ctx.beginPath();
    if (isFolded) {
      ctx.moveTo(3, -14);
      ctx.quadraticCurveTo(8, -13, 8, -8);
      ctx.lineTo(13, -7);
    } else {
      ctx.moveTo(3, -13);
      ctx.lineTo(10, -21);
      ctx.lineTo(12, -8);
    }
    ctx.fill();
    // Inner right ear (pink)
    ctx.fillStyle = '#ffc0cb';
    ctx.beginPath();
    if (!isFolded) {
      ctx.moveTo(5, -12);
      ctx.lineTo(8, -18);
      ctx.lineTo(10, -9);
      ctx.fill();
    }

    // Draw Eyes (happy arcs for sleep/petting, open circles otherwise)
    const sleepingOrPetting = (this.state === 'sleep' || this.state === 'pet') && !this.isDragging;
    ctx.strokeStyle = '#2f3542';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';

    if (this.hitTimer > 0) {
      // Squinty / dizzy eyes (>_<)
      ctx.strokeStyle = '#2f3542';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      // Left eye >
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-4, -2);
      ctx.lineTo(-8, 0);
      ctx.stroke();

      // Right eye <
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(4, -2);
      ctx.lineTo(8, 0);
      ctx.stroke();
    } else if (sleepingOrPetting) {
      // Left Eye closed
      ctx.beginPath();
      ctx.arc(-5, -2, 3, Math.PI, 0, false); // happy curve
      ctx.stroke();

      // Right Eye closed
      ctx.beginPath();
      ctx.arc(5, -2, 3, Math.PI, 0, false);
      ctx.stroke();
    } else {
      // Open Eyes
      ctx.fillStyle = this.colors.eyes;
      ctx.beginPath();
      ctx.arc(-5, -2, 4, 0, Math.PI * 2);
      ctx.arc(5, -2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Pupils (slit for cat eyes)
      ctx.fillStyle = '#000000';
      ctx.fillRect(-5.5, -5, 1, 6);
      ctx.fillRect(4.5, -5, 1, 6);
    }

    // Draw Nose & Mouth
    ctx.fillStyle = this.colors.nose;
    ctx.beginPath();
    ctx.moveTo(-1.5, 2);
    ctx.lineTo(1.5, 2);
    ctx.lineTo(0, 3.5);
    ctx.closePath();
    ctx.fill();

    // Mouth lines
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 3.5);
    ctx.quadraticCurveTo(-1.5, 5.5, -3, 4);
    ctx.moveTo(0, 3.5);
    ctx.quadraticCurveTo(1.5, 5.5, 3, 4);
    ctx.stroke();

    // Draw Whiskers
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = 1;
    // Left whiskers
    ctx.beginPath();
    ctx.moveTo(-11, 2); ctx.lineTo(-24, 0);
    ctx.moveTo(-12, 3.5); ctx.lineTo(-25, 4);
    ctx.moveTo(-11, 5); ctx.lineTo(-22, 8);
    // Right whiskers
    ctx.moveTo(11, 2); ctx.lineTo(24, 0);
    ctx.moveTo(12, 3.5); ctx.lineTo(25, 4);
    ctx.moveTo(11, 5); ctx.lineTo(22, 8);
    ctx.stroke();

    // 5. Draw Accessories
    this.accessories.forEach(acc => {
      if (acc === 'collar') {
        // Red collar around neck
        ctx.strokeStyle = '#e84118';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.ellipse(0, 11, 10, 4, 0.1, 0.2, Math.PI * 0.8);
        ctx.stroke();

        // Golden bell
        ctx.fillStyle = '#fbc531';
        ctx.beginPath();
        ctx.arc(3, 15, 3, 0, Math.PI * 2);
        ctx.fill();
        
      } else if (acc === 'ribbon') {
        // Cute red bow under head
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        // Left loop
        ctx.moveTo(0, 12);
        ctx.lineTo(-8, 7);
        ctx.lineTo(-8, 17);
        ctx.closePath();
        // Right loop
        ctx.moveTo(0, 12);
        ctx.lineTo(8, 7);
        ctx.lineTo(8, 17);
        ctx.closePath();
        ctx.fill();

        // Center knot
        ctx.fillStyle = '#ff6b81';
        ctx.beginPath();
        ctx.arc(0, 12, 3.5, 0, Math.PI * 2);
        ctx.fill();

      } else if (acc === 'hat') {
        // Cute Wizard hat on top of head
        ctx.save();
        ctx.translate(0, -14);
        ctx.rotate(-0.06);

        // Hat Brim
        ctx.fillStyle = '#3f313a'; // dark purple
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hat Cone
        ctx.fillStyle = '#4834d4'; // deep purple blue
        ctx.beginPath();
        ctx.moveTo(-8, -1);
        ctx.quadraticCurveTo(-1, -12, -2, -26); // curved tip
        ctx.lineTo(5, -1);
        ctx.closePath();
        ctx.fill();

        // Tiny gold star/circle on hat
        ctx.fillStyle = '#f9ca24';
        ctx.beginPath();
        ctx.arc(-1, -12, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

      } else if (acc === 'glasses') {
        // Heart glasses
        ctx.strokeStyle = '#ff4757';
        ctx.fillStyle = 'rgba(255, 71, 87, 0.15)';
        ctx.lineWidth = 2;

        // Left heart lens
        ctx.beginPath();
        ctx.moveTo(-9, -5);
        ctx.bezierCurveTo(-12, -8, -12, -2, -9, 0);
        ctx.bezierCurveTo(-6, -2, -6, -8, -9, -5);
        ctx.stroke();
        ctx.fill();

        // Right heart lens
        ctx.beginPath();
        ctx.moveTo(1, -5);
        ctx.bezierCurveTo(-2, -8, -2, -2, 1, 0);
        ctx.bezierCurveTo(4, -2, 4, -8, 1, -5);
        ctx.stroke();
        ctx.fill();

        // Bridge line
        ctx.beginPath();
        ctx.moveTo(-6, -3);
        ctx.lineTo(0, -3);
        ctx.stroke();
      }
    });

    ctx.restore(); // end Head

    // Draw Names (above head)
    ctx.restore(); // end Translate to Cat X, Y
    
    // Draw Name text overlay
    ctx.save();
    ctx.fillStyle = '#2f3542';
    ctx.font = '500 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255,255,255,0.85)';
    ctx.shadowBlur = 4;
    
    // Render Stats or State icon above name if being pet
    let displayName = this.name;
    if (this.state === 'sleep') displayName = '💤 ' + this.name;
    else if (this.state === 'eat') displayName = '🍲 ' + this.name;
    else if (this.state === 'play') displayName = '🎾 ' + this.name;

    ctx.fillText(displayName, this.x, this.y - this.height * this.scale - 20);
    ctx.restore();

    // Render rising hearts
    this.hearts.forEach(h => {
      ctx.save();
      ctx.fillStyle = `rgba(255, 107, 129, ${h.alpha})`;
      ctx.translate(h.x, h.y);
      // Draw small heart shape
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-h.size/2, -h.size/2, -h.size, h.size/3, 0, h.size);
      ctx.bezierCurveTo(h.size, h.size/3, h.size/2, -h.size/2, 0, 0);
      ctx.fill();
      ctx.restore();
    });

    // Render rising stars
    this.stars.forEach(s => {
      ctx.save();
      ctx.fillStyle = `rgba(253, 203, 110, ${s.alpha})`; // warm yellow
      ctx.translate(s.x, s.y);
      ctx.font = `${s.size}px "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⭐', 0, 0);
      ctx.restore();
    });
  }

  // Check if click coordinates hit the cat body bounds (scaled proportionally)
  isClicked(mx, my) {
    const w = this.width * this.scale;
    const h = this.height * this.scale;
    const rx = this.x - w / 2;
    const ry = this.y - h - 10 * this.scale;
    return (
      mx >= rx &&
      mx <= rx + w &&
      my >= ry &&
      my <= ry + h + 15 * this.scale
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
