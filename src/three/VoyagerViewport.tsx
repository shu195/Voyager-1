import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  COMPONENT_LIST,
  ComponentId,
  SubsystemId,
} from '../data/voyagerData';
import { buildVoyagerModel, BuiltVoyagerModel } from './buildVoyagerModel';
import { createProceduralTextureSet } from './proceduralTextures';

export type LightingMode = 'space' | 'cleanroom';

export interface HoverInfo {
  componentId: ComponentId;
  screenX: number;
  screenY: number;
}

export interface CameraRequest {
  position: [number, number, number];
  target: [number, number, number];
  nonce: number;
}

interface VoyagerViewportProps {
  explodeTarget: number;
  activeSubsystem: SubsystemId;
  selectedComponent: ComponentId | null;
  hoveredComponent: ComponentId | null;
  showOverlays: boolean;
  lightingMode: LightingMode;
  autoOrbit: boolean;
  xrayMode: boolean;
  cutawayDepth: number;
  showVectors: boolean;
  bloomEnabled: boolean;
  scanAzimuth: number;
  scanElevation: number;
  louverOpenness: number;
  thrusterPulseNonce: number;
  solarIntensityNorm: number;
  cameraRequest: CameraRequest | null;
  onSelectComponent: (id: ComponentId | null) => void;
  onHoverChange: (info: HoverInfo | null) => void;
}

const DEFAULT_CAM_POS = new THREE.Vector3(5.6, 3.1, 6.4);
const DEFAULT_CAM_TARGET = new THREE.Vector3(0.05, 0.25, -0.35);

const VECTOR_LABELS = [
  {
    id: 'dsn',
    label: 'Earth · DSN X-Band (8.4 GHz)',
    tone: 'text-cyan-300 border-cyan-500/60',
    pos: new THREE.Vector3(0, 5.75, 0),
  },
  {
    id: 'sun',
    label: 'Solar Direction · Sun',
    tone: 'text-amber-300 border-amber-500/60',
    pos: new THREE.Vector3(3.05, 2.78, 2.48),
  },
  {
    id: 'vel',
    label: 'Interstellar Velocity · 17.0 km/s',
    tone: 'text-emerald-300 border-emerald-500/60',
    pos: new THREE.Vector3(-1.58, -3.55, 2.08),
  },
];

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createStarfield(starSpriteMap: THREE.Texture): THREE.Points {
  const count = 2600;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  let seed = 19770905;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < count; i++) {
    const u = rand();
    const v = rand();
    const theta = u * Math.PI * 2;
    const isBand = rand() < 0.35;
    const phi = isBand
      ? Math.PI / 2 + (rand() - 0.5) * 0.42
      : Math.acos(2 * v - 1);
    const radius = 58 + rand() * 38;

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

    // Authentic blackbody star tints (O/B cool white, G white, K/M warm gold)
    const spec = rand();
    if (spec < 0.22) {
      color.setRGB(0.76, 0.87, 1.0);
    } else if (spec < 0.7) {
      color.setRGB(0.97, 0.98, 1.0);
    } else if (spec < 0.9) {
      color.setRGB(1.0, 0.93, 0.72);
    } else {
      color.setRGB(1.0, 0.8, 0.52);
    }
    const brightness = 0.28 + Math.pow(rand(), 1.6) * 0.72;
    colors[i * 3] = color.r * brightness;
    colors[i * 3 + 1] = color.g * brightness;
    colors[i * 3 + 2] = color.b * brightness;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.48,
    map: starSpriteMap,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geo, mat);
}

// Module-scoped reusable vectors (zero GC in render loop)
const _projVec = new THREE.Vector3();
const _rayMouse = new THREE.Vector2();
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();

export const VoyagerViewport: React.FC<VoyagerViewportProps> = ({
  explodeTarget,
  activeSubsystem,
  selectedComponent,
  hoveredComponent,
  showOverlays,
  lightingMode,
  autoOrbit,
  xrayMode,
  cutawayDepth,
  showVectors,
  bloomEnabled,
  scanAzimuth,
  scanElevation,
  louverOpenness,
  thrusterPulseNonce,
  solarIntensityNorm,
  cameraRequest,
  onSelectComponent,
  onHoverChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const pinRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const vectorLabelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [webglError, setWebglError] = useState<string | null>(null);

  // Store mutable React props in refs so WebGL lifecycle never tears down on UI updates
  const propsRef = useRef({
    explodeTarget,
    activeSubsystem,
    selectedComponent,
    hoveredComponent,
    showOverlays,
    lightingMode,
    autoOrbit,
    xrayMode,
    cutawayDepth,
    showVectors,
    bloomEnabled,
    scanAzimuth,
    scanElevation,
    louverOpenness,
    solarIntensityNorm,
    onSelectComponent,
    onHoverChange,
  });
  propsRef.current = {
    explodeTarget,
    activeSubsystem,
    selectedComponent,
    hoveredComponent,
    showOverlays,
    lightingMode,
    autoOrbit,
    xrayMode,
    cutawayDepth,
    showVectors,
    bloomEnabled,
    scanAzimuth,
    scanElevation,
    louverOpenness,
    solarIntensityNorm,
    onSelectComponent,
    onHoverChange,
  };

  // Expose imperatively triggered render & hardware state setters
  const engineRef = useRef<{
    requestRender: () => void;
    setCameraGoal: (pos: [number, number, number], target: [number, number, number]) => void;
    applyLighting: (mode: LightingMode, solarNorm: number) => void;
    applyHighlights: () => void;
    applyHardwareControls: () => void;
    triggerThrusterPulse: () => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglError('WebGL2 hardware or software context is unavailable in this browser.');
      return;
    }

    const initWidth = container.clientWidth || window.innerWidth;
    const initHeight = container.clientHeight || window.innerHeight;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(initWidth, initHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020306);
    scene.fog = null;

    const camera = new THREE.PerspectiveCamera(42, initWidth / initHeight, 0.08, 180);
    camera.position.copy(DEFAULT_CAM_POS);

    // GPU-only Selective Specular Bloom Post-Processing
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer);
      composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      composer.setSize(initWidth, initHeight);
      const renderPass = new RenderPass(scene, camera);
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(initWidth, initHeight),
        0.14, // subtle physical bloom strength
        0.32, // tight optical radius
        1.08, // high threshold so only genuine emissives & sharp glints bloom
      );
      const outputPass = new OutputPass();
      composer.addPass(renderPass);
      composer.addPass(bloomPass);
      composer.addPass(outputPass);
    }

    // Subtle Studio Environment Reflections for PBR Black MLI, Brushed Aluminum & Golden Record
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.52;
    pmremGenerator.dispose();

    // High-contrast Space Solar Key + Subtle Galactic Rim Rig (sculpts crinkled MLI & louvers)
    const keyLight = new THREE.DirectionalLight(0xfff6e8, 3.25);
    keyLight.position.set(11, 8, 9);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 32;
    const d = 6.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const hemiFill = new THREE.HemisphereLight(0x8bb6ef, 0x0c101a, 0.48);
    scene.add(hemiFill);

    const rimLight = new THREE.DirectionalLight(0x8cc6ff, 0.95);
    rimLight.position.set(-10, -5, -10);
    scene.add(rimLight);

    // Subtle studio fill highlight panel (GPU only; skipped on software WebGL)
    let softboxLight: THREE.RectAreaLight | null = null;
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      softboxLight = new THREE.RectAreaLight(0xfffaf0, 0.78, 6, 3);
      softboxLight.position.set(4.5, 4.2, 5.5);
      softboxLight.lookAt(0, 0.2, 0);
      scene.add(softboxLight);
    }

    // Subtle interior fill point light positioned inside bus so internal PCBs gleam when exploded
    const interiorFill = new THREE.PointLight(0xffdfb0, 0.9, 5.5, 2);
    interiorFill.position.set(0, 0.15, 0);
    scene.add(interiorFill);

    // Procedural Textures & Hyper-Realistic Voyager 1 Assembly
    const textures = createProceduralTextureSet(renderer.capabilities.getMaxAnisotropy());
    const voyager: BuiltVoyagerModel = buildVoyagerModel(textures, isSoftwareGl);
    scene.add(voyager.root);

    // Procedural Deep-Space Spectral Starfield + Distant Sun Star Point
    const starfield = createStarfield(textures.starSpriteMap);
    scene.add(starfield);

    const distantSunGeo = new THREE.SphereGeometry(0.28, 16, 12);
    const distantSunMat = new THREE.MeshBasicMaterial({ color: 0xfff7e2 });
    const distantSun = new THREE.Mesh(distantSunGeo, distantSunMat);
    distantSun.position.set(42, 36, 34);
    scene.add(distantSun);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(DEFAULT_CAM_TARGET);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 0.85;
    controls.maxDistance = 24;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.55;
    controls.update();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Internal transition & coalesced on-demand rendering state
    let currentExplode = propsRef.current.explodeTarget;
    let currentLouver = propsRef.current.louverOpenness;
    let currentAz = propsRef.current.scanAzimuth;
    let currentEl = propsRef.current.scanElevation;
    let thrusterPulseEndMs = 0;
    let hasCameraGoal = false;
    let isDisposed = false;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTimestamp = performance.now();

    // Pre-allocated screen-space label collision solver buffer (zero per-frame allocations)
    type PinSlot = {
      el: HTMLButtonElement;
      x: number;
      y: number;
      w: number;
      h: number;
      selected: boolean;
    };
    const visiblePins: PinSlot[] = [];

    const updateProjectedPins = () => {
      const show = propsRef.current.showOverlays;
      const showVec = propsRef.current.showVectors;
      const activeSub = propsRef.current.activeSubsystem;
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      voyager.root.updateMatrixWorld(true);
      camera.updateMatrixWorld();

      visiblePins.length = 0;

      for (let i = 0; i < COMPONENT_LIST.length; i++) {
        const comp = COMPONENT_LIST[i];
        const el = pinRefs.current[comp.id];
        if (!el) continue;

        const matchesSub = activeSub === 'all' || comp.subsystem === activeSub;
        const isSelected = propsRef.current.selectedComponent === comp.id;

        if (!show || (!matchesSub && !isSelected)) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }

        const anchor = voyager.anchors[comp.id];
        if (!anchor) continue;

        anchor.getWorldPosition(_projVec);
        _projVec.project(camera);

        const inFront = _projVec.z < 1 && _projVec.z > -1;
        const sx = (_projVec.x * 0.5 + 0.5) * width;
        const sy = (-_projVec.y * 0.5 + 0.5) * height;
        const onScreen = inFront && sx > 28 && sx < width - 28 && sy > 58 && sy < height - 110;

        if (!onScreen) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
        } else {
          visiblePins.push({
            el,
            x: sx,
            y: sy,
            w: el.offsetWidth || 110,
            h: el.offsetHeight || 42,
            selected: isSelected,
          });
        }
      }

      // Iterative 2D AABB repulsion pass so floating callouts never collide at any camera angle
      const padX = 8;
      const padY = 6;
      const n = visiblePins.length;
      for (let iter = 0; iter < 8; iter++) {
        let moved = false;
        for (let i = 0; i < n; i++) {
          const a = visiblePins[i];
          for (let j = i + 1; j < n; j++) {
            const b = visiblePins[j];
            const halfW = (a.w + b.w) * 0.5 + padX;
            const halfH = (a.h + b.h) * 0.5 + padY;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const ox = halfW - Math.abs(dx);
            const oy = halfH - Math.abs(dy);
            if (ox > 0 && oy > 0) {
              moved = true;
              const wa = a.selected ? 0.15 : 0.5;
              const wb = b.selected ? 0.15 : 0.5;
              const norm = wa + wb;
              if (oy <= ox * 1.35) {
                const dir = dy >= 0 ? 1 : -1;
                a.y -= dir * oy * (wa / norm);
                b.y += dir * oy * (wb / norm);
              } else {
                const dir = dx >= 0 ? 1 : -1;
                a.x -= dir * ox * (wa / norm);
                b.x += dir * ox * (wb / norm);
              }
            }
          }
        }
        if (!moved) break;
      }

      for (let i = 0; i < n; i++) {
        const p = visiblePins[i];
        const cx = Math.min(width - p.w * 0.5 - 12, Math.max(p.w * 0.5 + 12, p.x));
        const cy = Math.min(height - 108, Math.max(p.h + 52, p.y));
        p.el.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) translate(-50%, -100%)`;
        p.el.style.opacity = '1';
        p.el.style.pointerEvents = 'auto';
      }

      // Project 3D reference vector endpoint tags when Vectors mode is active
      for (let i = 0; i < VECTOR_LABELS.length; i++) {
        const item = VECTOR_LABELS[i];
        const el = vectorLabelRefs.current[item.id];
        if (!el) continue;

        if (!showVec) {
          el.style.opacity = '0';
          continue;
        }

        _projVec.copy(item.pos).applyMatrix4(voyager.root.matrixWorld).project(camera);
        const inFront = _projVec.z < 1 && _projVec.z > -1;
        const sx = (_projVec.x * 0.5 + 0.5) * width;
        const sy = (-_projVec.y * 0.5 + 0.5) * height;
        const onScreen = inFront && sx > 24 && sx < width - 24 && sy > 48 && sy < height - 96;

        if (!onScreen) {
          el.style.opacity = '0';
        } else {
          el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
          el.style.opacity = '1';
        }
      }
    };

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (isDisposed) {
          gl.deleteSync(sync);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const requestRender = () => {
      if (isDisposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        if (isDisposed) return;
        renderDirty = false;

        const dt = Math.min(0.05, Math.max(0.001, (now - lastTimestamp) / 1000));
        lastTimestamp = now;

        let needsAnotherFrame = false;

        // 1. Smoothly damp exploded-view separation
        const targetExplode = propsRef.current.explodeTarget;
        if (Math.abs(currentExplode - targetExplode) > 0.0008) {
          currentExplode = isSoftwareGl
            ? targetExplode
            : THREE.MathUtils.damp(currentExplode, targetExplode, 7.5, dt);
          voyager.updateExplode(currentExplode);
          needsAnotherFrame = Math.abs(currentExplode - targetExplode) > 0.0008;
        } else if (currentExplode !== targetExplode) {
          currentExplode = targetExplode;
          voyager.updateExplode(currentExplode);
        }

        // 2. Smoothly damp thermal louver openness & scan platform articulation
        const targetLouver = propsRef.current.louverOpenness;
        if (Math.abs(currentLouver - targetLouver) > 0.002) {
          currentLouver = isSoftwareGl
            ? targetLouver
            : THREE.MathUtils.damp(currentLouver, targetLouver, 8.0, dt);
          voyager.setLouverOpenness(currentLouver);
          needsAnotherFrame = true;
        } else if (currentLouver !== targetLouver) {
          currentLouver = targetLouver;
          voyager.setLouverOpenness(currentLouver);
        }

        const targetAz = propsRef.current.scanAzimuth;
        const targetEl = propsRef.current.scanElevation;
        if (Math.abs(currentAz - targetAz) > 0.08 || Math.abs(currentEl - targetEl) > 0.08) {
          currentAz = isSoftwareGl ? targetAz : THREE.MathUtils.damp(currentAz, targetAz, 8.5, dt);
          currentEl = isSoftwareGl ? targetEl : THREE.MathUtils.damp(currentEl, targetEl, 8.5, dt);
          voyager.setScanAngles(currentAz, currentEl);
          needsAnotherFrame = true;
        } else if (currentAz !== targetAz || currentEl !== targetEl) {
          currentAz = targetAz;
          currentEl = targetEl;
          voyager.setScanAngles(currentAz, currentEl);
        }

        // 3. Hydrazine MR-103 catalytic thruster pulse burst (1.35s duration)
        if (thrusterPulseEndMs > now) {
          const remaining = (thrusterPulseEndMs - now) / 1350;
          // Crisp rapid catalytic ignition + multi-pulse attitude flutter
          const envelope = Math.sin(Math.min(1, remaining) * Math.PI);
          const flutter = 0.72 + 0.28 * Math.sin(now * 0.042);
          voyager.setThrusterPulse(Math.max(0.05, envelope * flutter));
          needsAnotherFrame = true;
        } else if (thrusterPulseEndMs > 0) {
          thrusterPulseEndMs = 0;
          voyager.setThrusterPulse(0);
        }

        // 4. Smoothly damp camera focus preset transitions
        if (hasCameraGoal) {
          if (isSoftwareGl) {
            camera.position.copy(_camGoalPos);
            controls.target.copy(_camGoalTarget);
            hasCameraGoal = false;
          } else {
            camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoalPos.x, 6.2, dt);
            camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoalPos.y, 6.2, dt);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoalPos.z, 6.2, dt);
            controls.target.x = THREE.MathUtils.damp(controls.target.x, _camGoalTarget.x, 6.2, dt);
            controls.target.y = THREE.MathUtils.damp(controls.target.y, _camGoalTarget.y, 6.2, dt);
            controls.target.z = THREE.MathUtils.damp(controls.target.z, _camGoalTarget.z, 6.2, dt);

            const posDist = camera.position.distanceTo(_camGoalPos);
            const tgtDist = controls.target.distanceTo(_camGoalTarget);
            if (posDist < 0.015 && tgtDist < 0.015) {
              camera.position.copy(_camGoalPos);
              controls.target.copy(_camGoalTarget);
              hasCameraGoal = false;
            } else {
              needsAnotherFrame = true;
            }
          }
        }

        // 5. Auto-orbit (disabled on software WebGL per performance directive)
        const shouldAutoRotate = propsRef.current.autoOrbit && !isSoftwareGl && !hasCameraGoal;
        controls.autoRotate = shouldAutoRotate;
        if (shouldAutoRotate) {
          needsAnotherFrame = true;
        }

        const didOrbitMove = controls.update();
        if (didOrbitMove && controls.enableDamping) {
          needsAnotherFrame = true;
        }

        // Gentle authentic micro-slew on LECP stepper & AACS gyro rotors during motion
        if (shouldAutoRotate) {
          voyager.lecpTurretGroup.rotation.y = Math.sin(now * 0.0005) * 0.45;
        }
        if ((shouldAutoRotate || currentExplode > 0.25 || propsRef.current.xrayMode) && !isSoftwareGl) {
          for (let i = 0; i < voyager.gyroRotors.length; i++) {
            voyager.gyroRotors[i].rotation.y += dt * (4.2 + i * 0.9);
          }
        }

        if (composer && !isSoftwareGl && propsRef.current.bloomEnabled) {
          composer.render();
        } else {
          renderer.render(scene, camera);
        }
        updateProjectedPins();

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsAnotherFrame) {
            requestRender();
          }
        };

        if (isSoftwareGl) {
          afterDraw(done);
        } else {
          done();
        }
      });
    };

    const applyLighting = (mode: LightingMode, solarNorm: number) => {
      const clampedSolar = THREE.MathUtils.clamp(solarNorm, 0.12, 1.0);
      if (mode === 'cleanroom') {
        scene.background = new THREE.Color(0x131924);
        scene.fog = new THREE.FogExp2(0x131924, 0.006);
        scene.environmentIntensity = 0.78;
        keyLight.color.setHex(0xffffff);
        keyLight.intensity = 2.85;
        hemiFill.color.setHex(0xdce8ff);
        hemiFill.groundColor.setHex(0x3a465c);
        hemiFill.intensity = 1.25;
        rimLight.color.setHex(0xfff1d6);
        rimLight.intensity = 1.0;
        interiorFill.intensity = 1.35;
        if (softboxLight) softboxLight.intensity = 1.35;
        starfield.visible = false;
        distantSun.visible = false;
      } else {
        scene.background = new THREE.Color(0x020306);
        scene.fog = null;
        // Modulate solar key & subtle reflections from 1977 (1 AU) to 2026 (170 AU)
        scene.environmentIntensity = 0.46 + clampedSolar * 0.14;
        keyLight.color.setRGB(
          0.92 + clampedSolar * 0.08,
          0.94 + clampedSolar * 0.03,
          0.98 - clampedSolar * 0.08,
        );
        keyLight.intensity = 2.3 + clampedSolar * 1.7;
        hemiFill.color.setHex(0x8bb6ef);
        hemiFill.groundColor.setHex(0x0c101a);
        hemiFill.intensity = 0.54 - clampedSolar * 0.12;
        rimLight.color.setHex(0x8cc6ff);
        rimLight.intensity = 1.05 - clampedSolar * 0.2;
        interiorFill.intensity = 0.9;
        if (softboxLight) softboxLight.intensity = 0.62 + clampedSolar * 0.34;
        starfield.visible = true;
        distantSun.visible = true;
        const sunScale = 0.52 + clampedSolar * 1.45;
        distantSun.scale.setScalar(sunScale);
      }
      requestRender();
    };

    const applyHighlights = () => {
      voyager.updateHighlights(
        propsRef.current.activeSubsystem,
        propsRef.current.selectedComponent,
        propsRef.current.hoveredComponent,
        currentExplode,
        propsRef.current.xrayMode,
      );
      requestRender();
    };

    const applyHardwareControls = () => {
      voyager.setShowVectors(propsRef.current.showVectors);
      voyager.setCutawayDepth(propsRef.current.cutawayDepth);
      requestRender();
    };

    engineRef.current = {
      requestRender,
      setCameraGoal: (pos, target) => {
        _camGoalPos.set(pos[0], pos[1], pos[2]);
        _camGoalTarget.set(target[0], target[1], target[2]);
        hasCameraGoal = true;
        requestRender();
      },
      applyLighting,
      applyHighlights,
      applyHardwareControls,
      triggerThrusterPulse: () => {
        thrusterPulseEndMs = performance.now() + 1350;
        requestRender();
      },
    };

    // Cancel camera transitions immediately on manual user OrbitControls drag/zoom
    const onControlStart = () => {
      hasCameraGoal = false;
    };
    const onControlChange = () => {
      requestRender();
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('change', onControlChange);

    // High-performance throttled Raycasting (Layer 1 only)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);

    let lastRaycastMs = 0;
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoveredId: ComponentId | null = null;

    const pickComponent = (clientX: number, clientY: number): ComponentId | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      _rayMouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _rayMouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_rayMouse, camera);
      const hits = raycaster.intersectObjects(voyager.raycastTargets, false);
      if (hits.length > 0) {
        const compId = hits[0].object.userData.componentId as ComponentId | undefined;
        return compId ?? null;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastRaycastMs < 40) return;
      lastRaycastMs = now;

      // Skip hover raycasting while orbiting with button pressed
      if (e.buttons !== 0) {
        if (lastHoveredId !== null) {
          lastHoveredId = null;
          renderer.domElement.style.cursor = 'grabbing';
          propsRef.current.onHoverChange(null);
        }
        return;
      }

      const hitId = pickComponent(e.clientX, e.clientY);
      renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';

      if (hitId) {
        lastHoveredId = hitId;
        propsRef.current.onHoverChange({
          componentId: hitId,
          screenX: e.clientX,
          screenY: e.clientY,
        });
      } else if (lastHoveredId !== null) {
        lastHoveredId = null;
        propsRef.current.onHoverChange(null);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 5) return; // Ignore orbit drags

      const hitId = pickComponent(e.clientX, e.clientY);
      if (hitId) {
        propsRef.current.onSelectComponent(hitId);
      }
    };

    const onPointerLeave = () => {
      if (lastHoveredId !== null) {
        lastHoveredId = null;
        propsRef.current.onHoverChange(null);
      }
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('WebGL rendering context was interrupted. Attempting recovery...');
    };
    const onContextRestored = () => {
      setWebglError(null);
      requestRender();
    };

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) {
        composer.setSize(w, h);
      }
      if (bloomPass) {
        bloomPass.setSize(w, h);
      }
      requestRender();
    };
    window.addEventListener('resize', onResize);

    // Initial state sync & first draw
    voyager.updateExplode(currentExplode);
    voyager.setLouverOpenness(currentLouver);
    voyager.setScanAngles(currentAz, currentEl);
    voyager.setShowVectors(propsRef.current.showVectors);
    voyager.setCutawayDepth(propsRef.current.cutawayDepth);
    applyLighting(propsRef.current.lightingMode, propsRef.current.solarIntensityNorm);
    applyHighlights();
    requestRender();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', onControlChange);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      if (composer) {
        composer.dispose();
      }
      starfield.geometry.dispose();
      (starfield.material as THREE.Material).dispose();
      distantSunGeo.dispose();
      distantSunMat.dispose();
      voyager.dispose();
      textures.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      engineRef.current = null;
    };
  }, []);

  // React prop updates -> trigger WebGL updates without remounting canvas
  useEffect(() => {
    engineRef.current?.requestRender();
  }, [
    explodeTarget,
    showOverlays,
    autoOrbit,
    bloomEnabled,
    louverOpenness,
    scanAzimuth,
    scanElevation,
  ]);

  useEffect(() => {
    engineRef.current?.applyLighting(lightingMode, solarIntensityNorm);
  }, [lightingMode, solarIntensityNorm]);

  useEffect(() => {
    engineRef.current?.applyHighlights();
  }, [activeSubsystem, selectedComponent, hoveredComponent, xrayMode]);

  useEffect(() => {
    engineRef.current?.applyHardwareControls();
  }, [showVectors, cutawayDepth]);

  useEffect(() => {
    if (thrusterPulseNonce > 0) {
      engineRef.current?.triggerThrusterPulse();
    }
  }, [thrusterPulseNonce]);

  useEffect(() => {
    if (cameraRequest) {
      engineRef.current?.setCameraGoal(cameraRequest.position, cameraRequest.target);
    }
  }, [cameraRequest]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* 3D-Projected Scientific Data Overlay Callout Pins */}
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden z-10 ${
          showOverlays ? '' : 'hidden'
        }`}
      >
        {COMPONENT_LIST.map((comp) => {
          const isSelected = selectedComponent === comp.id;
          const isHovered = hoveredComponent === comp.id;
          const statusSymbol =
            comp.status === 'Active' ? '●' : comp.status === 'Passive' ? '◆' : '○';
          const statusTone =
            comp.status === 'Active'
              ? 'text-emerald-400'
              : comp.status === 'Passive'
                ? 'text-amber-400'
                : 'text-slate-400';

          return (
            <button
              key={comp.id}
              ref={(node) => {
                pinRefs.current[comp.id] = node;
              }}
              type="button"
              onClick={() => onSelectComponent(comp.id)}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onHoverChange({
                  componentId: comp.id,
                  screenX: rect.right,
                  screenY: rect.top,
                });
              }}
              onMouseLeave={() => onHoverChange(null)}
              style={{ opacity: 0, left: 0, top: 0 }}
              className={`absolute flex flex-col items-center group transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 ${
                isSelected ? 'z-20' : 'z-10'
              }`}
              aria-label={`Inspect ${comp.name}`}
            >
              <div
                className={`px-2 py-1 rounded-xs border text-[11px] font-mono whitespace-nowrap transition-colors duration-150 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#121a2b] border-amber-400 text-amber-200'
                    : isHovered
                      ? 'bg-[#101827] border-cyan-400/80 text-slate-100'
                      : 'bg-[#090d16]/90 border-slate-700/80 text-slate-200 hover:border-amber-400/70'
                }`}
              >
                <span className={`text-[9px] leading-none ${statusTone}`} aria-hidden="true">
                  {statusSymbol}
                </span>
                <span className="font-medium tracking-tight">{comp.shortLabel}</span>
              </div>
              {/* Crisp leader stem anchored to 3D hardware node */}
              <div
                className={`w-px h-3.5 ${
                  isSelected
                    ? 'bg-amber-400'
                    : isHovered
                      ? 'bg-cyan-400'
                      : 'bg-slate-500/70 group-hover:bg-amber-400/80'
                }`}
              />
              <div
                className={`w-1.5 h-1.5 rotate-45 border ${
                  isSelected
                    ? 'bg-amber-400 border-amber-200'
                    : 'bg-[#090d16] border-slate-400 group-hover:border-amber-400'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* 3D-Projected Reference Vector Endpoint Labels */}
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden z-10 ${
          showVectors ? '' : 'hidden'
        }`}
      >
        {VECTOR_LABELS.map((vec) => (
          <div
            key={vec.id}
            ref={(node) => {
              vectorLabelRefs.current[vec.id] = node;
            }}
            style={{ opacity: 0, left: 0, top: 0 }}
            className={`absolute px-2 py-0.5 bg-[#090d16]/95 border rounded-xs font-mono text-[10.5px] whitespace-nowrap transition-opacity duration-150 ${vec.tone}`}
          >
            {vec.label}
          </div>
        ))}
      </div>

      {/* Graceful WebGL Fallback Surface */}
      {webglError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#060910] p-6">
          <div className="max-w-md border border-slate-800 bg-[#0d1320] p-6 rounded text-center">
            <h2 className="font-display text-lg font-semibold text-slate-100 mb-2">
              WebGL Viewport Unavailable
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">{webglError}</p>
          </div>
        </div>
      )}
    </div>
  );
};
