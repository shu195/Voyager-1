import React, { useState } from 'react';
import {
  Clock,
  Compass,
  Crosshair,
  Disc3,
  Flame,
  Scan,
  Scissors,
  Sparkles,
  Thermometer,
  X,
  Zap,
} from 'lucide-react';
import {
  CORE_AVIONICS_BASELINE_WATTS,
  ComponentId,
  InterpolatedEpochState,
  MISSION_EPOCHS,
  POWER_LOAD_ITEMS,
} from '../data/voyagerData';

type LabTab = 'timeline' | 'power' | 'optics';

interface SimulationLabDrawerProps {
  visible: boolean;
  missionYear: number;
  epochState: InterpolatedEpochState;
  activeLoads: Record<string, boolean>;
  totalLoadWatts: number;
  busTempC: number;
  louverOpenness: number;
  scanAzimuth: number;
  scanElevation: number;
  xrayMode: boolean;
  cutawayDepth: number;
  showVectors: boolean;
  bloomEnabled: boolean;
  onClose: () => void;
  onMissionYearChange: (year: number, syncLoads?: boolean) => void;
  onToggleLoad: (id: string) => void;
  onSyncEpochLoads: () => void;
  onScanAzimuthChange: (deg: number) => void;
  onScanElevationChange: (deg: number) => void;
  onFireThrusters: () => void;
  onToggleXray: () => void;
  onCutawayDepthChange: (depth: number) => void;
  onToggleVectors: () => void;
  onToggleBloom: () => void;
  onOpenGoldenRecordDecoder: () => void;
  onSelectComponent: (id: ComponentId) => void;
}

export const SimulationLabDrawer: React.FC<SimulationLabDrawerProps> = ({
  visible,
  missionYear,
  epochState,
  activeLoads,
  totalLoadWatts,
  busTempC,
  louverOpenness,
  scanAzimuth,
  scanElevation,
  xrayMode,
  cutawayDepth,
  showVectors,
  bloomEnabled,
  onClose,
  onMissionYearChange,
  onToggleLoad,
  onSyncEpochLoads,
  onScanAzimuthChange,
  onScanElevationChange,
  onFireThrusters,
  onToggleXray,
  onCutawayDepthChange,
  onToggleVectors,
  onToggleBloom,
  onOpenGoldenRecordDecoder,
  onSelectComponent,
}) => {
  const [activeTab, setActiveTab] = useState<LabTab>('timeline');

  if (!visible) return null;

  const powerMargin = epochState.rtgWatts - totalLoadWatts;
  const isOverloaded = powerMargin < 0;
  const loadPct = Math.min(100, Math.round((totalLoadWatts / Math.max(1, epochState.rtgWatts)) * 100));
  const cutawayPct = Math.round(cutawayDepth * 100);
  const louverPct = Math.round(louverOpenness * 100);

  return (
    <aside
      aria-label="Voyager 1 Engineering Simulation Lab"
      className="fixed top-20 left-5 bottom-24 w-[min(358px,calc(100vw-2.5rem))] z-30 flex flex-col bg-[#0c111d] border border-slate-800 rounded shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800/90 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-100 tracking-tight">
            Engineering Simulation Lab
          </h2>
          <p className="text-[11px] text-slate-400">
            Mission epochs · Power &amp; thermal · Section cutaway
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 rounded transition-colors"
          aria-label="Close simulation lab"
          title="Close (S)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 3-Tab Switcher */}
      <div className="grid grid-cols-3 border-b border-slate-800 bg-[#090d16]">
        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`py-2 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'timeline'
              ? 'border-amber-400 text-amber-200 bg-[#0d1423]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Timeline</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('power')}
          className={`py-2 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'power'
              ? 'border-amber-400 text-amber-200 bg-[#0d1423]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Power</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('optics')}
          className={`py-2 text-xs font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'optics'
              ? 'border-amber-400 text-amber-200 bg-[#0d1423]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Cutaway</span>
        </button>
      </div>

      {/* Scrollable Tab Body */}
      <div className="flex-1 overflow-y-auto voyager-scroll px-4 py-3.5 space-y-4">
        {activeTab === 'timeline' && (
          <>
            {/* Year Scrubber */}
            <div className="border border-slate-800 bg-[#090d16] p-3 rounded space-y-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-slate-300">Mission Epoch</span>
                <span className="font-mono tabular-nums text-lg font-semibold text-amber-300">
                  {missionYear.toFixed(0)}
                </span>
              </div>
              <input
                type="range"
                min={1977}
                max={2026}
                step={1}
                value={Math.round(missionYear)}
                onChange={(e) => onMissionYearChange(Number(e.target.value), true)}
                aria-label="Mission timeline year"
                className="voyager-slider w-full"
              />
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>1977 · 1 AU</span>
                <span>2012 · 121.6 AU</span>
                <span>2026 · 170 AU</span>
              </div>
            </div>

            {/* Live Epoch Readout */}
            <div className="grid grid-cols-2 gap-px bg-slate-800/80 border border-slate-800 rounded overflow-hidden">
              <div className="bg-[#090d16] px-3 py-2">
                <div className="text-[10px] text-slate-400">Heliocentric Distance</div>
                <div className="font-mono tabular-nums text-sm font-semibold text-slate-100 mt-0.5">
                  {epochState.distanceAU.toFixed(1)}{' '}
                  <span className="text-[10px] text-slate-500">AU</span>
                </div>
              </div>
              <div className="bg-[#090d16] px-3 py-2">
                <div className="text-[10px] text-slate-400">RTG Electrical Output</div>
                <div className="font-mono tabular-nums text-sm font-semibold text-amber-300 mt-0.5">
                  {Math.round(epochState.rtgWatts)}{' '}
                  <span className="text-[10px] text-slate-500">W</span>
                </div>
              </div>
              <div className="bg-[#090d16] px-3 py-2">
                <div className="text-[10px] text-slate-400">One-Way Light Time</div>
                <div className="font-mono tabular-nums text-sm font-semibold text-slate-100 mt-0.5">
                  {epochState.oneWayLightHours}h{' '}
                  {String(epochState.oneWayLightMinutes).padStart(2, '0')}m
                </div>
              </div>
              <div className="bg-[#090d16] px-3 py-2">
                <div className="text-[10px] text-slate-400">Solar Flux Index</div>
                <div className="font-mono tabular-nums text-sm font-semibold text-cyan-300 mt-0.5">
                  {Math.round(epochState.solarIntensityNorm * 100)}%
                </div>
              </div>
            </div>

            {/* Nearest Epoch Context Card */}
            <div className="border border-slate-800 bg-[#090d16] p-3 rounded space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-amber-300/90">
                <span>{epochState.nearestEpoch.dateLabel}</span>
                <span className="text-slate-400">{epochState.nearestEpoch.region}</span>
              </div>
              <div className="font-display text-sm font-semibold text-slate-100">
                {epochState.nearestEpoch.title}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {epochState.nearestEpoch.summary}
              </p>
            </div>

            {/* Historical Epoch Jump Presets */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-slate-400">Historical Milestones</div>
              <div className="grid grid-cols-1 gap-1">
                {MISSION_EPOCHS.map((ep) => {
                  const isCurrent = Math.abs(missionYear - ep.year) < 1;
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => onMissionYearChange(ep.year, true)}
                      className={`w-full px-2.5 py-1.5 rounded text-left border transition-colors flex items-center justify-between gap-2 ${
                        isCurrent
                          ? 'bg-amber-500/15 border-amber-400/70 text-amber-100'
                          : 'bg-[#090d16] border-slate-800/80 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="min-w-0 truncate text-xs">
                        <span className="font-mono tabular-nums text-amber-300 mr-2">{ep.year}</span>
                        <span>{ep.title}</span>
                      </div>
                      <span className="font-mono tabular-nums text-[10.5px] text-slate-400 shrink-0">
                        {ep.distanceAU} AU
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {activeTab === 'power' && (
          <>
            {/* RTG Power Budget Bar */}
            <div className="border border-slate-800 bg-[#090d16] p-3 rounded space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">
                  MHW-RTG Power Bus ({Math.round(missionYear)})
                </span>
                <span
                  className={`font-mono tabular-nums text-xs font-semibold ${
                    isOverloaded ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {isOverloaded
                    ? `${Math.abs(powerMargin).toFixed(1)} W OVER`
                    : `+${powerMargin.toFixed(1)} W margin`}
                </span>
              </div>

              <div className="w-full h-2 bg-slate-900 border border-slate-800 rounded-xs overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    isOverloaded
                      ? 'bg-rose-500'
                      : loadPct > 88
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                  }`}
                  style={{ width: `${loadPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
                <span>Load: {totalLoadWatts.toFixed(1)} W</span>
                <span>Supply: {epochState.rtgWatts.toFixed(0)} W</span>
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[11px]">
                <span className="text-slate-400">
                  Core Avionics (CCS/FDS/TWTA):{' '}
                  <strong className="font-mono text-slate-200">{CORE_AVIONICS_BASELINE_WATTS} W</strong>
                </span>
                <button
                  type="button"
                  onClick={onSyncEpochLoads}
                  className="text-amber-300 hover:text-amber-200 underline underline-offset-2"
                >
                  Match {Math.round(missionYear)}
                </button>
              </div>
            </div>

            {/* Live Thermal Louver Coupling */}
            <div className="border border-slate-800 bg-[#090d16] p-3 rounded space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-200">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Bus Thermal Louvers</span>
                </div>
                <span className="font-mono tabular-nums text-xs text-amber-300">
                  {busTempC >= 0 ? `+${busTempC.toFixed(1)}` : busTempC.toFixed(1)} °C · {louverPct}% open
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Bimetallic springs automatically pivot the 50 aluminum blades on Bays 1, 3, 4, 6 &amp; 8 as internal waste heat rises or falls.
              </p>
            </div>

            {/* Toggleable Instrument & Heater Loads */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-slate-400">
                Instrument &amp; Heater Breakers
              </div>
              <div className="space-y-1">
                {POWER_LOAD_ITEMS.map((item) => {
                  const enabled = Boolean(activeLoads[item.id]);
                  return (
                    <div
                      key={item.id}
                      className={`px-2.5 py-2 rounded border flex items-center justify-between gap-2 transition-colors ${
                        enabled
                          ? 'bg-[#101827] border-slate-700 text-slate-100'
                          : 'bg-[#090d16] border-slate-800/80 text-slate-400'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectComponent(item.componentId)}
                            className="text-xs font-medium text-left hover:text-amber-300 transition-colors truncate"
                          >
                            {item.label}
                          </button>
                          <span className="font-mono tabular-nums text-[10.5px] text-amber-300/90 shrink-0">
                            {item.watts.toFixed(1)} W
                          </span>
                        </div>
                        <div className="text-[10.5px] text-slate-500 truncate">{item.note}</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        onClick={() => onToggleLoad(item.id)}
                        className={`px-2 py-1 rounded text-[10.5px] font-mono shrink-0 border transition-colors ${
                          enabled
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {enabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actuators: Scan Platform Slew + MR-103 Attitude Thrusters */}
            <div className="border border-slate-800 bg-[#090d16] p-3 rounded space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Hardware Actuators</span>
                </span>
                <button
                  type="button"
                  onClick={onFireThrusters}
                  className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-medium flex items-center gap-1 transition-colors"
                  title="Fire 16 MR-103 hydrazine attitude thrusters (T)"
                >
                  <Flame className="w-3 h-3" />
                  <span>Fire Thrusters</span>
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                    <span>Scan Platform Azimuth</span>
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
                    <span>Scan Platform Elevation</span>
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
            </div>
          </>
        )}

        {activeTab === 'optics' && (
          <>
            {/* Hardware Section Cutaway Plane */}
            <div className="border border-slate-800 bg-[#090d16] p-3 rounded space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-amber-400" />
                  <span>Section Cutaway Plane</span>
                </span>
                <span className="font-mono tabular-nums text-xs text-amber-300">
                  {cutawayPct === 0 ? 'OFF' : `${cutawayPct}%`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={cutawayPct}
                onChange={(e) => onCutawayDepthChange(Number(e.target.value) / 100)}
                aria-label="Hardware section cutaway plane depth"
                className="voyager-slider w-full"
              />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Slices directly through the HGA dish, decagonal bus bays, titanium hydrazine sphere, TWTAs, plated-wire memory, and gyroscopes.
              </p>
            </div>

            {/* X-Ray Shell Transparency */}
            <div className="border border-slate-800 bg-[#090d16] p-3 rounded flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <Scan className="w-3.5 h-3.5 text-cyan-400" />
                  <span>X-Ray Shell Mode</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Renders exterior MLI blankets, HGA dish, and RTG casings translucent to reveal interior hardware in place.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={xrayMode}
                onClick={onToggleXray}
                className={`px-2.5 py-1.5 rounded text-xs font-mono shrink-0 border transition-colors ${
                  xrayMode
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {xrayMode ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* 3D Reference Vectors */}
            <div className="border border-slate-800 bg-[#090d16] p-3 rounded space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                  <span>3D Reference Vectors</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showVectors}
                  onClick={onToggleVectors}
                  className={`px-2.5 py-1 rounded text-xs font-mono shrink-0 border transition-colors ${
                    showVectors
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {showVectors ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="space-y-1 text-[11px] font-mono">
                <div className="flex items-center gap-2 text-cyan-300">
                  <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
                  <span>Earth · DSN X-Band Downlink Cone</span>
                </div>
                <div className="flex items-center gap-2 text-amber-300">
                  <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
                  <span>Solar Illumination Direction</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-300">
                  <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
                  <span>Interstellar Velocity Vector (17 km/s)</span>
                </div>
              </div>
            </div>

            {/* Selective Specular Bloom */}
            <div className="border border-slate-800 bg-[#090d16] p-3 rounded flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Specular Bloom (GPU)</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Subtle optical halo on RTG heat-source glow, MR-103 thruster plumes, and metallic glints.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={bloomEnabled}
                onClick={onToggleBloom}
                className={`px-2.5 py-1.5 rounded text-xs font-mono shrink-0 border transition-colors ${
                  bloomEnabled
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {bloomEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Golden Record Cover Decoder Launcher */}
            <button
              type="button"
              onClick={onOpenGoldenRecordDecoder}
              className="w-full px-3 py-2.5 rounded border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-xs font-medium flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <Disc3 className="w-4 h-4 text-amber-400" />
                <span>Open Golden Record Cover Decoder</span>
              </span>
              <span className="font-mono text-[10px] text-amber-300/80">7 symbols</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
};
