// js/toy.js

export class Toy {
  constructor(type, x, y, options = {}) {
    this.id = 'toy_' + Math.random().toString(36).substr(2, 9);
    this.type = type; // 'yarn', 'box', 'treat'
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.isDragging = false;
    this.claimedBy = null; // ID of cat interacting with it
    
    // Set properties based on type
    if (this.type === 'yarn') {
      this.radius = 22;
      this.width = this.radius * 2;
      this.height = this.radius * 2;
      this.color = options.color || '#ff4757'; // red, blue, green, orange
      this.rotation = 0;
      this.bounce = 0.55;
    } else if (this.type === 'box') {
      this.width = 85;
      this.height = 55;
      this.bounce = 0.15;
    } else if (this.type === 'treat') {
      this.width = 38;
      this.height = 18;
      this.bites = 3; // bites remaining
      this.bounce = 0.2;
    }
  }

  update(width, height, floorY) {
    if (this.isDragging) {
      this.vx = 0;
      this.vy = 0;
      return;
    }

    // Apply gravity
    const gravity = 0.35;
    const bottom = floorY - (this.type === 'yarn' ? 0 : this.height / 2);
    
    if (this.y < bottom) {
      this.vy += gravity;
    }

    // Update positions
    this.x += this.vx;
    this.y += this.vy;

    // Floor collision
    if (this.y >= bottom) {
      this.y = bottom;
      this.vy = -this.vy * this.bounce; // bounce
      this.vx *= 0.85; // friction on impact
      
      // Stop tiny bounces
      if (Math.abs(this.vy) < 0.45) this.vy = 0;
    }

    // Floor friction
    if (this.y === bottom) {
      this.vx *= 0.97;
      if (Math.abs(this.vx) < 0.05) this.vx = 0;
      
      // Update rotation for rolling yarn
      if (this.type === 'yarn') {
        this.rotation += this.vx / this.radius;
      }
    }

    // Wall collisions
    const halfW = this.type === 'yarn' ? this.radius : this.width / 2;
    if (this.x - halfW < 0) {
      this.x = halfW;
      this.vx = -this.vx * 0.6;
    } else if (this.x + halfW > width) {
      this.x = width - halfW;
      this.vx = -this.vx * 0.6;
    }
  }

  // Draw the toy on the canvas
  draw(ctx, isBehindCat = false) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.type === 'yarn') {
      // Yarn ball (just a single pass drawing)
      ctx.rotate(this.rotation);
      
      // Draw shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.ellipse(0, this.radius - 2, this.radius * 0.8, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw ball
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw yarn lines for texture
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 2.5;
      
      // Line 1
      ctx.beginPath();
      ctx.arc(-5, -5, this.radius * 0.7, -0.5, Math.PI * 0.8);
      ctx.stroke();

      // Line 2
      ctx.beginPath();
      ctx.arc(5, 5, this.radius * 0.7, Math.PI * 0.9, -0.3);
      ctx.stroke();

      // Line 3
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.85, 0.5, Math.PI * 1.5);
      ctx.stroke();

      // Tiny loose thread sticking out
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-this.radius + 3, 3);
      ctx.quadraticCurveTo(-this.radius - 8, 8, -this.radius - 12, 4);
      ctx.stroke();

    } else if (this.type === 'box') {
      // Box is drawn in two passes so cat can go "inside"
      // isBehindCat = true -> back of the box
      // isBehindCat = false -> front of the box (drawn after cat is rendered)
      
      const w = this.width;
      const h = this.height;
      const x = -w / 2;
      const y = -h;

      if (isBehindCat) {
        // Draw shadow under box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.55, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inside back wall of the box
        ctx.fillStyle = '#b08b62'; // darker cardboard
        ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

        // Left wall, Right wall, Bottom wall (inside view)
        ctx.fillStyle = '#a6825a';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4);
        ctx.lineTo(x + 10, y + 10);
        ctx.lineTo(x + 10, 0 - 6);
        ctx.lineTo(x + 4, 0);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x + w - 4, y + 4);
        ctx.lineTo(x + w - 10, y + 10);
        ctx.lineTo(x + w - 10, 0 - 6);
        ctx.lineTo(x + w - 4, 0);
        ctx.fill();

        // Box flaps (open back flap)
        ctx.fillStyle = '#b8946c';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4);
        ctx.lineTo(x + w * 0.1, y - h * 0.3);
        ctx.lineTo(x + w * 0.9, y - h * 0.3);
        ctx.lineTo(x + w - 4, y + 4);
        ctx.fill();
        
      } else {
        // Front flaps and outer walls
        ctx.fillStyle = '#cda37b'; // lighter outer cardboard
        
        // Front wall
        ctx.fillRect(x, y + 10, w, h - 10);

        // Highlight top rim
        ctx.fillStyle = '#e4bc93';
        ctx.fillRect(x, y + 10, w, 2.5);

        // Open Side Flaps
        ctx.fillStyle = '#b8946c';
        // Left Flap
        ctx.beginPath();
        ctx.moveTo(x, y + 10);
        ctx.lineTo(x - w * 0.25, y - h * 0.1);
        ctx.lineTo(x - w * 0.25, y + h * 0.4);
        ctx.lineTo(x, y + h * 0.5);
        ctx.fill();

        // Right Flap
        ctx.beginPath();
        ctx.moveTo(x + w, y + 10);
        ctx.lineTo(x + w + w * 0.25, y - h * 0.1);
        ctx.lineTo(x + w + w * 0.25, y + h * 0.4);
        ctx.lineTo(x + w, y + h * 0.5);
        ctx.fill();

        // Front Flap (folded down towards user)
        ctx.fillStyle = '#c29b72';
        ctx.beginPath();
        ctx.moveTo(x, y + h - 2);
        ctx.lineTo(x + w * 0.1, y + h + h * 0.25);
        ctx.lineTo(x + w * 0.9, y + h + h * 0.25);
        ctx.lineTo(x + w, y + h - 2);
        ctx.fill();

        // Box Logo (cute cat face print on box side)
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        const logoY = y + h * 0.6;
        ctx.beginPath();
        ctx.arc(-10, logoY, 4, 0, Math.PI * 2);
        ctx.arc(10, logoY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-15, logoY - 5); ctx.lineTo(-8, logoY - 12); ctx.lineTo(-3, logoY - 5);
        ctx.moveTo(15, logoY - 5); ctx.lineTo(8, logoY - 12); ctx.lineTo(3, logoY - 5);
        ctx.moveTo(-3, logoY + 1); ctx.quadraticCurveTo(0, logoY + 4, 3, logoY + 1);
        ctx.stroke();
      }

    } else if (this.type === 'treat') {
      // Fish cookie treat
      const w = this.width;
      const h = this.height;

      // Draw shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.ellipse(0, h * 0.5, w * 0.5, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Fish color (golden brown biscuit)
      ctx.fillStyle = '#e5a93b';
      
      // Fish shape (body + tail)
      ctx.beginPath();
      ctx.ellipse(-w * 0.1, 0, w * 0.4, h * 0.5, 0, 0, Math.PI * 2); // Body
      
      // Tail
      ctx.moveTo(w * 0.3, 0);
      ctx.lineTo(w * 0.55, -h * 0.45);
      ctx.lineTo(w * 0.42, 0);
      ctx.lineTo(w * 0.55, h * 0.45);
      ctx.closePath();
      ctx.fill();

      // Draw scales/eye details
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.arc(-w * 0.3, -h * 0.1, 2, 0, Math.PI * 2); // Eye
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-w * 0.1, 0, h * 0.3, -1, 1); // scale line 1
      ctx.arc(w * 0.1, 0, h * 0.3, -1, 1);  // scale line 2
      ctx.stroke();

      // Bite marks based on remaining bites
      if (this.bites < 3) {
        ctx.fillStyle = '#eae1d8'; // room wallpaper/background color to mask bite
        ctx.beginPath();
        // Bite circle on the back/head
        ctx.arc(-w * 0.3, h * 0.3, 7, 0, Math.PI * 2);
        if (this.bites < 2) {
          ctx.arc(w * 0.15, -h * 0.2, 8, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // Check if mouse click is inside the toy bounds
  isClicked(mx, my) {
    if (this.type === 'yarn') {
      const dist = Math.hypot(this.x - mx, this.y - my);
      return dist <= this.radius + 10;
    } else if (this.type === 'box') {
      return (
        mx >= this.x - this.width / 2 - 10 &&
        mx <= this.x + this.width / 2 + 10 &&
        my >= this.y - this.height - 10 &&
        my <= this.y + 10
      );
    } else if (this.type === 'treat') {
      return (
        mx >= this.x - this.width / 2 - 10 &&
        mx <= this.x + this.width / 2 + 10 &&
        my >= this.y - this.height / 2 - 10 &&
        my <= this.y + this.height / 2 + 10
      );
    }
    return false;
  }
}

// Renders the Laser Pointer glowing dot on canvas
export function drawLaserDot(ctx, laserX, laserY) {
  ctx.save();
  // Radial glow
  const glow = ctx.createRadialGradient(laserX, laserY, 1, laserX, laserY, 12);
  glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
  glow.addColorStop(0.2, 'rgba(255, 0, 0, 1)');
  glow.addColorStop(0.6, 'rgba(255, 0, 0, 0.4)');
  glow.addColorStop(1, 'rgba(255, 0, 0, 0)');
  
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(laserX, laserY, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
