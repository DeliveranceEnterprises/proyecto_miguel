import { getSceneItemFootprints, type FootprintPoint, type SceneItemFootprint } from './itemFootprints';

export type NavigationPoint = FootprintPoint;

export type ObjectFootprintAStarOptions = {
  robotRadiusCm?: number;
  obstaclePaddingCm?: number;
  gridSizeCm?: number;
  boundsPaddingCm?: number;
  maxGridNodes?: number;
  includeDevices?: boolean;
  includeRobots?: boolean;
  simplifyPath?: boolean;
  movingItem?: any | null;
};

export type ObjectFootprintAStarStatus =
  | 'direct'
  | 'ok'
  | 'invalid-input'
  | 'start-blocked'
  | 'target-blocked'
  | 'grid-too-large'
  | 'no-path';

export type ObjectFootprintAStarResult = {
  status: ObjectFootprintAStarStatus;
  path: NavigationPoint[];
  obstacles: SceneItemFootprint[];
  gridSizeCm: number;
  diagnostics?: string;
};

const DEFAULT_OPTIONS: Required<Omit<ObjectFootprintAStarOptions, 'movingItem'>> = {
  robotRadiusCm: 35,
  obstaclePaddingCm: 15,
  gridSizeCm: 25,
  boundsPaddingCm: 150,
  maxGridNodes: 70000,
  includeDevices: false,
  includeRobots: false,
  simplifyPath: true,
};

type GridNode = {
  ix: number;
  iz: number;
};

type SearchNode = GridNode & {
  key: string;
  g: number;
  f: number;
  parent?: string;
};

function isFinitePoint(point: NavigationPoint): boolean {
  return Number.isFinite(point?.x) && Number.isFinite(point?.z);
}

function distance(a: NavigationPoint, b: NavigationPoint): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function keyOf(ix: number, iz: number): string {
  return `${ix},${iz}`;
}

function pointInPolygon(point: NavigationPoint, polygon: NavigationPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects = ((pi.z > point.z) !== (pj.z > point.z)) &&
      point.x < ((pj.x - pi.x) * (point.z - pi.z)) / ((pj.z - pi.z) || 1e-9) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distancePointToSegment(point: NavigationPoint, a: NavigationPoint, b: NavigationPoint): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const apx = point.x - a.x;
  const apz = point.z - a.z;
  const abLen2 = abx * abx + abz * abz;
  if (abLen2 <= 1e-9) return distance(point, a);

  const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / abLen2));
  return distance(point, { x: a.x + abx * t, z: a.z + abz * t });
}

function distancePointToPolygon(point: NavigationPoint, polygon: NavigationPoint[]): number {
  if (polygon.length === 0) return Infinity;
  if (pointInPolygon(point, polygon)) return 0;

  let minDistance = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    minDistance = Math.min(minDistance, distancePointToSegment(point, a, b));
  }
  return minDistance;
}

function isPointBlocked(point: NavigationPoint, obstacles: SceneItemFootprint[], clearanceCm: number): boolean {
  return obstacles.some((obstacle) => distancePointToPolygon(point, obstacle.points) <= clearanceCm);
}

function isSegmentBlocked(
  from: NavigationPoint,
  to: NavigationPoint,
  obstacles: SceneItemFootprint[],
  clearanceCm: number,
  sampleStepCm: number
): boolean {
  const length = distance(from, to);
  const steps = Math.max(1, Math.ceil(length / Math.max(5, sampleStepCm)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = {
      x: from.x + (to.x - from.x) * t,
      z: from.z + (to.z - from.z) * t,
    };
    if (isPointBlocked(point, obstacles, clearanceCm)) return true;
  }
  return false;
}

function getObstacleBounds(obstacles: SceneItemFootprint[]): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  obstacles.forEach((obstacle) => {
    obstacle.points.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    });
  });

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
    return null;
  }

  return { minX, maxX, minZ, maxZ };
}

function reconstructPath(
  closed: Map<string, SearchNode>,
  goalKey: string,
  gridToWorld: (node: GridNode) => NavigationPoint,
  start: NavigationPoint,
  target: NavigationPoint
): NavigationPoint[] {
  const reversed: GridNode[] = [];
  let currentKey: string | undefined = goalKey;

  while (currentKey) {
    const node = closed.get(currentKey);
    if (!node) break;
    reversed.push({ ix: node.ix, iz: node.iz });
    currentKey = node.parent;
  }

  const gridPath = reversed.reverse().map(gridToWorld);
  if (gridPath.length === 0) return [start, target];

  gridPath[0] = start;
  gridPath[gridPath.length - 1] = target;
  return gridPath;
}

function simplifyPath(
  path: NavigationPoint[],
  obstacles: SceneItemFootprint[],
  clearanceCm: number,
  gridSizeCm: number
): NavigationPoint[] {
  if (path.length <= 2) return path;

  const simplified: NavigationPoint[] = [path[0]];
  let anchorIndex = 0;

  while (anchorIndex < path.length - 1) {
    let nextIndex = path.length - 1;
    while (nextIndex > anchorIndex + 1) {
      if (!isSegmentBlocked(path[anchorIndex], path[nextIndex], obstacles, clearanceCm, gridSizeCm / 2)) break;
      nextIndex--;
    }
    simplified.push(path[nextIndex]);
    anchorIndex = nextIndex;
  }

  return simplified;
}

export function buildObjectFootprintAStarPath(args: {
  blueprint3d: any;
  start: NavigationPoint;
  target: NavigationPoint;
  movingItem?: any | null;
  options?: ObjectFootprintAStarOptions;
}): ObjectFootprintAStarResult {
  const options = { ...DEFAULT_OPTIONS, ...(args.options ?? {}) };
  const gridSizeCm = Math.max(5, Number(options.gridSizeCm) || DEFAULT_OPTIONS.gridSizeCm);
  const clearanceCm = Math.max(0, (Number(options.robotRadiusCm) || 0) + (Number(options.obstaclePaddingCm) || 0));
  const movingItem = args.movingItem ?? options.movingItem ?? null;

  if (!isFinitePoint(args.start) || !isFinitePoint(args.target)) {
    return { status: 'invalid-input', path: [], obstacles: [], gridSizeCm, diagnostics: 'Start or target is not a finite point.' };
  }

  const obstacles = getSceneItemFootprints(args.blueprint3d, {
    movingItem,
    includeDevices: options.includeDevices,
    includeRobots: options.includeRobots,
  });

  if (obstacles.length === 0) {
    return { status: 'direct', path: [args.start, args.target], obstacles, gridSizeCm };
  }

  if (isPointBlocked(args.start, obstacles, clearanceCm)) {
    return { status: 'start-blocked', path: [args.start, args.target], obstacles, gridSizeCm };
  }

  if (isPointBlocked(args.target, obstacles, clearanceCm)) {
    return { status: 'target-blocked', path: [args.start, args.target], obstacles, gridSizeCm };
  }

  if (!isSegmentBlocked(args.start, args.target, obstacles, clearanceCm, gridSizeCm / 2)) {
    return { status: 'direct', path: [args.start, args.target], obstacles, gridSizeCm };
  }

  const obstacleBounds = getObstacleBounds(obstacles);
  const padding = Math.max(options.boundsPaddingCm, clearanceCm + gridSizeCm * 4);
  const minX = Math.min(args.start.x, args.target.x, obstacleBounds?.minX ?? args.start.x) - padding;
  const maxX = Math.max(args.start.x, args.target.x, obstacleBounds?.maxX ?? args.target.x) + padding;
  const minZ = Math.min(args.start.z, args.target.z, obstacleBounds?.minZ ?? args.start.z) - padding;
  const maxZ = Math.max(args.start.z, args.target.z, obstacleBounds?.maxZ ?? args.target.z) + padding;

  const cols = Math.ceil((maxX - minX) / gridSizeCm) + 1;
  const rows = Math.ceil((maxZ - minZ) / gridSizeCm) + 1;
  if (cols <= 0 || rows <= 0) {
    return { status: 'invalid-input', path: [], obstacles, gridSizeCm };
  }
  if (cols * rows > options.maxGridNodes) {
    return {
      status: 'grid-too-large',
      path: [args.start, args.target],
      obstacles,
      gridSizeCm,
      diagnostics: `Grid ${cols}x${rows} exceeds maxGridNodes=${options.maxGridNodes}. Increase gridSizeCm or reduce boundsPaddingCm.`,
    };
  }

  const worldToGrid = (point: NavigationPoint): GridNode => ({
    ix: Math.max(0, Math.min(cols - 1, Math.round((point.x - minX) / gridSizeCm))),
    iz: Math.max(0, Math.min(rows - 1, Math.round((point.z - minZ) / gridSizeCm))),
  });

  const gridToWorld = (node: GridNode): NavigationPoint => ({
    x: minX + node.ix * gridSizeCm,
    z: minZ + node.iz * gridSizeCm,
  });

  const startNode = worldToGrid(args.start);
  const targetNode = worldToGrid(args.target);
  const startKey = keyOf(startNode.ix, startNode.iz);
  const targetKey = keyOf(targetNode.ix, targetNode.iz);

  const blockedCache = new Map<string, boolean>();
  const isGridBlocked = (node: GridNode): boolean => {
    if (node.ix < 0 || node.ix >= cols || node.iz < 0 || node.iz >= rows) return true;
    const key = keyOf(node.ix, node.iz);
    const cached = blockedCache.get(key);
    if (cached != null) return cached;
    const blocked = isPointBlocked(gridToWorld(node), obstacles, clearanceCm);
    blockedCache.set(key, blocked);
    return blocked;
  };

  if (isGridBlocked(startNode)) {
    return { status: 'start-blocked', path: [args.start, args.target], obstacles, gridSizeCm };
  }
  if (isGridBlocked(targetNode)) {
    return { status: 'target-blocked', path: [args.start, args.target], obstacles, gridSizeCm };
  }

  const open = new Map<string, SearchNode>();
  const closed = new Map<string, SearchNode>();
  open.set(startKey, {
    ...startNode,
    key: startKey,
    g: 0,
    f: distance(gridToWorld(startNode), args.target),
  });

  const neighbors = [
    { ix: -1, iz: -1, cost: Math.SQRT2 }, { ix: 0, iz: -1, cost: 1 }, { ix: 1, iz: -1, cost: Math.SQRT2 },
    { ix: -1, iz: 0, cost: 1 },                                      { ix: 1, iz: 0, cost: 1 },
    { ix: -1, iz: 1, cost: Math.SQRT2 },  { ix: 0, iz: 1, cost: 1 },  { ix: 1, iz: 1, cost: Math.SQRT2 },
  ];

  while (open.size > 0) {
    let current: SearchNode | null = null;
    open.forEach((node) => {
      if (!current || node.f < current.f) current = node;
    });
    if (!current) break;

    open.delete(current.key);
    closed.set(current.key, current);

    if (current.key === targetKey) {
      const rawPath = reconstructPath(closed, targetKey, gridToWorld, args.start, args.target);
      const path = options.simplifyPath ? simplifyPath(rawPath, obstacles, clearanceCm, gridSizeCm) : rawPath;
      return { status: 'ok', path, obstacles, gridSizeCm };
    }

    for (const neighbor of neighbors) {
      const next: GridNode = { ix: current.ix + neighbor.ix, iz: current.iz + neighbor.iz };
      const nextKey = keyOf(next.ix, next.iz);
      if (closed.has(nextKey) || isGridBlocked(next)) continue;

      // Avoid squeezing diagonally through two blocked orthogonal cells.
      if (neighbor.ix !== 0 && neighbor.iz !== 0) {
        if (isGridBlocked({ ix: current.ix + neighbor.ix, iz: current.iz }) ||
            isGridBlocked({ ix: current.ix, iz: current.iz + neighbor.iz })) {
          continue;
        }
      }

      const tentativeG = current.g + neighbor.cost * gridSizeCm;
      const existing = open.get(nextKey);
      if (existing && tentativeG >= existing.g) continue;

      const h = distance(gridToWorld(next), args.target);
      open.set(nextKey, {
        ...next,
        key: nextKey,
        g: tentativeG,
        f: tentativeG + h,
        parent: current.key,
      });
    }
  }

  return { status: 'no-path', path: [args.start, args.target], obstacles, gridSizeCm };
}

export function buildRobotObjectAvoidancePath(args: {
  blueprint3d: any;
  item: any;
  targetX: number;
  targetZ: number;
  options?: ObjectFootprintAStarOptions;
}): NavigationPoint[] | null {
  const start = {
    x: Number(args.item?.position?.x),
    z: Number(args.item?.position?.z),
  };
  const target = { x: Number(args.targetX), z: Number(args.targetZ) };
  const result = buildObjectFootprintAStarPath({
    blueprint3d: args.blueprint3d,
    start,
    target,
    movingItem: args.item,
    options: args.options,
  });

  if (result.status === 'ok' || result.status === 'direct') return result.path;
  return null;
}
