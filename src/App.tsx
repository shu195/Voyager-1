import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CORE_AVIONICS_BASELINE_WATTS,
  ComponentId,
  MISSION_EPOCHS,
  POWER_LOAD_ITEMS,
  SubsystemId,
  VOYAGER_COMPONENTS,
  computeVoyagerEphemeris,
  interpolateMissionYear,
} from './data/voyagerData';
import {
  CameraRequest,
  HoverInfo,
  LightingMode,
  VoyagerViewport,
} from './three/VoyagerViewport';
import { ControlDock } from './components/ControlDock';
import { GoldenRecordModal } from './components/GoldenRecordModal';
import { InspectorDrawer } from './components/InspectorDrawer';
import { MissionTelemetryOverlay } from './components/MissionTelemetryOverlay';
import { SimulationLabDrawer } from './components/SimulationLabDrawer';

const SUBSYSTEM_DEFAULT_CAMERAS: Record<
  SubsystemId,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  all: { pos: [5.6, 3.1, 6.4], target: [0.05, 0.25, -0.35] },
  communications: { pos: [3.6, 3.4, 4.6], target: [0, 1.55, 0] },
  power: { pos: [-3.9, -0.5, 4.2], target: [-1.4, -0.5, 0.25] },
  bus: { pos: [3.0, 1.05, 3.2], target: [0, 0.15, 0] },
  science: { pos: [4.8, 1.8, 4.9], target: [1.1, -0.25, -1.1] },
  payload: { pos: [1.75, 0.36, 1.95], target: [0.58, 0.15, 0.78] },
};

function buildLoadsForYear(year: number): Record<string, boolean> {
  const ep = interpolateMissionYear(year).nearestEpoch;
  const activeSet = new Set(ep.activeIds);
  const map: Record<string, boolean> = {};
  for (const item of POWER_LOAD_ITEMS) {
    map[item.id] = activeSet.has(item.id);
  }
  return map;
}

export default function App() {
  const isCinematic = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cinematic') === '1',
    [],
  );
  const [explodeTarget, setExplodeTarget] = useState<number>(0);
  const [activeSubsystem, setActiveSubsystem] = useState<SubsystemId>('all');
  const [selectedComponent, setSelectedComponent] = useState<ComponentId | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [showOverlays, setShowOverlays] = useState<boolean>(true);
  const [showMissionData, setShowMissionData] = useState<boolean>(false);
  const [showSimLab, setShowSimLab] = useState<boolean>(false);
  const [showGoldenRecordDecoder, setShowGoldenRecordDecoder] = useState<boolean>(false);
  const [lightingMode, setLightingMode] = useState<LightingMode>('space');
  const [autoOrbit, setAutoOrbit] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [cameraRequest, setCameraRequest] = useState<CameraRequest | null>(null);
  const [ephemeris, setEphemeris] = useState(() => computeVoyagerEphemeris());

  // Interactive Engineering Simulation State
  const [missionYear, setMissionYear] = useState<number>(2026);
  const [activeLoads, setActiveLoads] = useState<Record<string, boolean>>(() =>
    buildLoadsForYear(2026),
  );
  const [xrayMode, setXrayMode] = useState<boolean>(false);
  const [cutawayDepth, setCutawayDepth] = useState<number>(0);
  const [showVectors, setShowVectors] = useState<boolean>(false);
  const [bloomEnabled, setBloomEnabled] = useState<boolean>(true);
  const [scanAzimuth, setScanAzimuth] = useState<number>(0);
  const [scanElevation, setScanElevation] = useState<number>(0);
  const [thrusterPulseNonce, setThrusterPulseNonce] = useState<number>(0);

  // Update JPL interstellar ephemeris readout every 10 seconds
  useEffect(() => {
    const id = window.setInterval(() => {
      setEphemeris(computeVoyagerEphemeris());
    }, 10000);
    return () => window.clearInterval(id);
  }, []);

  const epochState = useMemo(() => interpolateMissionYear(missionYear), [missionYear]);

  // Compute live electrical load, internal bus temperature, and bimetallic thermal louver openness
  const { totalLoadWatts, busTempC, louverOpenness } = useMemo(() => {
    let watts = CORE_AVIONICS_BASELINE_WATTS;
    let heatC = -14; // Deep-space radiative baseline before instrument/heater dissipation
    for (const item of POWER_LOAD_ITEMS) {
      if (activeLoads[item.id]) {
        watts += item.watts;
        heatC += item.heatContributionC;
      }
    }
    // Solar radiative heating contributes significantly in inner solar system (1977-1981)
    heatC += epochState.solarIntensityNorm * 16;
    const openness = Math.min(1, Math.max(0.06, (heatC - 4) / 28));
    return {
      totalLoadWatts: watts,
      busTempC: heatC,
      louverOpenness: openness,
    };
  }, [activeLoads, epochState.solarIntensityNorm]);

  const triggerCamera = useCallback(
    (pos: [number, number, number], target: [number, number, number]) => {
      setCameraRequest({
        position: pos,
        target,
        nonce: Date.now() + Math.random(),
      });
    },
    [],
  );

  const handleSelectComponent = useCallback(
    (id: ComponentId | null) => {
      setSelectedComponent(id);
      if (id) {
        setAutoOrbit(false);
        const info = VOYAGER_COMPONENTS[id];
        triggerCamera(info.cameraPos, info.cameraTarget);
      }
    },
    [triggerCamera],
  );

  const handleSubsystemChange = useCallback(
    (sub: SubsystemId) => {
      setActiveSubsystem(sub);
      setAutoOrbit(false);
      if (sub === 'payload') {
        setSelectedComponent('golden_record');
      } else if (selectedComponent && sub !== 'all') {
        if (VOYAGER_COMPONENTS[selectedComponent].subsystem !== sub) {
          setSelectedComponent(null);
        }
      }
      const preset = SUBSYSTEM_DEFAULT_CAMERAS[sub];
      triggerCamera(preset.pos, preset.target);
    },
    [selectedComponent, triggerCamera],
  );

  const handleMissionYearChange = useCallback((year: number, syncLoads = false) => {
    setMissionYear(year);
    if (syncLoads) {
      setActiveLoads(buildLoadsForYear(year));
    }
  }, []);

  const handleToggleLoad = useCallback((id: string) => {
    setActiveLoads((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSyncEpochLoads = useCallback(() => {
    setActiveLoads(buildLoadsForYear(missionYear));
  }, [missionYear]);

  const handleFireThrusters = useCallback(() => {
    setThrusterPulseNonce((n) => n + 1);
  }, []);

  const handleToggleSimLab = useCallback(() => {
    setShowSimLab((v) => {
      const next = !v;
      if (next) setShowMissionData(false);
      return next;
    });
  }, []);

  const handleToggleMissionData = useCallback(() => {
    setShowMissionData((v) => {
      const next = !v;
      if (next) setShowSimLab(false);
      return next;
    });
  }, []);

  const handleResetView = useCallback(() => {
    setSelectedComponent(null);
    setActiveSubsystem('all');
    setExplodeTarget(0);
    setXrayMode(false);
    setCutawayDepth(0);
    setShowVectors(false);
    setScanAzimuth(0);
    setScanElevation(0);
    setAutoOrbit(false);
    const home = SUBSYSTEM_DEFAULT_CAMERAS.all;
    triggerCamera(home.pos, home.target);
  }, [triggerCamera]);

  const handleToggleExplodeQuick = useCallback(() => {
    setExplodeTarget((prev) => (prev > 0.5 ? 0 : 1));
  }, []);

  // Keyboard shortcuts for fast inspection workflow
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'e') {
        handleToggleExplodeQuick();
      } else if (key === 'l' || key === 'o') {
        setShowOverlays((v) => !v);
      } else if (key === 'm') {
        handleToggleMissionData();
      } else if (key === 's') {
        handleToggleSimLab();
      } else if (key === 'x') {
        setXrayMode((v) => !v);
      } else if (key === 'v') {
        setShowVectors((v) => !v);
      } else if (key === 't') {
        handleFireThrusters();
      } else if (key === 'h') {
        setDockCollapsed((v) => !v);
      } else if (key === 'r') {
        handleResetView();
      } else if (key === 'escape') {
        setShowGoldenRecordDecoder(false);
        setSelectedComponent(null);
        setShowMissionData(false);
        setShowSimLab(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleFireThrusters,
    handleResetView,
    handleToggleExplodeQuick,
    handleToggleMissionData,
    handleToggleSimLab,
  ]);

  const hoveredInfo = hoverInfo ? VOYAGER_COMPONENTS[hoverInfo.componentId] : null;
  const tooltipLeft = hoverInfo
    ? Math.min(Math.max(16, hoverInfo.screenX + 16), window.innerWidth - 290)
    : 0;
  const tooltipTop = hoverInfo
    ? Math.min(Math.max(16, hoverInfo.screenY - 14), window.innerHeight - 130)
    : 0;

  const isHistoricalEpoch = Math.round(missionYear) < MISSION_EPOCHS[MISSION_EPOCHS.length - 1].year;
  const displayDistanceAU = isHistoricalEpoch ? epochState.distanceAU : ephemeris.distanceAU;
  const displayLightHours = isHistoricalEpoch
    ? epochState.oneWayLightHours
    : ephemeris.oneWayLightHours;
  const displayLightMinutes = isHistoricalEpoch
    ? epochState.oneWayLightMinutes
    : ephemeris.oneWayLightMinutes;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#060910] select-none">
      {/* Full-Bleed WebGL 3D Voyager 1 Stage */}
      <VoyagerViewport
        explodeTarget={explodeTarget}
        activeSubsystem={activeSubsystem}
        selectedComponent={selectedComponent}
        hoveredComponent={hoverInfo?.componentId ?? null}
        showOverlays={isCinematic ? false : showOverlays}
        lightingMode={lightingMode}
        autoOrbit={autoOrbit}
        xrayMode={xrayMode}
        cutawayDepth={cutawayDepth}
        showVectors={showVectors}
        bloomEnabled={bloomEnabled}
        scanAzimuth={scanAzimuth}
        scanElevation={scanElevation}
        louverOpenness={louverOpenness}
        thrusterPulseNonce={thrusterPulseNonce}
        solarIntensityNorm={epochState.solarIntensityNorm}
        cameraRequest={cameraRequest}
        onSelectComponent={handleSelectComponent}
        onHoverChange={setHoverInfo}
      />

      {!isCinematic && (
        <>
          {/* Minimal Top-Left Brand & Scientific Ephemeris Lockup (Zero Pill Boxes) */}
          <header className="fixed top-5 left-5 z-20 pointer-events-none">
        <h1 className="font-display text-2xl sm:text-[26px] font-semibold tracking-tight text-slate-50 leading-none">
          Voyager 1
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
          <span>{isHistoricalEpoch ? `Epoch ${Math.round(missionYear)}` : 'JPL 1977'}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums text-amber-300/90">
            {displayDistanceAU.toFixed(2)} AU
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {displayLightHours}h {String(displayLightMinutes).padStart(2, '0')}m light-time
          </span>
        </div>
      </header>

      {/* Optional Interstellar Mission Ephemeris Overlay */}
      <MissionTelemetryOverlay
        visible={showMissionData}
        ephemeris={ephemeris}
        selectedComponent={selectedComponent}
        onSelectComponent={(id) => handleSelectComponent(id)}
        onClose={() => setShowMissionData(false)}
      />

      {/* Engineering Simulation Lab Drawer (Timeline, Power/Thermal, Cutaway, Vectors) */}
      <SimulationLabDrawer
        visible={showSimLab}
        missionYear={missionYear}
        epochState={epochState}
        activeLoads={activeLoads}
        totalLoadWatts={totalLoadWatts}
        busTempC={busTempC}
        louverOpenness={louverOpenness}
        scanAzimuth={scanAzimuth}
        scanElevation={scanElevation}
        xrayMode={xrayMode}
        cutawayDepth={cutawayDepth}
        showVectors={showVectors}
        bloomEnabled={bloomEnabled}
        onClose={() => setShowSimLab(false)}
        onMissionYearChange={handleMissionYearChange}
        onToggleLoad={handleToggleLoad}
        onSyncEpochLoads={handleSyncEpochLoads}
        onScanAzimuthChange={setScanAzimuth}
        onScanElevationChange={setScanElevation}
        onFireThrusters={handleFireThrusters}
        onToggleXray={() => setXrayMode((v) => !v)}
        onCutawayDepthChange={setCutawayDepth}
        onToggleVectors={() => setShowVectors((v) => !v)}
        onToggleBloom={() => setBloomEnabled((v) => !v)}
        onOpenGoldenRecordDecoder={() => setShowGoldenRecordDecoder(true)}
        onSelectComponent={(id) => handleSelectComponent(id)}
      />

      {/* Dismissible Right-Edge Hardware & Scientific Context Drawer */}
      <InspectorDrawer
        componentId={selectedComponent}
        explodeTarget={explodeTarget}
        xrayMode={xrayMode}
        scanAzimuth={scanAzimuth}
        scanElevation={scanElevation}
        onClose={() => setSelectedComponent(null)}
        onSelectComponent={(id) => handleSelectComponent(id)}
        onToggleExplodeForInternals={handleToggleExplodeQuick}
        onToggleXray={() => setXrayMode((v) => !v)}
        onOpenGoldenRecordDecoder={() => setShowGoldenRecordDecoder(true)}
        onFireThrusters={handleFireThrusters}
        onScanAzimuthChange={setScanAzimuth}
        onScanElevationChange={setScanElevation}
      />

      {/* Interactive Golden Record Engraved Cover Decoder Modal */}
      <GoldenRecordModal
        visible={showGoldenRecordDecoder}
        onClose={() => setShowGoldenRecordDecoder(false)}
      />

      {/* Floating Hardware Inspection Tooltip */}
      {hoverInfo && hoveredInfo && (
        <div
          role="tooltip"
          style={{
            transform: `translate3d(${tooltipLeft}px, ${tooltipTop}px, 0)`,
          }}
          className="fixed top-0 left-0 z-40 pointer-events-none w-[272px] bg-[#0b101b] border border-slate-700/90 rounded px-3 py-2.5 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono text-slate-400">
            <span>{hoveredInfo.subsystemLabel}</span>
            <span
              className={
                hoveredInfo.status === 'Active'
                  ? 'text-emerald-400'
                  : hoveredInfo.status === 'Passive'
                    ? 'text-amber-400'
                    : 'text-slate-400'
              }
            >
              {hoveredInfo.status === 'Active'
                ? '● Active'
                : hoveredInfo.status === 'Passive'
                  ? '◆ Passive'
                  : '○ Powered Off'}
            </span>
          </div>
          <div className="mt-1 font-display text-sm font-semibold text-slate-100 leading-snug">
            {hoveredInfo.name}
          </div>
          <div className="mt-1 font-mono tabular-nums text-[11px] text-amber-300/90">
            {hoveredInfo.quickMetric}
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[10.5px] text-slate-400">
            Click to focus and inspect specifications
          </div>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      <ControlDock
        collapsed={dockCollapsed}
        explodeTarget={explodeTarget}
        activeSubsystem={activeSubsystem}
        showOverlays={showOverlays}
        showMissionData={showMissionData}
        showSimLab={showSimLab}
        xrayMode={xrayMode}
        showVectors={showVectors}
        lightingMode={lightingMode}
        autoOrbit={autoOrbit}
        onToggleCollapsed={() => setDockCollapsed((v) => !v)}
        onExplodeChange={setExplodeTarget}
        onToggleExplodeQuick={handleToggleExplodeQuick}
        onSubsystemChange={handleSubsystemChange}
        onToggleOverlays={() => setShowOverlays((v) => !v)}
        onToggleMissionData={handleToggleMissionData}
        onToggleSimLab={handleToggleSimLab}
        onToggleXray={() => setXrayMode((v) => !v)}
        onToggleVectors={() => setShowVectors((v) => !v)}
        onToggleLighting={() =>
          setLightingMode((m) => (m === 'space' ? 'cleanroom' : 'space'))
        }
        onToggleAutoOrbit={() => setAutoOrbit((v) => !v)}
        onResetView={handleResetView}
      />
        </>
      )}
    </main>
  );
}
