import type { VideoHighlight } from '@toolsweb/shared';

/** Camera transform: image drawn at (x,y) with uniform scale (origin top-left). */
export type CameraTransform = {
  scale: number;
  x: number;
  y: number;
};

export function lerpCamera(
  a: CameraTransform,
  b: CameraTransform,
  t: number
): CameraTransform {
  const u = Math.min(1, Math.max(0, t));
  return {
    scale: a.scale + (b.scale - a.scale) * u,
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
  };
}

/**
 * Fit / focus camera for a screenshot inside a viewport (ADR-0008).
 * Subtle zoom toward highlight (~1.12–1.32× fit) when a box exists.
 */
export function cameraForFocus(input: {
  contentWidth: number;
  contentHeight: number;
  viewWidth: number;
  viewHeight: number;
  highlight?: VideoHighlight;
  /** Relative to fit scale. */
  minZoom?: number;
  maxZoom?: number;
  focusPaddingPx?: number;
}): CameraTransform {
  const {
    contentWidth: cw,
    contentHeight: ch,
    viewWidth: vw,
    viewHeight: vh,
    highlight: hl,
    minZoom = 1.05,
    maxZoom = 1.15,
    focusPaddingPx = 120,
  } = input;

  const fit = Math.min(vw / cw, vh / ch);
  const overview = overviewCamera(cw, ch, vw, vh, fit);
  if (!hl || hl.width <= 1 || hl.height <= 1) {
    return overview;
  }

  const tw = hl.width + focusPaddingPx * 2;
  const th = hl.height + focusPaddingPx * 2;
  const focusFit = Math.min(vw / tw, vh / th);
  let scale = Math.min(Math.max(fit * minZoom, focusFit), fit * maxZoom);
  // Never zoom out below fit; never crop more aggressively than maxZoom.
  scale = Math.min(Math.max(scale, fit), fit * maxZoom);

  const cx = hl.x + hl.width / 2;
  const cy = hl.y + hl.height / 2;
  let x = vw / 2 - cx * scale;
  let y = vh / 2 - cy * scale;

  const minX = vw - cw * scale;
  const minY = vh - ch * scale;
  if (cw * scale <= vw) {
    x = (vw - cw * scale) / 2;
  } else {
    x = Math.min(0, Math.max(minX, x));
  }
  if (ch * scale <= vh) {
    y = (vh - ch * scale) / 2;
  } else {
    y = Math.min(0, Math.max(minY, y));
  }

  return { scale, x, y };
}

function overviewCamera(
  cw: number,
  ch: number,
  vw: number,
  vh: number,
  fit: number
): CameraTransform {
  return {
    scale: fit,
    x: (vw - cw * fit) / 2,
    y: (vh - ch * fit) / 2,
  };
}

export function readPngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}
