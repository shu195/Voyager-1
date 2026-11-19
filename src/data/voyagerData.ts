export type SubsystemId =
  | 'all'
  | 'communications'
  | 'power'
  | 'bus'
  | 'science'
  | 'payload';

export type ComponentId =
  | 'hga'
  | 'subreflector'
  | 'bus'
  | 'propulsion'
  | 'golden_record'
  | 'rtg'
  | 'scan_platform'
  | 'mag_boom'
  | 'pra_pws'
  | 'particles';

export type OperationalStatus = 'Active' | 'Passive' | 'Powered Off';

export interface ComponentSpec {
  label: string;
  value: string;
  unit?: string;
}

export interface VoyagerComponentInfo {
  id: ComponentId;
  shortLabel: string;
  name: string;
  designation: string;
  subsystem: Exclude<SubsystemId, 'all'>;
  subsystemLabel: string;
  status: OperationalStatus;
  quickMetric: string;
  summary: string;
  internalDetail: string;
  scientificContext: string;
  discoveries: string[];
  specs: ComponentSpec[];
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
  chartType: 'rtg_decay' | 'dsn_link' | 'heliopause' | 'power_budget' | 'optics_spectrum';
  hasExplodedInternals: boolean;
}

export const SUBSYSTEM_FILTERS: {
  id: SubsystemId;
  label: string;
  accentHex: string;
}[] = [
  { id: 'all', label: 'All Systems', accentHex: '#f59e0b' },
  { id: 'communications', label: 'Comms', accentHex: '#06b6d4' },
  { id: 'power', label: 'Power & Prop', accentHex: '#f59e0b' },
  { id: 'bus', label: 'Avionics Bus', accentHex: '#38bdf8' },
  { id: 'science', label: 'Science Suite', accentHex: '#10b981' },
  { id: 'payload', label: 'Golden Record', accentHex: '#eab308' },
];

export const VOYAGER_COMPONENTS: Record<ComponentId, VoyagerComponentInfo> = {
  hga: {
    id: 'hga',
    shortLabel: 'HGA 3.7m',
    name: 'High-Gain Parabolic Antenna',
    designation: 'S/X-Band Cassegrain Dish',
    subsystem: 'communications',
    subsystemLabel: 'Communications',
    status: 'Active',
    quickMetric: '3.66 m Ø · 8.415 GHz X-band · 160 bps',
    summary:
      'A 3.66-meter aluminum honeycomb parabolic reflector painted with white thermal-control coating, locked continuously toward Earth to maintain deep-space telemetry across more than 24 billion kilometers.',
    internalDetail:
      'Exploded view separates the composite parabolic dish shell from the 10-strut titanium-aluminum adapter truss and central circular RF waveguide feed horn, revealing the internal concentric choke rings and brass coaxial couplers.',
    scientificContext:
      'Voyager 1 transmits at roughly 22 watts — comparable to a refrigerator bulb. By the time the X-band signal reaches NASA Deep Space Network 70-meter antennas on Earth, the received power is less than 10⁻¹⁶ watts.',
    discoveries: [
      'Enabled Radio Science occultation profiles of Jupiter, Saturn, and Titan atmospheres.',
      'Transmitted the 1990 "Pale Blue Dot" Solar System Family Portrait over 5.5 light-hours.',
      'Sustained interstellar downlink recovery following the 2024 Flight Data Subsystem memory patch.',
    ],
    specs: [
      { label: 'Reflector Diameter', value: '3.66', unit: 'm' },
      { label: 'X-Band Downlink', value: '8.415', unit: 'GHz' },
      { label: 'S-Band Uplink', value: '2.114', unit: 'GHz' },
      { label: 'RF Transmit Power', value: '22.4', unit: 'W' },
      { label: 'Current Bit Rate', value: '160', unit: 'bps' },
      { label: 'Beamwidth (X-Band)', value: '0.5', unit: 'deg' },
    ],
    cameraPos: [3.4, 3.3, 4.4],
    cameraTarget: [0, 1.35, 0],
    chartType: 'dsn_link',
    hasExplodedInternals: true,
  },
  subreflector: {
    id: 'subreflector',
    shortLabel: 'Sub-Reflector',
    name: 'Cassegrain Sub-Reflector & LGA',
    designation: 'Frequency-Selective Secondary Mirror',
    subsystem: 'communications',
    subsystemLabel: 'Communications',
    status: 'Active',
    quickMetric: 'Dichroic S/X surface · Tripod struts · LGA mast',
    summary:
      'Suspended at the focal point of the 3.7m parabolic dish on three low-blockage struts, this frequency-selective sub-reflector bounces X-band waves into the vertex feed horn while remaining transparent to S-band.',
    internalDetail:
      'Separating the tripod assembly in Exploded View reveals the stepped dichroic metallic resonant rings on the underside of the hyperbolic sub-reflector and the coaxial Low-Gain Antenna (LGA) backup mast mounted atop its housing.',
    scientificContext:
      'Dual-frequency S-band and X-band operation allowed Voyager 1 to measure electron densities in planetary ionospheres and interplanetary solar wind plasma by comparing phase delays between the two wavelengths.',
    discoveries: [
      'Measured Titan atmospheric surface pressure (1.45 bar) via dual-band radio occultation.',
      'Detected Saturn ring particle size distributions from forward-scattered X-band signals.',
    ],
    specs: [
      { label: 'Optical Geometry', value: 'Hyperbolic', unit: 'Cassegrain' },
      { label: 'X-Band Gain', value: '48.2', unit: 'dBi' },
      { label: 'S-Band Gain', value: '36.5', unit: 'dBi' },
      { label: 'LGA Coverage', value: 'Hemispherical', unit: 'Backup' },
      { label: 'Strut Mass', value: '6.4', unit: 'kg' },
    ],
    cameraPos: [2.2, 3.1, 2.8],
    cameraTarget: [0, 2.25, 0],
    chartType: 'dsn_link',
    hasExplodedInternals: true,
  },
  bus: {
    id: 'bus',
    shortLabel: '10-Bay Bus',
    name: 'Decagonal Main Bus & Flight Avionics',
    designation: 'CCS · FDS · AACS · 10-Bay Chassis',
    subsystem: 'bus',
    subsystemLabel: 'Avionics Bus',
    status: 'Active',
    quickMetric: '10 electronics bays · 69.6 KB total memory · Louvers',
    summary:
      'A 10-sided structural aluminum ring (1.78m across) housing Voyager 1’s triple-redundant 1970s computers, S/X-band transponders, power regulators, and 8-track digital tape recorder behind passive thermal louvers.',
    internalDetail:
      'Exploded view slides all 10 exterior bay shields and bimetallic thermal louvers radially outward, exposing the internal gold-trace printed circuit boards, plated-wire memory modules, DIP IC logic arrays, and braided Kapton wiring harnesses.',
    scientificContext:
      'Voyager 1 operates with three dual-redundant computer systems (CCS, FDS, AACS) totaling just 69.63 kilobytes of memory — roughly 240,000 times less than a modern smartphone — yet continues autonomous fault protection 49 years after launch.',
    discoveries: [
      'Bimetallic spring thermal louvers autonomously regulated electronics temperature from 1 AU to 166+ AU.',
      'In May 2024, JPL engineers relocated FDS flight code around a corrupted 256-word memory chip from 24 billion km away.',
    ],
    specs: [
      { label: 'Flat-to-Flat Span', value: '1.78', unit: 'm' },
      { label: 'Bus Height', value: '0.47', unit: 'm' },
      { label: 'Total RAM (6 CPUs)', value: '69.63', unit: 'KB' },
      { label: 'Tape Recorder (DTR)', value: '536', unit: 'Mbit' },
      { label: 'Internal Operating Temp', value: '-15 to +20', unit: '°C' },
      { label: 'Structural Mass', value: '295', unit: 'kg' },
    ],
    cameraPos: [2.9, 1.1, 3.1],
    cameraTarget: [0, 0.1, 0],
    chartType: 'power_budget',
    hasExplodedInternals: true,
  },
  propulsion: {
    id: 'propulsion',
    shortLabel: 'Hydrazine Core',
    name: 'Hydrazine Propulsion & Thruster Core',
    designation: 'Spherical Titanium Tank · 16× MR-103 Thrusters',
    subsystem: 'power',
    subsystemLabel: 'Power & Propulsion',
    status: 'Active',
    quickMetric: '0.71 m Ti tank · 16 thrusters · 0.9 N each',
    summary:
      'Nested within the hollow core of the decagonal bus sits a 71 cm titanium sphere containing monopropellant hydrazine (N₂H₄), feeding 16 catalytic thrusters that keep the high-gain dish aimed within 0.1° of Earth.',
    internalDetail:
      'Exploded view drops the aft thermal dome and lowers the gold Kapton-wrapped spherical tank from inside the bus core, revealing the stainless-steel propellant manifold, pressure regulators, and peripheral MR-103 thruster clusters.',
    scientificContext:
      'In 2017, after primary attitude-control thrusters degraded over 40 years of micro-pulses, NASA successfully fired the dormant Trajectory Correction Maneuver (TCM) thrusters for the first time since 1980, extending the mission by years.',
    discoveries: [
      'Executed precision gravity-assist trajectory corrections at Jupiter (1979) and Saturn (1980).',
      'Maintains 3-axis Earth-pointing lock using brief 10-millisecond hydrazine catalyst pulses.',
    ],
    specs: [
      { label: 'Tank Diameter', value: '0.71', unit: 'm' },
      { label: 'Initial Propellant', value: '104.8', unit: 'kg' },
      { label: 'Thruster Count', value: '16', unit: 'units' },
      { label: 'Unit Thrust', value: '0.90', unit: 'N' },
      { label: 'Pointing Precision', value: '0.05', unit: 'deg' },
    ],
    cameraPos: [2.4, -1.35, 2.7],
    cameraTarget: [0, -0.35, 0],
    chartType: 'power_budget',
    hasExplodedInternals: true,
  },
  golden_record: {
    id: 'golden_record',
    shortLabel: 'Golden Record',
    name: 'The Voyager Golden Record',
    designation: '12-Inch Gold-Plated Copper Phonograph Disc',
    subsystem: 'payload',
    subsystemLabel: 'Golden Record',
    status: 'Passive',
    quickMetric: '30 cm Ø · 115 images · 55 languages · 16⅔ RPM',
    summary:
      'Curated by Carl Sagan’s committee and bolted to Bay 10 of the bus, this gold-plated copper LP carries greetings in 55 languages, 115 analog-encoded images, Earth sounds, and 90 minutes of music for interstellar posterity.',
    internalDetail:
      'Exploded view lifts the engraved anodized-aluminum protective cover radially away from the bus wall, revealing the gleaming grooved gold-plated copper phonograph disc, cartridge stylus instructions, and mounting hardware underneath.',
    scientificContext:
      'The cover includes an ultra-pure Uranium-238 radioactive clock sample (half-life 4.468 billion years) allowing any finder to date the spacecraft’s launch, alongside a pulsar map pinpointing the Sun relative to 14 Galactic pulsars.',
    discoveries: [
      'Designed to remain physically legible for over 1 billion years in interstellar vacuum.',
      'Encodes the hydrogen 21-cm spin-flip transition (0.70 ns) as a universal physical time unit.',
    ],
    specs: [
      { label: 'Disc Diameter', value: '30.5', unit: 'cm' },
      { label: 'Substrate', value: 'Au / Cu', unit: 'Gold-plated' },
      { label: 'Playback Speed', value: '16.67', unit: 'RPM' },
      { label: 'Audio Duration', value: '90', unit: 'min' },
      { label: 'Encoded Images', value: '115', unit: 'analog' },
      { label: 'Clock Isotope', value: 'U-238', unit: '4.47 Gyr t½' },
    ],
    cameraPos: [1.65, 0.35, 1.85],
    cameraTarget: [0.58, 0.1, 0.78],
    chartType: 'power_budget',
    hasExplodedInternals: true,
  },
  rtg: {
    id: 'rtg',
    shortLabel: 'MHW-RTG ×3',
    name: 'Multihundred-Watt RTG Power Boom',
    designation: '3× Plutonium-238 Thermoelectric Generators',
    subsystem: 'power',
    subsystemLabel: 'Power & Propulsion',
    status: 'Active',
    quickMetric: '3× MHW-RTG · Pu-238 · ~218 W remaining',
    summary:
      'Three tandem nuclear thermoelectric generators mounted on a deployable boom away from sensitive radiation detectors, converting Plutonium-238 decay heat directly into electrical power via Silicon-Germanium thermocouples.',
    internalDetail:
      'Exploded view splits the black beryllium-finned outer radiator casings apart to reveal the glowing Plutonium-238 oxide fuel spheres (24 spheres per RTG) encased in graphite impact shells and ringed by 312 SiGe thermoelectric unicouples.',
    scientificContext:
      'Because sunlight at 166 AU is 27,500 times weaker than at Earth, solar panels are impossible. Plutonium-238 has an 87.7-year half-life; combined with thermocouple degradation, power drops ~4 W per year, requiring staged instrument shutdowns.',
    discoveries: [
      'Delivered 470 W at launch (1977), enabling continuous operations past Jupiter, Saturn, and the Heliopause.',
      'Expected to sustain core radio telemetry and select particle instruments into the early 2030s.',
    ],
    specs: [
      { label: 'Launch Output (1977)', value: '470', unit: 'W DC' },
      { label: 'Current Output', value: '~218', unit: 'W DC' },
      { label: 'Fuel Isotope', value: 'Pu-238', unit: '87.7 yr t½' },
      { label: 'Thermocouples', value: '936', unit: 'SiGe total' },
      { label: 'Core Temperature', value: '1000', unit: '°C' },
      { label: 'Total RTG Mass', value: '113.1', unit: 'kg' },
    ],
    cameraPos: [-3.9, -0.45, 3.6],
    cameraTarget: [-2.15, -0.75, 0.45],
    chartType: 'rtg_decay',
    hasExplodedInternals: true,
  },
  scan_platform: {
    id: 'scan_platform',
    shortLabel: 'Scan Platform',
    name: 'Articulated Science Scan Platform',
    designation: 'ISS Cameras · IRIS · UVS · PPS',
    subsystem: 'science',
    subsystemLabel: 'Science Suite',
    status: 'Powered Off',
    quickMetric: '2-axis gimbal · 1500mm + 200mm ISS · IRIS · UVS',
    summary:
      'A precision two-axis articulated instrument head at the end of the 2.3m science boom carrying Voyager 1’s narrow/wide-angle vidicon cameras (ISS), infrared spectrometer (IRIS), ultraviolet spectrometer (UVS), and photopolarimeter (PPS).',
    internalDetail:
      'Exploded view slides the optical sun baffles, Cassegrain camera barrels, and IRIS shroud forward to reveal the internal primary/secondary mirrors, selenium-sulfur vidicon detector tubes, and focal-plane electronics boards.',
    scientificContext:
      'The ISS cameras were permanently powered off after capturing the 1990 Pale Blue Dot mosaic to conserve RTG power and computer memory for interstellar fields-and-particles science. UVS operated until 2016.',
    discoveries: [
      'Discovered active sulfur volcanoes on Jupiter’s moon Io — the first active volcanism seen beyond Earth.',
      'Revealed complex braided rings and shepherd moons around Saturn, plus Titan’s dense nitrogen-methane haze.',
      'Captured the iconic "Pale Blue Dot" portrait of Earth from 6.0 billion kilometers away.',
    ],
    specs: [
      { label: 'ISS Narrow Focal Len', value: '1500', unit: 'mm f/8.5' },
      { label: 'ISS Wide Focal Len', value: '200', unit: 'mm f/3.0' },
      { label: 'Vidicon Resolution', value: '800×800', unit: 'px 8-bit' },
      { label: 'IRIS Aperture', value: '50.8', unit: 'cm' },
      { label: 'UVS Spectral Band', value: '50–170', unit: 'nm' },
      { label: 'Boom Span', value: '2.30', unit: 'm' },
    ],
    cameraPos: [4.5, 0.9, 3.3],
    cameraTarget: [2.75, 0.05, 0.35],
    chartType: 'optics_spectrum',
    hasExplodedInternals: true,
  },
  mag_boom: {
    id: 'mag_boom',
    shortLabel: 'MAG 13m Boom',
    name: 'Triaxial Fluxgate Magnetometer Boom',
    designation: '13-Meter Fiberglass Lattice · LFM & HFM',
    subsystem: 'science',
    subsystemLabel: 'Science Suite',
    status: 'Active',
    quickMetric: '13.0 m truss · 0.006 nT sensitivity · Active',
    summary:
      'Voyager 1’s longest appendage: a 13-meter collapsible triangular fiberglass-epoxy mast isolating two Low-Field Magnetometers (LFM) and two High-Field Magnetometers (HFM) from spacecraft magnetic interference.',
    internalDetail:
      'Exploded view detaches the cylindrical boom deployment canister and lifts the fiberglass protective covers off the tip LFM and mid-boom HFM triaxial fluxgate sensor cores.',
    scientificContext:
      'Still actively recording the local interstellar magnetic field today (~0.5 nT), MAG confirmed Voyager 1’s historic August 25, 2012 heliopause crossing when the magnetic field intensity doubled without reversing polarity.',
    discoveries: [
      'Mapped Jupiter’s immense magnetosphere and Io plasma torus electric currents (~5 million amperes).',
      'Confirmed entry into interstellar space by measuring draped interstellar magnetic fields beyond 121.6 AU.',
    ],
    specs: [
      { label: 'Deployed Length', value: '13.0', unit: 'm' },
      { label: 'LFM Sensitivity', value: '0.006', unit: 'nT' },
      { label: 'Dynamic Range', value: '2×10⁻³–2×10⁶', unit: 'nT' },
      { label: 'Boom Mass', value: '2.3', unit: 'kg' },
      { label: 'Current Field Read', value: '~0.48', unit: 'nT' },
    ],
    cameraPos: [-2.2, 2.2, -5.2],
    cameraTarget: [-0.9, -0.45, -3.5],
    chartType: 'heliopause',
    hasExplodedInternals: true,
  },
  pra_pws: {
    id: 'pra_pws',
    shortLabel: 'PRA / PWS Whips',
    name: 'Planetary Radio & Plasma Wave Antennas',
    designation: 'Twin 10-Meter Orthogonal Beryllium-Copper Whips',
    subsystem: 'science',
    subsystemLabel: 'Science Suite',
    status: 'Active',
    quickMetric: '2× 10.0 m whips · 10 Hz – 56 kHz PWS · Active',
    summary:
      'Two 10-meter orthogonal beryllium-copper dipole antennas extending in a 90° V-formation beneath the spacecraft, shared by the Planetary Radio Astronomy (PRA) and active Plasma Wave Subsystem (PWS).',
    internalDetail:
      'Exploded view uncovers the dual spring-driven deployment canisters and impedance-matching preamplifier housings mounted beneath the bus structure.',
    scientificContext:
      'Because Voyager 1’s Plasma Science (PLS) instrument failed in 1980, the Plasma Wave Subsystem (PWS) proved decisive in 2013: solar coronal mass ejections caused local interstellar plasma to ring at 2–3 kHz, directly revealing electron density 40× higher than inside the heliosphere.',
    discoveries: [
      'Provided definitive acoustic-frequency proof that Voyager 1 entered dense interstellar plasma.',
      'Detected lightning whistlers in Jupiter’s atmosphere and Saturn Electrostatic Discharges (SED).',
      'Currently detects persistent faint hum of interstellar plasma gas oscillations.',
    ],
    specs: [
      { label: 'Element Length', value: '10.0', unit: 'm each' },
      { label: 'Opening Angle', value: '90', unit: 'deg' },
      { label: 'PWS Frequency Band', value: '10 Hz–56', unit: 'kHz' },
      { label: 'PRA Band (Retired)', value: '1.2 kHz–40.5', unit: 'MHz' },
      { label: 'Material', value: 'BeCu', unit: 'Alloy tube' },
    ],
    cameraPos: [3.6, -2.5, -3.2],
    cameraTarget: [1.1, -1.9, -0.9],
    chartType: 'heliopause',
    hasExplodedInternals: true,
  },
  particles: {
    id: 'particles',
    shortLabel: 'CRS / LECP / PLS',
    name: 'Charged Particle & Cosmic Ray Suite',
    designation: 'CRS · LECP · PLS Science Boom Sensors',
    subsystem: 'science',
    subsystemLabel: 'Science Suite',
    status: 'Active',
    quickMetric: 'CRS & LECP Active · Galactic cosmic rays · 1–500 MeV',
    summary:
      'Clustered along the rigid science boom, the Cosmic Ray Subsystem (CRS) and Low-Energy Charged Particle (LECP) detector measure high-energy galactic cosmic rays and heliospheric ions, alongside the four Faraday cups of the Plasma Science (PLS) instrument.',
    internalDetail:
      'Exploded view separates the CRS multi-telescope brass collimator array and LECP rotating stepper turret to reveal the stacked silicon solid-state detector wafers and Faraday cup collector grids.',
    scientificContext:
      'On August 25, 2012 at 121.6 AU, CRS and LECP recorded a dramatic cliff-edge drop in solar-origin heliospheric particles alongside a sudden jump in galactic cosmic rays — marking humanity’s first in-situ crossing into interstellar space.',
    discoveries: [
      'Directly detected the Termination Shock (94 AU, Dec 2004) and Heliopause (121.6 AU, Aug 2012).',
      'Measures pristine low-energy galactic cosmic rays that are deflected away from Earth by the Sun’s magnetic field.',
    ],
    specs: [
      { label: 'CRS Energy Range', value: '0.5–500', unit: 'MeV/nuc' },
      { label: 'LECP Step Sectors', value: '8', unit: 'azimuthal' },
      { label: 'CRS Power Draw', value: '5.4', unit: 'W' },
      { label: 'LECP Power Draw', value: '3.8', unit: 'W' },
      { label: 'Status (CRS / LECP)', value: 'Active', unit: 'PLS Off' },
    ],
    cameraPos: [3.2, 1.35, 2.55],
    cameraTarget: [1.5, 0.15, 0.2],
    chartType: 'heliopause',
    hasExplodedInternals: true,
  },
};

export const COMPONENT_LIST: VoyagerComponentInfo[] = Object.values(VOYAGER_COMPONENTS);

export interface LiveEphemeris {
  missionYears: number;
  distanceAU: number;
  distanceKmBillion: number;
  oneWayLightHours: number;
  oneWayLightMinutes: number;
  heliocentricVelocityKmS: number;
  estimatedRtgWatts: number;
  activeInstruments: number;
}

/**
 * Computes physically grounded Voyager 1 interstellar ephemeris from JPL reference epoch:
 * Anchor: Jan 1, 2025 00:00 UTC -> 166.15 AU from Sun, velocity 16.999 km/s (~3.586 AU/year).
 * Launch: Sept 5, 1977 12:56 UTC.
 * RTG Power: 470 W at launch, decaying ~0.79%/yr (Pu-238 half-life 87.7 yr + thermocouple aging).
 */
export function computeVoyagerEphemeris(nowMs: number = Date.now()): LiveEphemeris {
  const launchMs = Date.UTC(1977, 8, 5, 12, 56, 0);
  const anchor2025Ms = Date.UTC(2025, 0, 1, 0, 0, 0);
  const msPerYear = 365.25 * 24 * 3600 * 1000;

  const missionYears = Math.max(47, (nowMs - launchMs) / msPerYear);
  const yearsSince2025 = (nowMs - anchor2025Ms) / msPerYear;

  const velocityKmS = 16.999; // JPL heliocentric asymptotic escape speed
  const auPerYear = (velocityKmS * 365.25 * 86400) / 149_597_870.7; // ~3.586 AU/yr
  const distanceAU = 166.15 + yearsSince2025 * auPerYear;
  const distanceKm = distanceAU * 149_597_870.7;
  const distanceKmBillion = distanceKm / 1e9;

  const lightSeconds = distanceKm / 299_792.458;
  const oneWayLightHours = Math.floor(lightSeconds / 3600);
  const oneWayLightMinutes = Math.floor((lightSeconds % 3600) / 60);

  // Calibrated MHW-RTG decay curve: 470W in 1977 -> ~224W in 2025 -> ~217W in late 2026
  const estimatedRtgWatts = 470 * Math.pow(0.5, missionYears / 87.7) * Math.exp(-0.0079 * missionYears);

  return {
    missionYears,
    distanceAU,
    distanceKmBillion,
    oneWayLightHours,
    oneWayLightMinutes,
    heliocentricVelocityKmS: velocityKmS,
    estimatedRtgWatts,
    activeInstruments: 4, // MAG, PWS, CRS, LECP (4 active science instruments)
  };
}

// ---------------------------------------------------------------------------
// MISSION TIMELINE EPOCHS (1977 -> Present)
// ---------------------------------------------------------------------------
export interface MissionEpoch {
  id: string;
  year: number;
  dateLabel: string;
  title: string;
  distanceAU: number;
  rtgWatts: number;
  solarIntensityNorm: number; // 1.0 = harsh inner solar system, 0.18 = interstellar starlight
  region: string;
  summary: string;
  activeIds: string[];
}

export const MISSION_EPOCHS: MissionEpoch[] = [
  {
    id: 'launch',
    year: 1977,
    dateLabel: 'Sep 5, 1977',
    title: 'Launch & Earth Departure',
    distanceAU: 1.0,
    rtgWatts: 470,
    solarIntensityNorm: 1.0,
    region: 'Inner Solar System',
    summary:
      'Launched atop Titan IIIE-Centaur from Cape Canaveral. Full 470 W RTG power with all 10 science instruments energized.',
    activeIds: ['iss', 'iris', 'uvs', 'pps', 'mag', 'crs', 'lecp', 'pls', 'pws', 'heaters'],
  },
  {
    id: 'jupiter',
    year: 1979,
    dateLabel: 'Mar 5, 1979',
    title: 'Jupiter Flyby & Io Volcanoes',
    distanceAU: 5.2,
    rtgWatts: 444,
    solarIntensityNorm: 0.78,
    region: 'Jovian System',
    summary:
      'Closest approach at 349,000 km. Discovered active volcanism on Io, faint Jovian rings, and a 5-million-ampere plasma torus.',
    activeIds: ['iss', 'iris', 'uvs', 'pps', 'mag', 'crs', 'lecp', 'pls', 'pws', 'heaters'],
  },
  {
    id: 'saturn',
    year: 1980,
    dateLabel: 'Nov 12, 1980',
    title: 'Saturn & Titan Flyby',
    distanceAU: 9.5,
    rtgWatts: 428,
    solarIntensityNorm: 0.62,
    region: 'Saturnian System',
    summary:
      'Close Titan flyby diverted Voyager 1 35° north of the ecliptic plane. Revealed braided F-ring shepherds and Titan’s dense nitrogen haze.',
    activeIds: ['iss', 'iris', 'uvs', 'mag', 'crs', 'lecp', 'pws', 'heaters'],
  },
  {
    id: 'pbd',
    year: 1990,
    dateLabel: 'Feb 14, 1990',
    title: 'Pale Blue Dot Portrait',
    distanceAU: 40.5,
    rtgWatts: 365,
    solarIntensityNorm: 0.4,
    region: 'Outer Heliosphere',
    summary:
      'Turned the ISS Narrow-Angle camera back toward Earth from 6 billion km to capture the Family Portrait before powering off the cameras forever.',
    activeIds: ['uvs', 'mag', 'crs', 'lecp', 'pws', 'heaters'],
  },
  {
    id: 'shock',
    year: 2004,
    dateLabel: 'Dec 16, 2004',
    title: 'Termination Shock Crossing',
    distanceAU: 94.0,
    rtgWatts: 298,
    solarIntensityNorm: 0.28,
    region: 'Heliosheath',
    summary:
      'Entered the turbulent heliosheath where the supersonic solar wind abruptly slowed as it collided with the interstellar medium.',
    activeIds: ['uvs', 'mag', 'crs', 'lecp', 'pws', 'heaters'],
  },
  {
    id: 'heliopause',
    year: 2012,
    dateLabel: 'Aug 25, 2012',
    title: 'Heliopause & Interstellar Entry',
    distanceAU: 121.6,
    rtgWatts: 267,
    solarIntensityNorm: 0.22,
    region: 'Local Interstellar Medium',
    summary:
      'Humanity’s first spacecraft to cross the heliopause. CRS & LECP saw solar particles vanish while galactic cosmic rays surged.',
    activeIds: ['uvs', 'mag', 'crs', 'lecp', 'pws', 'heaters'],
  },
  {
    id: 'present',
    year: 2026,
    dateLabel: 'Present Epoch',
    title: 'Deep Interstellar Cruising',
    distanceAU: 169.5,
    rtgWatts: 218,
    solarIntensityNorm: 0.16,
    region: 'Interstellar Space',
    summary:
      'Operating on ~218 W with 4 active fields-and-particles instruments (MAG, PWS, CRS, LECP) and carefully managed bus/propulsion heaters.',
    activeIds: ['mag', 'crs', 'lecp', 'pws', 'heaters'],
  },
];

export interface InterpolatedEpochState {
  year: number;
  distanceAU: number;
  rtgWatts: number;
  solarIntensityNorm: number;
  oneWayLightHours: number;
  oneWayLightMinutes: number;
  nearestEpoch: MissionEpoch;
}

export function interpolateMissionYear(year: number): InterpolatedEpochState {
  const clamped = Math.min(2026, Math.max(1977, year));
  let lower = MISSION_EPOCHS[0];
  let upper = MISSION_EPOCHS[MISSION_EPOCHS.length - 1];

  for (let i = 0; i < MISSION_EPOCHS.length - 1; i++) {
    if (clamped >= MISSION_EPOCHS[i].year && clamped <= MISSION_EPOCHS[i + 1].year) {
      lower = MISSION_EPOCHS[i];
      upper = MISSION_EPOCHS[i + 1];
      break;
    }
  }

  const span = Math.max(0.0001, upper.year - lower.year);
  const t = Math.min(1, Math.max(0, (clamped - lower.year) / span));

  const distanceAU = lower.distanceAU + (upper.distanceAU - lower.distanceAU) * t;
  const rtgWatts = lower.rtgWatts + (upper.rtgWatts - lower.rtgWatts) * t;
  const solarIntensityNorm =
    lower.solarIntensityNorm + (upper.solarIntensityNorm - lower.solarIntensityNorm) * t;

  const lightSeconds = (distanceAU * 149_597_870.7) / 299_792.458;
  const oneWayLightHours = Math.floor(lightSeconds / 3600);
  const oneWayLightMinutes = Math.floor((lightSeconds % 3600) / 60);

  let nearestEpoch = lower;
  let bestDist = Infinity;
  for (const ep of MISSION_EPOCHS) {
    const d = Math.abs(ep.year - clamped);
    if (d < bestDist) {
      bestDist = d;
      nearestEpoch = ep;
    }
  }

  return {
    year: clamped,
    distanceAU,
    rtgWatts,
    solarIntensityNorm,
    oneWayLightHours,
    oneWayLightMinutes,
    nearestEpoch,
  };
}

// ---------------------------------------------------------------------------
// LIVE POWER-SHEDDING & THERMAL LOAD SIMULATOR
// ---------------------------------------------------------------------------
export interface PowerLoadItem {
  id: string;
  label: string;
  subsystem: string;
  watts: number;
  heatContributionC: number;
  componentId: ComponentId;
  essential?: boolean;
  note: string;
}

export const CORE_AVIONICS_BASELINE_WATTS = 166; // CCS, FDS, AACS, S/X-Band TWTA, Power Reg

export const POWER_LOAD_ITEMS: PowerLoadItem[] = [
  {
    id: 'heaters',
    label: 'Propulsion & Bus Heaters',
    subsystem: 'Thermal',
    watts: 26.0,
    heatContributionC: 18,
    componentId: 'propulsion',
    note: 'Prevents hydrazine lines from freezing below +2 °C.',
  },
  {
    id: 'mag',
    label: 'MAG Fluxgate Boom',
    subsystem: 'Science',
    watts: 2.2,
    heatContributionC: 1.5,
    componentId: 'mag_boom',
    note: 'Active interstellar magnetic field sensor (~0.48 nT).',
  },
  {
    id: 'pws',
    label: 'PWS Plasma Wave',
    subsystem: 'Science',
    watts: 1.6,
    heatContributionC: 1.0,
    componentId: 'pra_pws',
    note: 'Active 10 Hz–56 kHz interstellar plasma oscillation receiver.',
  },
  {
    id: 'crs',
    label: 'CRS Cosmic Ray',
    subsystem: 'Science',
    watts: 5.4,
    heatContributionC: 3.5,
    componentId: 'particles',
    note: 'Active 7-telescope galactic cosmic-ray detector.',
  },
  {
    id: 'lecp',
    label: 'LECP Particle Stepper',
    subsystem: 'Science',
    watts: 3.8,
    heatContributionC: 2.5,
    componentId: 'particles',
    note: 'Active rotating low-energy charged particle detector.',
  },
  {
    id: 'iss',
    label: 'ISS Vidicon Cameras',
    subsystem: 'Optics',
    watts: 21.5,
    heatContributionC: 11,
    componentId: 'scan_platform',
    note: 'Narrow + wide cameras (powered off Feb 1990 after Pale Blue Dot).',
  },
  {
    id: 'iris',
    label: 'IRIS IR Spectrometer',
    subsystem: 'Optics',
    watts: 12.0,
    heatContributionC: 7,
    componentId: 'scan_platform',
    note: '50cm infrared interferometer (retired Jun 1998).',
  },
  {
    id: 'uvs',
    label: 'UVS UV Spectrometer',
    subsystem: 'Optics',
    watts: 2.4,
    heatContributionC: 2,
    componentId: 'scan_platform',
    note: 'Extreme-UV spectrometer (powered off Apr 2016).',
  },
  {
    id: 'pls',
    label: 'PLS Plasma Faraday Cups',
    subsystem: 'Science',
    watts: 8.1,
    heatContributionC: 4,
    componentId: 'particles',
    note: 'Failed shortly after Saturn encounter (Nov 1980).',
  },
];

// ---------------------------------------------------------------------------
// GOLDEN RECORD COVER DIAGRAM DECODER HOTSPOTS
// ---------------------------------------------------------------------------
export interface GoldenRecordSymbol {
  id: string;
  title: string;
  quadrant: string;
  xPct: number;
  yPct: number;
  rPct: number;
  physicalUnit: string;
  meaning: string;
  howToDecode: string;
}

export const GOLDEN_RECORD_SYMBOLS: GoldenRecordSymbol[] = [
  {
    id: 'disc_speed',
    title: 'Phonograph Disc & Stylus',
    quadrant: 'Upper Left',
    xPct: 32.7,
    yPct: 29.3,
    rPct: 16.5,
    physicalUnit: '3.6 s / rev (16⅔ RPM)',
    meaning:
      'Top-down view of the Golden Record with the included phonograph cartridge stylus placed at the outer lead-in groove.',
    howToDecode:
      'Binary dashes around the circumference encode 5,100,000,000 × 0.70 ns = 3.6 seconds per rotation (16⅔ RPM) — half normal LP speed to fit 90 minutes of audio.',
  },
  {
    id: 'side_profile',
    title: 'Cartridge Elevation & Side Profile',
    quadrant: 'Mid Left',
    xPct: 32.7,
    yPct: 48.0,
    rPct: 11.5,
    physicalUnit: '~1 hour / side',
    meaning:
      'Cross-sectional view showing the disc thickness, the stylus resting vertically on the groove, and binary total playtime underneath.',
    howToDecode:
      'Indicates the grooves must be played from the outside edge inward, with the cartridge stylus mounted in the recess directly below the cover.',
  },
  {
    id: 'video_waveform',
    title: 'Analog Video Signal & Scan Raster',
    quadrant: 'Upper Right',
    xPct: 67.0,
    yPct: 33.5,
    rPct: 14.5,
    physicalUnit: '512 vertical lines · 8 ms/line',
    meaning:
      'Shows the shape of an analog video scanline waveform and how sequential vertical scanlines interlock to form a 2D picture.',
    howToDecode:
      'Each image is encoded as 512 vertical audio-frequency traces (8.3 ms each). Sync pulses mark line starts; amplitude encodes pixel luminance.',
  },
  {
    id: 'first_circle',
    title: 'Calibration Circle (Image #1)',
    quadrant: 'Center Right',
    xPct: 66.8,
    yPct: 50.2,
    rPct: 9.0,
    physicalUnit: 'Aspect Ratio 4:3',
    meaning:
      'The very first decoded video frame stored on the record is a pure geometric circle inside a rectangle.',
    howToDecode:
      'Allows an extraterrestrial receiver to verify their horizontal/vertical scan aspect ratio and timing: if the decoded shape is circular, the remaining 114 Earth images will render distortion-free.',
  },
  {
    id: 'pulsar_map',
    title: '14-Pulsar Galactic Map',
    quadrant: 'Lower Left',
    xPct: 33.0,
    yPct: 69.5,
    rPct: 15.5,
    physicalUnit: 'Binary period ticks (0.70 ns units)',
    meaning:
      'Pinpoints the 3D position of our Sun relative to 14 rapidly spinning Milky Way neutron stars (pulsars) and the Galactic Center.',
    howToDecode:
      'Each radial line gives the direction and relative distance to a pulsar; perpendicular binary tick marks encode its unique spin period in 1977, letting astronomers triangulate both our home star and launch era.',
  },
  {
    id: 'u238_clock',
    title: 'Uranium-238 Radioactive Clock',
    quadrant: 'Bottom Left Edge',
    xPct: 20.5,
    yPct: 75.2,
    rPct: 6.2,
    physicalUnit: 't½ = 4.468 × 10⁹ years',
    meaning:
      'A 2 cm electroplated spot of ultra-pure Uranium-238 bonded directly onto the aluminum cover.',
    howToDecode:
      'By measuring the ratio of remaining U-238 to its daughter decay products (lead-206 / thorium), any finder can calculate how many millions or billions of years Voyager 1 has traveled.',
  },
  {
    id: 'hydrogen_flip',
    title: 'Hydrogen Hyperfine Transition',
    quadrant: 'Lower Right',
    xPct: 68.5,
    yPct: 72.0,
    rPct: 12.5,
    physicalUnit: 'λ = 21.1 cm · T = 0.704 ns',
    meaning:
      'Two hydrogen atoms showing the parallel-to-antiparallel electron spin-flip transition — the most abundant atomic transition in the universe.',
    howToDecode:
      'The vertical bar underneath defines the fundamental binary unit "1" = 0.704 nanoseconds (1420.4 MHz). Every binary time interval on the cover is expressed as a multiple of this universal constant.',
  },
];

