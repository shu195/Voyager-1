import React from 'react';
import { X } from 'lucide-react';
import {
  COMPONENT_LIST,
  ComponentId,
  LiveEphemeris,
} from '../data/voyagerData';

interface MissionTelemetryOverlayProps {
  visible: boolean;
  ephemeris: LiveEphemeris;
  selectedComponent: ComponentId | null;
  onSelectComponent: (id: ComponentId) => void;
  onClose: () => void;
}

export const MissionTelemetryOverlay: React.FC<MissionTelemetryOverlayProps> = ({
  visible,
  ephemeris,
  selectedComponent,
  onSelectComponent,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <section
      aria-label="Voyager 1 Interstellar Mission Data"
      className="fixed top-[84px] left-5 w-[min(324px,calc(100vw-2.5rem))] z-20 bg-[#0b101b] border border-slate-800 rounded shadow-2xl overflow-hidden"
    >
      <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-100">
            Interstellar Ephemeris
          </h2>
          <p className="text-[11px] text-slate-400">
            JPL Reference Trajectory · Mission Year {ephemeris.missionYears.toFixed(1)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
          aria-label="Close mission data overlay"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Live Calculated Scientific Metrics (Tabular Numerals) */}
      <div className="grid grid-cols-2 gap-px bg-slate-800/80 border-b border-slate-800">
        <div className="bg-[#090d16] px-3 py-2.5">
          <div className="text-[10.5px] text-slate-400">Heliocentric Distance</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="font-mono tabular-nums text-base font-semibold text-amber-300">
              {ephemeris.distanceAU.toFixed(2)}
            </span>
            <span className="font-mono text-[10px] text-slate-500">AU</span>
          </div>
          <div className="font-mono tabular-nums text-[10px] text-slate-500">
            {ephemeris.distanceKmBillion.toFixed(2)} billion km
          </div>
        </div>

        <div className="bg-[#090d16] px-3 py-2.5">
          <div className="text-[10.5px] text-slate-400">One-Way Light Time</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="font-mono tabular-nums text-base font-semibold text-cyan-300">
              {ephemeris.oneWayLightHours}h {String(ephemeris.oneWayLightMinutes).padStart(2, '0')}m
            </span>
          </div>
          <div className="font-mono tabular-nums text-[10px] text-slate-500">
            {ephemeris.heliocentricVelocityKmS.toFixed(3)} km/s vs Sun
          </div>
        </div>

        <div className="bg-[#090d16] px-3 py-2.5">
          <div className="text-[10.5px] text-slate-400">Estimated RTG Power</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="font-mono tabular-nums text-base font-semibold text-slate-100">
              {ephemeris.estimatedRtgWatts.toFixed(1)}
            </span>
            <span className="font-mono text-[10px] text-slate-500">W DC</span>
          </div>
          <div className="font-mono tabular-nums text-[10px] text-slate-500">
            470 W at 1977 launch
          </div>
        </div>

        <div className="bg-[#090d16] px-3 py-2.5">
          <div className="text-[10.5px] text-slate-400">Active Science</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="font-mono tabular-nums text-base font-semibold text-emerald-400">
              {ephemeris.activeInstruments} / 10
            </span>
            <span className="font-mono text-[10px] text-slate-500">inst.</span>
          </div>
          <div className="font-mono text-[10px] text-slate-500">
            MAG · PWS · CRS · LECP
          </div>
        </div>
      </div>

      {/* Hardware Directory Quick Jump */}
      <div className="p-2.5">
        <div className="px-1 mb-1.5 flex items-center justify-between text-[10.5px] text-slate-400">
          <span>Hardware Assemblies</span>
          <span className="font-mono text-slate-500">Click to focus</span>
        </div>
        <div className="max-h-48 overflow-y-auto voyager-scroll space-y-0.5">
          {COMPONENT_LIST.map((comp) => {
            const isSelected = selectedComponent === comp.id;
            const sym = comp.status === 'Active' ? '●' : comp.status === 'Passive' ? '◆' : '○';
            const tone =
              comp.status === 'Active'
                ? 'text-emerald-400'
                : comp.status === 'Passive'
                  ? 'text-amber-400'
                  : 'text-slate-500';
            return (
              <button
                key={comp.id}
                type="button"
                onClick={() => onSelectComponent(comp.id)}
                className={`w-full px-2 py-1.5 rounded text-left flex items-center justify-between gap-2 text-xs transition-colors ${
                  isSelected
                    ? 'bg-amber-500/15 text-amber-200'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-slate-100'
                }`}
              >
                <span className="truncate font-medium">{comp.shortLabel}</span>
                <span className={`font-mono text-[10px] whitespace-nowrap shrink-0 ${tone}`}>
                  {sym} {comp.status}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
