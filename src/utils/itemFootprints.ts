export type FootprintPoint = {
  x: number;
  z: number;
};

export type SceneItemFootprint = {
  id: string;
  name: string;
  item: any;
  points: FootprintPoint[];
  center: FootprintPoint;
  widthCm: number;
  depthCm: number;
  areaCm2: number;
  isDevice: boolean;
  isRobot: boolean;
  isCharger: boolean;
};

export type SceneItemFootprintOptions = {
  movingItem?: any | null;
  includeObjects?: boolean;
  includeDevices?: boolean;
  includeRobots?: boolean;
  includeChargers?: boolean;
  includeItemsWithoutCorners?: boolean;
};

const DEFAULT_OPTIONS: Required<Omit<SceneItemFootprintOptions, 'movingItem'>> = {
  includeObjects: true,
  includeDevices: false,
  includeRobots: false,
  includeChargers: false,
  includeItemsWithoutCorners: true,
};

const ROBOT_NAME_RE = /robot|panda|pandabot|pudu|ketty|bellabot|keenon|allybot|viggo/i;
const CHARGING_STATION_NAME_RE = /estaci[oó]n[\s_-]*carga|estacion[\s_-]*carga|charging[\s_-]*station/i;
const ROBOT_CHARGER_NAME_RE = /(^|[\s_-])(charger|cargador)([\s_-]|$)/i;

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readItemName(item: any): string {
  return String(
    item?.metadata?.itemName ??
    item?.metadata?.deviceName ??
    item?.metadata?.name ??
    item?.name ??
    item?.metadata?.modelUrl ??
    'item'
  );
}

function readItemId(item: any, index: number): string {
  return String(
    item?.metadata?.uid ??
    item?.metadata?.item_uid ??
    item?.metadata?.device_uid ??
    item?.metadata?.deviceId ??
    item?.uuid ??
    item?.name ??
    `item_${index}`
  );
}

function isDeviceItem(item: any): boolean {
  const meta = item?.metadata ?? {};
  return Boolean(
    meta.device_uid ||
    meta.deviceId ||
    meta.deviceModel ||
    meta.deviceImage ||
    item?.device_uid ||
    item?.deviceId
  );
}

function isRobotItem(item: any): boolean {
  const meta = item?.metadata ?? {};
  const text = [
    item?.name,
    meta.name,
    meta.itemName,
    meta.deviceName,
    meta.deviceModel,
    meta.deviceImage,
    meta.deviceMapKey,
    meta.modelUrl,
  ].filter(Boolean).join(' ');

  return ROBOT_NAME_RE.test(text);
}

function isChargerItem(item: any): boolean {
  const meta = item?.metadata ?? {};

  const text = [
    item?.name,
    meta.name,
    meta.itemName,
    meta.deviceName,
    meta.deviceModel,
    meta.deviceImage,
    meta.deviceMapKey,
    meta.modelUrl,
    meta.anchor_type,
    meta.anchorType,
  ].filter(Boolean).join(' ');

  // "Estacion_Carga" is a generic charging station object. It should stay
  // treated as a normal object, not as a robot charger.
  if (CHARGING_STATION_NAME_RE.test(text)) return false;

  const anchorType = String(meta.anchor_type ?? meta.anchorType ?? '').toLowerCase().trim();
  if (anchorType === 'charger') return true;

  return ROBOT_CHARGER_NAME_RE.test(text);
}

function polygonArea(points: FootprintPoint[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) / 2;
}

function polygonCenter(points: FootprintPoint[]): FootprintPoint {
  if (points.length === 0) return { x: 0, z: 0 };
  const total = points.reduce((acc, p) => ({ x: acc.x + p.x, z: acc.z + p.z }), { x: 0, z: 0 });
  return { x: total.x / points.length, z: total.z / points.length };
}

function polygonBounds(points: FootprintPoint[]): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  points.forEach((p) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  }

  return { minX, maxX, minZ, maxZ };
}

function normalizeCorners(corners: any[]): FootprintPoint[] {
  return corners
    .map((corner) => {
      const x = toFiniteNumber(corner?.x);
      const z = toFiniteNumber(corner?.z ?? corner?.y);
      return x == null || z == null ? null : { x, z };
    })
    .filter((point): point is FootprintPoint => point != null);
}

function getCornersFromItem(item: any): FootprintPoint[] {
  try {
    const corners = item?.getCorners?.('x', 'z');
    if (Array.isArray(corners) && corners.length >= 3) {
      return normalizeCorners(corners);
    }
  } catch { /* ignore */ }

  try {
    const position = item?.position;
    const halfSize = item?.halfSize;
    const x = toFiniteNumber(position?.x);
    const z = toFiniteNumber(position?.z);
    const halfX = toFiniteNumber(halfSize?.x);
    const halfZ = toFiniteNumber(halfSize?.z);

    if (x != null && z != null && halfX != null && halfZ != null && halfX > 0 && halfZ > 0) {
      return [
        { x: x - halfX, z: z - halfZ },
        { x: x + halfX, z: z - halfZ },
        { x: x + halfX, z: z + halfZ },
        { x: x - halfX, z: z + halfZ },
      ];
    }
  } catch { /* ignore */ }

  return [];
}

export function getSceneItemFootprints(
  blueprint3d: any,
  options: SceneItemFootprintOptions = {}
): SceneItemFootprint[] {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const items: any[] = blueprint3d?.model?.scene?.getItems?.() ?? [];

  return items.flatMap((item, index): SceneItemFootprint[] => {
    if (!item || item === options.movingItem) return [];

    const isDevice = isDeviceItem(item);
    const isRobot = isRobotItem(item);
    const isCharger = isChargerItem(item);

    if (isCharger) {
      if (!merged.includeChargers) return [];
    } else {
      if (!merged.includeObjects) return [];
      if (isDevice && !merged.includeDevices) return [];
      if (isRobot && !merged.includeRobots) return [];
    }

    const points = getCornersFromItem(item);
    if (points.length < 3 && !merged.includeItemsWithoutCorners) return [];
    if (points.length < 3) return [];

    const bounds = polygonBounds(points);
    return [{
      id: readItemId(item, index),
      name: readItemName(item),
      item,
      points,
      center: polygonCenter(points),
      widthCm: bounds.maxX - bounds.minX,
      depthCm: bounds.maxZ - bounds.minZ,
      areaCm2: polygonArea(points),
      isDevice,
      isRobot,
      isCharger,
    }];
  });
}
