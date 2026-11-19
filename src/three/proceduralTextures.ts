import * as THREE from 'three';

export interface ProceduralTextureSet {
  dishMap: THREE.CanvasTexture;
  dishNormal: THREE.CanvasTexture;
  dishRoughness: THREE.CanvasTexture;
  dishAo: THREE.CanvasTexture;
  kaptonMap: THREE.CanvasTexture;
  kaptonNormal: THREE.CanvasTexture;
  kaptonRoughness: THREE.CanvasTexture;
  blackMliMap: THREE.CanvasTexture;
  blackMliNormal: THREE.CanvasTexture;
  blackMliRoughness: THREE.CanvasTexture;
  brushedMetalMap: THREE.CanvasTexture;
  brushedMetalNormal: THREE.CanvasTexture;
  brushedMetalRoughness: THREE.CanvasTexture;
  whiteThermalMap: THREE.CanvasTexture;
  whiteThermalNormal: THREE.CanvasTexture;
  whiteThermalRoughness: THREE.CanvasTexture;
  osrMap: THREE.CanvasTexture;
  osrNormal: THREE.CanvasTexture;
  osrRoughness: THREE.CanvasTexture;
  fiberglassMap: THREE.CanvasTexture;
  fiberglassNormal: THREE.CanvasTexture;
  pcbMap: THREE.CanvasTexture;
  pcbNormal: THREE.CanvasTexture;
  pcbRoughness: THREE.CanvasTexture;
  pcbMetalness: THREE.CanvasTexture;
  recordCoverMap: THREE.CanvasTexture;
  recordCoverNormal: THREE.CanvasTexture;
  recordCoverRoughness: THREE.CanvasTexture;
  recordDiscMap: THREE.CanvasTexture;
  recordDiscNormal: THREE.CanvasTexture;
  recordDiscRoughness: THREE.CanvasTexture;
  busPanelMap: THREE.CanvasTexture;
  busPanelNormal: THREE.CanvasTexture;
  busPanelRoughness: THREE.CanvasTexture;
  busPanelAo: THREE.CanvasTexture;
  busPanelMetalness: THREE.CanvasTexture;
  rtgMap: THREE.CanvasTexture;
  rtgNormal: THREE.CanvasTexture;
  rtgRoughness: THREE.CanvasTexture;
  rtgAo: THREE.CanvasTexture;
  calTargetMap: THREE.CanvasTexture;
  starSpriteMap: THREE.CanvasTexture;
  dispose: () => void;
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = Math.min(maxAnisotropy, 16);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Converts a grayscale heightfield canvas into a crisp tangent-space RGB normal map
 * using a 3x3 Sobel filter with wrapping boundary conditions.
 */
function heightToNormalCanvas(
  heightCanvas: HTMLCanvasElement,
  strength: number,
): HTMLCanvasElement {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, w, h).data;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d')!;
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  const sample = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return srcData[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;

      let nx = -dX;
      let ny = -dY;
      let nz = 1.0;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * w + x) * 4;
      dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return outCanvas;
}

/**
 * Derives a subtle baked Ambient Occlusion canvas from a heightfield so recessed
 * panel crevices, rivet grooves, and seam lines hold crisp contact shadows.
 */
function heightToAoCanvas(
  heightCanvas: HTMLCanvasElement,
  contrast = 0.72,
): HTMLCanvasElement {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcData = heightCanvas.getContext('2d')!.getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const outCtx = out.getContext('2d')!;
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  for (let i = 0; i < srcData.length; i += 4) {
    const hv = srcData[i] / 255;
    // Recessed cavities (hv < 0.5) darken contact AO; flat/raised stays bright
    const ao = Math.min(1, Math.max(0.32, 0.55 + hv * contrast));
    const v = Math.round(ao * 255);
    dst[i] = v;
    dst[i + 1] = v;
    dst[i + 2] = v;
    dst[i + 3] = 255;
  }
  outCtx.putImageData(outImg, 0, 0);
  return out;
}

/**
 * Inverts and thresholds a roughness canvas into a calibrated metalness mask
 * (glossy gold traces, metal bezels & fasteners = metallic; matte epoxy/MLI = dielectric).
 */
function roughnessToMetalnessCanvas(
  roughCanvas: HTMLCanvasElement,
  threshold = 0.38,
  baseMetal = 0.14,
  highMetal = 0.94,
): HTMLCanvasElement {
  const w = roughCanvas.width;
  const h = roughCanvas.height;
  const srcData = roughCanvas.getContext('2d')!.getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const outCtx = out.getContext('2d')!;
  const outImg = outCtx.createImageData(w, h);
  const dst = outImg.data;

  for (let i = 0; i < srcData.length; i += 4) {
    const rv = srcData[i] / 255;
    const m = rv < threshold ? highMetal : baseMetal;
    const v = Math.round(m * 255);
    dst[i] = v;
    dst[i + 1] = v;
    dst[i + 2] = v;
    dst[i + 3] = 255;
  }
  outCtx.putImageData(outImg, 0, 0);
  return out;
}

/**
 * Shared multi-octave crinkled MLI foil generator (used for both gold Kapton and
 * Voyager's iconic matte-black carbon-filled conductive thermal blankets).
 */
function drawMultiOctaveCrinkles(
  size: number,
  ctx: CanvasRenderingContext2D,
  hCtx: CanvasRenderingContext2D,
  rCtx: CanvasRenderingContext2D,
  seed: number,
  palette: {
    baseColor: (t: number) => [number, number, number];
    ridgeStroke: (alpha: number) => string;
    roughMin: number;
    roughSpan: number;
  },
  octaves: { grid: number; alpha: number; heightAmp: number }[],
) {
  const rand = seededRand(seed);

  octaves.forEach(({ grid, alpha, heightAmp }) => {
    const step = size / grid;
    const pts: { x: number; y: number }[][] = [];
    for (let y = 0; y <= grid; y++) {
      pts[y] = [];
      for (let x = 0; x <= grid; x++) {
        // Periodic edge jitter so the texture tiles seamlessly across panels
        const jx = x === 0 || x === grid ? 0 : (rand() - 0.5) * step * 0.82;
        const jy = y === 0 || y === grid ? 0 : (rand() - 0.5) * step * 0.82;
        pts[y][x] = { x: x * step + jx, y: y * step + jy };
      }
    }

    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const p00 = pts[y][x];
        const p10 = pts[y][x + 1];
        const p01 = pts[y + 1][x];
        const p11 = pts[y + 1][x + 1];

        const drawTri = (
          a: { x: number; y: number },
          b: { x: number; y: number },
          c: { x: number; y: number },
        ) => {
          const t = rand();
          const [r, g, bl] = palette.baseColor(t);

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.closePath();
          ctx.fillStyle = `rgba(${r},${g},${bl},${alpha})`;
          ctx.fill();
          ctx.strokeStyle = palette.ridgeStroke(alpha);
          ctx.lineWidth = grid > 20 ? 0.65 : 1.05;
          ctx.stroke();

          const hv = Math.max(0, Math.min(255, Math.floor(128 + (t - 0.5) * 2 * heightAmp)));
          hCtx.beginPath();
          hCtx.moveTo(a.x, a.y);
          hCtx.lineTo(b.x, b.y);
          hCtx.lineTo(c.x, c.y);
          hCtx.closePath();
          hCtx.fillStyle = `rgba(${hv},${hv},${hv},${alpha})`;
          hCtx.fill();
          hCtx.strokeStyle = `rgba(248,248,248,${alpha * 0.58})`;
          hCtx.lineWidth = grid > 20 ? 0.85 : 1.25;
          hCtx.stroke();

          const rv = Math.max(
            0,
            Math.min(255, Math.floor(palette.roughMin + (1 - t) * palette.roughSpan)),
          );
          rCtx.beginPath();
          rCtx.moveTo(a.x, a.y);
          rCtx.lineTo(b.x, b.y);
          rCtx.lineTo(c.x, c.y);
          rCtx.closePath();
          rCtx.fillStyle = `rgba(${rv},${rv},${rv},${alpha})`;
          rCtx.fill();
        };

        if (rand() > 0.5) {
          drawTri(p00, p10, p11);
          drawTri(p00, p11, p01);
        } else {
          drawTri(p00, p10, p01);
          drawTri(p10, p11, p01);
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// 1. HIGH-GAIN PARABOLIC DISH (2048px — Warm Ivory Thermal Paint, Gore Seams,
//    Honeycomb Micro-Texture, Scalloped Rim Trim & Countersunk Rivets)
// ---------------------------------------------------------------------------
function createDishCanvases() {
  const size = 2048;
  const color = document.createElement('canvas');
  const height = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = height.width = rough.width = size;
  color.height = height.height = rough.height = size;

  const ctx = color.getContext('2d')!;
  const hCtx = height.getContext('2d')!;
  const rCtx = rough.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  // Authentic Voyager warm matte off-white/eggshell aerospace thermal coating
  const radGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, size * 0.5);
  radGrad.addColorStop(0, '#cfcFC7');
  radGrad.addColorStop(0.16, '#dfdfd8');
  radGrad.addColorStop(0.68, '#dcdbd4');
  radGrad.addColorStop(0.92, '#d2d2ca');
  radGrad.addColorStop(0.975, '#c2c3bc');
  radGrad.addColorStop(1, '#aeafb0');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#828282';
  hCtx.fillRect(0, 0, size, size);

  // Matte white thermal paint base roughness (~0.62)
  rCtx.fillStyle = '#9f9f9f';
  rCtx.fillRect(0, 0, size, size);

  // Fine aluminum honeycomb core print-through & micro-speckled thermal paint grain
  const rand = seededRand(1977);
  for (let i = 0; i < 34000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const a = 0.012 + rand() * 0.026;
    const v = rand() > 0.48 ? 248 : 138;
    ctx.fillStyle = `rgba(${v},${v},${v - 4},${a})`;
    ctx.fillRect(x, y, 2, 2);

    const hv = rand() > 0.5 ? 142 : 118;
    hCtx.fillStyle = `rgba(${hv},${hv},${hv},0.22)`;
    hCtx.fillRect(x, y, 2, 2);

    const rv = rand() > 0.5 ? 172 : 146;
    rCtx.fillStyle = `rgba(${rv},${rv},${rv},0.25)`;
    rCtx.fillRect(x, y, 3, 3);
  }

  // Subtle crimped/scalloped aluminum tape wraps around the outer perimeter lip (iconic Voyager detail)
  const rimCrimps = 96;
  for (let i = 0; i < rimCrimps; i++) {
    const a0 = (i / rimCrimps) * Math.PI * 2;
    const a1 = ((i + 0.5) / rimCrimps) * Math.PI * 2;
    const rIn = size * 0.472;
    const rOut = size * 0.498;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a0) * rIn, cy + Math.sin(a0) * rIn);
    ctx.lineTo(cx + Math.cos(a1) * rOut, cy + Math.sin(a1) * rOut);
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(92, 96, 102, 0.34)' : 'rgba(255, 255, 250, 0.32)';
    ctx.lineWidth = 3.2;
    ctx.stroke();

    hCtx.beginPath();
    hCtx.moveTo(cx + Math.cos(a0) * rIn, cy + Math.sin(a0) * rIn);
    hCtx.lineTo(cx + Math.cos(a1) * rOut, cy + Math.sin(a1) * rOut);
    hCtx.strokeStyle = i % 2 === 0 ? '#404040' : '#d2d2d2';
    hCtx.lineWidth = 4.2;
    hCtx.stroke();
  }

  // Concentric aluminum tape seams & honeycomb ring splices
  const rings = [0.14, 0.31, 0.51, 0.72, 0.89, 0.962];
  rings.forEach((rFrac, rIdx) => {
    const r = rFrac * size * 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = rIdx === 5 ? 'rgba(116, 120, 126, 0.48)' : 'rgba(104, 108, 114, 0.2)';
    ctx.lineWidth = rIdx === 5 ? 9 : 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(66, 70, 76, 0.35)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    hCtx.beginPath();
    hCtx.arc(cx, cy, r, 0, Math.PI * 2);
    hCtx.strokeStyle = '#3c3c3c';
    hCtx.lineWidth = 4.5;
    hCtx.stroke();

    rCtx.beginPath();
    rCtx.arc(cx, cy, r, 0, Math.PI * 2);
    rCtx.strokeStyle = '#525252';
    rCtx.lineWidth = 7;
    rCtx.stroke();
  });

  // 16 radial aluminum honeycomb gore panel seams + subtle panel tone shifts + double rivet rows
  const sectors = 16;
  for (let i = 0; i < sectors; i++) {
    const angle = (i / sectors) * Math.PI * 2;
    const nextAngle = ((i + 1) / sectors) * Math.PI * 2;
    const x0 = cx + Math.cos(angle) * size * 0.065;
    const y0 = cy + Math.sin(angle) * size * 0.065;
    const x1 = cx + Math.cos(angle) * size * 0.494;
    const y1 = cy + Math.sin(angle) * size * 0.494;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, size * 0.49, angle, nextAngle);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,253,246,0.032)' : 'rgba(85,88,94,0.028)';
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = 'rgba(78, 82, 90, 0.32)';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    hCtx.beginPath();
    hCtx.moveTo(x0, y0);
    hCtx.lineTo(x1, y1);
    hCtx.strokeStyle = '#303030';
    hCtx.lineWidth = 4;
    hCtx.stroke();

    rCtx.beginPath();
    rCtx.moveTo(x0, y0);
    rCtx.lineTo(x1, y1);
    rCtx.strokeStyle = '#585858';
    rCtx.lineWidth = 6;
    rCtx.stroke();

    // Countersunk double rivet rows along each gore seam
    for (let t = 0.16; t <= 0.94; t += 0.045) {
      for (const side of [-0.01, 0.01]) {
        const rx = cx + Math.cos(angle + side) * size * 0.5 * t;
        const ry = cy + Math.sin(angle + side) * size * 0.5 * t;
        ctx.fillStyle = 'rgba(88, 92, 100, 0.44)';
        ctx.beginPath();
        ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
        ctx.fill();

        hCtx.fillStyle = '#dadada';
        hCtx.beginPath();
        hCtx.arc(rx, ry, 2.8, 0, Math.PI * 2);
        hCtx.fill();
      }
    }

    // Photogrammetric fiducial alignment crosshairs on 4 cardinal axes
    if (i % 4 === 0) {
      const fx = cx + Math.cos(angle + Math.PI / 16) * size * 0.39;
      const fy = cy + Math.sin(angle + Math.PI / 16) * size * 0.39;
      ctx.strokeStyle = 'rgba(65, 70, 78, 0.48)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(fx - 12, fy);
      ctx.lineTo(fx + 12, fy);
      ctx.moveTo(fx, fy - 12);
      ctx.lineTo(fx, fy + 12);
      ctx.arc(fx, fy, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  return {
    color,
    normal: heightToNormalCanvas(height, 2.6),
    rough,
    ao: heightToAoCanvas(height, 0.78),
  };
}

// ---------------------------------------------------------------------------
// 2. CRINKLED GOLD KAPTON MLI FOIL (1024px — 3-Octave Aerospace Foil)
// ---------------------------------------------------------------------------
function createKaptonCanvases() {
  const size = 1024;
  const color = document.createElement('canvas');
  const height = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = height.width = rough.width = size;
  color.height = height.height = rough.height = size;

  const ctx = color.getContext('2d')!;
  const hCtx = height.getContext('2d')!;
  const rCtx = rough.getContext('2d')!;

  ctx.fillStyle = '#c88d1d';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#404040';
  rCtx.fillRect(0, 0, size, size);

  drawMultiOctaveCrinkles(
    size,
    ctx,
    hCtx,
    rCtx,
    770905,
    {
      baseColor: (t) => [
        Math.min(255, Math.floor(158 + t * 96)),
        Math.min(255, Math.floor(100 + t * 98)),
        Math.min(255, Math.floor(14 + t * 48)),
      ],
      ridgeStroke: (a) => `rgba(255, 232, 152, ${a * 0.34})`,
      roughMin: 26,
      roughSpan: 64,
    },
    [
      { grid: 10, alpha: 1.0, heightAmp: 120 },
      { grid: 22, alpha: 0.48, heightAmp: 78 },
      { grid: 42, alpha: 0.24, heightAmp: 46 },
    ],
  );

  // Subtle Kapton overlap tape seam across foil sheet
  ctx.strokeStyle = 'rgba(248, 202, 82, 0.34)';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, size - 14, size - 14);

  return { color, normal: heightToNormalCanvas(height, 5.2), rough };
}

// ---------------------------------------------------------------------------
// 3. CRINKLED MATTE-BLACK CONDUCTIVE THERMAL BLANKET MLI (1024px)
//    Matches Voyager's iconic dark graphite/black faceted Kapton-Dacron blankets
//    on the HGA rear collar, bus aft face, ISS camera wraps & particle housings
// ---------------------------------------------------------------------------
function createBlackMliCanvases() {
  const size = 1024;
  const color = document.createElement('canvas');
  const height = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = height.width = rough.width = size;
  color.height = height.height = rough.height = size;

  const ctx = color.getContext('2d')!;
  const hCtx = height.getContext('2d')!;
  const rCtx = rough.getContext('2d')!;

  ctx.fillStyle = '#14171c';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#929292';
  rCtx.fillRect(0, 0, size, size);

  drawMultiOctaveCrinkles(
    size,
    ctx,
    hCtx,
    rCtx,
    19771977,
    {
      baseColor: (t) => {
        const v = Math.floor(16 + t * 34);
        return [v, v + 2, v + 5];
      },
      ridgeStroke: (a) => `rgba(115, 126, 142, ${a * 0.28})`,
      roughMin: 74,
      roughSpan: 118,
    },
    [
      { grid: 9, alpha: 1.0, heightAmp: 122 },
      { grid: 20, alpha: 0.52, heightAmp: 82 },
      { grid: 38, alpha: 0.28, heightAmp: 50 },
    ],
  );

  // Conductive carbon-tape blanket seams & grounding straps
  ctx.strokeStyle = 'rgba(56, 62, 72, 0.55)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, size - 10, size - 10);
  rCtx.strokeStyle = '#505050';
  rCtx.lineWidth = 10;
  rCtx.strokeRect(5, 5, size - 10, size - 10);

  return { color, normal: heightToNormalCanvas(height, 5.8), rough };
}

// ---------------------------------------------------------------------------
// 4. ANISOTROPIC BRUSHED AEROSPACE ALUMINUM / TITANIUM METAL (512px)
// ---------------------------------------------------------------------------
function createBrushedMetalCanvases() {
  const size = 512;
  const color = document.createElement('canvas');
  const height = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = height.width = rough.width = size;
  color.height = height.height = rough.height = size;

  const ctx = color.getContext('2d')!;
  const hCtx = height.getContext('2d')!;
  const rCtx = rough.getContext('2d')!;

  ctx.fillStyle = '#c8d0da';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#565656';
  rCtx.fillRect(0, 0, size, size);

  const rand = seededRand(6061);
  // Fine horizontal anisotropic machining brush streaks
  for (let i = 0; i < 4200; i++) {
    const y = rand() * size;
    const x = rand() * size;
    const len = 30 + rand() * 140;
    const bright = rand() > 0.5;
    const v = bright ? 226 + Math.floor(rand() * 28) : 162 + Math.floor(rand() * 34);
    ctx.strokeStyle = `rgba(${v},${v + 2},${v + 6},${0.08 + rand() * 0.14})`;
    ctx.lineWidth = 0.8 + rand() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();

    const hv = bright ? 156 : 102;
    hCtx.strokeStyle = `rgba(${hv},${hv},${hv},0.28)`;
    hCtx.lineWidth = 1;
    hCtx.beginPath();
    hCtx.moveTo(x, y);
    hCtx.lineTo(x + len, y);
    hCtx.stroke();

    const rv = bright ? 58 : 104;
    rCtx.strokeStyle = `rgba(${rv},${rv},${rv},0.28)`;
    rCtx.lineWidth = 1;
    rCtx.beginPath();
    rCtx.moveTo(x, y);
    rCtx.lineTo(x + len, y);
    rCtx.stroke();
  }

  // Subtle machined panel joint lines & fastener dots
  ctx.strokeStyle = 'rgba(72, 82, 96, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5);
  ctx.lineTo(size, size * 0.5);
  ctx.stroke();

  hCtx.strokeStyle = '#383838';
  hCtx.lineWidth = 2.5;
  hCtx.beginPath();
  hCtx.moveTo(0, size * 0.5);
  hCtx.lineTo(size, size * 0.5);
  hCtx.stroke();

  return { color, normal: heightToNormalCanvas(height, 1.8), rough };
}

// ---------------------------------------------------------------------------
// 5. WHITE THERMAL-PAINTED INSTRUMENT SHELL (IRIS RADIATOR / SUB-REFLECTOR)
//    Matches the iconic clean matte-white IRIS cylinder with dark baffle band
// ---------------------------------------------------------------------------
function createWhiteThermalCanvases() {
  const size = 1024;
  const color = document.createElement('canvas');
  const height = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = height.width = rough.width = size;
  color.height = height.height = rough.height = size;

  const ctx = color.getContext('2d')!;
  const hCtx = height.getContext('2d')!;
  const rCtx = rough.getContext('2d')!;

  ctx.fillStyle = '#e0dfd9';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#9e9e9e';
  rCtx.fillRect(0, 0, size, size);

  const rand = seededRand(5050);
  for (let i = 0; i < 12000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const v = rand() > 0.5 ? 245 : 178;
    ctx.fillStyle = `rgba(${v},${v},${v - 3},0.055)`;
    ctx.fillRect(x, y, 2, 2);
    const hv = rand() > 0.5 ? 140 : 116;
    hCtx.fillStyle = `rgba(${hv},${hv},${hv},0.2)`;
    hCtx.fillRect(x, y, 2, 2);
  }

  // Iconic dark charcoal-black thermal aperture band near front edge of IRIS cylinder
  ctx.fillStyle = '#181b21';
  ctx.fillRect(0, 32, size, 58);
  hCtx.fillStyle = '#5c5c5c';
  hCtx.fillRect(0, 32, size, 58);
  rCtx.fillStyle = '#747474';
  rCtx.fillRect(0, 32, size, 58);

  // Subtle gold/brass lip accent along front aperture rim
  ctx.fillStyle = '#c89e3c';
  ctx.fillRect(0, 0, size, 24);
  rCtx.fillStyle = '#323232';
  rCtx.fillRect(0, 0, size, 24);

  // Axial aluminum barrel panel seams & tiny flush screws
  for (let x = 0; x < size; x += 256) {
    ctx.strokeStyle = 'rgba(72, 76, 84, 0.34)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();

    hCtx.strokeStyle = '#383838';
    hCtx.lineWidth = 3;
    hCtx.beginPath();
    hCtx.moveTo(x, 0);
    hCtx.lineTo(x, size);
    hCtx.stroke();

    for (let y = 140; y < size - 60; y += 110) {
      ctx.fillStyle = '#8b929c';
      ctx.beginPath();
      ctx.arc(x + 18, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      hCtx.fillStyle = '#dcdcdc';
      hCtx.beginPath();
      hCtx.arc(x + 18, y, 3.8, 0, Math.PI * 2);
      hCtx.fill();
    }
  }

  // Rear mounting seam ring
  ctx.strokeStyle = 'rgba(65, 70, 78, 0.42)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, size - 78);
  ctx.lineTo(size, size - 78);
  ctx.stroke();
  hCtx.strokeStyle = '#2d2d2d';
  hCtx.lineWidth = 5;
  hCtx.beginPath();
  hCtx.moveTo(0, size - 78);
  hCtx.lineTo(size, size - 78);
  hCtx.stroke();

  return { color, normal: heightToNormalCanvas(height, 2.4), rough };
}

// ---------------------------------------------------------------------------
// 5B. SILVERED TEFLON OPTICAL SOLAR REFLECTOR (OSR) THERMAL MIRROR TILES
// ---------------------------------------------------------------------------
function createOsrCanvases() {
  const size = 512;
  const color = document.createElement('canvas');
  const height = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = height.width = rough.width = size;
  color.height = height.height = rough.height = size;

  const ctx = color.getContext('2d')!;
  const hCtx = height.getContext('2d')!;
  const rCtx = rough.getContext('2d')!;

  ctx.fillStyle = '#c8d6e6';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#c4c4c4';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#242424';
  rCtx.fillRect(0, 0, size, size);

  const tiles = 8;
  const step = size / tiles;
  const rand = seededRand(9901);

  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const shade = 192 + Math.floor(rand() * 38);
      const x = tx * step;
      const y = ty * step;
      const grad = ctx.createLinearGradient(x, y, x + step, y + step);
      grad.addColorStop(0, `rgb(${shade},${shade + 10},${Math.min(255, shade + 24)})`);
      grad.addColorStop(1, `rgb(${shade - 18},${shade - 6},${shade + 10})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x + 2, y + 2, step - 4, step - 4);

      // Grout seam between fused-silica silvered mirror tiles
      ctx.strokeStyle = '#1e2530';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, step - 3, step - 3);

      hCtx.strokeStyle = '#242424';
      hCtx.lineWidth = 4;
      hCtx.strokeRect(x + 1.5, y + 1.5, step - 3, step - 3);

      rCtx.strokeStyle = '#a0a0a0';
      rCtx.lineWidth = 4;
      rCtx.strokeRect(x + 1.5, y + 1.5, step - 3, step - 3);
    }
  }

  return { color, normal: heightToNormalCanvas(height, 2.8), rough };
}

// ---------------------------------------------------------------------------
// 6. WOVEN FIBERGLASS-EPOXY MAGNETOMETER ASTROMAST TEXTURE (512px)
// ---------------------------------------------------------------------------
function createFiberglassCanvases() {
  const size = 512;
  const color = document.createElement('canvas');
  const height = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = height.width = rough.width = size;
  color.height = height.height = rough.height = size;

  const ctx = color.getContext('2d')!;
  const hCtx = height.getContext('2d')!;

  ctx.fillStyle = '#6f5c30';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#707070';
  hCtx.fillRect(0, 0, size, size);

  // Tightly braided amber-gold fiberglass strands
  for (let y = 0; y < size; y += 8) {
    for (let x = 0; x < size; x += 8) {
      const alt = ((x + y) / 8) % 2 === 0;
      ctx.fillStyle = alt ? '#b9994a' : '#4a3d1e';
      ctx.fillRect(x, y, 6, 6);
      hCtx.fillStyle = alt ? '#c8c8c8' : '#424242';
      hCtx.fillRect(x, y, 6, 6);
    }
  }

  return { color, normal: heightToNormalCanvas(height, 2.8) };
}

// ---------------------------------------------------------------------------
// 7. 1970s JPL GOLD-TRACE FLIGHT AVIONICS PCB (1024px)
// ---------------------------------------------------------------------------
function createPcbCanvases() {
  const size = 1024;
  const color = document.createElement('canvas');
  const height = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = height.width = rough.width = size;
  color.height = height.height = rough.height = size;

  const ctx = color.getContext('2d')!;
  const hCtx = height.getContext('2d')!;
  const rCtx = rough.getContext('2d')!;

  ctx.fillStyle = '#113627';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#404040';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#747474';
  rCtx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255,255,255,0.032)';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  const drawBusRibbon = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    lanes: number,
    spacing: number,
    vertical: boolean,
  ) => {
    for (let l = 0; l < lanes; l++) {
      const off = l * spacing;
      ctx.strokeStyle = '#d8aa3c';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      if (vertical) {
        ctx.moveTo(x0 + off, y0);
        ctx.lineTo(x1 + off, y1);
      } else {
        ctx.moveTo(x0, y0 + off);
        ctx.lineTo(x1, y1 + off);
      }
      ctx.stroke();

      hCtx.strokeStyle = '#8e8e8e';
      hCtx.lineWidth = 2.8;
      hCtx.beginPath();
      if (vertical) {
        hCtx.moveTo(x0 + off, y0);
        hCtx.lineTo(x1 + off, y1);
      } else {
        hCtx.moveTo(x0, y0 + off);
        hCtx.lineTo(x1, y1 + off);
      }
      hCtx.stroke();

      rCtx.strokeStyle = '#282828';
      rCtx.lineWidth = 2.5;
      rCtx.beginPath();
      if (vertical) {
        rCtx.moveTo(x0 + off, y0);
        rCtx.lineTo(x1 + off, y1);
      } else {
        rCtx.moveTo(x0, y0 + off);
        rCtx.lineTo(x1, y1 + off);
      }
      rCtx.stroke();
    }
  };

  drawBusRibbon(48, 250, 976, 250, 8, 6, false);
  drawBusRibbon(48, 472, 976, 472, 8, 6, false);
  drawBusRibbon(48, 720, 976, 720, 6, 6, false);
  drawBusRibbon(302, 70, 302, 910, 5, 6, true);
  drawBusRibbon(602, 70, 602, 910, 5, 6, true);

  const rand = seededRand(19770820);
  for (let i = 0; i < 95; i++) {
    const x0 = Math.floor(rand() * 32) * 32 + 16;
    const y0 = Math.floor(rand() * 28) * 32 + 16;
    const len1 = (1 + Math.floor(rand() * 5)) * 32;
    const dir = rand() > 0.5 ? 1 : -1;
    const x1 = x0 + len1 * dir;
    const x2 = x1 + 20 * dir;
    const y2 = y0 + (rand() > 0.5 ? 20 : -20);
    const y3 = y2 + (1 + Math.floor(rand() * 3)) * 32 * (rand() > 0.5 ? 1 : -1);

    ctx.strokeStyle = '#d6a93b';
    ctx.lineWidth = rand() > 0.7 ? 3.8 : 2.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y3);
    ctx.stroke();

    hCtx.strokeStyle = '#929292';
    hCtx.lineWidth = ctx.lineWidth + 0.8;
    hCtx.beginPath();
    hCtx.moveTo(x0, y0);
    hCtx.lineTo(x1, y0);
    hCtx.lineTo(x2, y2);
    hCtx.lineTo(x2, y3);
    hCtx.stroke();

    rCtx.strokeStyle = '#2a2a2a';
    rCtx.lineWidth = ctx.lineWidth;
    rCtx.beginPath();
    rCtx.moveTo(x0, y0);
    rCtx.lineTo(x1, y0);
    rCtx.lineTo(x2, y2);
    rCtx.lineTo(x2, y3);
    rCtx.stroke();

    for (const [px, py] of [
      [x0, y0],
      [x2, y3],
    ]) {
      ctx.fillStyle = '#edc963';
      ctx.beginPath();
      ctx.arc(px, py, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#091811';
      ctx.beginPath();
      ctx.arc(px, py, 2.1, 0, Math.PI * 2);
      ctx.fill();
      hCtx.fillStyle = '#b4b4b4';
      hCtx.beginPath();
      hCtx.arc(px, py, 5.2, 0, Math.PI * 2);
      hCtx.fill();
    }
  }

  const chipSpecs = [
    { x: 64, y: 84, w: 206, h: 122, label: 'CCS-CPU-A', code: 'U01 · 18-BIT' },
    { x: 356, y: 84, w: 218, h: 122, label: 'PLATED-WIRE', code: 'MEM 4096W' },
    { x: 656, y: 84, w: 296, h: 122, label: 'FDS-LOGIC-01', code: 'CMOS-HI-REL' },
    { x: 64, y: 316, w: 216, h: 122, label: 'AACS-CTRL', code: 'U14 · GYRO' },
    { x: 356, y: 316, w: 218, h: 122, label: 'CMOS-RAM-B', code: 'U19 · 8192B' },
    { x: 656, y: 316, w: 296, h: 122, label: 'S/X-MODEM', code: 'RF-SYNTH-8G' },
    { x: 64, y: 544, w: 222, h: 132, label: 'PWR-REG-DC', code: '28V BUS' },
    { x: 356, y: 544, w: 224, h: 132, label: 'DTR-CTRL', code: '8-TRK TAPE' },
    { x: 656, y: 544, w: 296, h: 132, label: 'JPL-VGR-1977', code: 'FLIGHT UNIT 1' },
  ];

  chipSpecs.forEach((chip) => {
    ctx.strokeStyle = 'rgba(235, 242, 238, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(chip.x - 6, chip.y - 6, chip.w + 12, chip.h + 12);

    ctx.fillStyle = '#181b21';
    ctx.fillRect(chip.x, chip.y, chip.w, chip.h);
    hCtx.fillStyle = '#e6e6e6';
    hCtx.fillRect(chip.x, chip.y, chip.w, chip.h);
    rCtx.fillStyle = '#5c5c5c';
    rCtx.fillRect(chip.x, chip.y, chip.w, chip.h);

    ctx.fillStyle = '#d3a236';
    ctx.fillRect(chip.x + 12, chip.y + 12, chip.w - 24, chip.h - 24);
    ctx.strokeStyle = '#f6dc84';
    ctx.lineWidth = 2;
    ctx.strokeRect(chip.x + 12, chip.y + 12, chip.w - 24, chip.h - 24);
    hCtx.fillStyle = '#f6f6f6';
    hCtx.fillRect(chip.x + 12, chip.y + 12, chip.w - 24, chip.h - 24);
    rCtx.fillStyle = '#242424';
    rCtx.fillRect(chip.x + 12, chip.y + 12, chip.w - 24, chip.h - 24);

    ctx.fillStyle = '#ecc55d';
    hCtx.fillStyle = '#cccccc';
    rCtx.fillStyle = '#242424';
    for (let px = chip.x + 14; px < chip.x + chip.w - 14; px += 15) {
      ctx.fillRect(px, chip.y - 12, 6, 12);
      ctx.fillRect(px, chip.y + chip.h, 6, 12);
      hCtx.fillRect(px, chip.y - 12, 6, 12);
      hCtx.fillRect(px, chip.y + chip.h, 6, 12);
      rCtx.fillRect(px, chip.y - 12, 6, 12);
      rCtx.fillRect(px, chip.y + chip.h, 6, 12);
    }

    ctx.fillStyle = '#2a200a';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(chip.label, chip.x + 20, chip.y + chip.h / 2 - 2);
    ctx.font = '12px monospace';
    ctx.fillText(chip.code, chip.x + 20, chip.y + chip.h / 2 + 18);
  });

  const bandColors = ['#a13825', '#d97706', '#2563eb', '#d4af37'];
  for (let i = 0; i < 14; i++) {
    const rx = 68 + i * 64;
    const ry = 790;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rx, ry - 18);
    ctx.lineTo(rx, ry + 56);
    ctx.stroke();

    ctx.fillStyle = '#c49b6c';
    ctx.fillRect(rx - 10, ry, 20, 38);
    hCtx.fillStyle = '#dcdcdc';
    hCtx.fillRect(rx - 10, ry, 20, 38);

    bandColors.forEach((bc, bIdx) => {
      ctx.fillStyle = bc;
      ctx.fillRect(rx - 10, ry + 5 + bIdx * 8, 20, 4);
    });
  }

  for (let i = 0; i < 46; i++) {
    const x = 36 + i * 20.8;
    ctx.fillStyle = '#eab945';
    ctx.fillRect(x, size - 82, 12, 68);
    hCtx.fillStyle = '#c8c8c8';
    hCtx.fillRect(x, size - 82, 12, 68);
    rCtx.fillStyle = '#222222';
    rCtx.fillRect(x, size - 82, 12, 68);
  }

  return {
    color,
    normal: heightToNormalCanvas(height, 3.0),
    rough,
    metalness: roughnessToMetalnessCanvas(rough, 0.25, 0.08, 0.96),
  };
}

// ---------------------------------------------------------------------------
// 8. VOYAGER GOLDEN RECORD ENGRAVED COVER (1024px)
// ---------------------------------------------------------------------------
function createGoldenRecordCoverCanvases() {
  const size = 1024;
  const color = document.createElement('canvas');
  const height = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = height.width = rough.width = size;
  color.height = height.height = rough.height = size;

  const ctx = color.getContext('2d')!;
  const hCtx = height.getContext('2d')!;
  const rCtx = rough.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  const bg = ctx.createRadialGradient(cx * 0.85, cy * 0.85, 35, cx, cy, size * 0.56);
  bg.addColorStop(0, '#fae49e');
  bg.addColorStop(0.5, '#e2ba58');
  bg.addColorStop(0.88, '#c49836');
  bg.addColorStop(1, '#a47b24');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#a8a8a8';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#363636';
  rCtx.fillRect(0, 0, size, size);

  for (let r = 8; r < size * 0.5; r += 2) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r % 4 === 0 ? 'rgba(255,250,226,0.08)' : 'rgba(85,56,12,0.055)';
    ctx.lineWidth = 1;
    ctx.stroke();

    hCtx.beginPath();
    hCtx.arc(cx, cy, r, 0, Math.PI * 2);
    hCtx.strokeStyle = r % 4 === 0 ? '#b2b2b2' : '#9c9c9c';
    hCtx.lineWidth = 1;
    hCtx.stroke();
  }

  const etch = (drawFn: (c: CanvasRenderingContext2D) => void, lw = 4.2) => {
    ctx.save();
    ctx.strokeStyle = '#322206';
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    drawFn(ctx);
    ctx.stroke();
    ctx.restore();

    hCtx.save();
    hCtx.strokeStyle = '#181818';
    hCtx.lineWidth = lw + 1.4;
    hCtx.lineCap = 'round';
    hCtx.beginPath();
    drawFn(hCtx);
    hCtx.stroke();
    hCtx.restore();

    rCtx.save();
    rCtx.strokeStyle = '#b4b4b4';
    rCtx.lineWidth = lw + 1.2;
    rCtx.lineCap = 'round';
    rCtx.beginPath();
    drawFn(rCtx);
    rCtx.stroke();
    rCtx.restore();
  };

  etch((c) => c.arc(cx, cy, 476, 0, Math.PI * 2), 6.5);
  etch((c) => c.arc(cx, cy, 464, 0, Math.PI * 2), 2.2);

  const recX = 335;
  const recY = 300;
  etch((c) => c.arc(recX, recY, 132, 0, Math.PI * 2), 4.5);
  etch((c) => c.arc(recX, recY, 114, 0, Math.PI * 2), 2.0);
  etch((c) => c.arc(recX, recY, 46, 0, Math.PI * 2), 2.5);
  etch((c) => c.arc(recX, recY, 11, 0, Math.PI * 2), 3.0);
  etch((c) => {
    c.moveTo(recX - 98, recY - 84);
    c.lineTo(recX + 8, recY - 58);
    c.lineTo(recX + 40, recY - 22);
  }, 4.2);

  const bits = '101100101110100101101';
  for (let i = 0; i < bits.length; i++) {
    const a = -Math.PI * 0.9 + i * 0.085;
    const isOne = bits[i] === '1';
    const r0 = 144;
    const r1 = isOne ? 164 : 153;
    etch((c) => {
      c.moveTo(recX + Math.cos(a) * r0, recY + Math.sin(a) * r0);
      c.lineTo(recX + Math.cos(a) * r1, recY + Math.sin(a) * r1);
    }, 3.0);
  }

  etch((c) => {
    c.moveTo(212, 484);
    c.lineTo(458, 484);
    c.moveTo(212, 494);
    c.lineTo(458, 494);
    c.moveTo(312, 484);
    c.lineTo(312, 462);
    c.lineTo(358, 462);
    c.lineTo(358, 484);
    c.moveTo(218, 514);
    c.lineTo(452, 514);
  }, 3.4);

  etch((c) => {
    c.moveTo(570, 218);
    c.lineTo(605, 218);
    c.lineTo(614, 188);
    c.lineTo(626, 244);
    c.lineTo(642, 196);
    c.lineTo(658, 228);
    c.lineTo(676, 182);
    c.lineTo(698, 236);
    c.lineTo(724, 204);
    c.lineTo(748, 224);
    c.lineTo(792, 218);
  }, 3.6);
  etch((c) => c.rect(582, 282, 198, 148), 3.6);
  for (let y = 300; y < 424; y += 15) {
    etch((c) => {
      c.moveTo(594, y);
      c.lineTo(768, y);
    }, 1.7);
  }
  etch((c) => {
    c.rect(612, 458, 142, 112);
    c.moveTo(683 + 44, 514);
    c.arc(683, 514, 44, 0, Math.PI * 2);
  }, 3.6);

  const pX = 335;
  const pY = 710;
  const pulsarAngles = [
    0.16, 0.51, 0.93, 1.37, 1.84, 2.24, 2.67, 3.04, 3.44, 3.87, 4.34, 4.81, 5.37, 5.87,
  ];
  const pulsarLengths = [146, 118, 156, 98, 134, 148, 110, 158, 122, 94, 140, 126, 150, 108];
  pulsarAngles.forEach((ang, idx) => {
    const len = pulsarLengths[idx];
    const ex = pX + Math.cos(ang) * len;
    const ey = pY + Math.sin(ang) * len;
    etch((c) => {
      c.moveTo(pX, pY);
      c.lineTo(ex, ey);
    }, 3.0);

    for (let t = 0.38; t <= 0.88; t += 0.12) {
      const mx = pX + Math.cos(ang) * len * t;
      const my = pY + Math.sin(ang) * len * t;
      const perp = ang + Math.PI / 2;
      const tickHalf = (idx + Math.round(t * 10)) % 2 === 0 ? 7.5 : 4.2;
      etch((c) => {
        c.moveTo(mx - Math.cos(perp) * tickHalf, my - Math.sin(perp) * tickHalf);
        c.lineTo(mx + Math.cos(perp) * tickHalf, my + Math.sin(perp) * tickHalf);
      }, 2.4);
    }
  });

  ctx.beginPath();
  ctx.arc(210, 770, 27, 0, Math.PI * 2);
  ctx.fillStyle = '#cfcac0';
  ctx.fill();
  ctx.strokeStyle = '#4a3a18';
  ctx.lineWidth = 3;
  ctx.stroke();
  rCtx.beginPath();
  rCtx.arc(210, 770, 27, 0, Math.PI * 2);
  rCtx.fillStyle = '#202020';
  rCtx.fill();

  const hY = 735;
  const h1X = 632;
  const h2X = 768;
  etch((c) => {
    c.arc(h1X, hY, 42, 0, Math.PI * 2);
    c.moveTo(h2X + 42, hY);
    c.arc(h2X, hY, 42, 0, Math.PI * 2);
    c.moveTo(h1X + 42, hY);
    c.lineTo(h2X - 42, hY);
    c.moveTo(h1X + 4, hY);
    c.arc(h1X, hY, 4, 0, Math.PI * 2);
    c.moveTo(h2X + 4, hY);
    c.arc(h2X, hY, 4, 0, Math.PI * 2);
    c.moveTo(h1X, hY - 64);
    c.lineTo(h1X, hY - 48);
    c.moveTo(h2X, hY + 48);
    c.lineTo(h2X, hY + 64);
    c.moveTo(700, hY + 66);
    c.lineTo(700, hY + 94);
  }, 4.2);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const bx = cx + Math.cos(a) * 442;
    const by = cy + Math.sin(a) * 442;
    ctx.beginPath();
    ctx.arc(bx, by, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#684e1c';
    ctx.fill();
    hCtx.beginPath();
    hCtx.arc(bx, by, 11, 0, Math.PI * 2);
    hCtx.fillStyle = '#252525';
    hCtx.fill();
  }

  return { color, normal: heightToNormalCanvas(height, 3.4), rough };
}

// ---------------------------------------------------------------------------
// 9. GOLDEN RECORD GROOVED GOLD-PLATED COPPER LP DISC (1024px)
// ---------------------------------------------------------------------------
function createGoldenRecordDiscCanvases() {
  const size = 1024;
  const color = document.createElement('canvas');
  const height = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = height.width = rough.width = size;
  color.height = height.height = rough.height = size;

  const ctx = color.getContext('2d')!;
  const hCtx = height.getContext('2d')!;
  const rCtx = rough.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#e4ae34';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#303030';
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 360; i++) {
    const a = (i * Math.PI) / 180;
    const sheen = Math.pow(Math.abs(Math.cos(a * 2 + 0.55)), 2.8);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, size * 0.49, a, a + (Math.PI * 2) / 360 + 0.006);
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 244, 188, ${0.05 + sheen * 0.34})`;
    ctx.fill();
  }

  for (let r = 174; r < 490; r += 2.2) {
    const isBandGap =
      Math.abs(r - 238) < 4 ||
      Math.abs(r - 310) < 4 ||
      Math.abs(r - 388) < 4 ||
      Math.abs(r - 452) < 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = isBandGap ? 'rgba(255, 236, 160, 0.55)' : 'rgba(110, 72, 10, 0.38)';
    ctx.lineWidth = isBandGap ? 2.4 : 1.0;
    ctx.stroke();

    hCtx.beginPath();
    hCtx.arc(cx, cy, r, 0, Math.PI * 2);
    hCtx.strokeStyle = isBandGap ? '#c8c8c8' : r % 4.4 < 2.2 ? '#242424' : '#dedede';
    hCtx.lineWidth = 1.1;
    hCtx.stroke();

    rCtx.beginPath();
    rCtx.arc(cx, cy, r, 0, Math.PI * 2);
    rCtx.strokeStyle = isBandGap ? '#1c1c1c' : '#4a4a4a';
    rCtx.lineWidth = 1.1;
    rCtx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 168, 0, Math.PI * 2);
  ctx.fillStyle = '#d49d2a';
  ctx.fill();
  ctx.strokeStyle = '#68460b';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.save();
  ctx.fillStyle = '#472e07';
  ctx.font = 'bold 21px serif';
  ctx.textAlign = 'center';
  ctx.fillText('THE SOUNDS OF EARTH', cx, cy - 72);
  ctx.font = '14px monospace';
  ctx.fillText('TO THE MAKERS OF MUSIC', cx, cy - 42);
  ctx.fillText('VOYAGER 1 · NASA JPL · 1977', cx, cy + 82);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#16120b';
  ctx.fill();

  return { color, normal: heightToNormalCanvas(height, 3.2), rough };
}

// ---------------------------------------------------------------------------
// 10. BUS OUTER PANEL (1024px — Authentic Dark Graphite-Black Crinkled Conductive
//     MLI Blanket with Recessed Aluminum Frame Trim, Grounding Tabs & Fasteners)
// ---------------------------------------------------------------------------
function createBusPanelCanvases() {
  const size = 1024;
  const color = document.createElement('canvas');
  const height = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = height.width = rough.width = size;
  color.height = height.height = rough.height = size;

  const ctx = color.getContext('2d')!;
  const hCtx = height.getContext('2d')!;
  const rCtx = rough.getContext('2d')!;

  ctx.fillStyle = '#191d24';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#7e7e7e';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#989898';
  rCtx.fillRect(0, 0, size, size);

  // Realistic organic crinkled matte-graphite thermal blanket surface (matches reference image)
  drawMultiOctaveCrinkles(
    size,
    ctx,
    hCtx,
    rCtx,
    8812,
    {
      baseColor: (t) => {
        const v = Math.floor(20 + t * 34);
        return [v, v + 3, v + 7];
      },
      ridgeStroke: (a) => `rgba(128, 138, 154, ${a * 0.24})`,
      roughMin: 78,
      roughSpan: 112,
    },
    [
      { grid: 8, alpha: 1.0, heightAmp: 112 },
      { grid: 18, alpha: 0.46, heightAmp: 70 },
      { grid: 34, alpha: 0.22, heightAmp: 40 },
    ],
  );

  // Subtle horizontal & vertical thermal blanket stitch seams
  ctx.strokeStyle = 'rgba(72, 80, 92, 0.36)';
  ctx.lineWidth = 3;
  ctx.strokeRect(44, 44, size - 88, size - 88);
  hCtx.strokeStyle = '#323232';
  hCtx.lineWidth = 5;
  hCtx.strokeRect(44, 44, size - 88, size - 88);

  // Machined anodized dark-titanium perimeter trim flange (replaces cartoonish bright gold border)
  ctx.strokeStyle = '#3d4552';
  ctx.lineWidth = 24;
  ctx.strokeRect(12, 12, size - 24, size - 24);
  ctx.strokeStyle = '#788496';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, size - 48, size - 48);

  hCtx.strokeStyle = '#d4d4d4';
  hCtx.lineWidth = 22;
  hCtx.strokeRect(12, 12, size - 24, size - 24);

  rCtx.strokeStyle = '#484848';
  rCtx.lineWidth = 24;
  rCtx.strokeRect(12, 12, size - 24, size - 24);

  // Subtle stainless bay retention fasteners along frame edge
  const boltPos = [
    [48, 48],
    [size / 2, 42],
    [size - 48, 48],
    [48, size - 48],
    [size / 2, size - 42],
    [size - 48, size - 48],
    [42, size / 2],
    [size - 42, size / 2],
  ];
  boltPos.forEach(([x, y]) => {
    ctx.fillStyle = '#aeb8c6';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3c434f';
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();

    hCtx.fillStyle = '#ffffff';
    hCtx.beginPath();
    hCtx.arc(x, y, 11, 0, Math.PI * 2);
    hCtx.fill();

    rCtx.fillStyle = '#242424';
    rCtx.beginPath();
    rCtx.arc(x, y, 11, 0, Math.PI * 2);
    rCtx.fill();
  });

  // Grounding strap copper-gold foil tab at bottom-right corner
  ctx.fillStyle = '#b98b32';
  ctx.fillRect(size - 118, size - 78, 46, 18);
  rCtx.fillStyle = '#2e2e2e';
  rCtx.fillRect(size - 118, size - 78, 46, 18);

  // Crisp subtle JPL hardware bay stencil
  ctx.fillStyle = 'rgba(186, 198, 214, 0.32)';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('VGR-1 · BAY MLI', 68, size - 62);

  return {
    color,
    normal: heightToNormalCanvas(height, 4.2),
    rough,
    ao: heightToAoCanvas(height, 0.85),
    metalness: roughnessToMetalnessCanvas(rough, 0.32, 0.16, 0.9),
  };
}

// ---------------------------------------------------------------------------
// 11. MHW-RTG HIGH-EMISSIVITY IRON-TITANATE BERYLLIUM RADIATOR (1024px)
// ---------------------------------------------------------------------------
function createRtgCanvases() {
  const size = 1024;
  const color = document.createElement('canvas');
  const height = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = height.width = rough.width = size;
  color.height = height.height = rough.height = size;

  const ctx = color.getContext('2d')!;
  const hCtx = height.getContext('2d')!;
  const rCtx = rough.getContext('2d')!;

  // Deep matte-charcoal sintered iron-titanate high-emissivity thermal radiator coating
  const grad = ctx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, '#12151a');
  grad.addColorStop(0.5, '#1d2026');
  grad.addColorStop(1, '#111419');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#9c9c9c';
  rCtx.fillRect(0, 0, size, size);

  const rand = seededRand(238);
  for (let i = 0; i < 18000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const v = 14 + Math.floor(rand() * 32);
    ctx.fillStyle = `rgba(${v + 3},${v + 2},${v + 1},0.42)`;
    ctx.fillRect(x, y, 2, 2);
    const hv = 102 + Math.floor(rand() * 52);
    hCtx.fillStyle = `rgba(${hv},${hv},${hv},0.35)`;
    hCtx.fillRect(x, y, 2, 2);
  }

  // Circumferential machined radiator stiffening ribs & titanium bolt channels
  for (let y = 64; y < size; y += 128) {
    ctx.fillStyle = 'rgba(138, 150, 168, 0.22)';
    ctx.fillRect(0, y - 6, size, 12);
    hCtx.fillStyle = '#d0d0d0';
    hCtx.fillRect(0, y - 6, size, 12);
    rCtx.fillStyle = '#4e4e4e';
    rCtx.fillRect(0, y - 6, size, 12);

    for (let x = 32; x < size; x += 64) {
      ctx.fillStyle = '#8c96a6';
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      hCtx.fillStyle = '#ffffff';
      hCtx.beginPath();
      hCtx.arc(x, y, 5.5, 0, Math.PI * 2);
      hCtx.fill();
      rCtx.fillStyle = '#2a2a2a';
      rCtx.beginPath();
      rCtx.arc(x, y, 5.5, 0, Math.PI * 2);
      rCtx.fill();
    }
  }

  return {
    color,
    normal: heightToNormalCanvas(height, 3.0),
    rough,
    ao: heightToAoCanvas(height, 0.82),
  };
}

/**
 * Generates a PNG data URL of the Golden Record cover for the interactive symbol decoder.
 */
export function createGoldenRecordCoverDataUrl(): string {
  return createGoldenRecordCoverCanvases().color.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// 12. OPTICAL PHOTOMETRIC CALIBRATION TARGET PLATE (512px)
// ---------------------------------------------------------------------------
function createCalTargetCanvas(): HTMLCanvasElement {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#dedede';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, size - 24, size - 24);

  const shades = ['#f8fafc', '#cbd5e1', '#94a3b8', '#475569', '#1e293b', '#0f172a'];
  const sw = (size - 64) / shades.length;
  shades.forEach((s, idx) => {
    ctx.fillStyle = s;
    ctx.fillRect(32 + idx * sw, 36, sw - 4, 120);
  });

  ctx.fillStyle = '#1e293b';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(48 + i * 24, 196, 10, 110);
  }
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(360, 260, 62, 0, Math.PI * 2);
  ctx.moveTo(280, 260);
  ctx.lineTo(440, 260);
  ctx.moveTo(360, 180);
  ctx.lineTo(360, 340);
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('JPL CAL TARGET · VGR-1', 48, 430);
  ctx.font = '16px monospace';
  ctx.fillText('ISS / IRIS / UVS REF 94%', 48, 462);

  return c;
}

// ---------------------------------------------------------------------------
// 13. CRISP RADIAL POINT-SPREAD STAR SPRITE (64px)
// ---------------------------------------------------------------------------
function createStarSpriteCanvas(): HTMLCanvasElement {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.22, 'rgba(255, 255, 255, 0.88)');
  grad.addColorStop(0.5, 'rgba(235, 244, 255, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return c;
}

export function createProceduralTextureSet(maxAnisotropy: number): ProceduralTextureSet {
  const dish = createDishCanvases();
  const kapton = createKaptonCanvases();
  const blackMli = createBlackMliCanvases();
  const brushedMetal = createBrushedMetalCanvases();
  const whiteThermal = createWhiteThermalCanvases();
  const osr = createOsrCanvases();
  const fiberglass = createFiberglassCanvases();
  const pcb = createPcbCanvases();
  const cover = createGoldenRecordCoverCanvases();
  const disc = createGoldenRecordDiscCanvases();
  const busPanel = createBusPanelCanvases();
  const rtg = createRtgCanvases();
  const calTarget = createCalTargetCanvas();
  const starSprite = createStarSpriteCanvas();

  const dishMap = finalizeTexture(dish.color, maxAnisotropy, true);
  const dishNormal = finalizeTexture(dish.normal, maxAnisotropy, false);
  const dishRoughness = finalizeTexture(dish.rough, maxAnisotropy, false);
  const dishAo = finalizeTexture(dish.ao, maxAnisotropy, false);

  const kaptonMap = finalizeTexture(kapton.color, maxAnisotropy, true, 2, 2);
  const kaptonNormal = finalizeTexture(kapton.normal, maxAnisotropy, false, 2, 2);
  const kaptonRoughness = finalizeTexture(kapton.rough, maxAnisotropy, false, 2, 2);

  const blackMliMap = finalizeTexture(blackMli.color, maxAnisotropy, true, 2, 2);
  const blackMliNormal = finalizeTexture(blackMli.normal, maxAnisotropy, false, 2, 2);
  const blackMliRoughness = finalizeTexture(blackMli.rough, maxAnisotropy, false, 2, 2);

  const brushedMetalMap = finalizeTexture(brushedMetal.color, maxAnisotropy, true, 2, 2);
  const brushedMetalNormal = finalizeTexture(brushedMetal.normal, maxAnisotropy, false, 2, 2);
  const brushedMetalRoughness = finalizeTexture(brushedMetal.rough, maxAnisotropy, false, 2, 2);

  const whiteThermalMap = finalizeTexture(whiteThermal.color, maxAnisotropy, true);
  const whiteThermalNormal = finalizeTexture(whiteThermal.normal, maxAnisotropy, false);
  const whiteThermalRoughness = finalizeTexture(whiteThermal.rough, maxAnisotropy, false);

  const osrMap = finalizeTexture(osr.color, maxAnisotropy, true);
  const osrNormal = finalizeTexture(osr.normal, maxAnisotropy, false);
  const osrRoughness = finalizeTexture(osr.rough, maxAnisotropy, false);

  const fiberglassMap = finalizeTexture(fiberglass.color, maxAnisotropy, true, 1, 14);
  const fiberglassNormal = finalizeTexture(fiberglass.normal, maxAnisotropy, false, 1, 14);

  const pcbMap = finalizeTexture(pcb.color, maxAnisotropy, true);
  const pcbNormal = finalizeTexture(pcb.normal, maxAnisotropy, false);
  const pcbRoughness = finalizeTexture(pcb.rough, maxAnisotropy, false);
  const pcbMetalness = finalizeTexture(pcb.metalness, maxAnisotropy, false);

  const recordCoverMap = finalizeTexture(cover.color, maxAnisotropy, true);
  const recordCoverNormal = finalizeTexture(cover.normal, maxAnisotropy, false);
  const recordCoverRoughness = finalizeTexture(cover.rough, maxAnisotropy, false);

  const recordDiscMap = finalizeTexture(disc.color, maxAnisotropy, true);
  const recordDiscNormal = finalizeTexture(disc.normal, maxAnisotropy, false);
  const recordDiscRoughness = finalizeTexture(disc.rough, maxAnisotropy, false);

  const busPanelMap = finalizeTexture(busPanel.color, maxAnisotropy, true);
  const busPanelNormal = finalizeTexture(busPanel.normal, maxAnisotropy, false);
  const busPanelRoughness = finalizeTexture(busPanel.rough, maxAnisotropy, false);
  const busPanelAo = finalizeTexture(busPanel.ao, maxAnisotropy, false);
  const busPanelMetalness = finalizeTexture(busPanel.metalness, maxAnisotropy, false);

  const rtgMap = finalizeTexture(rtg.color, maxAnisotropy, true, 2, 1);
  const rtgNormal = finalizeTexture(rtg.normal, maxAnisotropy, false, 2, 1);
  const rtgRoughness = finalizeTexture(rtg.rough, maxAnisotropy, false, 2, 1);
  const rtgAo = finalizeTexture(rtg.ao, maxAnisotropy, false, 2, 1);

  const calTargetMap = finalizeTexture(calTarget, maxAnisotropy, true);
  const starSpriteMap = finalizeTexture(starSprite, maxAnisotropy, true);
  starSpriteMap.wrapS = THREE.ClampToEdgeWrapping;
  starSpriteMap.wrapT = THREE.ClampToEdgeWrapping;

  const all = [
    dishMap,
    dishNormal,
    dishRoughness,
    dishAo,
    kaptonMap,
    kaptonNormal,
    kaptonRoughness,
    blackMliMap,
    blackMliNormal,
    blackMliRoughness,
    brushedMetalMap,
    brushedMetalNormal,
    brushedMetalRoughness,
    whiteThermalMap,
    whiteThermalNormal,
    whiteThermalRoughness,
    osrMap,
    osrNormal,
    osrRoughness,
    fiberglassMap,
    fiberglassNormal,
    pcbMap,
    pcbNormal,
    pcbRoughness,
    pcbMetalness,
    recordCoverMap,
    recordCoverNormal,
    recordCoverRoughness,
    recordDiscMap,
    recordDiscNormal,
    recordDiscRoughness,
    busPanelMap,
    busPanelNormal,
    busPanelRoughness,
    busPanelAo,
    busPanelMetalness,
    rtgMap,
    rtgNormal,
    rtgRoughness,
    rtgAo,
    calTargetMap,
    starSpriteMap,
  ];

  return {
    dishMap,
    dishNormal,
    dishRoughness,
    dishAo,
    kaptonMap,
    kaptonNormal,
    kaptonRoughness,
    blackMliMap,
    blackMliNormal,
    blackMliRoughness,
    brushedMetalMap,
    brushedMetalNormal,
    brushedMetalRoughness,
    whiteThermalMap,
    whiteThermalNormal,
    whiteThermalRoughness,
    osrMap,
    osrNormal,
    osrRoughness,
    fiberglassMap,
    fiberglassNormal,
    pcbMap,
    pcbNormal,
    pcbRoughness,
    pcbMetalness,
    recordCoverMap,
    recordCoverNormal,
    recordCoverRoughness,
    recordDiscMap,
    recordDiscNormal,
    recordDiscRoughness,
    busPanelMap,
    busPanelNormal,
    busPanelRoughness,
    busPanelAo,
    busPanelMetalness,
    rtgMap,
    rtgNormal,
    rtgRoughness,
    rtgAo,
    calTargetMap,
    starSpriteMap,
    dispose: () => {
      all.forEach((t) => t.dispose());
    },
  };
}
