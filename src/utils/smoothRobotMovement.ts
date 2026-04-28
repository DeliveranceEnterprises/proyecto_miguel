import { rotateItemTowardsMovement } from './robotOrientation';

export type RobotPathPoint = {
  x: number;
  z: number;
};

export type SmoothRobotMove = {
  item: any;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  path: RobotPathPoint[];
  cumulativeDistances: number[];
  totalDistance: number;
  startAt: number;
  durationMs: number;
};

export type SmoothRobotMoveRegistry = Record<string, SmoothRobotMove>;

export type RobotPositionSample = {
  x: number;
  z: number;
  status: string;
  receivedAt: number;
};

export type RobotPositionSampleRegistry = Record<string, RobotPositionSample>;

export type SmoothRobotMoveOptions = {
  /** Duration used until there is a measured interval between backend updates. */
  defaultDurationMs?: number;
  /** Avoid almost-instant animations when the backend sends updates very quickly. */
  minDurationMs?: number;
  /** Avoid very slow catch-up when one backend update arrives late. */
  maxDurationMs?: number;
  /** Ignore tiny coordinate jitter. Coordinates use the same units as the scene. */
  minMovement?: number;
  /** Put the robot directly on the first backend position instead of animating from a stale saved position. */
  snapFirstUpdate?: boolean;
  /** Optional A* / navigation path to follow instead of the direct segment. */
  path?: RobotPathPoint[] | null;
};

export type SmoothRobotMoveFrame = {
  uid: string;
  item: any;
  currentX: number;
  currentZ: number;
  targetX: number;
  targetZ: number;
  progress: number;
  path: RobotPathPoint[];
  remainingPath: RobotPathPoint[];
};

const DEFAULT_OPTIONS: Required<Omit<SmoothRobotMoveOptions, 'path'>> = {
  defaultDurationMs: 500,
  minDurationMs: 120,
  maxDurationMs: 1200,
  minMovement: 0.001,
  snapFirstUpdate: true,
};

function getNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function readSceneX(item: any): number {
  const value = Number(item?.position?.x);
  return Number.isFinite(value) ? value : 0;
}

function readSceneZ(item: any): number {
  const value = Number(item?.position?.z);
  return Number.isFinite(value) ? value : 0;
}

function isFinitePathPoint(point: RobotPathPoint | null | undefined): point is RobotPathPoint {
  return Boolean(point) && Number.isFinite(point!.x) && Number.isFinite(point!.z);
}

function distance(a: RobotPathPoint, b: RobotPathPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function samePoint(a: RobotPathPoint, b: RobotPathPoint, tolerance = 0.001): boolean {
  return distance(a, b) <= tolerance;
}

function normalizeMovePath(
  rawPath: RobotPathPoint[] | null | undefined,
  start: RobotPathPoint,
  target: RobotPathPoint
): RobotPathPoint[] {
  const normalized: RobotPathPoint[] = [];

  const pushPoint = (point: RobotPathPoint) => {
    if (!isFinitePathPoint(point)) return;
    const next = { x: Number(point.x), z: Number(point.z) };
    const previous = normalized[normalized.length - 1];
    if (!previous || !samePoint(previous, next)) {
      normalized.push(next);
    }
  };

  pushPoint(start);
  (rawPath ?? []).forEach(pushPoint);
  pushPoint(target);

  if (normalized.length < 2) return [start, target];
  return normalized;
}

function buildCumulativeDistances(path: RobotPathPoint[]): number[] {
  const cumulativeDistances = [0];
  for (let index = 1; index < path.length; index += 1) {
    cumulativeDistances[index] = cumulativeDistances[index - 1] + distance(path[index - 1], path[index]);
  }
  return cumulativeDistances;
}

function interpolateAlongPath(
  path: RobotPathPoint[],
  cumulativeDistances: number[],
  totalDistance: number,
  progress: number
): { point: RobotPathPoint; segmentIndex: number } {
  if (path.length <= 1 || totalDistance <= 0) {
    return { point: path[path.length - 1] ?? { x: 0, z: 0 }, segmentIndex: Math.max(0, path.length - 1) };
  }

  const targetDistance = clamp(progress, 0, 1) * totalDistance;

  for (let index = 1; index < cumulativeDistances.length; index += 1) {
    if (targetDistance <= cumulativeDistances[index]) {
      const segmentStartDistance = cumulativeDistances[index - 1];
      const segmentLength = Math.max(0.000001, cumulativeDistances[index] - segmentStartDistance);
      const segmentT = clamp((targetDistance - segmentStartDistance) / segmentLength, 0, 1);
      const from = path[index - 1];
      const to = path[index];
      return {
        point: {
          x: from.x + (to.x - from.x) * segmentT,
          z: from.z + (to.z - from.z) * segmentT,
        },
        segmentIndex: index,
      };
    }
  }

  return { point: path[path.length - 1], segmentIndex: path.length - 1 };
}

function buildRemainingPath(
  currentPoint: RobotPathPoint,
  path: RobotPathPoint[],
  segmentIndex: number
): RobotPathPoint[] {
  const remaining = [currentPoint];
  for (let index = Math.max(1, segmentIndex); index < path.length; index += 1) {
    const next = path[index];
    const previous = remaining[remaining.length - 1];
    if (!previous || !samePoint(previous, next)) {
      remaining.push(next);
    }
  }
  return remaining.length >= 2 ? remaining : [currentPoint, path[path.length - 1] ?? currentPoint];
}

export function scheduleSmoothRobotMove(args: {
  uid: string;
  item: any;
  targetX: number;
  targetZ: number;
  status?: string;
  moves: SmoothRobotMoveRegistry;
  samples: RobotPositionSampleRegistry;
  now?: number;
  options?: SmoothRobotMoveOptions;
}): boolean {
  const options = { ...DEFAULT_OPTIONS, ...(args.options ?? {}) };
  const now = args.now ?? getNow();
  const status = args.status ?? '';
  const lastSample = args.samples[args.uid];

  if (!args.item?.position) return false;
  if (!Number.isFinite(args.targetX) || !Number.isFinite(args.targetZ)) return false;

  if (
    lastSample &&
    lastSample.x === args.targetX &&
    lastSample.z === args.targetZ &&
    lastSample.status === status
  ) {
    return false;
  }

  const fromX = readSceneX(args.item);
  const fromZ = readSceneZ(args.item);
  const target = { x: args.targetX, z: args.targetZ };
  const start = { x: fromX, z: fromZ };
  const dx = target.x - start.x;
  const dz = target.z - start.z;
  const directDistance = Math.hypot(dx, dz);
  const hasMovement = directDistance > options.minMovement;

  args.samples[args.uid] = {
    x: args.targetX,
    z: args.targetZ,
    status,
    receivedAt: now,
  };

  if (!hasMovement) {
    delete args.moves[args.uid];
    return false;
  }

  const path = normalizeMovePath(args.options?.path, start, target);
  const cumulativeDistances = buildCumulativeDistances(path);
  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1] ?? directDistance;

  if (!lastSample && options.snapFirstUpdate) {
    rotateItemTowardsMovement(args.item, dx, dz, options.minMovement);
    args.item.position.set(args.targetX, args.item.position.y, args.targetZ);
    return false;
  }

  const measuredInterval = lastSample ? now - lastSample.receivedAt : options.defaultDurationMs;
  const baseDurationMs = clamp(
    Number.isFinite(measuredInterval) && measuredInterval > 0
      ? measuredInterval
      : options.defaultDurationMs,
    options.minDurationMs,
    options.maxDurationMs
  );
  const pathScale = directDistance > options.minMovement
    ? clamp(totalDistance / directDistance, 1, 3)
    : 1;
  const durationMs = clamp(baseDurationMs * pathScale, options.minDurationMs, options.maxDurationMs);

  args.moves[args.uid] = {
    item: args.item,
    fromX,
    fromZ,
    toX: args.targetX,
    toZ: args.targetZ,
    path,
    cumulativeDistances,
    totalDistance,
    startAt: now,
    durationMs,
  };

  const firstLeg = path[1] ?? target;
  rotateItemTowardsMovement(args.item, firstLeg.x - start.x, firstLeg.z - start.z, options.minMovement);
  return true;
}

export function tickSmoothRobotMoves(args: {
  moves: SmoothRobotMoveRegistry;
  now?: number;
  isUidBlocked?: (uid: string) => boolean;
  minMovement?: number;
  onMoveFrame?: (frame: SmoothRobotMoveFrame) => void;
  onMoveComplete?: (frame: SmoothRobotMoveFrame) => void;
  onMoveCancel?: (uid: string) => void;
}): { hasActiveMoves: boolean; didUpdate: boolean } {
  const now = args.now ?? getNow();
  const minMovement = args.minMovement ?? DEFAULT_OPTIONS.minMovement;
  let hasActiveMoves = false;
  let didUpdate = false;

  for (const [uid, move] of Object.entries(args.moves)) {
    if (args.isUidBlocked?.(uid)) {
      delete args.moves[uid];
      args.onMoveCancel?.(uid);
      continue;
    }

    const item = move.item;
    if (!item?.position) {
      delete args.moves[uid];
      args.onMoveCancel?.(uid);
      continue;
    }

    const rawT = move.durationMs > 0 ? (now - move.startAt) / move.durationMs : 1;
    const t = clamp(rawT, 0, 1);
    const eased = smoothstep(t);

    const previousX = readSceneX(item);
    const previousZ = readSceneZ(item);
    const { point: nextPoint, segmentIndex } = interpolateAlongPath(
      move.path,
      move.cumulativeDistances,
      move.totalDistance,
      eased
    );

    rotateItemTowardsMovement(item, nextPoint.x - previousX, nextPoint.z - previousZ, minMovement);
    item.position.set(nextPoint.x, item.position.y, nextPoint.z);
    didUpdate = true;

    const remainingPath = buildRemainingPath(nextPoint, move.path, segmentIndex);
    const frame: SmoothRobotMoveFrame = {
      uid,
      item,
      currentX: nextPoint.x,
      currentZ: nextPoint.z,
      targetX: move.toX,
      targetZ: move.toZ,
      progress: t,
      path: move.path,
      remainingPath,
    };
    args.onMoveFrame?.(frame);

    if (t >= 1) {
      item.position.set(move.toX, item.position.y, move.toZ);
      const completePoint = { x: move.toX, z: move.toZ };
      delete args.moves[uid];
      args.onMoveComplete?.({
        ...frame,
        currentX: move.toX,
        currentZ: move.toZ,
        progress: 1,
        remainingPath: [completePoint, completePoint],
      });
    } else {
      hasActiveMoves = true;
    }
  }

  return { hasActiveMoves, didUpdate };
}
