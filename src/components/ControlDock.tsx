import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  EyeOff,
  Layers,
  Moon,
  Navigation,
  Orbit,
  RotateCcw,
  Scan,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { SUBSYSTEM_FILTERS, SubsystemId } from '../data/voyagerData';
import { LightingMode } from '../three/VoyagerViewport';

interface ControlDockProps {
  collapsed: boolean;
  explodeTarget: number;
  activeSubsystem: SubsystemId;
  showOverlays: boolean;
  showMissionData: boolean;
  showSimLab: boolean;
  xrayMode: boolean;
  showVectors: boolean;
  lightingMode: LightingMode;
  autoOrbit: boolean;
  onToggleCollapsed: () => void;
  onExplodeChange: (value: number) => void;
  onToggleExplodeQuick: () => void;
  onSubsystemChange: (id: SubsystemId) => void;
  onToggleOverlays: () => void;
  onToggleMissionData: () => void;
  onToggleSimLab: () => void;
  onToggleXray: () => void;
  onToggleVectors: () => void;
  onToggleLighting: () => void;
  onToggleAutoOrbit: () => void;
  onResetView: () => void;
}

export const ControlDock: React.FC<ControlDockProps> = ({
  collapsed,
  explodeTarget,
  activeSubsystem,
  showOverlays,
  showMissionData,
  showSimLab,
  xrayMode,
  showVectors,
  lightingMode,
  autoOrbit,
  onToggleCollapsed,
  onExplodeChange,
  onToggleExplodeQuick,
  onSubsystemChange,
  onToggleOverlays,
  onToggleMissionData,
  onToggleSimLab,
  onToggleXray,
  onToggleVectors,
  onToggleLighting,
  onToggleAutoOrbit,
  onResetView,
}) => {
  const explodePct = Math.round(explodeTarget * 100);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(1040px,96vw)] flex flex-col items-center pointer-events-none">
      {/* Collapsible Drawer Handle + Quick Labels Toggle when Collapsed */}
      <div className="pointer-events-auto mb-1.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="px-3 py-1 bg-[#0b101b] border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-slate-100 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          title="Toggle controls (H)"
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {collapsed && (
          <button
            type="button"
            onClick={onToggleOverlays}
            aria-pressed={showOverlays}
            className={`px-3 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
              showOverlays
                ? 'bg-[#0b101b] text-cyan-200 border-cyan-500/50 hover:border-cyan-400'
                : 'bg-[#0b101b] text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200'
            }`}
            title="Show or hide 3D hardware labels (L)"
          >
            {showOverlays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showOverlays ? 'Hide Labels' : 'Show Labels'}</span>
          </button>
        )}
      </div>

      {/* Unified Bottom Control Dock */}
      {!collapsed && (
        <div className="pointer-events-auto w-full bg-[#0b101b] border border-slate-800 rounded shadow-2xl px-3.5 py-2.5 flex flex-col gap-2.5">
          {/* Row 1: Exploded View Scrubber + Simulation, Cutaway & Viewport Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Exploded View Slider + Quick Toggle */}
            <div className="flex items-center gap-2 flex-1 min-w-[215px]">
              <button
                type="button"
                onClick={onToggleExplodeQuick}
                className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
                  explodeTarget > 0.1
                    ? 'bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400'
                    : 'bg-[#121927] text-slate-200 border-slate-700 hover:border-amber-500/60'
                }`}
                title="Toggle exploded view (E)"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{explodeTarget > 0.5 ? 'Assemble' : 'Explode'}</span>
              </button>

              <div className="flex items-center gap-2 flex-1 max-w-[180px]">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={explodePct}
                  onChange={(e) => onExplodeChange(Number(e.target.value) / 100)}
                  aria-label="Exploded view separation percentage"
                  className="voyager-slider w-full"
                />
                <span className="font-mono tabular-nums text-[11px] text-amber-300 w-8 text-right shrink-0">
                  {explodePct}%
                </span>
              </div>
            </div>

            {/* Secondary Functional Controls */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={onToggleSimLab}
                aria-pressed={showSimLab}
                className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
                  showSimLab
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/70'
                    : 'bg-[#121927] text-slate-200 border-slate-700 hover:border-amber-500/50'
                }`}
                title="Open Engineering Simulation Lab: Timeline, Power, Cutaway & Actuators (S)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>Sim Lab</span>
              </button>

              <button
                type="button"
                onClick={onToggleXray}
                aria-pressed={xrayMode}
                className={`px-2 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
                  xrayMode
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/70'
                    : 'bg-[#121927] text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
                title="Toggle X-Ray shell transparency (X)"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>X-Ray</span>
              </button>

              <button
                type="button"
                onClick={onToggleVectors}
                aria-pressed={showVectors}
                className={`px-2 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
                  showVectors
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/70'
                    : 'bg-[#121927] text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
                title="Toggle 3D Earth DSN Beam, Sun & Velocity vectors (V)"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Vectors</span>
              </button>

              <button
                type="button"
                onClick={onToggleOverlays}
                aria-pressed={showOverlays}
                className={`px-2 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
                  showOverlays
                    ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/50 hover:bg-cyan-500/20'
                    : 'bg-[#121927] text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-600'
                }`}
                title="Show or hide 3D hardware labels (L)"
              >
                {showOverlays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{showOverlays ? 'Labels: On' : 'Labels: Off'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleMissionData}
                className={`px-2 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
                  showMissionData
                    ? 'bg-amber-500/15 text-amber-200 border-amber-500/50'
                    : 'bg-[#121927] text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title="Toggle interstellar ephemeris & hardware list (M)"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Mission</span>
              </button>

              <button
                type="button"
                onClick={onToggleLighting}
                className="px-2 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 bg-[#121927] text-slate-300 border border-slate-800 hover:border-slate-600 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
                title="Switch lighting between Deep Space and JPL Cleanroom"
              >
                {lightingMode === 'space' ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-amber-300" />
                    <span>Space</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-sky-300" />
                    <span>Cleanroom</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onToggleAutoOrbit}
                className={`px-2 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
                  autoOrbit
                    ? 'bg-slate-700/80 text-slate-100 border-slate-600'
                    : 'bg-[#121927] text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title="Toggle slow camera orbit"
              >
                <Orbit className="w-3.5 h-3.5" />
                <span>Orbit</span>
              </button>

              <button
                type="button"
                onClick={onResetView}
                className="px-2 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 bg-[#121927] text-slate-300 border border-slate-800 hover:border-slate-600 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
                title="Reset camera, cutaway, and filters (R)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Hairline Separator */}
          <div className="h-px bg-slate-800/80" />

          {/* Row 2: Mission Subsystem Highlight Toggles */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap shrink-0 hidden sm:inline">
              Highlight Subsystem
            </span>
            <div
              role="tablist"
              aria-label="Highlight spacecraft subsystem"
              className="flex items-center gap-1 overflow-x-auto flex-1 sm:justify-end"
            >
              {SUBSYSTEM_FILTERS.map((sub) => {
                const isActive = activeSubsystem === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSubsystemChange(sub.id)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-slate-100 text-slate-950'
                        : 'bg-[#121927] text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                    }`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
