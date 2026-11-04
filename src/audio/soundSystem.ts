/**
 * Procedural Web Audio Synthesizer for Valorant Tactical Sound Effects
 * Optimized with a pre-allocated noise buffer, polyphony throttling, and Master/SFX/Music volume buses.
 */

class SoundSystem {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.85;
  private sfxVolume: number = 0.9;
  private musicVolume: number = 0.4;
  private killStreak: number = 0;
  private lastKillTime: number = 0;
  private lastGunfireTime: number = 0;
  private lastFootstepTime: number = 0;
  private stepParity: boolean = false;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private wavBuffers: Map<string, AudioBuffer> = new Map();
  private wavPreloadStarted: boolean = false;

  private preloadWavAssets(ctx: AudioContext) {
    if (this.wavPreloadStarted || typeof fetch === 'undefined') return;
    this.wavPreloadStarted = true;
    const files = [
      'rifle_fire',
      'pistol_fire',
      'sniper_fire',
      'reload_mag_out',
      'reload_mag_in',
      'reload_bolt_rack',
      'footstep_concrete',
      'footstep_metal',
      'jump_launch',
      'land_impact',
      'ability_cast',
      'ability_ult',
      'ui_click',
      'ambient_hum',
    ];
    for (const name of files) {
      fetch(`/assets/audio/${name}.wav`)
        .then((res) => (res.ok ? res.arrayBuffer() : null))
        .then((buf) => (buf ? ctx.decodeAudioData(buf) : null))
        .then((decoded) => {
          if (decoded) this.wavBuffers.set(name, decoded);
        })
        .catch(() => {});
    }
  }

  private playWavBuffer(name: string, volume: number, playbackRate = 1.0): boolean {
    const ctx = this.ctx;
    const buf = this.wavBuffers.get(name);
    if (!ctx || !buf) return false;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.setValueAtTime(playbackRate, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      return true;
    } catch {
      return false;
    }
  }

  private getContext(): AudioContext | null {
    if (this.isMuted || this.masterVolume <= 0.001) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.25);
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        this.preloadWavAssets(this.ctx);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setVolumes(master: number, sfx: number, music: number) {
    this.masterVolume = Math.max(0, Math.min(1, master));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.musicVolume = Math.max(0, Math.min(1, music));
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(
        this.masterVolume * this.musicVolume * 0.04,
        this.ctx.currentTime
      );
    }
  }

  private getSfxScale(): number {
    return this.masterVolume * this.sfxVolume;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public resetKillStreak() {
    this.killStreak = 0;
    this.lastKillTime = 0;
  }

  public startAmbience() {
    const ctx = this.getContext();
    if (!ctx || this.ambientOsc) return;
    try {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(65.41, ctx.currentTime); // Deep C2 tactical drone
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, ctx.currentTime);
      gain.gain.setValueAtTime(this.masterVolume * this.musicVolume * 0.04, ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.ambientOsc = osc;
      this.ambientGain = gain;
    } catch {
      // Ignore autoplay restriction until user gesture
    }
  }

  // Surface-Aware Footstep Audio (Plays physical WAV asset + dynamic filter)
  public playFootstep(
    isSprinting: boolean = false,
    surface: 'concrete' | 'metal' = 'concrete'
  ) {
    const perfNow = performance.now();
    const minInterval = isSprinting ? 260 : 370;
    if (perfNow - this.lastFootstepTime < minInterval) return;
    this.lastFootstepTime = perfNow;
    this.stepParity = !this.stepParity;

    const ctx = this.getContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    const vol = (isSprinting ? 0.24 : 0.14) * sfx;
    const pitch = this.stepParity ? 0.96 : 1.05;
    this.playWavBuffer(
      surface === 'metal' ? 'footstep_metal' : 'footstep_concrete',
      vol * 0.75,
      pitch
    );

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseFreq = surface === 'metal' ? 680 : 270;
    filter.frequency.setValueAtTime(this.stepParity ? baseFreq : baseFreq * 1.15, now);
    filter.Q.setValueAtTime(surface === 'metal' ? 5.2 : 3.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.07);
  }

  public playReloadStage(stage: 'mag_out' | 'mag_in' | 'bolt_rack') {
    const ctx = this.getContext();
    if (!ctx) return;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;
    const wavMap = {
      mag_out: 'reload_mag_out',
      mag_in: 'reload_mag_in',
      bolt_rack: 'reload_bolt_rack',
    } as const;
    if (!this.playWavBuffer(wavMap[stage], 0.32 * sfx)) {
      this.playReload();
    }
  }

  // Jump & Landing Audio (Plays physical WAV asset + sub-bass impact)
  public playJump(isLanding: boolean = false) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    this.playWavBuffer(isLanding ? 'land_impact' : 'jump_launch', 0.28 * sfx);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    if (isLanding) {
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.09);
      gain.gain.setValueAtTime(0.24 * sfx, now);
    } else {
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(175, now + 0.08);
      gain.gain.setValueAtTime(0.18 * sfx, now);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // Gunfire Synthesizer (isBot reduces volume and throttles polyphony)
  public playGunfire(weaponId: string, isBot: boolean = false) {
    const perfNow = performance.now();
    if (isBot && perfNow - this.lastGunfireTime < 85) return;
    if (!isBot && perfNow - this.lastGunfireTime < 35) return;
    this.lastGunfireTime = perfNow;

    const ctx = this.getContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;
    const volScale = (isBot ? 0.35 : 1.0) * sfx;

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();

    if (weaponId === 'vandal') {
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(3200, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(300, now + 0.14);

      noiseGain.gain.setValueAtTime(0.4 * volScale, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      if (!isBot) {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.11);

        oscGain.gain.setValueAtTime(0.45 * sfx, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      }
    } else if (weaponId === 'judge') {
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(2400, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(180, now + 0.21);

      noiseGain.gain.setValueAtTime(0.55 * volScale, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    } else if (weaponId === 'phantom') {
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1800, now);
      noiseFilter.Q.setValueAtTime(2.0, now);

      noiseGain.gain.setValueAtTime(0.32 * volScale, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    } else if (weaponId === 'operator') {
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(4800, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(150, now + 0.24);

      noiseGain.gain.setValueAtTime(0.6 * volScale, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    } else {
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(600, now);

      noiseGain.gain.setValueAtTime(0.28 * volScale, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    }

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + 0.24);
  }

  public playHeadshotDink() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    const osc1 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(2900, now);
    osc1.frequency.exponentialRampToValueAtTime(2400, now + 0.11);

    gainNode.gain.setValueAtTime(0.32 * sfx, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.13);
  }

  public playKillSound(_isHeadshot: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    if (now - this.lastKillTime < 6.0) {
      this.killStreak = Math.min(5, this.killStreak + 1);
    } else {
      this.killStreak = 1;
    }
    this.lastKillTime = now;

    const killFrequencies = [261.63, 329.63, 392.0, 523.25, 659.25];
    const baseFreq = killFrequencies[this.killStreak - 1] || 523.25;

    const osc1 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.22);

    gain.gain.setValueAtTime(0.35 * sfx, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc1.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.26);

    if (this.killStreak >= 5) {
      this.playAceFanfare();
    }
  }

  public playAceFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    const notes = [392.0, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.09;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2 * sfx, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.38);
    });
  }

  public playHitmarker() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);

    gain.gain.setValueAtTime(0.2 * sfx, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playSpikeBeep(frequencyHz: number = 880) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequencyHz, now);

    gain.gain.setValueAtTime(0.25 * sfx, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playDefuseCheckpoint() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    const osc1 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.setValueAtTime(880.0, now + 0.08);

    gain.gain.setValueAtTime(0.25 * sfx, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc1.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.26);
  }

  public playSpikeDefused() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const time = now + idx * 0.1;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.2 * sfx, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.38);
    });
  }

  public playSpikeExplosion() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(15, now + 1.0);

    oscGain.gain.setValueAtTime(0.6 * sfx, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.2);
  }

  public playReload() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(450, now);
    osc1.frequency.exponentialRampToValueAtTime(120, now + 0.06);

    gain1.gain.setValueAtTime(0.22 * sfx, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.09);
  }

  public playDash() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.28);

    gain.gain.setValueAtTime(0.3 * sfx, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playFlashbang() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.14);

    gain.gain.setValueAtTime(0.3 * sfx, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playRoundStartHorn() {
    this.startAmbience();
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sfx = this.getSfxScale();
    if (sfx <= 0.01) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(196, now + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.25 * sfx, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.7);
  }
}

export const soundSystem = new SoundSystem();
