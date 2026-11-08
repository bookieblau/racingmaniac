import type { Car } from "./car";
import type { InputManager } from "./input";
import type { CarTypeId } from "./carTypes";
import { ENGINE_SOUND_PROFILES, type EngineSoundProfile } from "./engineAudioProfiles";

export class EngineAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private mixGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private exhaustFilter: BiquadFilterNode | null = null;

  private oscMain: OscillatorNode | null = null;
  private oscHarm: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private harmGain: GainNode | null = null;
  private subGain: GainNode | null = null;

  private scrubNoise: AudioBufferSourceNode | null = null;
  private scrubGain: GainNode | null = null;
  private intakeNoise: AudioBufferSourceNode | null = null;
  private intakeGain: GainNode | null = null;
  private intakeFilter: BiquadFilterNode | null = null;
  private scrubBuffer: AudioBuffer | null = null;
  private intakeBuffer: AudioBuffer | null = null;

  private started = false;
  private profileId: CarTypeId | null = null;
  private profile: EngineSoundProfile = ENGINE_SOUND_PROFILES.buggy;

  start(initialVehicle: CarTypeId = "buggy"): void {
    if (this.started) return;

    void (async () => {
      this.ctx = new AudioContext();
      await this.ctx.resume();

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);

      this.exhaustFilter = this.ctx.createBiquadFilter();
      this.exhaustFilter.type = "lowpass";
      this.exhaustFilter.Q.value = 0.7;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;

      this.mixGain = this.ctx.createGain();
      this.mixGain.gain.value = 1;

      this.harmGain = this.ctx.createGain();
      this.subGain = this.ctx.createGain();

      this.oscMain = this.ctx.createOscillator();
      this.oscHarm = this.ctx.createOscillator();
      this.oscSub = this.ctx.createOscillator();
      this.oscSub.type = "sine";

      this.oscMain.connect(this.mixGain);
      this.oscHarm.connect(this.harmGain);
      this.harmGain.connect(this.mixGain);
      this.oscSub.connect(this.subGain);
      this.subGain.connect(this.mixGain);

      this.mixGain.connect(this.exhaustFilter);
      this.exhaustFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);

      this.oscMain.start();
      this.oscHarm.start();
      this.oscSub.start();

      this.intakeBuffer = makeNoiseBuffer(this.ctx, 2, 0.4);
      this.scrubBuffer = makeNoiseBuffer(this.ctx, 2, 0.35);

      this.intakeGain = this.ctx.createGain();
      this.intakeGain.gain.value = 0;
      this.intakeFilter = this.ctx.createBiquadFilter();
      this.intakeFilter.type = "bandpass";
      this.intakeFilter.frequency.value = 2400;
      this.intakeFilter.Q.value = 0.9;
      this.intakeGain.connect(this.intakeFilter);
      this.intakeFilter.connect(this.master);

      this.scrubGain = this.ctx.createGain();
      this.scrubGain.gain.value = 0;
      this.scrubGain.connect(this.master);

      this.profileId = null;
      this.applyProfile(initialVehicle);
      this.started = true;
    })();
  }

  setVehicle(id: CarTypeId): void {
    this.applyProfile(id);
  }

  private applyProfile(id: CarTypeId): void {
    if (this.profileId === id) return;
    this.profileId = id;
    this.profile = ENGINE_SOUND_PROFILES[id];

    if (!this.oscMain || !this.oscHarm || !this.harmGain || !this.subGain) return;

    this.oscMain.type = this.profile.mainWave;
    this.oscHarm.type = this.profile.harmWave;
    this.harmGain.gain.value = this.profile.harmLevel;
    this.subGain.gain.value = this.profile.subLevel;

    if (this.exhaustFilter) {
      this.exhaustFilter.frequency.value = this.profile.filterIdle;
    }
  }

  update(car: Car, input: InputManager): void {
    if (!this.started || !this.ctx || !this.oscMain || !this.engineGain || !this.exhaustFilter) return;

    const vehicleId = car.getTypeId();
    if (vehicleId !== this.profileId) {
      this.applyProfile(vehicleId);
    }

    const speed = Math.abs(car.getSpeed());
    const max = car.getMaxSpeed();
    const ratio = Math.min(1, speed / max);
    const throttle = input.isActive("forward")
      ? 1
      : input.isActive("backward")
        ? 0.42
        : 0.52;

    const { idleHz, redlineHz } = this.profile;
    const loadBlend = 0.12 + throttle * 0.2;
    const hz = idleHz + (redlineHz - idleHz) * Math.min(1, ratio * 0.88 + loadBlend * 0.5);

    const t = this.ctx.currentTime;
    this.oscMain.frequency.setTargetAtTime(hz, t, 0.035);
    this.oscHarm!.frequency.setTargetAtTime(hz * this.profile.harmRatio, t, 0.035);
    this.oscSub!.frequency.setTargetAtTime(hz * 0.5, t, 0.045);

    const filterHz = this.profile.filterIdle
      + (this.profile.filterWide - this.profile.filterIdle) * Math.min(1, ratio * 0.9 + throttle * 0.15);
    this.exhaustFilter.frequency.setTargetAtTime(filterHz, t, 0.05);

    const airborne = car.isAirborne() ? 0.5 : 1;
    let vol = (0.045 + ratio * 0.13 + (throttle - 0.5) * 0.08) * airborne;

    if (this.profile.twoStrokePulse) {
      const pulse = 0.68 + 0.32 * Math.abs(Math.sin(performance.now() * 0.0022 * hz));
      vol *= pulse;
    } else if (this.profile.harmRatio < 0.98) {
      const beat = 0.88 + 0.12 * Math.abs(Math.sin(performance.now() * 0.0015 * (redlineHz - hz + 40)));
      vol *= beat;
    }

    this.engineGain.gain.setTargetAtTime(vol, t, 0.06);

    const rasp = this.profile.noiseLevel
      + ratio * this.profile.loadRasp
      + Math.max(0, throttle - 0.55) * this.profile.loadRasp;
    this.updateIntakeNoise(rasp * airborne);

    this.updateScrub(car, ratio);
  }

  private updateIntakeNoise(level: number): void {
    if (!this.ctx || !this.intakeGain || !this.intakeBuffer) return;
    const t = this.ctx.currentTime;

    if (level > 0.012 && !this.intakeNoise) {
      this.intakeNoise = this.ctx.createBufferSource();
      this.intakeNoise.buffer = this.intakeBuffer;
      this.intakeNoise.loop = true;
      this.intakeNoise.connect(this.intakeGain);
      this.intakeNoise.start();
    }

    this.intakeGain.gain.setTargetAtTime(level, t, 0.06);
    if (this.intakeFilter) {
      const car = this.profile;
      const band = 1400 + (car.filterWide - car.filterIdle) * 0.35;
      this.intakeFilter.frequency.setTargetAtTime(band, t, 0.08);
    }

    if (level < 0.008 && this.intakeNoise) {
      try {
        this.intakeNoise.stop();
      } catch {
        /* already stopped */
      }
      this.intakeNoise = null;
    }
  }

  private updateScrub(car: Car, speedRatio: number): void {
    if (!this.ctx || !this.scrubGain || !this.scrubBuffer) return;

    const scrubVol = car.isDrifting() && !car.isAirborne()
      ? Math.min(0.12, speedRatio * 0.14 + Math.abs(car.getSlipAngle()) * 0.08)
      : 0;

    if (scrubVol > 0.01 && !this.scrubNoise) {
      this.scrubNoise = this.ctx.createBufferSource();
      this.scrubNoise.buffer = this.scrubBuffer;
      this.scrubNoise.loop = true;
      this.scrubNoise.connect(this.scrubGain);
      this.scrubNoise.start();
    }

    this.scrubGain.gain.setTargetAtTime(scrubVol, this.ctx.currentTime, 0.05);

    if (scrubVol < 0.005 && this.scrubNoise) {
      try {
        this.scrubNoise.stop();
      } catch {
        /* already stopped */
      }
      this.scrubNoise = null;
    }
  }

  dispose(): void {
    try {
      this.scrubNoise?.stop();
      this.intakeNoise?.stop();
      this.oscMain?.stop();
      this.oscHarm?.stop();
      this.oscSub?.stop();
    } catch {
      /* noop */
    }
    void this.ctx?.close();
    this.started = false;
  }
}

function makeNoiseBuffer(ctx: AudioContext, seconds: number, amp: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, rate * seconds, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * amp;
  }
  return buffer;
}
