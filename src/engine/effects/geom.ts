/**
 * AEStudio - Geometric Transformations & Interpolation
 * Derived 1:1 from _geom_lib.rs and util.rs
 */

export class Mat3 {
  // 3x3 matrix in row-major order: [[m00, m01, m02], [m10, m11, m12], [m20, m21, m22]]
  public m: number[][];

  constructor(m?: number[][]) {
    this.m = m || [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }

  static identity(): Mat3 {
    return new Mat3();
  }

  static translate(tx: number, ty: number): Mat3 {
    return new Mat3([
      [1, 0, tx],
      [0, 1, ty],
      [0, 0, 1],
    ]);
  }

  static scale(sx: number, sy: number): Mat3 {
    return new Mat3([
      [sx, 0, 0],
      [0, sy, 0],
      [0, 0, 1],
    ]);
  }

  static rotateDeg(deg: number): Mat3 {
    const rad = (deg * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Mat3([
      [c, -s, 0],
      [s, c, 0],
      [0, 0, 1],
    ]);
  }

  static skewDeg(skew: number, axisDeg: number): Mat3 {
    const k = Math.tan((skew * Math.PI) / 180);
    const r1 = Mat3.rotateDeg(axisDeg);
    const sk = new Mat3([
      [1, k, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    const r2 = Mat3.rotateDeg(-axisDeg);
    return r1.multiply(sk).multiply(r2);
  }

  multiply(o: Mat3): Mat3 {
    const r = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          sum += this.m[i][k] * o.m[k][j];
        }
        r[i][j] = sum;
      }
    }
    return new Mat3(r);
  }

  apply(x: number, y: number): [number, number] {
    const m = this.m;
    const rx = m[0][0] * x + m[0][1] * y + m[0][2];
    const ry = m[1][0] * x + m[1][1] * y + m[1][2];
    const rw = m[2][0] * x + m[2][1] * y + m[2][2];
    if (rw !== 1.0 && rw !== 0.0) {
      return [rx / rw, ry / rw];
    }
    return [rx, ry];
  }

  inverse(): Mat3 | null {
    const m = this.m;
    const d =
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

    if (Math.abs(d) < 1e-12) return null;
    const invD = 1.0 / d;

    const inv = [
      [
        (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * invD,
        (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invD,
        (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invD,
      ],
      [
        (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invD,
        (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invD,
        (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * invD,
      ],
      [
        (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * invD,
        (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * invD,
        (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * invD,
      ],
    ];

    return new Mat3(inv);
  }

  // Maps unit square (0,0), (1,0), (1,1), (0,1) to quad q0, q1, q2, q3
  static squareToQuad(q: [number, number][]): Mat3 {
    const [x0, y0] = q[0];
    const [x1, y1] = q[1];
    const [x2, y2] = q[2];
    const [x3, y3] = q[3];

    const dx1 = x1 - x2;
    const dx2 = x3 - x2;
    const dy1 = y1 - y2;
    const dy2 = y3 - y2;
    const sx = x0 - x1 + x2 - x3;
    const sy = y0 - y1 + y2 - y3;

    if (Math.abs(sx) < 1e-12 && Math.abs(sy) < 1e-12) {
      return new Mat3([
        [x1 - x0, x3 - x0, x0],
        [y1 - y0, y3 - y0, y0],
        [0.0, 0.0, 1.0],
      ]);
    }

    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-12) return new Mat3();
    const g = (sx * dy2 - dx2 * sy) / den;
    const h = (dx1 * sy - sx * dy1) / den;

    return new Mat3([
      [x1 - x0 + g * x1, x3 - x0 + h * x3, x0],
      [y1 - y0 + g * y1, y3 - y0 + h * y3, y0],
      [g, h, 1.0],
    ]);
  }
}

/**
 * Deterministic PRNG Hash matching hash1 in util.rs
 */
export function hash1(a: number, b: number, seed: number): number {
  let h = (a * 374761393 + b * 668265263 + seed * 961748927) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296.0;
}

/**
 * Bilinear sampling of ImageData (clamped or transparent outside)
 */
export function sampleBilinear(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  clamp: boolean = false
): [number, number, number, number] {
  if (clamp) {
    x = Math.max(0, Math.min(w - 1, x));
    y = Math.max(0, Math.min(h - 1, y));
  } else {
    if (x < 0 || x >= w || y < 0 || y >= h) {
      return [0, 0, 0, 0];
    }
  }

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);

  const fx = x - x0;
  const fy = y - y0;

  const idx00 = (y0 * w + x0) * 4;
  const idx10 = (y0 * w + x1) * 4;
  const idx01 = (y1 * w + x0) * 4;
  const idx11 = (y1 * w + x1) * 4;

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  const r = data[idx00] * w00 + data[idx10] * w10 + data[idx01] * w01 + data[idx11] * w11;
  const g = data[idx00 + 1] * w00 + data[idx10 + 1] * w10 + data[idx01 + 1] * w01 + data[idx11 + 1] * w11;
  const b = data[idx00 + 2] * w00 + data[idx10 + 2] * w10 + data[idx01 + 2] * w01 + data[idx11 + 2] * w11;
  const a = data[idx00 + 3] * w00 + data[idx10 + 3] * w10 + data[idx01 + 3] * w01 + data[idx11 + 3] * w11;

  return [r, g, b, a];
}
