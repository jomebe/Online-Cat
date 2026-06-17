// js/audio.js

let audioCtx = null;
let ambientSource = null;
let ambientGainNode = null;
let purrOsc = null;
let purrModulator = null;
let purrGainNode = null;
let currentAmbientType = 'none'; // 'none', 'rain', 'wind'
let isMuted = false;

let ambientVolume = 0.15; // default volume state

// Initialize Audio Context on first interaction
export function initAudio() {
  if (audioCtx) return;
  
  // Create audio context
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContextClass();
  
  // Create master gain for ambient
  ambientGainNode = audioCtx.createGain();
  ambientGainNode.gain.setValueAtTime(ambientVolume, audioCtx.currentTime);
  ambientGainNode.connect(audioCtx.destination);
  
  // Setup purring gain node
  purrGainNode = audioCtx.createGain();
  purrGainNode.gain.value = 0;
  purrGainNode.connect(audioCtx.destination);
}

// Generate White Noise Buffer for ambient sounds
function createNoiseBuffer() {
  if (!audioCtx) return null;
  const sampleRate = audioCtx.sampleRate || 44100;
  const bufferSize = sampleRate * 2; // 2 seconds
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// Start Ambient Sounds
export function startAmbient(type) {
  if (!audioCtx) initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  stopAmbient();
  currentAmbientType = type;
  if (type === 'none' || isMuted) return;

  const noiseBuffer = createNoiseBuffer();
  if (!noiseBuffer) return;

  const noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;

  const filter = audioCtx.createBiquadFilter();
  
  if (type === 'rain') {
    // Rain filter: Bandpass at ~800Hz, plus lowpass to make it softer
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 1.0;
    
    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1500;
    
    noiseSource.connect(filter);
    filter.connect(lowpass);
    lowpass.connect(ambientGainNode);
    
    // Add random drop crackles (synthesized droplets)
    createRainDropletInterval();
  } else if (type === 'wind') {
    // Wind filter: Lowpass with a slowly modulating frequency
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 2.0;

    // LFO to modulate filter frequency for wind gusts
    const windLFO = audioCtx.createOscillator();
    windLFO.frequency.value = 0.15; // 0.15 Hz (slow gust cycles)
    
    const windLFOGain = audioCtx.createGain();
    windLFOGain.gain.value = 250; // modulate by 250Hz

    windLFO.connect(windLFOGain);
    windLFOGain.connect(filter.frequency);
    
    noiseSource.connect(filter);
    filter.connect(ambientGainNode);
    
    windLFO.start();
    noiseSource.windLFO = windLFO;
  }

  noiseSource.start();
  ambientSource = noiseSource;
}

// Stop Ambient Sounds
export function stopAmbient() {
  if (ambientSource) {
    try {
      ambientSource.stop();
      if (ambientSource.windLFO) {
        ambientSource.windLFO.stop();
      }
    } catch (e) {}
    ambientSource = null;
  }
}

// Synthesize soft rain droplet crackles
let rainDropletTimer = null;
function createRainDropletInterval() {
  if (rainDropletTimer) clearInterval(rainDropletTimer);
  rainDropletTimer = setInterval(() => {
    if (currentAmbientType !== 'rain' || isMuted || !audioCtx) {
      clearInterval(rainDropletTimer);
      return;
    }
    // Random chance to play a tiny drop sound
    if (Math.random() > 0.4) {
      playSoftClick();
    }
  }, 150);
}

function playSoftClick() {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1000 + Math.random() * 1500, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.04);

  filter.type = 'lowpass';
  filter.frequency.value = 2000;

  gain.gain.setValueAtTime(0.005 + Math.random() * 0.015, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ambientGainNode || audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

// Purr Synthesizer (continuous low frequency rumble modulated at breathing rate)
export function startPurr() {
  if (!audioCtx) initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  if (purrOsc || isMuted) return;

  // Purr Carrier Oscillator: Triangle wave around 24Hz
  purrOsc = audioCtx.createOscillator();
  purrOsc.type = 'triangle';
  purrOsc.frequency.value = 24;

  // LFO Modulator: Sine wave around 3.5Hz to simulate breathing/purring vibration
  purrModulator = audioCtx.createOscillator();
  purrModulator.type = 'sine';
  purrModulator.frequency.value = 3.5;

  const purrModulatorGain = audioCtx.createGain();
  purrModulatorGain.gain.value = 0.5; // modulate volume range

  // Filter to cut out any clicky high frequencies
  const purrFilter = audioCtx.createBiquadFilter();
  purrFilter.type = 'lowpass';
  purrFilter.frequency.value = 80;

  // Connect LFO to modulator gain
  purrModulator.connect(purrModulatorGain);
  // Connect modulator gain to purr gain node volume
  purrModulatorGain.connect(purrGainNode.gain);

  // Connect Carrier -> Filter -> Gain Node
  purrOsc.connect(purrFilter);
  purrFilter.connect(purrGainNode);

  // Set base volume (soft rumble)
  purrGainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);

  purrOsc.start();
  purrModulator.start();
}

export function stopPurr() {
  if (purrOsc) {
    try {
      purrOsc.stop();
      purrModulator.stop();
    } catch (e) {}
    purrOsc = null;
    purrModulator = null;
  }
  if (purrGainNode) {
    purrGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  }
}

// Meow Synthesizer (dynamic pitch and filter envelope for vocal sounds)
export function playMeow(type = 'normal') {
  if (!audioCtx) initAudio();
  if (isMuted || audioCtx.state === 'suspended') return;

  const osc = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  const filterNode = audioCtx.createBiquadFilter();

  // Settings based on meow type
  let baseFreq = 400;
  let peakFreq = 580;
  let endFreq = 420;
  let duration = 0.45;
  let waveType = 'triangle';
  let volume = 0.08;

  if (type === 'kitten') {
    baseFreq = 650;
    peakFreq = 950;
    endFreq = 750;
    duration = 0.3;
    volume = 0.06;
  } else if (type === 'happy') {
    baseFreq = 480;
    peakFreq = 700;
    endFreq = 620;
    duration = 0.25;
    volume = 0.07;
  } else if (type === 'low') {
    baseFreq = 300;
    peakFreq = 400;
    endFreq = 280;
    duration = 0.6;
    volume = 0.09;
  }

  // Carrier oscillator 1
  osc.type = waveType;
  osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
  // Pitch glide up then down (creates the "me-ow" shape)
  osc.frequency.exponentialRampToValueAtTime(peakFreq, audioCtx.currentTime + duration * 0.25);
  osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);

  // Sub-oscillator 2 (sine wave for warmth and harmonics)
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(baseFreq * 1.5, audioCtx.currentTime);
  osc2.frequency.exponentialRampToValueAtTime(peakFreq * 1.5, audioCtx.currentTime + duration * 0.25);
  osc2.frequency.exponentialRampToValueAtTime(endFreq * 1.5, audioCtx.currentTime + duration);

  // Vocal tract resonance filter (bandpass filter moves to mimic open mouth)
  filterNode.type = 'bandpass';
  filterNode.Q.value = 1.8;
  filterNode.frequency.setValueAtTime(800, audioCtx.currentTime);
  filterNode.frequency.exponentialRampToValueAtTime(1600, audioCtx.currentTime + duration * 0.25);
  filterNode.frequency.exponentialRampToValueAtTime(700, audioCtx.currentTime + duration);

  // Gain (volume) envelope
  gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.05); // quick attack
  gainNode.gain.exponentialRampToValueAtTime(volume * 0.8, audioCtx.currentTime + duration * 0.5); // sustain
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration); // release

  // Connections
  osc.connect(filterNode);
  osc2.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  // Play
  osc.start();
  osc2.start();
  osc.stop(audioCtx.currentTime + duration);
  osc2.stop(audioCtx.currentTime + duration);
}

// UI / Interaction Chime (Soft bell sound)
export function playChime() {
  if (!audioCtx || isMuted || audioCtx.state === 'suspended') return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
  osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.05); // glide to E6
  osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.15); // glide to A6

  gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.6);
}

// Toggle Mute State
export function toggleMute(muted) {
  isMuted = muted;
  if (isMuted) {
    stopAmbient();
    stopPurr();
  } else if (currentAmbientType !== 'none') {
    startAmbient(currentAmbientType);
  }
}

// Set Ambient Volume
export function setAmbientVolume(vol) {
  ambientVolume = vol;
  if (ambientGainNode && audioCtx) {
    ambientGainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
  }
}

// Procedural Camera Shutter click sound
export function playCameraSound() {
  if (!audioCtx || isMuted || audioCtx.state === 'suspended') return;

  const now = audioCtx.currentTime;

  // 1. Synthesize shutter opening click (metallic click)
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.setValueAtTime(100, now + 0.02);
  
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.06, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.04);
  
  // 2. Synthesize shutter closing click (80ms later)
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(500, now + 0.07);
  osc2.frequency.setValueAtTime(80, now + 0.09);
  
  gain2.gain.setValueAtTime(0.001, now + 0.07);
  gain2.gain.linearRampToValueAtTime(0.05, now + 0.075);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);
  osc2.start(now + 0.07);
  osc2.stop(now + 0.13);
  
  // 3. Synthesize the air hiss (white noise burst) for shutter release
  try {
    const bufferSize = audioCtx.sampleRate * 0.15;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2500;
    filter.Q.value = 1.0;
    
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.025, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    
    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    
    noiseSource.start(now);
    noiseSource.stop(now + 0.15);
  } catch (e) {
    console.warn('Procedural noise generation failed:', e);
  }
}
