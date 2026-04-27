import { rotateItemTowardsMovement } from './robotOrientation';

export type SmoothRobotMove = {
  item: any;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
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
};

export type SmoothRobotMoveFrame = {
  uid: string;
  item: any;
  currentX: number;
  currentZ: number;
  targetX: number;
  targetZ: number;
  progress: number;
};

const DEFAULT_OPTIONS: Required<SmoothRobotMoveOptions> = {
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
  const dx = args.targetX - fromX;
  const dz = args.targetZ - fromZ;
  const hasMovement = (dx * dx + dz * dz) > options.minMovement * options.minMovement;

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

  if (!lastSample && options.snapFirstUpdate) {
    rotateItemTowardsMovement(args.item, dx, dz, options.minMovement);
    args.item.position.set(args.targetX, args.item.position.y, args.targetZ);
    return false;
  }

  const measuredInterval = lastSample ? now - lastSample.receivedAt : options.defaultDurationMs;
  const durationMs = clamp(
    Number.isFinite(measuredInterval) && measuredInterval > 0
      ? measuredInterval
      : options.defaultDurationMs,
    options.minDurationMs,
    options.maxDurationMs
  );

  args.moves[args.uid] = {
    item: args.item,
    fromX,
    fromZ,
    toX: args.targetX,
    toZ: args.targetZ,
    startAt: now,
    durationMs,
  };

  rotateItemTowardsMovement(args.item, dx, dz, options.minMovement);
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
    const nextX = move.fromX + (move.toX - move.fromX) * eased;
    const nextZ = move.fromZ + (move.toZ - move.fromZ) * eased;

    rotateItemTowardsMovement(item, nextX - previousX, nextZ - previousZ, minMovement);
    item.position.set(nextX, item.position.y, nextZ);
    didUpdate = true;

    const frame: SmoothRobotMoveFrame = {
      uid,
      item,
      currentX: nextX,
      currentZ: nextZ,
      targetX: move.toX,
      targetZ: move.toZ,
      progress: t,
    };
    args.onMoveFrame?.(frame);

    if (t >= 1) {
      item.position.set(move.toX, item.position.y, move.toZ);
      delete args.moves[uid];
      args.onMoveComplete?.({ ...frame, currentX: move.toX, currentZ: move.toZ, progress: 1 });
    } else {
      hasActiveMoves = true;
    }
  }

  return { hasActiveMoves, didUpdate };
}
