import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Crosshair, Power, Radio, Volume2, VolumeX, Zap } from 'lucide-react';
import { ComponentId } from '../data/voyagerData';

interface ScienceInstrumentsDeckProps {
  missionYear: number;
  activeLoads: Record<string, boolean>;
  scanAzimuth: number;
  scanElevation: number;
  onToggleLoad: (id: string) => void;
  onSelectComponent: (id: ComponentId) => void;
}

export const ScienceInstrumentsDeck: React.FC<ScienceInstrumentsDeckProps> = ({
  missionYear,
  activeLoads,
  scanAzimuth,
  scanElevation,
  onToggleLoad,
  onSelectComponent,
}) => {
  const [tick, setTick] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<{ stop: () => void } | null>(null);

  const magOn = Boolean(activeLoads.mag);
  const pwsOn = Boolean(activeLoads.pws);
  const crsOn = Boolean(activeLoads.crs);
  const issOn = Boolean(activeLoads.iss);
  const isInterstellar = missionYear >= 2012.6;

  // Lightweight 6 Hz instrument telemetry ticker
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => (t + 1) % 10000), 165);
    return () => window.clearInterval(id);
  }, []);

  // Stop PWS audio automatically if PWS is powered off or unmounted
  const stopPwsAudio = () => {
    audioNodesRef.current?.stop();
    audioNodesRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAudioOn(false);
  };

  useEffect(() => {
    if (!pwsOn && audioOn) stopPwsAudio();
  }, [pwsOn, audioOn]);

  useEffect(() => () => stopPwsAudio(), []);

  const togglePwsAudio = () => {
    if (!pwsOn) return;
    if (audioOn) {
      stopPwsAudio();
      return;
    }
    try {
      const AudioCtor =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtor();
      audioCtxRef.current = ctx;

      // Synthesize authentic ~2.4–3.0 kHz interstellar electron plasma oscillation + subtle drift
      const baseFreq = isInterstellar ? 2680 : 1420;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const master = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.value = baseFreq;
      osc2.type = 'triangle';
      osc2.frequency.value = baseFreq * 1.012;

      lfo.type = 'sine';
      lfo.frequency.value = 0.28;
      lfoGain.gain.value = isInterstellar ? 140 : 260;

      master.gain.value = 0.045;

      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);
      osc1.connect(master);
      osc2.connect(master);
      master.connect(ctx.destination);

      osc1.start();
      osc2.start();
      lfo.start();

      audioNodesRef.current = {
        stop: () => {
          try {
            osc1.stop();
            osc2.stop();
            lfo.stop();
          } catch {
            // ignore already stopped
          }
        },
      };
      setAudioOn(true);
    } catch {
      setAudioOn(false);
    }
  };

  // 1. MAG 3-Axis Fluxgate Telemetry (nT)
  const magData = useMemo(() => {
    const baseB = isInterstellar ? 0.48 : missionYear < 1982 ? 2.4 : 0.14;
    const ptsR: string[] = [];
    const ptsT: string[] = [];
    const ptsN: string[] = [];
    for (let i = 0; i < 28; i++) {
      const x = (i / 27) * 260;
      const ph = (tick + i) * 0.32;
      const r = Math.sin(ph) * 0.35 + Math.cos(ph * 0.4) * 0.2;
      const t = Math.cos(ph * 0.85 + 1.1) * 0.42;
      const n = Math.sin(ph * 0.6 + 2.4) * 0.28;
      ptsR.push(`${x.toFixed(1)},${(22 - r * 14).toFixed(1)}`);
      ptsT.push(`${x.toFixed(1)},${(22 - t * 14).toFixed(1)}`);
      ptsN.push(`${x.toFixed(1)},${(22 - n * 14).toFixed(1)}`);
    }
    const br = (baseB * (0.28 + Math.sin(tick * 0.25) * 0.04)).toFixed(3);
    const bt = (baseB * (0.82 + Math.cos(tick * 0.21) * 0.03)).toFixed(3);
    const bn = (baseB * (-0.49 + Math.sin(tick * 0.17) * 0.03)).toFixed(3);
    const bMag = Math.hypot(Number(br), Number(bt), Number(bn)).toFixed(3);
    return { ptsR: ptsR.join(' '), ptsT: ptsT.join(' '), ptsN: ptsN.join(' '), br, bt, bn, bMag };
  }, [tick, isInterstellar, missionYear]);

  // 2. PWS 16-Band Plasma Wave Spectrum (10 Hz - 56 kHz)
  const pwsBars = useMemo(() => {
    const peakBin = isInterstellar ? 10 : 5;
    return Array.from({ length: 16 }, (_, i) => {
      const dist = Math.abs(i - peakBin);
      const env = Math.exp(-(dist * dist) / 6.5);
      const jitter = 0.55 + 0.45 * Math.sin(tick * 0.7 + i * 1.9);
      return Math.min(100, Math.max(8, Math.round((env * 78 + 14) * jitter)));
    });
  }, [tick, isInterstellar]);

  // 3. CRS Galactic Cosmic Ray Flux & Energy Histogram
  const crsData = useMemo(() => {
    const rateBase = isInterstellar ? 2.48 : missionYear > 2004 ? 1.12 : 0.42;
    const rate = (rateBase + Math.sin(tick * 0.9) * 0.07).toFixed(2);
    const bins = Array.from({ length: 8 }, (_, i) => {
      const slope = isInterstellar ? 1 - i * 0.09 : 0.45 - i * 0.04;
      const pulse = 0.8 + 0.2 * Math.cos(tick * 0.8 + i * 1.3);
      return Math.min(100, Math.max(10, Math.round(slope * 92 * pulse)));
    });
    return { rate, bins };
  }, [tick, isInterstellar, missionYear]);

  // 4. ISS Optical Reticle Coordinates
  const reticleX = 50 + (scanAzimuth / 180) * 38;
  const reticleY = 50 - (scanElevation / 90) * 34;

  return (
    <div className="space-y-3">
      {/* 1. MAG — Triaxial Fluxgate Magnetometer */}
      <section className="rounded border border-slate-800 bg-[#090d16] p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            type="button"
            onClick={() => onSelectComponent('mag_boom')}
            className="flex items-center gap-1.5 text-left group"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-100 group-hover:text-amber-300 transition-colors">
              MAG · Fluxgate Magnetometer
            </span>
          </button>
          <button
            type="button"
            onClick={() => onToggleLoad('mag')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 ${
              magOn
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-500'
            }`}
          >
            <Power className="w-2.5 h-2.5" />
            {magOn ? 'LIVE' : 'OFF'}
          </button>
        </div>

        {magOn ? (
          <>
            <svg viewBox="0 0 260 44" className="w-full h-11 rounded bg-[#05080f] border border-slate-800/80 mb-2">
              <line x1="0" y1="22" x2="260" y2="22" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />
              <polyline fill="none" stroke="#34d399" strokeWidth="1.3" points={magData.ptsR} />
              <polyline fill="none" stroke="#38bdf8" strokeWidth="1.3" points={magData.ptsT} />
              <polyline fill="none" stroke="#f59e0b" strokeWidth="1.1" points={magData.ptsN} />
            </svg>
            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-slate-300">
              <div>
                <span className="text-emerald-400">Br</span> {magData.br}
              </div>
              <div>
                <span className="text-sky-400">Bt</span> {magData.bt}
              </div>
              <div>
                <span className="text-amber-400">Bn</span> {magData.bn}
              </div>
              <div className="text-right text-slate-100 font-semibold">|B| {magData.bMag} nT</div>
            </div>
          </>
        ) : (
          <p className="text-[11px] font-mono text-slate-500 py-2 text-center">
            OFFLINE · POWER SHED (2.2 W)
          </p>
        )}
      </section>

      {/* 2. PWS — Plasma Wave Subsystem + Web Audio Synthesizer */}
      <section className="rounded border border-slate-800 bg-[#090d16] p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            type="button"
            onClick={() => onSelectComponent('pra_pws')}
            className="flex items-center gap-1.5 text-left group"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-100 group-hover:text-amber-300 transition-colors">
              PWS · Plasma Wave (10 Hz–56 kHz)
            </span>
          </button>
          <div className="flex items-center gap-1.5">
            {pwsOn && (
              <button
                type="button"
                onClick={togglePwsAudio}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 transition-colors ${
                  audioOn
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-400/60'
                }`}
                title="Synthesize interstellar electron plasma oscillation audio"
              >
                {audioOn ? <Volume2 className="w-2.5 h-2.5" /> : <VolumeX className="w-2.5 h-2.5" />}
                {audioOn ? 'AUDIO ON' : 'LISTEN'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onToggleLoad('pws')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 ${
                pwsOn
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-500'
              }`}
            >
              <Power className="w-2.5 h-2.5" />
              {pwsOn ? 'LIVE' : 'OFF'}
            </button>
          </div>
        </div>

        {pwsOn ? (
          <>
            <div className="h-12 px-1.5 py-1 rounded bg-[#05080f] border border-slate-800/80 flex items-end gap-1 mb-1.5">
              {pwsBars.map((pct, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-xs transition-all duration-150"
                  style={{
                    height: `${pct}%`,
                    backgroundColor: pct > 68 ? '#22d3ee' : pct > 38 ? '#0284c7' : '#1e3a5f',
                  }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>{isInterstellar ? 'Peak: ~2.68 kHz (ISM Plasma)' : 'Peak: ~1.42 kHz (Solar Wind)'}</span>
              <span className="text-cyan-300">{isInterstellar ? 'nₑ ≈ 0.08 cm⁻³' : 'nₑ ≈ 0.002 cm⁻³'}</span>
            </div>
          </>
        ) : (
          <p className="text-[11px] font-mono text-slate-500 py-2 text-center">
            OFFLINE · POWER SHED (1.6 W)
          </p>
        )}
      </section>

      {/* 3. CRS — Cosmic Ray Subsystem */}
      <section className="rounded border border-slate-800 bg-[#090d16] p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            type="button"
            onClick={() => onSelectComponent('particles')}
            className="flex items-center gap-1.5 text-left group"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-slate-100 group-hover:text-amber-300 transition-colors">
              CRS · Cosmic Ray Telescopes
            </span>
          </button>
          <button
            type="button"
            onClick={() => onToggleLoad('crs')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 ${
              crsOn
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-500'
            }`}
          >
            <Power className="w-2.5 h-2.5" />
            {crsOn ? 'LIVE' : 'OFF'}
          </button>
        </div>

        {crsOn ? (
          <>
            <div className="h-10 px-1.5 py-1 rounded bg-[#05080f] border border-slate-800/80 flex items-end gap-1.5 mb-1.5">
              {crsData.bins.map((pct, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-xs transition-all duration-150 bg-amber-400/80"
                  style={{ height: `${pct}%` }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>GCR &gt;70 MeV Flux</span>
              <span className="text-amber-300 font-semibold">{crsData.rate} cts/s</span>
            </div>
          </>
        ) : (
          <p className="text-[11px] font-mono text-slate-500 py-2 text-center">
            OFFLINE · POWER SHED (5.4 W)
          </p>
        )}
      </section>

      {/* 4. ISS — Imaging Science Subsystem (Synced to Scan Platform) */}
      <section className="rounded border border-slate-800 bg-[#090d16] p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            type="button"
            onClick={() => onSelectComponent('scan_platform')}
            className="flex items-center gap-1.5 text-left group"
          >
            <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-100 group-hover:text-amber-300 transition-colors">
              ISS · Narrow / Wide Vidicon
            </span>
          </button>
          <button
            type="button"
            onClick={() => onToggleLoad('iss')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 ${
              issOn
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-amber-400/60 hover:text-amber-200'
            }`}
          >
            <Power className="w-2.5 h-2.5" />
            {issOn ? 'LIVE' : 'RE-ENERGIZE'}
          </button>
        </div>

        {issOn ? (
          <div className="relative h-20 rounded bg-[#05080f] border border-slate-800/80 overflow-hidden">
            <div className="absolute inset-0 opacity-25 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:12px_12px]" />
            {/* Moving boresight reticle */}
            <div
              className="absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 border border-amber-400/90 rounded-full transition-all duration-150 flex items-center justify-center"
              style={{ left: `${reticleX}%`, top: `${reticleY}%` }}
            >
              <div className="w-1 h-1 rounded-full bg-amber-300" />
            </div>
            <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-mono text-slate-300">
              <span>AZ {scanAzimuth > 0 ? `+${scanAzimuth}` : scanAzimuth}°</span>
              <span>EL {scanElevation > 0 ? `+${scanElevation}` : scanElevation}°</span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] font-mono text-slate-500 py-2 text-center">
            OFFLINE · SHUT DOWN FEB 1990 (PALE BLUE DOT)
          </p>
        )}
      </section>
    </div>
  );
};
