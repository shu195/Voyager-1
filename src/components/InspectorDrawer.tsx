import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Disc3,
  Flame,
  Layers,
  Scan,
  X,
} from 'lucide-react';
import {
  COMPONENT_LIST,
  ComponentId,
  VOYAGER_COMPONENTS,
} from '../data/voyagerData';
import { ScientificChart } from './ScientificChart';

interface InspectorDrawerProps {
  componentId: ComponentId | null;
  explodeTarget: number;
  xrayMode: boolean;
  scanAzimuth: number;
  scanElevation: number;
  onClose: () => void;
  onSelectComponent: (id: ComponentId) => void;
  onToggleExplodeForInternals: () => void;
  onToggleXray: () => void;
  onOpenGoldenRecordDecoder: () => void;
  onFireThrusters: () => void;
  onScanAzimuthChange: (deg: number) => void;
  onScanElevationChange: (deg: number) => void;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  componentId,
  explodeTarget,
  xrayMode,
  scanAzimuth,
  scanElevation,
  onClose,
  onSelectComponent,
  onToggleExplodeForInternals,
  onToggleXray,
  onOpenGoldenRecordDecoder,
  onFireThrusters,
  onScanAzimuthChange,
  onScanElevationChange,
}) => {
  if (!componentId) return null;

  const info = VOYAGER_COMPONENTS[componentId];
  const currentIdx = COMPONENT_LIST.findIndex((c) => c.id === componentId);
  const prevComp = COMPONENT_LIST[(currentIdx - 1 + COMPONENT_LIST.length) % COMPONENT_LIST.length];
  const nextComp = COMPONENT_LIST[(currentIdx + 1) % COMPONENT_LIST.length];

  const statusSymbol =
    info.status === 'Active' ? '●' : info.status === 'Passive' ? '◆' : '○';
  const statusColor =
    info.status === 'Active'
      ? 'text-emerald-400'
      : info.status === 'Passive'
        ? 'text-amber-400'
        : 'text-slate-400';

  const isExploded = explodeTarget > 0.55;

  return (
    <aside
      aria-label={`Hardware specification for ${info.name}`}
      className="fixed top-5 right-5 bottom-24 w-[min(376px,calc(100vw-2.5rem))] z-30 flex flex-col bg-[#0c111d] border border-slate-800 rounded shadow-2xl overflow-hidden"
    >
      {/* Top Header */}
      <div className="px-4 py-3.5 border-b border-slate-800/90 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mb-1">
            <span>{info.subsystemLabel}</span>
            <span aria-hidden="true">·</span>
            <span className={statusColor}>
              {statusSymbol} {info.status}
            </span>
          </div>
          <h2 className="font-display text-lg font-semibold text-slate-50 leading-snug tracking-tight">
            {info.name}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{info.designation}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 rounded transition-colors shrink-0"
          aria-label="Close hardware inspector"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Technical Body */}
      <div className="flex-1 overflow-y-auto voyager-scroll px-4 py-4 space-y-4">
        <p className="text-[13px] text-slate-300 leading-relaxed">{info.summary}</p>

        {/* Context-Aware Interactive Hardware Action */}
        {componentId === 'golden_record' && (
          <button
            type="button"
            onClick={onOpenGoldenRecordDecoder}
            className="w-full px-3 py-2.5 rounded border border-amber-400/70 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-medium flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <Disc3 className="w-4 h-4 text-amber-400" />
              <span>Decode Engraved Cover Diagrams</span>
            </span>
            <span className="font-mono text-[10.5px] text-amber-300">Interactive</span>
          </button>
        )}

        {componentId === 'propulsion' && (
          <div className="border border-amber-500/40 bg-[#090d16] p-3 rounded flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-amber-200">
                MR-103 Attitude Pulse Test
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Fire all 16 catalytic hydrazine monopropellant nozzles (0.9 N).
              </p>
            </div>
            <button
              type="button"
              onClick={onFireThrusters}
              className="px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Fire Pulse</span>
            </button>
          </div>
        )}

        {componentId === 'scan_platform' && (
          <div className="border border-cyan-500/40 bg-[#090d16] p-3 rounded space-y-2.5">
            <div className="flex items-center justify-between text-xs font-medium text-cyan-200">
              <span className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                <span>2-Axis Gimbal Slew Control</span>
              </span>
              {(scanAzimuth !== 0 || scanElevation !== 0) && (
                <button
                  type="button"
                  onClick={() => {
                    onScanAzimuthChange(0);
                    onScanElevationChange(0);
                  }}
                  className="text-[10.5px] font-mono text-slate-400 hover:text-cyan-200 underline underline-offset-2"
                >
                  Center
                </button>
              )}
            </div>
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Azimuth</span>
                <span className="tabular-nums text-cyan-300">{scanAzimuth}°</span>
              </div>
              <input
                type="range"
                min={-120}
                max={120}
                step={1}
                value={scanAzimuth}
                onChange={(e) => onScanAzimuthChange(Number(e.target.value))}
                className="voyager-slider w-full"
              />
            </div>
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Elevation</span>
                <span className="tabular-nums text-cyan-300">{scanElevation}°</span>
              </div>
              <input
                type="range"
                min={-75}
                max={75}
                step={1}
                value={scanElevation}
                onChange={(e) => onScanElevationChange(Number(e.target.value))}
                className="voyager-slider w-full"
              />
            </div>
          </div>
        )}

        {/* Key Specifications Table (Tabular Numerals) */}
        <div>
          <h3 className="text-xs font-medium text-slate-400 mb-2">
            Engineering Specifications
          </h3>
          <div className="grid grid-cols-2 gap-px bg-slate-800/80 border border-slate-800 rounded overflow-hidden">
            {info.specs.map((spec) => (
              <div key={spec.label} className="bg-[#090d16] px-3 py-2">
                <div className="text-[10.5px] text-slate-400 truncate">{spec.label}</div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="font-mono tabular-nums text-sm font-semibold text-slate-100">
                    {spec.value}
                  </span>
                  {spec.unit && (
                    <span className="font-mono text-[10px] text-slate-500">{spec.unit}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Internal Circuitry & Exploded Cutaway Section */}
        <div className="border border-slate-800 bg-[#090d16] p-3 rounded space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-medium text-amber-300">
              Internal Hardware &amp; Cutaway
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleXray}
                aria-pressed={xrayMode}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 border ${
                  xrayMode
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/70'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
                title="Toggle X-Ray shell transparency (X)"
              >
                <Scan className="w-3 h-3" />
                <span>X-Ray</span>
              </button>
              <button
                type="button"
                onClick={onToggleExplodeForInternals}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  isExploded
                    ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {isExploded ? 'Assemble' : 'Explode'}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{info.internalDetail}</p>
        </div>

        {/* Scientific Data Chart */}
        <ScientificChart chartType={info.chartType} />

        {/* Scientific Context & Interstellar Mission */}
        <div>
          <h3 className="text-xs font-medium text-slate-400 mb-1.5">
            Scientific Context
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">{info.scientificContext}</p>
        </div>

        {/* Milestone Discoveries */}
        <div>
          <h3 className="text-xs font-medium text-slate-400 mb-1.5">
            Mission Milestones
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
            {info.discoveries.map((d) => (
              <li key={d} className="flex items-start gap-2">
                <span className="text-amber-400/80 font-mono text-[10px] mt-0.5 shrink-0">
                  —
                </span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Component Prev / Next Stepper Footer */}
      <div className="px-4 py-2.5 border-t border-slate-800 bg-[#090d16] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelectComponent(prevComp.id)}
          className="flex items-center gap-1 text-xs text-slate-300 hover:text-amber-300 transition-colors whitespace-nowrap"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>{prevComp.shortLabel}</span>
        </button>
        <span className="font-mono tabular-nums text-[11px] text-slate-500">
          {currentIdx + 1} / {COMPONENT_LIST.length}
        </span>
        <button
          type="button"
          onClick={() => onSelectComponent(nextComp.id)}
          className="flex items-center gap-1 text-xs text-slate-300 hover:text-amber-300 transition-colors whitespace-nowrap"
        >
          <span>{nextComp.shortLabel}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
