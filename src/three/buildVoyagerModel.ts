import * as THREE from 'three';
import { ComponentId, SubsystemId, VOYAGER_COMPONENTS } from '../data/voyagerData';
import { ProceduralTextureSet } from './proceduralTextures';

export interface ExplodablePart {
  object: THREE.Object3D;
  basePos: THREE.Vector3;
  explodeOffset: THREE.Vector3;
  baseRot?: THREE.Euler;
  explodeRot?: THREE.Vector3;
}

export interface MaterialRecord {
  material: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  baseEmissive: THREE.Color;
  baseEmissiveIntensity: number;
  baseOpacity: number;
  baseTransparent: boolean;
  componentId: ComponentId;
  subsystem: Exclude<SubsystemId, 'all'>;
  isExteriorShell: boolean;
}

export interface BuiltVoyagerModel {
  root: THREE.Group;
  explodables: ExplodablePart[];
  anchors: Record<ComponentId, THREE.Object3D>;
  raycastTargets: THREE.Object3D[];
  materialRecords: MaterialRecord[];
  guideLines: THREE.LineSegments;
  guideLinePositions: Float32Array;
  guideLinks: { startObj: THREE.Object3D; endObj: THREE.Object3D }[];
  rtgGlowMaterials: THREE.MeshStandardMaterial[];
  scanHeadGroup: THREE.Group;
  lecpTurretGroup: THREE.Group;
  gyroRotors: THREE.Object3D[];
  updateExplode: (amount: number) => void;
  updateHighlights: (
    activeSubsystem: SubsystemId,
    selectedId: ComponentId | null,
    hoveredId: ComponentId | null,
    explodeAmount: number,
    xrayMode?: boolean,
  ) => void;
  setLouverOpenness: (openness: number) => void;
  setScanAngles: (azDeg: number, elDeg: number) => void;
  setThrusterPulse: (intensity: number) => void;
  setShowVectors: (visible: boolean) => void;
  setCutawayDepth: (depth01: number) => void;
  dispose: () => void;
}

function addStrut(
  parent: THREE.Object3D,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  radius: number,
  mat: THREE.Material,
  castShadow = true,
  scaleX = 1,
  scaleZ = 1,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 10);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  if (scaleX !== 1 || scaleZ !== 1) {
    mesh.scale.set(scaleX, 1, scaleZ);
  }
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function buildVoyagerModel(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
): BuiltVoyagerModel {
  const root = new THREE.Group();
  root.name = 'Voyager1Root';

  const explodables: ExplodablePart[] = [];
  const raycastTargets: THREE.Object3D[] = [];
  const materialRecords: MaterialRecord[] = [];
  const rtgGlowMaterials: THREE.MeshStandardMaterial[] = [];
  const louverBlades: THREE.Mesh[] = [];
  const gyroRotors: THREE.Object3D[] = [];
  const thrusterPlumes: THREE.Mesh[] = [];
  const guideLinks: { startObj: THREE.Object3D; endObj: THREE.Object3D }[] = [];
  const anchors = {} as Record<ComponentId, THREE.Object3D>;

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // Shared hardware clipping plane for Section Cutaway slider
  const cutawayPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 10);

  const makeStdMat = (
    componentId: ComponentId,
    params: THREE.MeshStandardMaterialParameters,
    isExteriorShell = false,
  ): THREE.MeshStandardMaterial => {
    const adjustedRoughness =
      !params.roughnessMap && typeof params.roughness === 'number' && params.roughness < 0.42
        ? Math.min(1, params.roughness + 0.1)
        : params.roughness;
    const m = new THREE.MeshStandardMaterial({
      ...params,
      roughness: adjustedRoughness,
      envMapIntensity: params.envMapIntensity ?? 0.62,
      clippingPlanes: [],
      clipShadows: true,
    });
    materials.push(m);
    materialRecords.push({
      material: m,
      baseEmissive: m.emissive.clone(),
      baseEmissiveIntensity: m.emissiveIntensity,
      baseOpacity: m.opacity,
      baseTransparent: m.transparent,
      componentId,
      subsystem: VOYAGER_COMPONENTS[componentId].subsystem,
      isExteriorShell,
    });
    return m;
  };

  const makePhysMat = (
    componentId: ComponentId,
    params: THREE.MeshPhysicalMaterialParameters,
    isExteriorShell = false,
  ): THREE.MeshPhysicalMaterial => {
    const adjustedRoughness =
      !params.roughnessMap && typeof params.roughness === 'number' && params.roughness < 0.42
        ? Math.min(1, params.roughness + 0.1)
        : params.roughness;
    const m = new THREE.MeshPhysicalMaterial({
      ...params,
      roughness: adjustedRoughness,
      clearcoat: typeof params.clearcoat === 'number' ? params.clearcoat * 0.5 : params.clearcoat,
      envMapIntensity: params.envMapIntensity ?? 0.66,
      clippingPlanes: [],
      clipShadows: true,
    });
    materials.push(m);
    materialRecords.push({
      material: m,
      baseEmissive: m.emissive.clone(),
      baseEmissiveIntensity: m.emissiveIntensity,
      baseOpacity: m.opacity,
      baseTransparent: m.transparent,
      componentId,
      subsystem: VOYAGER_COMPONENTS[componentId].subsystem,
      isExteriorShell,
    });
    return m;
  };

  const registerExplodable = (
    object: THREE.Object3D,
    explodeOffset: THREE.Vector3,
    explodeRot?: THREE.Vector3,
  ) => {
    explodables.push({
      object,
      basePos: object.position.clone(),
      explodeOffset,
      baseRot: object.rotation.clone(),
      explodeRot,
    });
  };

  const tagComponent = (group: THREE.Object3D, componentId: ComponentId) => {
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.userData.componentId = componentId;
        child.layers.enable(1);
        raycastTargets.push(child);
        const geo = (child as THREE.Mesh).geometry;
        if (geo && !geometries.includes(geo)) {
          geometries.push(geo);
        }
      }
    });
  };

  const registerAnchor = (
    parent: THREE.Object3D,
    componentId: ComponentId,
    localPos: THREE.Vector3,
  ) => {
    const node = new THREE.Object3D();
    node.position.copy(localPos);
    parent.add(node);
    anchors[componentId] = node;
    return node;
  };

  const addGuideLink = (
    startParent: THREE.Object3D,
    startLocal: THREE.Vector3,
    endParent: THREE.Object3D,
    endLocal: THREE.Vector3,
  ) => {
    const s = new THREE.Object3D();
    s.position.copy(startLocal);
    startParent.add(s);
    const e = new THREE.Object3D();
    e.position.copy(endLocal);
    endParent.add(e);
    guideLinks.push({ startObj: s, endObj: e });
  };

  // =========================================================================
  // 1. HIGH-GAIN PARABOLIC ANTENNA (HGA 3.66m + 32-RIB BACKING + WAVEGUIDES)
  // =========================================================================
  const hgaRoot = new THREE.Group();
  hgaRoot.position.set(0, 0.88, 0);
  root.add(hgaRoot);

  const dishWhiteMat = makeStdMat(
    'hga',
    {
      color: 0xf7f6f0,
      map: textures.dishMap,
      normalMap: textures.dishNormal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: textures.dishRoughness,
      aoMap: textures.dishAo,
      aoMapIntensity: 0.72,
      roughness: 1.0,
      metalness: 0.06,
      side: THREE.DoubleSide,
    },
    true,
  );

  const dishAlumRibMat = makePhysMat('hga', {
    color: 0xd0d8e2,
    map: textures.brushedMetalMap,
    normalMap: textures.brushedMetalNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: textures.brushedMetalRoughness,
    roughness: 0.72,
    metalness: 0.88,
    clearcoat: 0.12,
  });

  const dishHubBlanketMat = makeStdMat(
    'hga',
    {
      color: 0xffffff,
      map: textures.blackMliMap,
      normalMap: textures.blackMliNormal,
      normalScale: new THREE.Vector2(1.45, 1.45),
      roughnessMap: textures.blackMliRoughness,
      roughness: 1.0,
      metalness: 0.34,
      side: THREE.DoubleSide,
    },
    true,
  );

  const dishFastenerMat = makeStdMat('hga', {
    color: 0xe2e8f0,
    roughness: 0.2,
    metalness: 0.94,
  });

  const feedBrassMat = makePhysMat('hga', {
    color: 0xe0ae44,
    roughness: 0.2,
    metalness: 0.94,
    clearcoat: 0.35,
  });

  const dishGroup = new THREE.Group();
  hgaRoot.add(dishGroup);

  // Precision parabolic dish shell with stepped rolled rim flange
  const dishPoints: THREE.Vector2[] = [];
  const R = 1.83;
  const depth = 0.56;
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const r = 0.145 + (i / steps) * (R - 0.145);
    const y = depth * Math.pow(r / R, 2);
    dishPoints.push(new THREE.Vector2(r, y));
  }
  // Rolled stiffening flange lip
  dishPoints.push(new THREE.Vector2(R + 0.032, depth + 0.014));
  dishPoints.push(new THREE.Vector2(R + 0.036, depth - 0.018));
  dishPoints.push(new THREE.Vector2(R + 0.022, depth - 0.056));
  dishPoints.push(new THREE.Vector2(R - 0.015, depth - 0.056));
  for (let i = steps; i >= 0; i--) {
    const r = 0.145 + (i / steps) * (R - 0.145);
    const y = depth * Math.pow(r / R, 2) - 0.034;
    dishPoints.push(new THREE.Vector2(r, y));
  }
  const dishGeo = new THREE.LatheGeometry(dishPoints, 72);
  dishGeo.computeVertexNormals();
  // Planar top-down UVs so radial gore panel seams align cleanly on both front and back
  const dishPosAttr = dishGeo.attributes.position;
  const dishUvAttr = dishGeo.attributes.uv;
  for (let i = 0; i < dishPosAttr.count; i++) {
    const x = dishPosAttr.getX(i);
    const z = dishPosAttr.getZ(i);
    dishUvAttr.setXY(i, x / (2 * (R + 0.04)) + 0.5, z / (2 * (R + 0.04)) + 0.5);
  }
  dishUvAttr.needsUpdate = true;

  const dishMesh = new THREE.Mesh(dishGeo, dishWhiteMat);
  dishMesh.castShadow = true;
  dishMesh.receiveShadow = true;
  dishGroup.add(dishMesh);

  // Rear 32-rib structural aluminum stiffener grid (16 primary full ribs + 16 outer half-ribs)
  for (let i = 0; i < 32; i++) {
    const ang = (i / 32) * Math.PI * 2;
    const isPrimary = i % 2 === 0;
    const rStart = isPrimary ? 0.28 : 0.92;
    const rEnd = 1.77;
    const ribP1 = new THREE.Vector3(
      Math.cos(ang) * rStart,
      depth * Math.pow(rStart / R, 2) - 0.052,
      Math.sin(ang) * rStart,
    );
    const ribP2 = new THREE.Vector3(
      Math.cos(ang) * rEnd,
      depth * Math.pow(rEnd / R, 2) - 0.054,
      Math.sin(ang) * rEnd,
    );
    addStrut(dishGroup, ribP1, ribP2, isPrimary ? 0.014 : 0.009, dishAlumRibMat, false);
  }

  // Three concentric rear machined aluminum stiffener rings
  [0.54, 1.06, 1.54].forEach((rr, idx) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(rr, idx === 1 ? 0.022 : 0.015, 10, 64),
      dishAlumRibMat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = depth * Math.pow(rr / R, 2) - 0.056;
    dishGroup.add(ring);
  });

  const outerRimRing = new THREE.Mesh(
    new THREE.TorusGeometry(R + 0.016, 0.02, 12, 72),
    dishAlumRibMat,
  );
  outerRimRing.rotation.x = Math.PI / 2;
  outerRimRing.position.y = depth - 0.012;
  dishGroup.add(outerRimRing);

  // Instanced 48 stainless perimeter hex bolts along the dish rim flange
  const rimBoltGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.024, 6);
  geometries.push(rimBoltGeo);
  const rimBolts = new THREE.InstancedMesh(rimBoltGeo, dishFastenerMat, 48);
  const boltDummy = new THREE.Object3D();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    boltDummy.position.set(Math.cos(a) * (R + 0.012), depth + 0.008, Math.sin(a) * (R + 0.012));
    boltDummy.rotation.set(0, -a, 0);
    boltDummy.scale.set(1, 1, 1);
    boltDummy.updateMatrix();
    rimBolts.setMatrixAt(i, boltDummy.matrix);
  }
  rimBolts.instanceMatrix.needsUpdate = true;
  rimBolts.computeBoundingSphere();
  dishGroup.add(rimBolts);

  // Iconic dark charcoal crinkled MLI cylindrical rear RF hub shroud behind dish vertex
  const rearHubShroud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.92, 0.86, 0.28, 36, 1, true),
    dishHubBlanketMat,
  );
  rearHubShroud.position.y = -0.09;
  rearHubShroud.castShadow = true;
  rearHubShroud.receiveShadow = true;
  dishGroup.add(rearHubShroud);

  const rearHubClamp = new THREE.Mesh(
    new THREE.TorusGeometry(0.89, 0.014, 10, 48),
    dishAlumRibMat,
  );
  rearHubClamp.rotation.x = Math.PI / 2;
  rearHubClamp.position.y = -0.22;
  dishGroup.add(rearHubClamp);

  registerExplodable(dishGroup, new THREE.Vector3(0, 0.98, 0));

  // Vertex RF Feed Horn, Orthomode Transducer (OMT) & Twin Curved S/X Waveguides
  const feedGroup = new THREE.Group();
  hgaRoot.add(feedGroup);

  const feedHornCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.23, 0.18, 28),
    dishAlumRibMat,
  );
  feedHornCollar.position.y = 0.04;
  feedGroup.add(feedHornCollar);

  // 5 concentric gold-plated corrugated RF choke rings
  for (let i = 0; i < 5; i++) {
    const choke = new THREE.Mesh(
      new THREE.TorusGeometry(0.056 + i * 0.024, 0.0075, 10, 36),
      feedBrassMat,
    );
    choke.rotation.x = Math.PI / 2;
    choke.position.y = 0.14 + i * 0.013;
    feedGroup.add(choke);
  }

  const innerWaveguide = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.05, 0.36, 24),
    feedBrassMat,
  );
  innerWaveguide.position.y = 0.02;
  feedGroup.add(innerWaveguide);

  // Orthomode Transducer (OMT) splitter block behind dish vertex
  const omtBlock = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.13, 0.15), feedBrassMat);
  omtBlock.position.y = -0.16;
  feedGroup.add(omtBlock);

  // Twin curved brass S-band & X-band waveguides with machined coupling flanges
  const wgPaths = [
    [
      new THREE.Vector3(0.06, -0.16, 0.02),
      new THREE.Vector3(0.22, -0.26, 0.12),
      new THREE.Vector3(0.36, -0.45, 0.22),
      new THREE.Vector3(0.46, -0.58, 0.26),
    ],
    [
      new THREE.Vector3(-0.06, -0.16, -0.02),
      new THREE.Vector3(-0.2, -0.28, -0.11),
      new THREE.Vector3(-0.34, -0.46, -0.2),
      new THREE.Vector3(-0.44, -0.58, -0.24),
    ],
  ];
  wgPaths.forEach((pts) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.019, 10, false), feedBrassMat);
    feedGroup.add(pipe);
    // Mid-run waveguide flange collar
    const midPt = curve.getPoint(0.5);
    const flange = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.02, 0.055), dishAlumRibMat);
    flange.position.copy(midPt);
    feedGroup.add(flange);
  });

  registerExplodable(feedGroup, new THREE.Vector3(0, 0.44, 0));

  // 10-Bay V-Strut Titanium Adapter Truss with machined end clevises
  const hgaTrussGroup = new THREE.Group();
  hgaRoot.add(hgaTrussGroup);
  for (let i = 0; i < 10; i++) {
    const a1 = (i / 10) * Math.PI * 2;
    const a2 = ((i + 0.5) / 10) * Math.PI * 2;
    const busPt = new THREE.Vector3(Math.cos(a1) * 0.85, -0.46, Math.sin(a1) * 0.85);
    const dishPt1 = new THREE.Vector3(Math.cos(a2) * 1.06, 0.135, Math.sin(a2) * 1.06);
    const dishPt2 = new THREE.Vector3(
      Math.cos(a1 - Math.PI / 10) * 1.06,
      0.135,
      Math.sin(a1 - Math.PI / 10) * 1.06,
    );
    addStrut(hgaTrussGroup, busPt, dishPt1, 0.014, dishAlumRibMat, false);
    addStrut(hgaTrussGroup, busPt, dishPt2, 0.014, dishAlumRibMat, false);

    // Machined clevis bracket on top bus ring
    const clevis = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.055), dishFastenerMat);
    clevis.position.copy(busPt);
    clevis.rotation.y = -a1;
    hgaTrussGroup.add(clevis);
  }

  registerAnchor(dishGroup, 'hga', new THREE.Vector3(1.25, 0.42, 0.95));
  addGuideLink(
    hgaTrussGroup,
    new THREE.Vector3(0, 0.15, 0),
    dishGroup,
    new THREE.Vector3(0, 0.05, 0),
  );
  tagComponent(hgaRoot, 'hga');

  // =========================================================================
  // 2. CASSEGRAIN SUB-REFLECTOR, LOW-BLOCKAGE TRIPOD & LGA MAST
  // =========================================================================
  const subRefGroup = new THREE.Group();
  subRefGroup.position.set(0, 0.88, 0);
  root.add(subRefGroup);

  const subStrutMat = makePhysMat('subreflector', {
    color: 0xd9e1eb,
    map: textures.brushedMetalMap,
    normalMap: textures.brushedMetalNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.26,
    metalness: 0.86,
  });

  const subDichroicMat = makePhysMat('subreflector', {
    color: 0xebbe4d,
    roughness: 0.18,
    metalness: 0.94,
    clearcoat: 0.55,
  });

  const subCapMat = makeStdMat('subreflector', {
    color: 0xf4f3ed,
    map: textures.whiteThermalMap,
    normalMap: textures.whiteThermalNormal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: textures.whiteThermalRoughness,
    roughness: 1.0,
    metalness: 0.12,
  });

  const focusY = 1.46;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const baseR = 1.24;
    const baseY = depth * Math.pow(baseR / R, 2) - 0.01;
    const pBase = new THREE.Vector3(Math.cos(a) * baseR, baseY, Math.sin(a) * baseR);
    const pTop = new THREE.Vector3(Math.cos(a) * 0.21, focusY, Math.sin(a) * 0.21);

    // Aerodynamic elliptical low-blockage tripod strut
    addStrut(subRefGroup, pBase, pTop, 0.017, subStrutMat, true, 0.65, 1.35);

    // Bolted tripod mounting shoe on parabolic face
    const shoe = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.068, 0.036, 16), subStrutMat);
    shoe.position.copy(pBase);
    subRefGroup.add(shoe);

    // Mid-strut turnbuckle collar
    const mid = pBase.clone().lerp(pTop, 0.45);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.075, 12), subDichroicMat);
    collar.position.copy(mid);
    collar.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      pTop.clone().sub(pBase).normalize(),
    );
    subRefGroup.add(collar);
  }

  // Coaxial LGA feed cable clipped along Strut 0
  const lgaCableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(Math.cos(Math.PI / 6) * 1.22, depth * Math.pow(1.22 / R, 2) + 0.01, Math.sin(Math.PI / 6) * 1.22),
    new THREE.Vector3(Math.cos(Math.PI / 6) * 0.72, 0.82, Math.sin(Math.PI / 6) * 0.72),
    new THREE.Vector3(Math.cos(Math.PI / 6) * 0.24, focusY + 0.04, Math.sin(Math.PI / 6) * 0.24),
  ]);
  subRefGroup.add(new THREE.Mesh(new THREE.TubeGeometry(lgaCableCurve, 18, 0.007, 8, false), subDichroicMat));

  // Sub-reflector drum housing + machined flange bevels
  const subDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.15, 36), subCapMat);
  subDrum.position.y = focusY + 0.035;
  subDrum.castShadow = true;
  subRefGroup.add(subDrum);

  const subFlange = new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.014, 10, 36), subStrutMat);
  subFlange.rotation.x = Math.PI / 2;
  subFlange.position.y = focusY - 0.035;
  subRefGroup.add(subFlange);

  // Hyperbolic dichroic S/X frequency-selective reflector underside
  const subFace = new THREE.Mesh(new THREE.ConeGeometry(0.265, 0.095, 36), subDichroicMat);
  subFace.rotation.x = Math.PI;
  subFace.position.y = focusY - 0.072;
  subRefGroup.add(subFace);

  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.055 + i * 0.048, 0.0055, 8, 32),
      subStrutMat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = focusY - 0.088 + i * 0.012;
    subRefGroup.add(ring);
  }

  // Multi-stage Low-Gain Antenna (LGA) backup omnidirectional mast
  const lgaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.1, 0.13, 24), subStrutMat);
  lgaBase.position.y = focusY + 0.16;
  subRefGroup.add(lgaBase);

  const lgaMast = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.038, 0.36, 20), subCapMat);
  lgaMast.position.y = focusY + 0.38;
  subRefGroup.add(lgaMast);

  // Helical phasing rings & cross-dipole tip
  for (let r = 0; r < 3; r++) {
    const phRing = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.005, 8, 24), subDichroicMat);
    phRing.rotation.x = Math.PI / 2;
    phRing.position.y = focusY + 0.44 + r * 0.045;
    subRefGroup.add(phRing);
  }
  const lgaTip = new THREE.Mesh(new THREE.SphereGeometry(0.036, 18, 14), subDichroicMat);
  lgaTip.position.y = focusY + 0.57;
  subRefGroup.add(lgaTip);

  registerExplodable(subRefGroup, new THREE.Vector3(0, 1.76, 0));
  registerAnchor(subRefGroup, 'subreflector', new THREE.Vector3(0.28, focusY + 0.25, 0.18));
  addGuideLink(
    dishGroup,
    new THREE.Vector3(0, 0.22, 0),
    subRefGroup,
    new THREE.Vector3(0, focusY - 0.1, 0),
  );
  tagComponent(subRefGroup, 'subreflector');

  // =========================================================================
  // 3. DECAGONAL 10-BAY BUS, THERMAL LOUVERS, DTR TAPE RECORDER & AVIONICS
  // =========================================================================
  const busRoot = new THREE.Group();
  busRoot.position.set(0, 0.15, 0);
  root.add(busRoot);

  const busFrameMat = makePhysMat('bus', {
    color: 0x8e99a8,
    map: textures.brushedMetalMap,
    normalMap: textures.brushedMetalNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: textures.brushedMetalRoughness,
    roughness: 0.78,
    metalness: 0.86,
  });

  const busOuterBlanketMat = makeStdMat(
    'bus',
    {
      color: 0xffffff,
      map: textures.busPanelMap,
      normalMap: textures.busPanelNormal,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: textures.busPanelRoughness,
      aoMap: textures.busPanelAo,
      aoMapIntensity: 0.8,
      metalnessMap: textures.busPanelMetalness,
      roughness: 1.0,
      metalness: 0.9,
    },
    true,
  );

  const busLouverMat = makePhysMat('bus', {
    color: 0xf0f4fa,
    map: textures.brushedMetalMap,
    normalMap: textures.brushedMetalNormal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.14,
    metalness: 0.96,
    clearcoat: 0.4,
  });

  const busOsrMat = makePhysMat('bus', {
    color: 0xdbeafe,
    map: textures.osrMap,
    normalMap: textures.osrNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: textures.osrRoughness,
    roughness: 0.32,
    metalness: 0.92,
    clearcoat: 0.85,
  });

  const pcbMat = makeStdMat('bus', {
    color: 0xffffff,
    map: textures.pcbMap,
    normalMap: textures.pcbNormal,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughnessMap: textures.pcbRoughness,
    metalnessMap: textures.pcbMetalness,
    roughness: 1.0,
    metalness: 1.0,
  });

  const goldHarnessMat = makePhysMat('bus', {
    color: 0xeeb942,
    map: textures.kaptonMap,
    normalMap: textures.kaptonNormal,
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughnessMap: textures.kaptonRoughness,
    roughness: 1.0,
    metalness: 0.9,
  });

  const chipBodyMat = makeStdMat('bus', {
    color: 0x181c24,
    roughness: 0.44,
    metalness: 0.38,
  });

  const goldLidMat = makePhysMat('bus', {
    color: 0xe5b842,
    roughness: 0.18,
    metalness: 0.95,
  });

  const copperBusbarMat = makeStdMat('bus', {
    color: 0xd98042,
    roughness: 0.24,
    metalness: 0.92,
  });

  const calTargetMat = makeStdMat('bus', {
    color: 0xffffff,
    map: textures.calTargetMap,
    roughness: 0.62,
    metalness: 0.08,
  });

  const starOpticGlassMat = makePhysMat('bus', {
    color: 0x3b82f6,
    roughness: 0.08,
    metalness: 0.2,
    clearcoat: 1.0,
  });

  const busRadius = 0.89;
  const busHeight = 0.48;
  const ringShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
    const x = Math.cos(a) * busRadius;
    const y = Math.sin(a) * busRadius;
    if (i === 0) ringShape.moveTo(x, y);
    else ringShape.lineTo(x, y);
  }
  ringShape.closePath();

  const innerHole = new THREE.Path();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
    const x = Math.cos(a) * 0.56;
    const y = Math.sin(a) * 0.56;
    if (i === 0) innerHole.moveTo(x, y);
    else innerHole.lineTo(x, y);
  }
  innerHole.closePath();
  ringShape.holes.push(innerHole);

  const ringGeo = new THREE.ExtrudeGeometry(ringShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.009,
    bevelSize: 0.009,
    bevelSegments: 2,
  });
  ringGeo.rotateX(-Math.PI / 2);

  const topDeck = new THREE.Mesh(ringGeo, busFrameMat);
  topDeck.position.y = busHeight / 2 - 0.02;
  topDeck.castShadow = true;
  topDeck.receiveShadow = true;
  busRoot.add(topDeck);

  const bottomDeck = new THREE.Mesh(ringGeo, busFrameMat);
  bottomDeck.position.y = -busHeight / 2 - 0.016;
  bottomDeck.castShadow = true;
  bottomDeck.receiveShadow = true;
  busRoot.add(bottomDeck);

  // Central Star-Bus Ring Harness & S/X Diplexer Distribution Ring around inner core
  const innerRingBus = new THREE.Mesh(
    new THREE.TorusGeometry(0.575, 0.022, 10, 40),
    goldHarnessMat,
  );
  innerRingBus.rotation.x = Math.PI / 2;
  innerRingBus.position.y = 0.11;
  busRoot.add(innerRingBus);

  const lowerRingBus = new THREE.Mesh(
    new THREE.TorusGeometry(0.575, 0.018, 10, 40),
    copperBusbarMat,
  );
  lowerRingBus.rotation.x = Math.PI / 2;
  lowerRingBus.position.y = -0.11;
  busRoot.add(lowerRingBus);

  // 10 radial machined aluminum bulkheads with vertical stiffener flanges
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
    const bulkhead = new THREE.Mesh(new THREE.BoxGeometry(0.31, busHeight, 0.02), busFrameMat);
    bulkhead.position.set(Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72);
    bulkhead.rotation.y = -a;
    bulkhead.castShadow = true;
    busRoot.add(bulkhead);

    // Outer corner structural post + exterior braided gold/silver umbilical harness with machined clamps
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, busHeight + 0.04, 8), busFrameMat);
    post.position.set(Math.cos(a) * (busRadius - 0.01), 0, Math.sin(a) * (busRadius - 0.01));
    busRoot.add(post);

    if (i % 2 === 0) {
      const harnessR = busRadius + 0.022;
      const extHarness = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0085, 0.0085, busHeight + 0.02, 8),
        i % 4 === 0 ? goldHarnessMat : busFrameMat,
      );
      extHarness.position.set(Math.cos(a) * harnessR, 0, Math.sin(a) * harnessR);
      busRoot.add(extHarness);

      for (const cy of [-0.14, 0, 0.14]) {
        const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 12), busLouverMat);
        clamp.rotation.x = Math.PI / 2;
        clamp.position.set(Math.cos(a) * harnessR, cy, Math.sin(a) * harnessR);
        busRoot.add(clamp);
      }
    }
  }

  const bayFaceWidth = 2 * busRadius * Math.sin(Math.PI / 10) - 0.03;
  const bayFaceR = busRadius * Math.cos(Math.PI / 10);

  for (let i = 0; i < 10; i++) {
    const midAngle = (i / 10) * Math.PI * 2;
    const nx = Math.cos(midAngle);
    const nz = Math.sin(midAngle);

    // --- HIGH-DETAIL INTERNAL AVIONICS RACK MODULE (UNIQUE PER BAY SUBSYSTEM) ---
    const bayModule = new THREE.Group();
    bayModule.position.set(nx * 0.71, 0, nz * 0.71);
    bayModule.rotation.y = -midAngle + Math.PI / 2;
    busRoot.add(bayModule);

    // Machined aluminum slide-in card-cage frame rails
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.018, busHeight * 0.84, 0.16), busFrameMat);
      rail.position.set(side * bayFaceWidth * 0.4, 0, 0);
      bayModule.add(rail);
    }

    if (i === 0) {
      // BAY 1: Twin S/X-Band Traveling-Wave Tube Amplifiers (TWTAs) with Copper Heat Sinks & Coax Plumbing
      const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(bayFaceWidth * 0.78, busHeight * 0.78, 0.035),
        busFrameMat,
      );
      chassis.position.z = -0.02;
      bayModule.add(chassis);

      for (const tx of [-0.105, 0.105]) {
        const twtaTube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.042, 0.042, 0.28, 18),
          copperBusbarMat,
        );
        twtaTube.position.set(tx, 0.02, 0.045);
        bayModule.add(twtaTube);

        // Finned thermal radiator collars along TWTA body
        for (let f = -3; f <= 3; f++) {
          const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.008, 16), goldLidMat);
          fin.position.set(tx, 0.02 + f * 0.035, 0.045);
          bayModule.add(fin);
        }
        // Brass coax jumper curve to RF diplexer
        const rfCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(tx, 0.16, 0.045),
          new THREE.Vector3(tx * 0.5, 0.19, 0.085),
          new THREE.Vector3(0, 0.16, 0.03),
        ]);
        bayModule.add(new THREE.Mesh(new THREE.TubeGeometry(rfCurve, 12, 0.009, 8, false), goldLidMat));
      }
      const hvSupply = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.072, 0.065), chipBodyMat);
      hvSupply.position.set(0, -0.135, 0.042);
      bayModule.add(hvSupply);
    } else if (i === 2 || i === 3) {
      // BAYS 3 & 4: CCS / FDS Plated-Wire Magnetic Memory Planes + Dual-Redundant CMOS Logic Cards
      const backPcb = new THREE.Mesh(
        new THREE.BoxGeometry(bayFaceWidth * 0.76, busHeight * 0.76, 0.018),
        pcbMat,
      );
      backPcb.position.z = -0.035;
      bayModule.add(backPcb);

      const memFrame = new THREE.Mesh(
        new THREE.BoxGeometry(bayFaceWidth * 0.72, busHeight * 0.44, 0.048),
        busFrameMat,
      );
      memFrame.position.set(0, 0.06, 0.035);
      bayModule.add(memFrame);

      // Parallel gold-plated magnetic memory wire strands stretched inside memory plane
      for (let w = -5; w <= 5; w++) {
        const wire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0032, 0.0032, bayFaceWidth * 0.64, 6),
          goldLidMat,
        );
        wire.rotation.z = Math.PI / 2;
        wire.position.set(0, 0.06 + w * 0.014, 0.064);
        bayModule.add(wire);
      }

      // Lower CMOS 18-bit logic row
      for (let col = -1; col <= 1; col++) {
        const ic = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.052, 0.022), chipBodyMat);
        ic.position.set(col * 0.115, -0.11, 0.048);
        bayModule.add(ic);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.036, 0.006), goldLidMat);
        lid.position.set(col * 0.115, -0.11, 0.061);
        bayModule.add(lid);
      }
    } else if (i === 4) {
      // BAY 5: AACS 3-Axis Inertial Reference Unit (Spinning Gyroscope Assemblies)
      const iruChassis = new THREE.Mesh(
        new THREE.BoxGeometry(bayFaceWidth * 0.78, busHeight * 0.78, 0.04),
        busFrameMat,
      );
      iruChassis.position.z = -0.015;
      bayModule.add(iruChassis);

      const gyroPositions: [number, number, number, number][] = [
        [-0.1, 0.07, 0, 0],
        [0.1, 0.07, Math.PI / 2, 0],
        [0, -0.09, 0, Math.PI / 2],
      ];
      gyroPositions.forEach(([gx, gy, rx, rz]) => {
        const gyroHousing = new THREE.Group();
        gyroHousing.position.set(gx, gy, 0.055);
        bayModule.add(gyroHousing);

        const outerGimbal = new THREE.Mesh(
          new THREE.TorusGeometry(0.058, 0.009, 10, 24),
          busLouverMat,
        );
        gyroHousing.add(outerGimbal);

        const rotor = new THREE.Group();
        rotor.rotation.set(rx, 0, rz);
        gyroHousing.add(rotor);
        gyroRotors.push(rotor);

        const drum = new THREE.Mesh(
          new THREE.CylinderGeometry(0.042, 0.042, 0.036, 18),
          goldLidMat,
        );
        rotor.add(drum);

        const axle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.008, 0.1, 10),
          copperBusbarMat,
        );
        rotor.add(axle);
      });
    } else if (i === 5) {
      // BAY 6: Iconic 8-Track Digital Tape Recorder (DTR) with twin reels & capstans!
      const dtrDeck = new THREE.Mesh(
        new THREE.BoxGeometry(bayFaceWidth * 0.78, busHeight * 0.78, 0.045),
        busFrameMat,
      );
      dtrDeck.position.z = 0.01;
      bayModule.add(dtrDeck);

      for (const rx of [-0.105, 0.105]) {
        const reelFlange = new THREE.Mesh(
          new THREE.CylinderGeometry(0.088, 0.088, 0.028, 24),
          goldLidMat,
        );
        reelFlange.rotation.x = Math.PI / 2;
        reelFlange.position.set(rx, 0.04, 0.052);
        bayModule.add(reelFlange);

        const tapeSpool = new THREE.Mesh(
          new THREE.CylinderGeometry(0.072, 0.072, 0.032, 20),
          chipBodyMat,
        );
        tapeSpool.rotation.x = Math.PI / 2;
        tapeSpool.position.set(rx, 0.04, 0.052);
        bayModule.add(tapeSpool);
      }
      // Read/write magnetic head assembly & capstan rollers
      const rwHead = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.055, 0.04), copperBusbarMat);
      rwHead.position.set(0, -0.09, 0.055);
      bayModule.add(rwHead);
    } else {
      // Triple-stacked gold-trace JPL Flight Computer & Power Regulation PCBs
      const pcbFront = new THREE.Mesh(
        new THREE.BoxGeometry(bayFaceWidth * 0.78, busHeight * 0.78, 0.018),
        pcbMat,
      );
      pcbFront.position.z = 0.052;
      bayModule.add(pcbFront);

      const pcbMid = new THREE.Mesh(
        new THREE.BoxGeometry(bayFaceWidth * 0.76, busHeight * 0.75, 0.016),
        pcbMat,
      );
      pcbMid.position.z = -0.008;
      bayModule.add(pcbMid);

      const pcbBack = new THREE.Mesh(
        new THREE.BoxGeometry(bayFaceWidth * 0.74, busHeight * 0.72, 0.016),
        pcbMat,
      );
      pcbBack.position.z = -0.065;
      bayModule.add(pcbBack);

      // 3D Hermetic Ceramic Gold-Lid DIP ICs, Capacitors & Toroidal Inductors
      for (let row = -1; row <= 1; row++) {
        for (let col = -1; col <= 1; col++) {
          const ic = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.042, 0.014), chipBodyMat);
          ic.position.set(col * 0.11, row * 0.102, 0.068);
          bayModule.add(ic);

          const lid = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.006), goldLidMat);
          lid.position.set(col * 0.11, row * 0.102, 0.076);
          bayModule.add(lid);

          const cap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.011, 0.011, 0.032, 10),
            copperBusbarMat,
          );
          cap.rotation.x = Math.PI / 2;
          cap.position.set(col * 0.11 + 0.044, row * 0.102 - 0.012, 0.072);
          bayModule.add(cap);
        }
      }

      // Gold D-sub multi-pin telemetry umbilical plug & curved Kapton cable harness
      const dsub = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.032, 0.028), goldLidMat);
      dsub.position.set(0, -busHeight * 0.34, 0.068);
      bayModule.add(dsub);

      const cableCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.08, -busHeight * 0.34, 0.075),
        new THREE.Vector3(0, -busHeight * 0.36, 0.105),
        new THREE.Vector3(0.08, -busHeight * 0.34, 0.075),
      ]);
      bayModule.add(
        new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 12, 0.011, 8, false), goldHarnessMat),
      );
    }

    registerExplodable(bayModule, new THREE.Vector3(nx * 0.28, 0, nz * 0.28));

    // --- OUTER BAY SHIELD, THERMAL LOUVERS, OSR MIRROR PATCHES & STAR TRACKERS ---
    const isGoldenRecordBay = i === 1;
    const isLouverBay = i === 0 || i === 3 || i === 4 || i === 6 || i === 8;

    const outerCover = new THREE.Group();
    outerCover.position.set(nx * (bayFaceR + 0.012), 0, nz * (bayFaceR + 0.012));
    outerCover.rotation.y = -midAngle + Math.PI / 2;
    busRoot.add(outerCover);

    const shieldPlate = new THREE.Mesh(
      new THREE.BoxGeometry(bayFaceWidth * 0.96, busHeight * 0.96, 0.026),
      busOuterBlanketMat,
    );
    shieldPlate.castShadow = true;
    shieldPlate.receiveShadow = true;
    outerCover.add(shieldPlate);

    if (isLouverBay) {
      // Precision JPL bimetallic thermal louver frame + coiled spring actuators + 10 dynamic blades
      const louverFrame = new THREE.Mesh(
        new THREE.BoxGeometry(bayFaceWidth * 0.84, busHeight * 0.78, 0.024),
        busFrameMat,
      );
      louverFrame.position.z = 0.018;
      outerCover.add(louverFrame);

      const actuatorBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, busHeight * 0.74, 10),
        goldLidMat,
      );
      actuatorBar.position.set(0, 0, 0.036);
      outerCover.add(actuatorBar);

      // Coiled bimetallic spiral spring housings along central actuator shaft
      for (const sy of [-0.11, 0, 0.11]) {
        const springCoil = new THREE.Mesh(
          new THREE.CylinderGeometry(0.019, 0.019, 0.022, 12),
          copperBusbarMat,
        );
        springCoil.rotation.z = Math.PI / 2;
        springCoil.position.set(0, sy, 0.036);
        outerCover.add(springCoil);
      }

      for (let b = 0; b < 10; b++) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(bayFaceWidth * 0.78, 0.024, 0.034),
          busLouverMat,
        );
        blade.position.set(0, -0.158 + b * 0.035, 0.032);
        blade.rotation.x = 0.42;
        outerCover.add(blade);
        louverBlades.push(blade);
      }
    } else if (i === 2) {
      // Twin Redundant Canopus Star Tracker Optical Baffle Barrels + Blue-Coated Lenses
      for (const sx of [-0.085, 0.085]) {
        const hood = new THREE.Mesh(
          new THREE.CylinderGeometry(0.056, 0.072, 0.16, 4),
          busFrameMat,
        );
        hood.rotation.x = Math.PI / 2;
        hood.rotation.y = Math.PI / 4;
        hood.position.set(sx, 0.04, 0.085);
        outerCover.add(hood);

        const starLens = new THREE.Mesh(new THREE.CircleGeometry(0.036, 20), starOpticGlassMat);
        starLens.position.set(sx, 0.04, 0.062);
        outerCover.add(starLens);
      }
      // Silvered-Teflon OSR thermal radiator tile patch below star trackers
      const osrPatch = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.012), busOsrMat);
      osrPatch.position.set(0, -0.125, 0.018);
      outerCover.add(osrPatch);
    } else if (i === 5 || i === 9) {
      // Silvered-Teflon Optical Solar Reflector (OSR) mosaic thermal mirror panel
      const osrTile = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.012), busOsrMat);
      osrTile.position.set(0, 0.01, 0.018);
      outerCover.add(osrTile);
    } else if (i === 7) {
      // Fine Sun Sensor baffled optical pyramid & secondary coarse sun sensor
      const sunSensor = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.062, 0.1, 8), busFrameMat);
      sunSensor.rotation.x = Math.PI / 2;
      sunSensor.position.set(-0.065, 0.06, 0.06);
      outerCover.add(sunSensor);

      const sunSlit = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.015), starOpticGlassMat);
      sunSlit.position.set(-0.065, 0.06, 0.105);
      outerCover.add(sunSlit);

      const osrStrip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.012), busOsrMat);
      osrStrip.position.set(0.1, -0.02, 0.018);
      outerCover.add(osrStrip);
    }

    if (!isGoldenRecordBay) {
      registerExplodable(outerCover, new THREE.Vector3(nx * 0.78, 0, nz * 0.78));
      if (i % 2 === 0) {
        addGuideLink(
          busRoot,
          new THREE.Vector3(nx * 0.7, 0, nz * 0.7),
          outerCover,
          new THREE.Vector3(0, 0, 0),
        );
      }
    } else {
      registerExplodable(outerCover, new THREE.Vector3(nx * 0.36, 0, nz * 0.36));
    }
  }

  // Photometric Optical Calibration Target Plate mounted on Bay 9 facing Scan Platform
  const calTruss = new THREE.Group();
  const calAng = (9 / 10) * Math.PI * 2;
  calTruss.position.set(Math.cos(calAng) * 0.92, 0.06, Math.sin(calAng) * 0.92);
  calTruss.rotation.y = -calAng;
  busRoot.add(calTruss);
  addStrut(calTruss, new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0.34, 0.09, 0), 0.011, busFrameMat, false);
  addStrut(calTruss, new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0.34, 0.09, 0), 0.011, busFrameMat, false);
  const calFrame = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.25, 0.25), busFrameMat);
  calFrame.position.set(0.35, 0.09, 0);
  calTruss.add(calFrame);
  const calFace = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.23), calTargetMat);
  calFace.rotation.y = Math.PI / 2;
  calFace.position.set(0.362, 0.09, 0);
  calTruss.add(calFace);

  registerAnchor(busRoot, 'bus', new THREE.Vector3(0.95, 0.25, -0.35));
  tagComponent(busRoot, 'bus');

  // =========================================================================
  // 4. HYDRAZINE PROPULSION CORE, PRESSURANT ACCUMULATOR & 16 MR-103 THRUSTERS
  // =========================================================================
  const propRoot = new THREE.Group();
  propRoot.position.set(0, 0.08, 0);
  root.add(propRoot);

  const tankGoldMat = makePhysMat('propulsion', {
    color: 0xf4c149,
    map: textures.kaptonMap,
    normalMap: textures.kaptonNormal,
    normalScale: new THREE.Vector2(1.45, 1.45),
    roughnessMap: textures.kaptonRoughness,
    roughness: 1.0,
    metalness: 0.92,
    clearcoat: 0.22,
  });

  const tiMetalMat = makePhysMat('propulsion', {
    color: 0xc2ccd8,
    map: textures.brushedMetalMap,
    normalMap: textures.brushedMetalNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughnessMap: textures.brushedMetalRoughness,
    roughness: 0.68,
    metalness: 0.9,
  });

  const nozzleMat = makeStdMat('propulsion', {
    color: 0x262c36,
    normalMap: textures.rtgNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.38,
    metalness: 0.86,
  });

  const aftShieldMat = makeStdMat(
    'propulsion',
    {
      color: 0xffffff,
      map: textures.blackMliMap,
      normalMap: textures.blackMliNormal,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughnessMap: textures.blackMliRoughness,
      roughness: 1.0,
      metalness: 0.32,
      side: THREE.DoubleSide,
    },
    true,
  );

  // Translucent blue-white catalytic hydrazine pulse plume material
  const thrusterPlumeMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  materials.push(thrusterPlumeMat);

  const tankGroup = new THREE.Group();
  propRoot.add(tankGroup);

  const tankSphere = new THREE.Mesh(new THREE.SphereGeometry(0.355, 42, 32), tankGoldMat);
  tankSphere.castShadow = true;
  tankGroup.add(tankSphere);

  // Equatorial machined titanium girth flange + 12 clamp bolts
  const tankFlange = new THREE.Mesh(new THREE.TorusGeometry(0.362, 0.022, 12, 42), tiMetalMat);
  tankFlange.rotation.x = Math.PI / 2;
  tankGroup.add(tankFlange);

  for (let b = 0; b < 12; b++) {
    const ba = (b / 12) * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.048, 6), nozzleMat);
    bolt.position.set(Math.cos(ba) * 0.368, 0, Math.sin(ba) * 0.368);
    tankGroup.add(bolt);
  }

  // Polar fill/drain titanium service boss & pressure regulator
  const topBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.075, 0.07, 16), tiMetalMat);
  topBoss.position.y = 0.355;
  tankGroup.add(topBoss);

  // Secondary Helium/Nitrogen Pressurant Accumulator Sphere tucked beside main tank
  const pressTank = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 18), tiMetalMat);
  pressTank.position.set(0.38, -0.22, -0.18);
  tankGroup.add(pressTank);

  // Twin toroidal propellant manifold rings & 4 braided stainless feed tubes + solenoid valves
  const manifoldRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.013, 10, 32), tiMetalMat);
  manifoldRing.rotation.x = Math.PI / 2;
  manifoldRing.position.y = -0.34;
  tankGroup.add(manifoldRing);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.14, -0.34, Math.sin(a) * 0.14),
      new THREE.Vector3(Math.cos(a) * 0.38, -0.28, Math.sin(a) * 0.38),
      new THREE.Vector3(Math.cos(a) * 0.56, -0.16, Math.sin(a) * 0.56),
    ]);
    tankGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.014, 8, false), tiMetalMat));

    // Solenoid latch valve & pressure transducer block
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.072, 12), nozzleMat);
    valve.position.set(Math.cos(a) * 0.38, -0.28, Math.sin(a) * 0.38);
    tankGroup.add(valve);
  }

  registerExplodable(tankGroup, new THREE.Vector3(0, -0.9, 0));

  // Aft Propellant Thermal Skirt & Launch Adapter Cone + 16 Flared MR-103 Thrusters
  const aftAdapterGroup = new THREE.Group();
  aftAdapterGroup.position.set(0, -0.34, 0);
  propRoot.add(aftAdapterGroup);

  const aftCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.44, 0.18, 10, 1, false),
    aftShieldMat,
  );
  aftCone.position.y = 0.04;
  aftCone.castShadow = true;
  aftCone.receiveShadow = true;
  aftAdapterGroup.add(aftCone);

  // Iconic Voyager aft triangular tubular propulsion/launch adapter truss cage
  for (let r = 0; r < 5; r++) {
    const ra0 = (r / 5) * Math.PI * 2 + Math.PI / 10;
    const ra1 = ((r + 0.5) / 5) * Math.PI * 2 + Math.PI / 10;
    const ra2 = ((r + 1) / 5) * Math.PI * 2 + Math.PI / 10;
    const pTop0 = new THREE.Vector3(Math.cos(ra0) * 0.82, 0.14, Math.sin(ra0) * 0.82);
    const pTop2 = new THREE.Vector3(Math.cos(ra2) * 0.82, 0.14, Math.sin(ra2) * 0.82);
    const pAft = new THREE.Vector3(Math.cos(ra1) * 0.54, -0.52, Math.sin(ra1) * 0.54);
    const pAftNext = new THREE.Vector3(
      Math.cos(ra1 + (Math.PI * 2) / 5) * 0.54,
      -0.52,
      Math.sin(ra1 + (Math.PI * 2) / 5) * 0.54,
    );
    addStrut(aftAdapterGroup, pTop0, pAft, 0.022, nozzleMat, true);
    addStrut(aftAdapterGroup, pTop2, pAft, 0.022, nozzleMat, true);
    addStrut(aftAdapterGroup, pAft, pAftNext, 0.018, nozzleMat, false);

    // Machined metallic foot clevis on aft propulsion truss apex
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.045, 12), tiMetalMat);
    foot.position.copy(pAft);
    aftAdapterGroup.add(foot);
  }

  const aftRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.024, 12, 36), tiMetalMat);
  aftRing.rotation.x = Math.PI / 2;
  aftRing.position.y = -0.06;
  aftAdapterGroup.add(aftRing);

  // Lathe parabolic niobium thruster bell geometry (reused across all 16 MR-103 thrusters)
  const bellPts = [
    new THREE.Vector2(0.008, 0),
    new THREE.Vector2(0.011, 0.014),
    new THREE.Vector2(0.007, 0.022),
    new THREE.Vector2(0.016, 0.042),
    new THREE.Vector2(0.023, 0.062),
  ];
  const thrusterBellGeo = new THREE.LatheGeometry(bellPts, 16);
  geometries.push(thrusterBellGeo);

  const thrusterPlumeGeo = new THREE.ConeGeometry(0.048, 0.34, 12, 1, true);
  thrusterPlumeGeo.translate(0, 0.21, 0);
  geometries.push(thrusterPlumeGeo);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const cluster = new THREE.Group();
    cluster.position.set(Math.cos(a) * 0.62, -0.02, Math.sin(a) * 0.62);
    cluster.rotation.y = -a;
    aftAdapterGroup.add(cluster);

    // Thruster quad manifold block, pressure gauge boss & mounting strut back to bus
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.072, 0.095), tiMetalMat);
    cluster.add(block);
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 12), tankGoldMat);
    gauge.position.set(0, 0.044, 0);
    cluster.add(gauge);
    addStrut(cluster, new THREE.Vector3(-0.14, 0.04, 0), new THREE.Vector3(-0.03, 0, 0), 0.012, tiMetalMat, false);

    const nozzleConfigs: [number, number, number, number, number][] = [
      [0.044, 0, 0.03, 0, -Math.PI / 2],
      [0.044, 0, -0.03, 0, -Math.PI / 2],
      [0, -0.036, 0.028, Math.PI, 0],
      [0, -0.036, -0.028, Math.PI, 0],
    ];
    nozzleConfigs.forEach(([nx, ny, nz, rx, rz]) => {
      const bell = new THREE.Mesh(thrusterBellGeo, nozzleMat);
      bell.position.set(nx, ny, nz);
      bell.rotation.set(rx, 0, rz);
      cluster.add(bell);

      // Catalytic MR-103 exhaust pulse plume cone
      const plume = new THREE.Mesh(thrusterPlumeGeo, thrusterPlumeMat);
      plume.visible = false;
      bell.add(plume);
      thrusterPlumes.push(plume);
    });
  }

  registerExplodable(aftAdapterGroup, new THREE.Vector3(0, -1.62, 0));
  addGuideLink(
    busRoot,
    new THREE.Vector3(0, -0.25, 0),
    aftAdapterGroup,
    new THREE.Vector3(0, 0.1, 0),
  );
  registerAnchor(tankGroup, 'propulsion', new THREE.Vector3(-0.35, -0.45, 0.35));
  tagComponent(propRoot, 'propulsion');

  // =========================================================================
  // 5. VOYAGER GOLDEN RECORD (COVER + INTERNAL CARTRIDGE/STYLUS + LP DISC)
  // =========================================================================
  const grAngle = (1 / 10) * Math.PI * 2;
  const grRoot = new THREE.Group();
  grRoot.position.set(
    Math.cos(grAngle) * (bayFaceR + 0.042),
    0.15,
    Math.sin(grAngle) * (bayFaceR + 0.042),
  );
  grRoot.rotation.y = -grAngle + Math.PI / 2;
  root.add(grRoot);

  const grCoverMat = makePhysMat(
    'golden_record',
    {
      color: 0xffffff,
      map: textures.recordCoverMap,
      normalMap: textures.recordCoverNormal,
      normalScale: new THREE.Vector2(1.25, 1.25),
      roughnessMap: textures.recordCoverRoughness,
      roughness: 0.92,
      metalness: 0.94,
      clearcoat: 0.42,
      clearcoatRoughness: 0.16,
      anisotropy: 0.72,
    },
    true,
  );

  const grDiscMat = makePhysMat('golden_record', {
    color: 0xffffff,
    map: textures.recordDiscMap,
    normalMap: textures.recordDiscNormal,
    normalScale: new THREE.Vector2(1.35, 1.35),
    roughnessMap: textures.recordDiscRoughness,
    roughness: 0.88,
    metalness: 0.98,
    clearcoat: 0.55,
    clearcoatRoughness: 0.12,
    anisotropy: 0.92,
    iridescence: 0.18,
    iridescenceIOR: 1.4,
  });

  const grRimMat = makePhysMat('golden_record', {
    color: 0xdcb24b,
    roughness: 0.22,
    metalness: 0.94,
  });

  const grSteelMat = makeStdMat('golden_record', {
    color: 0xcbd5e1,
    roughness: 0.24,
    metalness: 0.92,
  });

  // Inner backing cradle + Gold-Plated Copper LP + Stored Stylus Cartridge
  const grDiscGroup = new THREE.Group();
  grRoot.add(grDiscGroup);

  const backingRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.172, 0.178, 0.02, 48),
    grRimMat,
  );
  backingRing.rotation.x = Math.PI / 2;
  grDiscGroup.add(backingRing);

  const phonographDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.154, 0.154, 0.009, 56),
    grDiscMat,
  );
  phonographDisc.rotation.x = Math.PI / 2;
  phonographDisc.position.z = 0.014;
  grDiscGroup.add(phonographDisc);

  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.032, 16), grSteelMat);
  spindle.rotation.x = Math.PI / 2;
  spindle.position.z = 0.019;
  grDiscGroup.add(spindle);

  // Stored diamond phonograph cartridge & stylus bracket tucked inside the housing
  const stylusHolder = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.052, 0.014), grSteelMat);
  stylusHolder.position.set(-0.12, 0.11, 0.022);
  stylusHolder.rotation.z = -0.45;
  grDiscGroup.add(stylusHolder);

  // 8 perimeter hex socket bolts on mounting bezel
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.024, 6), grSteelMat);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(Math.cos(a) * 0.163, Math.sin(a) * 0.163, 0.012);
    grDiscGroup.add(screw);
  }

  registerExplodable(grDiscGroup, new THREE.Vector3(0, 0, 0.36));

  // Protective Anodized Aluminum Engraved Cover
  const grCoverGroup = new THREE.Group();
  grCoverGroup.position.z = 0.028;
  grRoot.add(grCoverGroup);

  const coverDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.168, 0.168, 0.011, 56),
    grCoverMat,
  );
  coverDisc.rotation.x = Math.PI / 2;
  coverDisc.castShadow = true;
  grCoverGroup.add(coverDisc);

  const coverRim = new THREE.Mesh(new THREE.TorusGeometry(0.168, 0.009, 12, 56), grRimMat);
  grCoverGroup.add(coverRim);

  registerExplodable(grCoverGroup, new THREE.Vector3(0, 0, 0.92));
  addGuideLink(
    grDiscGroup,
    new THREE.Vector3(0, 0, 0.015),
    grCoverGroup,
    new THREE.Vector3(0, 0, -0.005),
  );
  registerAnchor(grCoverGroup, 'golden_record', new THREE.Vector3(0, 0.19, 0.06));
  tagComponent(grRoot, 'golden_record');

  // =========================================================================
  // 6. MHW-RTG NUCLEAR POWER BOOM (3× RTGs + INSTANCED SiGe THERMOCOUPLES)
  // =========================================================================
  const rtgRoot = new THREE.Group();
  rtgRoot.position.set(-0.78, -0.18, 0.25);
  rtgRoot.rotation.set(0.08, -0.22, 0.34);
  root.add(rtgRoot);

  const rtgCasingMat = makeStdMat(
    'rtg',
    {
      color: 0xffffff,
      map: textures.rtgMap,
      normalMap: textures.rtgNormal,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughnessMap: textures.rtgRoughness,
      aoMap: textures.rtgAo,
      aoMapIntensity: 0.78,
      roughness: 1.0,
      metalness: 0.58,
    },
    true,
  );

  const rtgFinMat = makeStdMat(
    'rtg',
    {
      color: 0x1b1f26,
      map: textures.rtgMap,
      normalMap: textures.rtgNormal,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.56,
      metalness: 0.64,
    },
    true,
  );

  const rtgTrussMat = makePhysMat('rtg', {
    color: 0xd8e0ea,
    map: textures.brushedMetalMap,
    normalMap: textures.brushedMetalNormal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.24,
    metalness: 0.92,
  });

  const rtgSiGeMat = makePhysMat('rtg', {
    color: 0x6f829c,
    roughness: 0.26,
    metalness: 0.9,
  });

  const rtgMolyMat = makePhysMat('rtg', {
    color: 0xd4a446,
    roughness: 0.24,
    metalness: 0.92,
  });

  const rtgPuGlowMat = makeStdMat('rtg', {
    color: 0xff6e1c,
    emissive: 0xff4500,
    emissiveIntensity: 1.65,
    roughness: 0.32,
    metalness: 0.18,
  });
  rtgGlowMaterials.push(rtgPuGlowMat);

  // Reinforced Silver-Titanium RTG Boom Deployment Truss & X-Braced Outrigger Cages
  const rtgSupportGroup = new THREE.Group();
  rtgRoot.add(rtgSupportGroup);

  const hingeClevis = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.28, 16), rtgTrussMat);
  hingeClevis.position.set(-0.04, 0, 0);
  rtgSupportGroup.add(hingeClevis);

  // Open bright aluminum root truss pyramid + cross-braces (signature Voyager silhouette)
  addStrut(rtgSupportGroup, new THREE.Vector3(0, 0.18, 0.17), new THREE.Vector3(-0.74, 0.14, 0.11), 0.018, rtgTrussMat);
  addStrut(rtgSupportGroup, new THREE.Vector3(0, 0.18, -0.17), new THREE.Vector3(-0.74, 0.14, -0.11), 0.018, rtgTrussMat);
  addStrut(rtgSupportGroup, new THREE.Vector3(0, -0.18, 0.12), new THREE.Vector3(-0.74, -0.16, 0.09), 0.018, rtgTrussMat);
  addStrut(rtgSupportGroup, new THREE.Vector3(0, -0.18, -0.12), new THREE.Vector3(-0.74, -0.16, -0.09), 0.018, rtgTrussMat);
  // Diagonal X-bracing bays inside root truss
  addStrut(rtgSupportGroup, new THREE.Vector3(0, 0.18, 0.17), new THREE.Vector3(-0.74, -0.16, 0.09), 0.011, rtgTrussMat, false);
  addStrut(rtgSupportGroup, new THREE.Vector3(0, -0.18, 0.12), new THREE.Vector3(-0.74, 0.14, 0.11), 0.011, rtgTrussMat, false);
  addStrut(rtgSupportGroup, new THREE.Vector3(0, 0.18, -0.17), new THREE.Vector3(-0.74, -0.16, -0.09), 0.011, rtgTrussMat, false);
  addStrut(rtgSupportGroup, new THREE.Vector3(0, -0.18, -0.12), new THREE.Vector3(-0.74, 0.14, -0.11), 0.011, rtgTrussMat, false);
  // Outer protective silver titanium stand-off struts flanking the aft RTG units
  addStrut(rtgSupportGroup, new THREE.Vector3(-2.1, 0.24, 0.2), new THREE.Vector3(-3.36, 0.19, 0.18), 0.012, rtgTrussMat, false);
  addStrut(rtgSupportGroup, new THREE.Vector3(-2.1, 0.24, -0.2), new THREE.Vector3(-3.36, 0.19, -0.18), 0.012, rtgTrussMat, false);
  addStrut(rtgSupportGroup, new THREE.Vector3(-2.1, 0.24, 0.2), new THREE.Vector3(-2.74, -0.16, 0.09), 0.01, rtgTrussMat, false);
  addStrut(rtgSupportGroup, new THREE.Vector3(-2.74, 0.22, 0.19), new THREE.Vector3(-3.36, -0.16, 0.09), 0.01, rtgTrussMat, false);
  addStrut(rtgSupportGroup, new THREE.Vector3(-2.1, 0.24, -0.2), new THREE.Vector3(-2.74, -0.16, -0.09), 0.01, rtgTrussMat, false);
  addStrut(rtgSupportGroup, new THREE.Vector3(-2.74, 0.22, -0.19), new THREE.Vector3(-3.36, -0.16, -0.09), 0.01, rtgTrussMat, false);

  // Twin spine rails beneath all 3 RTGs
  addStrut(rtgSupportGroup, new THREE.Vector3(-0.72, -0.16, 0.08), new THREE.Vector3(-3.44, -0.16, 0.08), 0.016, rtgTrussMat);
  addStrut(rtgSupportGroup, new THREE.Vector3(-0.72, -0.16, -0.08), new THREE.Vector3(-3.44, -0.16, -0.08), 0.016, rtgTrussMat);

  // Armored copper/Kapton DC power bus conduit running back from RTGs to bus
  const rtgCable = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.2, -0.19, 0),
    new THREE.Vector3(-1.8, -0.2, 0.04),
    new THREE.Vector3(-0.68, -0.16, 0.06),
    new THREE.Vector3(0.04, -0.08, 0.08),
  ]);
  rtgSupportGroup.add(new THREE.Mesh(new THREE.TubeGeometry(rtgCable, 24, 0.016, 8, false), rtgMolyMat));

  // Shared SiGe thermocouple unicouple geometry (instanced across each RTG unit!)
  const unicoupleGeo = new THREE.BoxGeometry(0.032, 0.038, 0.026);
  geometries.push(unicoupleGeo);
  const ucDummy = new THREE.Object3D();

  for (let u = 0; u < 3; u++) {
    const ux = -1.12 - u * 0.92;
    const unitGroup = new THREE.Group();
    unitGroup.position.set(ux, 0, 0);
    rtgRoot.add(unitGroup);

    const coreGroup = new THREE.Group();
    unitGroup.add(coreGroup);

    // 4 visible glowing Plutonium-238 fuel spheres cradled inside graphite impact rings
    for (let s = 0; s < 4; s++) {
      const sx = -0.3 + s * 0.2;
      const puSphere = new THREE.Mesh(new THREE.SphereGeometry(0.072, 20, 16), rtgPuGlowMat);
      puSphere.position.set(sx, 0, 0);
      coreGroup.add(puSphere);

      const impactRing = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.012, 8, 12), rtgFinMat);
      impactRing.rotation.y = Math.PI / 2;
      impactRing.position.set(sx, 0, 0);
      coreGroup.add(impactRing);
    }

    // Instanced cylindrical matrix of 48 Silicon-Germanium (SiGe) thermoelectric unicouples per RTG
    const ucMesh = new THREE.InstancedMesh(unicoupleGeo, rtgSiGeMat, 48);
    let ucIdx = 0;
    for (let ring = 0; ring < 4; ring++) {
      const rx = -0.3 + ring * 0.2;
      for (let k = 0; k < 12; k++) {
        const ka = (k / 12) * Math.PI * 2;
        ucDummy.position.set(rx, Math.cos(ka) * 0.125, Math.sin(ka) * 0.125);
        ucDummy.rotation.set(ka, 0, 0);
        ucDummy.scale.set(1, 1, 1);
        ucDummy.updateMatrix();
        ucMesh.setMatrixAt(ucIdx++, ucDummy.matrix);
      }
    }
    ucMesh.instanceMatrix.needsUpdate = true;
    ucMesh.computeBoundingSphere();
    coreGroup.add(ucMesh);

    // Molybdenum multifoil collector rings at ends of core
    for (const ex of [-0.39, 0.39]) {
      const molyEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.025, 24), rtgMolyMat);
      molyEnd.rotation.z = Math.PI / 2;
      molyEnd.position.x = ex;
      coreGroup.add(molyEnd);
    }

    // Split Beryllium-Coated Finned Radiator Casings
    for (const half of [-1, 1]) {
      const shellHalf = new THREE.Group();
      unitGroup.add(shellHalf);

      const halfCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.175,
          0.175,
          0.84,
          20,
          1,
          false,
          half === 1 ? 0 : Math.PI,
          Math.PI,
        ),
        rtgCasingMat,
      );
      halfCyl.rotation.z = Math.PI / 2;
      halfCyl.castShadow = true;
      shellHalf.add(halfCyl);

      // 4 tapered longitudinal radiator cooling fins per half (8 total per RTG)
      for (let f = 0; f < 4; f++) {
        const fa = (half === 1 ? 0 : Math.PI) + ((f + 0.5) / 4) * Math.PI;
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.013, 0.105), rtgFinMat);
        fin.position.set(0, Math.cos(fa) * 0.218, Math.sin(fa) * 0.218);
        fin.rotation.x = -fa + Math.PI / 2;
        fin.castShadow = true;
        shellHalf.add(fin);
      }

      registerExplodable(shellHalf, new THREE.Vector3(0, half * 0.06, half * 0.46));
      if (u === 1 && half === 1) {
        addGuideLink(
          coreGroup,
          new THREE.Vector3(0, 0, 0),
          shellHalf,
          new THREE.Vector3(0, 0, 0.18),
        );
      }
    }

    // Titanium inter-stage tie-rod clamping flange ring
    const clampRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.198, 0.198, 0.052, 24),
      rtgTrussMat,
    );
    clampRing.rotation.z = Math.PI / 2;
    clampRing.position.x = 0.43;
    unitGroup.add(clampRing);

    if (u === 2) {
      // Aft RTG pressure-relief end dome
      const endDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.175, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        rtgTrussMat,
      );
      endDome.rotation.z = Math.PI / 2;
      endDome.position.x = -0.42;
      unitGroup.add(endDome);
    }
  }

  registerAnchor(rtgRoot, 'rtg', new THREE.Vector3(-2.05, 0.34, 0.2));
  tagComponent(rtgRoot, 'rtg');

  // =========================================================================
  // 7. SCIENCE BOOM & ARTICULATED SCAN PLATFORM (ISS, IRIS, UVS, PPS)
  // =========================================================================
  const sciBoomRoot = new THREE.Group();
  sciBoomRoot.position.set(0.84, 0.06, 0.14);
  sciBoomRoot.rotation.set(0, -0.14, 0.04);
  root.add(sciBoomRoot);

  const boomAlumMat = makePhysMat('scan_platform', {
    color: 0xd0d8e4,
    map: textures.brushedMetalMap,
    normalMap: textures.brushedMetalNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.28,
    metalness: 0.88,
  });

  const optBaffleMat = makeStdMat(
    'scan_platform',
    {
      color: 0xffffff,
      map: textures.blackMliMap,
      normalMap: textures.blackMliNormal,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: textures.blackMliRoughness,
      roughness: 1.0,
      metalness: 0.34,
    },
    true,
  );

  const irisWhiteShellMat = makeStdMat(
    'scan_platform',
    {
      color: 0xf7f6f1,
      map: textures.whiteThermalMap,
      normalMap: textures.whiteThermalNormal,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughnessMap: textures.whiteThermalRoughness,
      roughness: 1.0,
      metalness: 0.1,
      side: THREE.FrontSide,
    },
    true,
  );

  const optGoldMat = makePhysMat('scan_platform', {
    color: 0xeeb942,
    map: textures.kaptonMap,
    normalMap: textures.kaptonNormal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: textures.kaptonRoughness,
    roughness: 1.0,
    metalness: 0.92,
  });

  const optGlassMat = makePhysMat('scan_platform', {
    color: 0x4aa8ff,
    roughness: 0.06,
    metalness: 0.12,
    transmission: isSoftwareGl ? 0 : 0.84,
    transparent: true,
    opacity: isSoftwareGl ? 0.52 : 0.95,
    ior: 1.56,
    thickness: 0.12,
    clearcoat: 1.0,
  });

  const optMirrorMat = makePhysMat('scan_platform', {
    color: 0xf0f6ff,
    roughness: 0.05,
    metalness: 0.98,
    clearcoat: 0.7,
  });

  const optGoldMirrorMat = makePhysMat('scan_platform', {
    color: 0xf6c94d,
    roughness: 0.06,
    metalness: 0.98,
    clearcoat: 0.6,
  });

  const optPcbMat = makeStdMat('scan_platform', {
    color: 0xffffff,
    map: textures.pcbMap,
    normalMap: textures.pcbNormal,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughnessMap: textures.pcbRoughness,
    roughness: 1.0,
    metalness: 0.42,
  });

  // Reinforced 2.3m Triangular Lattice Science Boom
  const boomLen = 2.15;
  const rBoom = 0.115;
  for (let c = 0; c < 3; c++) {
    const a = (c / 3) * Math.PI * 2;
    addStrut(
      sciBoomRoot,
      new THREE.Vector3(0, Math.cos(a) * rBoom, Math.sin(a) * rBoom),
      new THREE.Vector3(boomLen, Math.cos(a) * rBoom * 0.72, Math.sin(a) * rBoom * 0.72),
      0.014,
      boomAlumMat,
      true,
    );
  }
  for (let b = 0; b < 8; b++) {
    const x0 = (b / 8) * boomLen;
    const x1 = ((b + 1) / 8) * boomLen;
    for (let c = 0; c < 3; c++) {
      const a0 = (c / 3) * Math.PI * 2;
      const a1 = ((c + 1) / 3) * Math.PI * 2;
      const s0 = 1 - (b / 8) * 0.28;
      const s1 = 1 - ((b + 1) / 8) * 0.28;
      addStrut(
        sciBoomRoot,
        new THREE.Vector3(x0, Math.cos(a0) * rBoom * s0, Math.sin(a0) * rBoom * s0),
        new THREE.Vector3(x1, Math.cos(a1) * rBoom * s1, Math.sin(a1) * rBoom * s1),
        0.008,
        boomAlumMat,
        false,
      );
      // Transverse triangular bulkhead batten
      addStrut(
        sciBoomRoot,
        new THREE.Vector3(x0, Math.cos(a0) * rBoom * s0, Math.sin(a0) * rBoom * s0),
        new THREE.Vector3(x0, Math.cos(a1) * rBoom * s0, Math.sin(a1) * rBoom * s0),
        0.007,
        boomAlumMat,
        false,
      );
    }
  }
  // Dual Kapton-wrapped data/power cable looms clamped along boom
  addStrut(sciBoomRoot, new THREE.Vector3(0, -0.055, 0.025), new THREE.Vector3(boomLen, -0.04, 0.02), 0.018, optGoldMat, false);
  addStrut(sciBoomRoot, new THREE.Vector3(0, -0.055, -0.025), new THREE.Vector3(boomLen, -0.04, -0.02), 0.014, boomAlumMat, false);

  // Two-Axis Articulated Azimuth/Elevation Gimbal Head
  const scanHeadGroup = new THREE.Group();
  scanHeadGroup.position.set(boomLen + 0.14, 0, 0);
  sciBoomRoot.add(scanHeadGroup);

  const azActuator = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.26, 20), boomAlumMat);
  scanHeadGroup.add(azActuator);

  const elActuator = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.28, 18), optBaffleMat);
  elActuator.rotation.x = Math.PI / 2;
  elActuator.position.set(0.08, 0, 0);
  scanHeadGroup.add(elActuator);

  // Flexible Kapton gimbal service cable loop
  const gimbalLoop = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.08, -0.04, 0.02),
    new THREE.Vector3(0.02, -0.18, 0.1),
    new THREE.Vector3(0.14, -0.12, 0.06),
  ]);
  scanHeadGroup.add(new THREE.Mesh(new THREE.TubeGeometry(gimbalLoop, 14, 0.014, 8, false), optGoldMat));

  const platformBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.44, 0.58), optBaffleMat);
  platformBase.position.set(0.14, 0, 0);
  platformBase.castShadow = true;
  scanHeadGroup.add(platformBase);

  // Internal focal-plane electronics PCB exposed when housings slide forward
  const scanPcb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.44), optPcbMat);
  scanPcb.position.set(0.19, 0, 0);
  scanHeadGroup.add(scanPcb);

  // 1) ISS Narrow-Angle 1500mm Cassegrain Telescope (Spider vanes + Primary/Secondary mirrors + Filter wheel)
  const issNarrowBarrel = new THREE.Group();
  issNarrowBarrel.position.set(0.26, 0.14, 0.16);
  scanHeadGroup.add(issNarrowBarrel);

  const issTube = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.098, 0.46, 28, 1, true), optBaffleMat);
  issTube.rotation.z = -Math.PI / 2;
  issTube.position.x = 0.21;
  issTube.castShadow = true;
  issNarrowBarrel.add(issTube);

  // Front knife-edge sun baffle collar & optical corrector glass
  const issCollar = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.01, 10, 28), boomAlumMat);
  issCollar.rotation.y = Math.PI / 2;
  issCollar.position.x = 0.44;
  issNarrowBarrel.add(issCollar);

  const issLens = new THREE.Mesh(new THREE.CircleGeometry(0.084, 28), optGlassMat);
  issLens.rotation.y = Math.PI / 2;
  issLens.position.x = 0.42;
  issNarrowBarrel.add(issLens);

  // 3-vane Cassegrain secondary mirror spider & central hyperbolic secondary
  const secMirror = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.025, 16), optBaffleMat);
  secMirror.rotation.z = -Math.PI / 2;
  secMirror.position.x = 0.39;
  issNarrowBarrel.add(secMirror);
  for (let v = 0; v < 3; v++) {
    const va = (v / 3) * Math.PI * 2;
    addStrut(
      issNarrowBarrel,
      new THREE.Vector3(0.39, 0, 0),
      new THREE.Vector3(0.39, Math.cos(va) * 0.088, Math.sin(va) * 0.088),
      0.003,
      boomAlumMat,
      false,
    );
  }

  // Exposed internal parabolic primary mirror, 8-color optical filter wheel & glowing vidicon tube
  const issMirror = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.024, 28), optMirrorMat);
  issMirror.rotation.z = -Math.PI / 2;
  issMirror.position.set(0.31, 0.14, 0.16);
  scanHeadGroup.add(issMirror);

  const filterWheelGroup = new THREE.Group();
  filterWheelGroup.position.set(0.265, 0.14, 0.16);
  scanHeadGroup.add(filterWheelGroup);

  const filterWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.018, 24), boomAlumMat);
  filterWheel.rotation.z = -Math.PI / 2;
  filterWheelGroup.add(filterWheel);

  // Authentic Voyager 8-color optical filter wheel cells (Clear, Violet, Blue, Green, Orange, UV, CH4, Na-D)
  const filterColors = [0xf8fafc, 0x7c3aed, 0x2563eb, 0x16a34a, 0xea580c, 0x4f46e5, 0xdc2626, 0xfacc15];
  filterColors.forEach((hex, idx) => {
    const fa = (idx / filterColors.length) * Math.PI * 2;
    const fMat = makePhysMat('scan_platform', {
      color: hex,
      emissive: hex,
      emissiveIntensity: 0.25,
      roughness: 0.1,
      metalness: 0.15,
      clearcoat: 1.0,
    });
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.022, 14), fMat);
    cell.rotation.z = -Math.PI / 2;
    cell.position.set(0, Math.cos(fa) * 0.045, Math.sin(fa) * 0.045);
    filterWheelGroup.add(cell);
  });

  // Selenium-sulfur Vidicon imaging sensor tube behind filter wheel
  const vidiconTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.036, 0.085, 18),
    optGoldMirrorMat,
  );
  vidiconTube.rotation.z = -Math.PI / 2;
  vidiconTube.position.set(0.21, 0.14, 0.16);
  scanHeadGroup.add(vidiconTube);

  registerExplodable(issNarrowBarrel, new THREE.Vector3(0.5, 0.12, 0.08));
  addGuideLink(
    scanHeadGroup,
    new THREE.Vector3(0.28, 0.14, 0.16),
    issNarrowBarrel,
    new THREE.Vector3(0, 0, 0),
  );

  // 2) ISS Wide-Angle 200mm Vidicon Camera
  const issWideBarrel = new THREE.Group();
  issWideBarrel.position.set(0.26, 0.14, -0.06);
  scanHeadGroup.add(issWideBarrel);

  const wideTube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.068, 0.28, 24), optBaffleMat);
  wideTube.rotation.z = -Math.PI / 2;
  wideTube.position.x = 0.13;
  issWideBarrel.add(wideTube);

  const wideCollar = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 24), boomAlumMat);
  wideCollar.rotation.y = Math.PI / 2;
  wideCollar.position.x = 0.27;
  issWideBarrel.add(wideCollar);

  const wideLens = new THREE.Mesh(new THREE.CircleGeometry(0.052, 24), optGlassMat);
  wideLens.rotation.y = Math.PI / 2;
  wideLens.position.x = 0.272;
  issWideBarrel.add(wideLens);

  registerExplodable(issWideBarrel, new THREE.Vector3(0.4, 0.16, -0.06));

  // 3) IRIS 50cm Infrared Interferometer Spectrometer (Iconic matte-white outer radiator cylinder + gleaming gold inner cavity)
  const irisShroud = new THREE.Group();
  irisShroud.position.set(0.26, -0.14, 0.08);
  scanHeadGroup.add(irisShroud);

  const irisBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.172, 0.164, 0.38, 36, 1, true),
    irisWhiteShellMat,
  );
  irisBarrel.rotation.z = -Math.PI / 2;
  irisBarrel.position.x = 0.18;
  irisBarrel.castShadow = true;
  irisShroud.add(irisBarrel);

  // Gleaming reflective gold inner barrel wall visible inside IRIS aperture (matches reference image)
  const irisInnerWallMat = makePhysMat('scan_platform', {
    color: 0xf4c244,
    roughness: 0.12,
    metalness: 0.96,
    side: THREE.BackSide,
  });
  const irisInnerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(0.165, 0.158, 0.37, 36, 1, true),
    irisInnerWallMat,
  );
  irisInnerWall.rotation.z = -Math.PI / 2;
  irisInnerWall.position.x = 0.18;
  irisShroud.add(irisInnerWall);

  const irisRim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 12, 36), optGoldMirrorMat);
  irisRim.rotation.y = Math.PI / 2;
  irisRim.position.x = 0.37;
  irisShroud.add(irisRim);

  // IRIS secondary mirror & 3 spider struts
  const irisSec = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.024, 18), optGoldMirrorMat);
  irisSec.rotation.z = -Math.PI / 2;
  irisSec.position.x = 0.3;
  irisShroud.add(irisSec);
  for (let v = 0; v < 3; v++) {
    const va = (v / 3) * Math.PI * 2 + Math.PI / 6;
    addStrut(
      irisShroud,
      new THREE.Vector3(0.3, 0, 0),
      new THREE.Vector3(0.3, Math.cos(va) * 0.16, Math.sin(va) * 0.16),
      0.004,
      boomAlumMat,
      false,
    );
  }

  // Internal gold-coated parabolic primary infrared mirror inside IRIS
  const irisMirror = new THREE.Mesh(
    new THREE.CylinderGeometry(0.146, 0.146, 0.028, 32),
    optGoldMirrorMat,
  );
  irisMirror.rotation.z = -Math.PI / 2;
  irisMirror.position.set(0.29, -0.14, 0.08);
  scanHeadGroup.add(irisMirror);

  registerExplodable(irisShroud, new THREE.Vector3(0.55, -0.14, 0.06));

  // 4) UVS Ultraviolet Spectrometer & PPS Photopolarimeter
  const uvsGroup = new THREE.Group();
  uvsGroup.position.set(0.28, -0.11, -0.19);
  scanHeadGroup.add(uvsGroup);
  uvsGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.16), optBaffleMat));
  // Collimator slit grille on UVS front
  for (let s = -2; s <= 2; s++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.008), boomAlumMat);
    slat.position.set(0.145, 0, s * 0.022);
    uvsGroup.add(slat);
  }
  // PPS compact 20cm telescope tube mounted beside UVS
  const ppsTube = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.22, 18), boomAlumMat);
  ppsTube.rotation.z = -Math.PI / 2;
  ppsTube.position.set(0.05, 0.11, -0.02);
  uvsGroup.add(ppsTube);

  registerExplodable(uvsGroup, new THREE.Vector3(0.36, -0.12, -0.24));

  registerAnchor(scanHeadGroup, 'scan_platform', new THREE.Vector3(0.35, 0.36, 0.1));
  tagComponent(sciBoomRoot, 'scan_platform');

  // =========================================================================
  // 8. COSMIC RAY (CRS 7-TELESCOPE), LECP & PLASMA SCIENCE (PLS FARADAY CUPS)
  // =========================================================================
  const particlesRoot = new THREE.Group();
  particlesRoot.position.set(1.52, 0.22, 0.14);
  root.add(particlesRoot);

  const partGoldMat = makePhysMat('particles', {
    color: 0xebb63f,
    map: textures.kaptonMap,
    normalMap: textures.kaptonNormal,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: textures.kaptonRoughness,
    roughness: 1.0,
    metalness: 0.9,
  });

  const partAlumMat = makePhysMat('particles', {
    color: 0xcbd4e0,
    map: textures.brushedMetalMap,
    normalMap: textures.brushedMetalNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.26,
    metalness: 0.9,
  });

  const partDarkMat = makeStdMat('particles', {
    color: 0xffffff,
    map: textures.blackMliMap,
    normalMap: textures.blackMliNormal,
    normalScale: new THREE.Vector2(1.35, 1.35),
    roughnessMap: textures.blackMliRoughness,
    roughness: 1.0,
    metalness: 0.34,
  });

  const partSiliconMat = makePhysMat('particles', {
    color: 0x3b82f6,
    roughness: 0.12,
    metalness: 0.88,
    clearcoat: 0.9,
  });

  const crsBox = new THREE.Group();
  crsBox.position.set(-0.22, 0.05, 0.14);
  particlesRoot.add(crsBox);

  const crsBody = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.22), partDarkMat);
  crsBody.castShadow = true;
  crsBox.add(crsBody);

  // Authentic 7 independent solid-state cosmic-ray detector telescopes (1 central HET + 6 ring LET/TET)
  const crsBarrels = new THREE.Group();
  crsBox.add(crsBarrels);
  const centralHet = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.15, 16), partAlumMat);
  centralHet.position.set(0, 0.135, 0);
  crsBarrels.add(centralHet);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.026, 0.12, 14), partAlumMat);
    tube.position.set(Math.cos(a) * 0.068, 0.12, Math.sin(a) * 0.068);
    crsBarrels.add(tube);
  }
  // Stacked metallic-blue silicon wafer detectors exposed underneath
  for (let w = 0; w < 3; w++) {
    const siWafer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072 - w * 0.01, 0.072 - w * 0.01, 0.014, 24),
      partSiliconMat,
    );
    siWafer.position.y = 0.092 + w * 0.018;
    crsBox.add(siWafer);
  }
  registerExplodable(crsBarrels, new THREE.Vector3(0, 0.36, 0.08));

  // LECP rotating stepper-motor azimuth turret
  const lecpTurretGroup = new THREE.Group();
  lecpTurretGroup.position.set(0.26, 0.02, -0.06);
  particlesRoot.add(lecpTurretGroup);

  const lecpBase = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.098, 0.14, 20), partDarkMat);
  lecpTurretGroup.add(lecpBase);

  const lecpHead = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.11, 0.13), partGoldMat);
  lecpHead.position.y = 0.115;
  lecpTurretGroup.add(lecpHead);

  // Dual opposing flared particle collimators + sun-shield vane
  const lecpCol1 = new THREE.Mesh(new THREE.ConeGeometry(0.054, 0.12, 18, 1, true), partAlumMat);
  lecpCol1.rotation.z = -Math.PI / 2;
  lecpCol1.position.set(0.12, 0.115, 0);
  lecpTurretGroup.add(lecpCol1);

  const lecpCol2 = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.08, 16, 1, true), partAlumMat);
  lecpCol2.rotation.z = Math.PI / 2;
  lecpCol2.position.set(-0.1, 0.115, 0);
  lecpTurretGroup.add(lecpCol2);

  const sunVane = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.14, 0.15), partAlumMat);
  sunVane.position.set(0, 0.12, 0.1);
  lecpTurretGroup.add(sunVane);

  registerExplodable(lecpTurretGroup, new THREE.Vector3(0.12, 0.3, -0.18));

  // PLS Tetrahedral 4-Faraday Cup Plasma Detector
  const plsCluster = new THREE.Group();
  plsCluster.position.set(-0.32, -0.22, -0.16);
  particlesRoot.add(plsCluster);

  const plsBody = new THREE.Mesh(new THREE.OctahedronGeometry(0.115, 0), partAlumMat);
  plsCluster.add(plsBody);
  for (let c = 0; c < 4; c++) {
    const a = (c / 4) * Math.PI * 2;
    const cupGroup = new THREE.Group();
    cupGroup.position.set(Math.cos(a) * 0.075, -0.04, Math.sin(a) * 0.075);
    cupGroup.rotation.z = Math.cos(a) * 0.52;
    cupGroup.rotation.x = -Math.sin(a) * 0.52;
    plsCluster.add(cupGroup);

    cupGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.028, 0.062, 16), partDarkMat));
    // Gold Faraday collector grid ring inside cup aperture
    const gridRing = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.004, 8, 16), partGoldMat);
    gridRing.rotation.x = Math.PI / 2;
    gridRing.position.y = -0.025;
    cupGroup.add(gridRing);
  }
  registerExplodable(plsCluster, new THREE.Vector3(-0.1, -0.34, -0.24));

  registerAnchor(particlesRoot, 'particles', new THREE.Vector3(0.02, 0.34, 0.12));
  tagComponent(particlesRoot, 'particles');

  // =========================================================================
  // 9. 13-METER MAGNETOMETER ASTROMAST BOOM (44-BAY INSTANCED LATTICE)
  // =========================================================================
  const magRoot = new THREE.Group();
  magRoot.position.set(-0.42, -0.15, -0.78);
  magRoot.rotation.set(0.16, 0.28, 0.04);
  root.add(magRoot);

  const magCanisterMat = makePhysMat('mag_boom', {
    color: 0xd9e1eb,
    map: textures.brushedMetalMap,
    normalMap: textures.brushedMetalNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.28,
    metalness: 0.86,
  });

  const magEpoxyMat = makeStdMat('mag_boom', {
    color: 0xe6d08e,
    map: textures.fiberglassMap,
    normalMap: textures.fiberglassNormal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 0.36,
    metalness: 0.32,
  });

  const magCopperMat = makePhysMat('mag_boom', {
    color: 0xd98038,
    roughness: 0.22,
    metalness: 0.94,
  });

  const magCanister = new THREE.Mesh(
    new THREE.CylinderGeometry(0.125, 0.125, 0.38, 24),
    magCanisterMat,
  );
  magCanister.rotation.x = Math.PI / 2;
  magCanister.position.z = -0.19;
  magCanister.castShadow = true;
  magRoot.add(magCanister);

  // Ribbed launch-latch rings on deployment canister
  for (const cz of [-0.04, -0.19, -0.35]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.011, 8, 24), magCopperMat);
    rib.position.z = cz;
    magRoot.add(rib);
  }

  const magLen = 7.5;
  const magR = 0.098;
  const magBays = 44;

  for (let c = 0; c < 3; c++) {
    const a = (c / 3) * Math.PI * 2 - Math.PI / 2;
    const longeron = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0085, 0.0085, magLen, 8),
      magEpoxyMat,
    );
    longeron.rotation.x = Math.PI / 2;
    longeron.position.set(Math.cos(a) * magR, Math.sin(a) * magR, -0.34 - magLen / 2);
    magRoot.add(longeron);
  }

  // Instanced 44-bay triangular battens & cross-tension wires (264 struts in 1 draw call!)
  const battenLen = magR * Math.sqrt(3);
  const bayStep = magLen / magBays;
  const diagLen = Math.hypot(battenLen, bayStep);

  const battenGeo = new THREE.CylinderGeometry(0.0044, 0.0044, 1, 6);
  geometries.push(battenGeo);
  const latticeInstanced = new THREE.InstancedMesh(battenGeo, magEpoxyMat, magBays * 6);
  latticeInstanced.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vMid = new THREE.Vector3();
  const vDir = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  let idx = 0;

  for (let b = 0; b < magBays; b++) {
    const z0 = -0.34 - b * bayStep;
    const z1 = z0 - bayStep;
    for (let c = 0; c < 3; c++) {
      const a0 = (c / 3) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((c + 1) / 3) * Math.PI * 2 - Math.PI / 2;

      vA.set(Math.cos(a0) * magR, Math.sin(a0) * magR, z0);
      vB.set(Math.cos(a1) * magR, Math.sin(a1) * magR, z0);
      vMid.copy(vA).add(vB).multiplyScalar(0.5);
      vDir.subVectors(vB, vA).normalize();
      dummy.position.copy(vMid);
      dummy.quaternion.setFromUnitVectors(yAxis, vDir);
      dummy.scale.set(1, battenLen, 1);
      dummy.updateMatrix();
      latticeInstanced.setMatrixAt(idx++, dummy.matrix);

      vB.set(Math.cos(a1) * magR, Math.sin(a1) * magR, z1);
      vMid.copy(vA).add(vB).multiplyScalar(0.5);
      vDir.subVectors(vB, vA).normalize();
      dummy.position.copy(vMid);
      dummy.quaternion.setFromUnitVectors(yAxis, vDir);
      dummy.scale.set(0.7, diagLen, 0.7);
      dummy.updateMatrix();
      latticeInstanced.setMatrixAt(idx++, dummy.matrix);
    }
  }
  latticeInstanced.instanceMatrix.needsUpdate = true;
  latticeInstanced.computeBoundingSphere();
  magRoot.add(latticeInstanced);

  // Mid-boom High-Field Magnetometer (HFM) & Tip Low-Field Magnetometer (LFM) Helmholtz Coils
  const hfmNode = new THREE.Group();
  hfmNode.position.set(0, 0, -0.34 - magLen * 0.52);
  magRoot.add(hfmNode);
  hfmNode.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.13), magCopperMat));
  const hfmCover = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.088, 0.19, 14),
    magCanisterMat,
  );
  hfmCover.rotation.x = Math.PI / 2;
  hfmNode.add(hfmCover);
  registerExplodable(hfmCover, new THREE.Vector3(0, 0.3, 0));

  const lfmNode = new THREE.Group();
  lfmNode.position.set(0, 0, -0.34 - magLen - 0.06);
  magRoot.add(lfmNode);
  // Orthogonal copper-wound triaxial fluxgate sensor bobbins
  const coilX = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.012, 10, 20), magCopperMat);
  coilX.rotation.y = Math.PI / 2;
  const coilY = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.012, 10, 20), magCopperMat);
  coilY.rotation.x = Math.PI / 2;
  const coilZ = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.012, 10, 20), magCopperMat);
  lfmNode.add(coilX, coilY, coilZ);

  const lfmCover = new THREE.Mesh(
    new THREE.CylinderGeometry(0.108, 0.108, 0.23, 18),
    magCanisterMat,
  );
  lfmCover.rotation.x = Math.PI / 2;
  lfmNode.add(lfmCover);
  // Crisp triangular silver-aluminum magnetometer tip alignment bracket (visible in reference image)
  for (let c = 0; c < 3; c++) {
    const a0 = (c / 3) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((c + 1) / 3) * Math.PI * 2 - Math.PI / 2;
    addStrut(
      lfmNode,
      new THREE.Vector3(Math.cos(a0) * 0.135, Math.sin(a0) * 0.135, -0.14),
      new THREE.Vector3(Math.cos(a1) * 0.135, Math.sin(a1) * 0.135, -0.14),
      0.011,
      magCanisterMat,
      false,
    );
  }
  registerExplodable(lfmCover, new THREE.Vector3(0, 0, -0.38));

  registerAnchor(magRoot, 'mag_boom', new THREE.Vector3(0, 0.28, -3.4));
  tagComponent(magRoot, 'mag_boom');

  // =========================================================================
  // 10. PLANETARY RADIO (PRA) & PLASMA WAVE (PWS) 10m ORTHOGONAL WHIPS
  // =========================================================================
  const praRoot = new THREE.Group();
  praRoot.position.set(0.32, -0.26, -0.58);
  root.add(praRoot);

  const whipMat = makePhysMat('pra_pws', {
    color: 0xe0ae70,
    roughness: 0.22,
    metalness: 0.94,
  });

  const praCanisterMat = makePhysMat('pra_pws', {
    color: 0xeeb942,
    map: textures.kaptonMap,
    normalMap: textures.kaptonNormal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap: textures.kaptonRoughness,
    roughness: 1.0,
    metalness: 0.9,
  });

  const praPreampMat = makeStdMat('pra_pws', {
    color: 0x3b4454,
    roughness: 0.42,
    metalness: 0.76,
  });

  const praBox = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.2), praPreampMat);
  praRoot.add(praBox);

  const whipLen = 5.25;
  const whipDirs = [
    new THREE.Vector3(0.66, -0.58, -0.47).normalize(),
    new THREE.Vector3(-0.32, -0.68, -0.66).normalize(),
  ];

  whipDirs.forEach((dir, idx) => {
    const whipSub = new THREE.Group();
    praRoot.add(whipSub);

    const canister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.044, 0.052, 0.24, 16),
      praCanisterMat,
    );
    canister.position.copy(dir).multiplyScalar(0.15);
    canister.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    whipSub.add(canister);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.008, 8, 16), praPreampMat);
    collar.position.copy(dir).multiplyScalar(0.26);
    collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    whipSub.add(collar);

    const whipMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.015, whipLen, 10),
      whipMat,
    );
    whipMesh.position.copy(dir).multiplyScalar(0.24 + whipLen / 2);
    whipMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    whipSub.add(whipMesh);

    // End-cap corona discharge sphere at whip tip
    const tipSphere = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), whipMat);
    tipSphere.position.copy(dir).multiplyScalar(0.24 + whipLen);
    whipSub.add(tipSphere);

    registerExplodable(whipSub, dir.clone().multiplyScalar(0.46 + idx * 0.1));
  });

  registerAnchor(praRoot, 'pra_pws', new THREE.Vector3(1.1, -1.25, -0.95));
  tagComponent(praRoot, 'pra_pws');

  // =========================================================================
  // EXPLODED VIEW DASHED ASSEMBLY GUIDE LINES
  // =========================================================================
  const guideLinePositions = new Float32Array(guideLinks.length * 6);
  const guideLineGeo = new THREE.BufferGeometry();
  guideLineGeo.setAttribute('position', new THREE.BufferAttribute(guideLinePositions, 3));
  geometries.push(guideLineGeo);

  const guideLineMat = new THREE.LineDashedMaterial({
    color: 0xf59e0b,
    dashSize: 0.06,
    gapSize: 0.045,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  materials.push(guideLineMat);

  const guideLines = new THREE.LineSegments(guideLineGeo, guideLineMat);
  guideLines.frustumCulled = false;
  root.add(guideLines);

  // =========================================================================
  // 11. TOGGLEABLE 3D REFERENCE VECTORS (DSN X-BAND BEAM, SUN, VELOCITY)
  // =========================================================================
  const vectorsGroup = new THREE.Group();
  vectorsGroup.visible = false;
  root.add(vectorsGroup);

  const addVectorArrow = (
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    length: number,
    colorHex: number,
  ) => {
    const unit = dir.clone().normalize();
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
    });
    materials.push(mat);

    const shaftLen = length - 0.34;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, shaftLen, 10), mat);
    shaft.position.copy(origin).addScaledVector(unit, shaftLen * 0.5);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), unit);
    vectorsGroup.add(shaft);

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.34, 14), mat);
    head.position.copy(origin).addScaledVector(unit, shaftLen + 0.17);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), unit);
    vectorsGroup.add(head);
  };

  // 1) Earth / DSN X-Band Downlink RF Beam Cone along HGA boresight (+Y)
  const dsnBeamMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  materials.push(dsnBeamMat);
  const dsnConeGeo = new THREE.ConeGeometry(1.15, 5.2, 36, 1, true);
  // Flip cone so narrow apex starts near HGA subreflector and expands toward Earth (+Y)
  dsnConeGeo.rotateX(Math.PI);
  dsnConeGeo.translate(0, 4.9, 0);
  geometries.push(dsnConeGeo);
  const dsnCone = new THREE.Mesh(dsnConeGeo, dsnBeamMat);
  vectorsGroup.add(dsnCone);

  addVectorArrow(new THREE.Vector3(0, 2.55, 0), new THREE.Vector3(0, 1, 0), 4.6, 0x22d3ee);

  // 2) Solar Direction Vector (warm amber arrow toward distant Sun at 42,36,34)
  addVectorArrow(
    new THREE.Vector3(0, 0.15, 0),
    new THREE.Vector3(42, 36, 34),
    4.6,
    0xf59e0b,
  );

  // 3) Interstellar Velocity Vector (~17.0 km/s heading north of ecliptic relative to heliopause)
  addVectorArrow(
    new THREE.Vector3(0, 0.15, 0),
    new THREE.Vector3(-0.35, -0.82, 0.46),
    4.4,
    0x10b981,
  );

  // Visual glowing section-cut plane indicator ring
  const cutawayRingMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  materials.push(cutawayRingMat);
  const cutawayIndicator = new THREE.Mesh(new THREE.RingGeometry(2.38, 2.43, 64), cutawayRingMat);
  cutawayIndicator.rotation.y = Math.PI / 2;
  cutawayIndicator.visible = false;
  root.add(cutawayIndicator);

  const _startW = new THREE.Vector3();
  const _endW = new THREE.Vector3();
  const _highlightGold = new THREE.Color(0xf59e0b);
  const _highlightCyan = new THREE.Color(0x06b6d4);
  const _hoverTint = new THREE.Color(0x38bdf8);

  const updateExplode = (amount: number) => {
    const clamped = THREE.MathUtils.clamp(amount, 0, 1);
    for (let i = 0; i < explodables.length; i++) {
      const p = explodables[i];
      p.object.position.set(
        p.basePos.x + p.explodeOffset.x * clamped,
        p.basePos.y + p.explodeOffset.y * clamped,
        p.basePos.z + p.explodeOffset.z * clamped,
      );
      if (p.baseRot && p.explodeRot) {
        p.object.rotation.set(
          p.baseRot.x + p.explodeRot.x * clamped,
          p.baseRot.y + p.explodeRot.y * clamped,
          p.baseRot.z + p.explodeRot.z * clamped,
        );
      }
    }

    if (clamped > 0.015) {
      root.updateMatrixWorld(true);
      const posAttr = guideLineGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < guideLinks.length; i++) {
        guideLinks[i].startObj.getWorldPosition(_startW);
        guideLinks[i].endObj.getWorldPosition(_endW);
        root.worldToLocal(_startW);
        root.worldToLocal(_endW);
        posAttr.setXYZ(i * 2, _startW.x, _startW.y, _startW.z);
        posAttr.setXYZ(i * 2 + 1, _endW.x, _endW.y, _endW.z);
      }
      posAttr.needsUpdate = true;
      guideLines.computeLineDistances();
      guideLineMat.opacity = Math.min(0.75, clamped * 0.85);
      guideLines.visible = true;
    } else {
      guideLines.visible = false;
    }

    for (let i = 0; i < rtgGlowMaterials.length; i++) {
      rtgGlowMaterials[i].emissiveIntensity = 1.4 + clamped * 1.45;
    }
  };

  const updateHighlights = (
    activeSubsystem: SubsystemId,
    selectedId: ComponentId | null,
    hoveredId: ComponentId | null,
    explodeAmount: number,
    xrayMode = false,
  ) => {
    const hasFilter = activeSubsystem !== 'all';

    for (let i = 0; i < materialRecords.length; i++) {
      const rec = materialRecords[i];
      const mat = rec.material;
      const isSelected = selectedId === rec.componentId;
      const isHovered = hoveredId === rec.componentId;
      const matchesSubsystem = !hasFilter || rec.subsystem === activeSubsystem;
      const isRtgGlow = rtgGlowMaterials.includes(mat as THREE.MeshStandardMaterial);

      // X-Ray hull mode turns exterior shells translucent to expose internal circuitry/cores
      const xrayTransparent = xrayMode && rec.isExteriorShell;

      if (isSelected) {
        mat.emissive.copy(rec.subsystem === 'communications' ? _highlightCyan : _highlightGold);
        mat.emissiveIntensity = isRtgGlow ? 2.8 : 0.34;
        mat.opacity = xrayTransparent ? 0.24 : rec.baseOpacity;
        mat.transparent = xrayTransparent || rec.baseTransparent;
        mat.depthWrite = !mat.transparent || mat.opacity > 0.9;
      } else if (isHovered) {
        mat.emissive.copy(_hoverTint);
        mat.emissiveIntensity = isRtgGlow ? 2.5 : 0.22;
        mat.opacity = xrayTransparent ? 0.24 : rec.baseOpacity;
        mat.transparent = xrayTransparent || rec.baseTransparent;
        mat.depthWrite = !mat.transparent || mat.opacity > 0.9;
      } else if (hasFilter && matchesSubsystem) {
        mat.emissive.copy(rec.subsystem === 'communications' ? _highlightCyan : _highlightGold);
        mat.emissiveIntensity = isRtgGlow ? 2.5 : 0.16;
        mat.opacity = xrayTransparent ? 0.22 : rec.baseOpacity;
        mat.transparent = xrayTransparent || rec.baseTransparent;
        mat.depthWrite = !mat.transparent || mat.opacity > 0.9;
      } else if (hasFilter && !matchesSubsystem) {
        mat.emissive.copy(rec.baseEmissive);
        mat.emissiveIntensity = isRtgGlow ? 0.35 : 0;
        mat.transparent = true;
        mat.opacity = Math.min(rec.baseOpacity, xrayTransparent ? 0.1 : 0.22);
        mat.depthWrite = false;
      } else {
        mat.emissive.copy(rec.baseEmissive);
        mat.emissiveIntensity = isRtgGlow
          ? 1.55 + (explodeAmount + (xrayMode ? 0.7 : 0)) * 1.25
          : rec.baseEmissiveIntensity;
        mat.opacity = xrayTransparent ? 0.19 : rec.baseOpacity;
        mat.transparent = xrayTransparent || rec.baseTransparent;
        mat.depthWrite = !mat.transparent || mat.opacity > 0.9;
      }
    }
  };

  const setLouverOpenness = (openness: number) => {
    const t = THREE.MathUtils.clamp(openness, 0, 1);
    const angle = THREE.MathUtils.lerp(0.08, 1.32, t);
    for (let i = 0; i < louverBlades.length; i++) {
      louverBlades[i].rotation.x = angle;
    }
  };

  const setScanAngles = (azDeg: number, elDeg: number) => {
    scanHeadGroup.rotation.y = THREE.MathUtils.degToRad(azDeg);
    scanHeadGroup.rotation.z = THREE.MathUtils.degToRad(elDeg);
  };

  const setThrusterPulse = (intensity: number) => {
    const v = THREE.MathUtils.clamp(intensity, 0, 1);
    thrusterPlumeMat.opacity = v * 0.85;
    const show = v > 0.02;
    for (let i = 0; i < thrusterPlumes.length; i++) {
      thrusterPlumes[i].visible = show;
      if (show) {
        const flicker = 0.85 + Math.sin(i * 1.7 + v * 28) * 0.18;
        thrusterPlumes[i].scale.set(0.85 + v * 0.3, (0.4 + v * 0.9) * flicker, 0.85 + v * 0.3);
      }
    }
  };

  const setShowVectors = (visible: boolean) => {
    vectorsGroup.visible = visible;
  };

  const setCutawayDepth = (depth01: number) => {
    const d = THREE.MathUtils.clamp(depth01, 0, 1);
    if (d <= 0.005) {
      cutawayIndicator.visible = false;
      for (let i = 0; i < materialRecords.length; i++) {
        materialRecords[i].material.clippingPlanes = [];
      }
      return;
    }
    // Slice plane moves cleanly across the spacecraft from X = +2.35 down to X = -2.35
    const planeX = THREE.MathUtils.lerp(2.35, -2.35, d);
    cutawayPlane.constant = planeX;
    cutawayIndicator.position.set(planeX, 0.25, 0);
    cutawayIndicator.visible = true;
    for (let i = 0; i < materialRecords.length; i++) {
      const m = materialRecords[i].material;
      if (!m.clippingPlanes || m.clippingPlanes.length === 0) {
        m.clippingPlanes = [cutawayPlane];
      }
    }
  };

  return {
    root,
    explodables,
    anchors,
    raycastTargets,
    materialRecords,
    guideLines,
    guideLinePositions,
    guideLinks,
    rtgGlowMaterials,
    scanHeadGroup,
    lecpTurretGroup,
    gyroRotors,
    updateExplode,
    updateHighlights,
    setLouverOpenness,
    setScanAngles,
    setThrusterPulse,
    setShowVectors,
    setCutawayDepth,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
