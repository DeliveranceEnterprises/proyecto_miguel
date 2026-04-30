import {
  getSceneItemFootprints,
  type SceneItemFootprint,
} from './itemFootprints';

export interface DrawObjectFootprintsOverlayOptions {
  visible?: boolean;
  includeLabels?: boolean;
  selectedFootprintId?: string | null;
  includeObjects?: boolean;
  includeDevices?: boolean;
  includeRobots?: boolean;
  includeChargers?: boolean;
  fillStyle?: string;
  strokeStyle?: string;
  selectedFillStyle?: string;
  selectedStrokeStyle?: string;
  chargerFillStyle?: string;
  chargerStrokeStyle?: string;
  labelStyle?: string;
}

const OVERLAY_CANVAS_ID = 'floorplanner-object-footprints-canvas';

const getFloorplannerElements = () => {
  const container = document.getElementById('floorplanner');
  const baseCanvas = document.getElementById('floorplanner-canvas') as HTMLCanvasElement | null;

  return { container, baseCanvas };
};

const ensureOverlayCanvas = (): HTMLCanvasElement | null => {
  const { container, baseCanvas } = getFloorplannerElements();
  if (!container || !baseCanvas) return null;

  let overlay = document.getElementById(OVERLAY_CANVAS_ID) as HTMLCanvasElement | null;

  if (!overlay) {
    overlay = document.createElement('canvas');
    overlay.id = OVERLAY_CANVAS_ID;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.position = 'absolute';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '8';
    overlay.style.display = 'none';
    container.appendChild(overlay);
  }

  return overlay;
};

const syncOverlayCanvasSize = (overlay: HTMLCanvasElement) => {
  const { baseCanvas } = getFloorplannerElements();
  if (!baseCanvas) return null;

  const rect = baseCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));

  if (overlay.width !== pixelWidth) overlay.width = pixelWidth;
  if (overlay.height !== pixelHeight) overlay.height = pixelHeight;

  overlay.style.width = `${width}px`;
  overlay.style.height = `${height}px`;

  const context = overlay.getContext('2d');
  if (!context) return null;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  return { context, width, height };
};

const toCanvasPoint = (blueprint3d: any, point: { x: number; z: number }) => {
  const floorplanner = blueprint3d?.floorplanner;

  if (
    floorplanner &&
    typeof floorplanner.convertX === 'function' &&
    typeof floorplanner.convertY === 'function'
  ) {
    return {
      x: floorplanner.convertX(point.x),
      y: floorplanner.convertY(point.z),
    };
  }

  const cmPerPixel = Number(floorplanner?.cmPerPixel ?? 1);
  const pixelsPerCm = Number(floorplanner?.pixelsPerCm ?? 1 / cmPerPixel);
  const originX = Number(floorplanner?.originX ?? 0);
  const originY = Number(floorplanner?.originY ?? 0);

  return {
    x: (point.x - originX * cmPerPixel) * pixelsPerCm,
    y: (point.z - originY * cmPerPixel) * pixelsPerCm,
  };
};

const drawFootprintPolygon = (
  context: CanvasRenderingContext2D,
  blueprint3d: any,
  footprint: SceneItemFootprint,
  options: Required<
    Pick<
      DrawObjectFootprintsOverlayOptions,
      | 'includeLabels'
      | 'fillStyle'
      | 'strokeStyle'
      | 'selectedFillStyle'
      | 'selectedStrokeStyle'
      | 'chargerFillStyle'
      | 'chargerStrokeStyle'
      | 'labelStyle'
    >
  > & { isSelected: boolean }
) => {
  const canvasPoints = footprint.points.map((point) => toCanvasPoint(blueprint3d, point));
  if (canvasPoints.length < 3) return;

  context.beginPath();
  context.moveTo(canvasPoints[0].x, canvasPoints[0].y);
  for (let i = 1; i < canvasPoints.length; i += 1) {
    context.lineTo(canvasPoints[i].x, canvasPoints[i].y);
  }
  context.closePath();

  context.fillStyle = options.isSelected
    ? options.selectedFillStyle
    : footprint.isCharger
      ? options.chargerFillStyle
      : options.fillStyle;
  context.strokeStyle = options.isSelected
    ? options.selectedStrokeStyle
    : footprint.isCharger
      ? options.chargerStrokeStyle
      : options.strokeStyle;
  context.lineWidth = options.isSelected ? 3 : 2;
  context.fill();
  context.stroke();

  if (!options.includeLabels && !options.isSelected) return;

  const center = toCanvasPoint(blueprint3d, footprint.center);
  const label = footprint.name.length > 24 ? `${footprint.name.slice(0, 21)}…` : footprint.name;

  context.font = '600 12px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const metrics = context.measureText(label);
  const paddingX = 5;
  const labelWidth = metrics.width + paddingX * 2;
  const labelHeight = 18;

  context.fillStyle = 'rgba(255, 255, 255, 0.88)';
  context.fillRect(center.x - labelWidth / 2, center.y - labelHeight / 2, labelWidth, labelHeight);
  context.strokeStyle = 'rgba(45, 55, 72, 0.25)';
  context.lineWidth = 1;
  context.strokeRect(center.x - labelWidth / 2, center.y - labelHeight / 2, labelWidth, labelHeight);

  context.fillStyle = options.labelStyle;
  context.fillText(label, center.x, center.y + 0.5);
};

export const drawObjectFootprintsOverlay = (
  blueprint3d: any,
  options: DrawObjectFootprintsOverlayOptions = {}
): SceneItemFootprint[] => {
  const {
    visible = true,
    includeLabels = false,
    selectedFootprintId = null,
    includeObjects = true,
    includeDevices = true,
    includeRobots = false,
    includeChargers = false,
    fillStyle = 'rgba(49, 130, 206, 0.22)',
    strokeStyle = 'rgba(43, 108, 176, 0.9)',
    selectedFillStyle = 'rgba(237, 137, 54, 0.32)',
    selectedStrokeStyle = 'rgba(194, 65, 12, 0.95)',
    chargerFillStyle = 'rgba(56, 161, 105, 0.24)',
    chargerStrokeStyle = 'rgba(47, 133, 90, 0.95)',
    labelStyle = '#1A365D',
  } = options;

  const overlay = ensureOverlayCanvas();
  if (!overlay) return [];

  const drawing = syncOverlayCanvasSize(overlay);
  if (!drawing) return [];

  if (!visible) {
    overlay.style.display = 'none';
    return [];
  }

  overlay.style.display = 'block';

  const footprints = getSceneItemFootprints(blueprint3d, {
    includeObjects,
    includeDevices,
    includeRobots,
    includeChargers,
  });

  footprints.forEach((footprint) => {
    drawFootprintPolygon(drawing.context, blueprint3d, footprint, {
      includeLabels,
      fillStyle,
      strokeStyle,
      selectedFillStyle,
      selectedStrokeStyle,
      chargerFillStyle,
      chargerStrokeStyle,
      labelStyle,
      isSelected: footprint.id === selectedFootprintId,
    });
  });

  return footprints;
};

export const clearObjectFootprintsOverlay = () => {
  const overlay = document.getElementById(OVERLAY_CANVAS_ID) as HTMLCanvasElement | null;
  if (!overlay) return;

  const context = overlay.getContext('2d');
  context?.clearRect(0, 0, overlay.width, overlay.height);
  overlay.style.display = 'none';
};

export const removeObjectFootprintsOverlay = () => {
  const overlay = document.getElementById(OVERLAY_CANVAS_ID);
  overlay?.parentElement?.removeChild(overlay);
};
