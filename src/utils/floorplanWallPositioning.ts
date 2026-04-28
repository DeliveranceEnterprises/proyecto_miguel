export type WallPlacementOption = {
  id: string;
  label: string;
  wall: any;
  start: { x: number; z: number };
  end: { x: number; z: number };
  lengthCm: number;
};

export type WallRelativePlacement = {
  wallId: string;
  alongM: number;
  offsetM: number;
  wallLengthM: number;
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const getWallStart = (wall: any) => {
  const start = wall?.getStart?.() ?? wall?.start;

  return {
    x: toFiniteNumber(start?.x ?? start?.getX?.() ?? wall?.getStartX?.()),
    z: toFiniteNumber(start?.z ?? start?.y ?? start?.getY?.() ?? wall?.getStartY?.()),
  };
};

const getWallEnd = (wall: any) => {
  const end = wall?.getEnd?.() ?? wall?.end;

  return {
    x: toFiniteNumber(end?.x ?? end?.getX?.() ?? wall?.getEndX?.()),
    z: toFiniteNumber(end?.z ?? end?.y ?? end?.getY?.() ?? wall?.getEndY?.()),
  };
};

const getSceneNeedsUpdate = (blueprint3d: any) => {
  const scene = blueprint3d?.model?.scene;
  if (scene) scene.needsUpdate = true;
  blueprint3d?.three?.needsUpdate?.();
};

export const getWallPlacementOptions = (blueprint3d: any): WallPlacementOption[] => {
  const walls: any[] = blueprint3d?.model?.floorplan?.getWalls?.() ?? [];

  return walls.flatMap((wall, index) => {
    const start = getWallStart(wall);
    const end = getWallEnd(wall);

    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const lengthCm = Math.hypot(dx, dz);

    if (!Number.isFinite(lengthCm) || lengthCm <= 0) return [];

    const id = String(wall?.getUuid?.() ?? wall?.id ?? `wall-${index}`);

    return [{
      id,
      label: `Pared ${index + 1} (${(lengthCm / 100).toFixed(2)} m)`,
      wall,
      start,
      end,
      lengthCm,
    }];
  });
};

const getInteriorNormal = (blueprint3d: any, wall: WallPlacementOption) => {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const length = Math.hypot(dx, dz) || 1;

  const ux = dx / length;
  const uz = dz / length;

  let nx = -uz;
  let nz = ux;

  const center = blueprint3d?.model?.floorplan?.getCenter?.();
  const centerX = toFiniteNumber(center?.x);
  const centerZ = toFiniteNumber(center?.z);

  const wallMidX = (wall.start.x + wall.end.x) / 2;
  const wallMidZ = (wall.start.z + wall.end.z) / 2;
  const dotToCenter = (centerX - wallMidX) * nx + (centerZ - wallMidZ) * nz;

  if (dotToCenter < 0) {
    nx *= -1;
    nz *= -1;
  }

  return { nx, nz, ux, uz };
};

const readItemCorners = (item: any): Array<{ x: number; z: number }> => {
  try {
    const corners = item?.getCorners?.('x', 'z');
    if (!Array.isArray(corners)) return [];

    return corners
      .map((corner: any) => ({
        x: toFiniteNumber(corner?.x, NaN),
        z: toFiniteNumber(corner?.z ?? corner?.y, NaN),
      }))
      .filter((corner) => Number.isFinite(corner.x) && Number.isFinite(corner.z));
  } catch {
    return [];
  }
};

const getCenterToNearestEdgeCm = (
  item: any,
  wall: WallPlacementOption,
  nx: number,
  nz: number
) => {
  const centerDistance =
    (toFiniteNumber(item?.position?.x) - wall.start.x) * nx +
    (toFiniteNumber(item?.position?.z) - wall.start.z) * nz;

  const corners = readItemCorners(item);
  if (!corners.length) return 0;

  const minCornerDistance = Math.min(
    ...corners.map((corner) =>
      (corner.x - wall.start.x) * nx +
      (corner.z - wall.start.z) * nz
    )
  );

  return centerDistance - minCornerDistance;
};

export const getCurrentWallRelativePlacement = (
  blueprint3d: any,
  item: any
): WallRelativePlacement | null => {
  if (!blueprint3d || !item?.position) return null;

  const walls = getWallPlacementOptions(blueprint3d);
  if (!walls.length) return null;

  const candidates = walls.map((wall) => {
    const { nx, nz, ux, uz } = getInteriorNormal(blueprint3d, wall);

    const itemX = toFiniteNumber(item.position.x);
    const itemZ = toFiniteNumber(item.position.z);

    const alongCm = (itemX - wall.start.x) * ux + (itemZ - wall.start.z) * uz;
    const centerDistanceCm = (itemX - wall.start.x) * nx + (itemZ - wall.start.z) * nz;
    const centerToNearestEdgeCm = getCenterToNearestEdgeCm(item, wall, nx, nz);
    const edgeDistanceCm = centerDistanceCm - centerToNearestEdgeCm;

    return {
      wallId: wall.id,
      alongM: alongCm / 100,
      offsetM: edgeDistanceCm / 100,
      wallLengthM: wall.lengthCm / 100,
      score: Math.abs(edgeDistanceCm),
    };
  });

  candidates.sort((a, b) => a.score - b.score);

  const best = candidates[0];
  if (!best) return null;

  return {
    wallId: best.wallId,
    alongM: best.alongM,
    offsetM: best.offsetM,
    wallLengthM: best.wallLengthM,
  };
};

export const applyWallRelativePlacement = (
  blueprint3d: any,
  item: any,
  wallId: string,
  alongM: number,
  offsetM: number
) => {
  if (!blueprint3d || !item?.position || !wallId) return false;

  const wall = getWallPlacementOptions(blueprint3d).find((candidate) => candidate.id === wallId);
  if (!wall) return false;

  const { nx, nz, ux, uz } = getInteriorNormal(blueprint3d, wall);

  const alongCm = toFiniteNumber(alongM) * 100;
  const offsetCm = toFiniteNumber(offsetM) * 100;

  const clampedAlongCm = Math.max(0, Math.min(wall.lengthCm, alongCm));
  const centerToNearestEdgeCm = getCenterToNearestEdgeCm(item, wall, nx, nz);
  const centerOffsetCm = offsetCm + centerToNearestEdgeCm;

  item.position.x = wall.start.x + ux * clampedAlongCm + nx * centerOffsetCm;
  item.position.z = wall.start.z + uz * clampedAlongCm + nz * centerOffsetCm;

  if (typeof item.changed === 'function') item.changed();
  getSceneNeedsUpdate(blueprint3d);

  return true;
};
