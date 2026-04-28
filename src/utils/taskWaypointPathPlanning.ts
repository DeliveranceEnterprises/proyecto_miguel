import { buildObjectFootprintAStarPath, type NavigationPoint, type ObjectFootprintAStarOptions, type ObjectFootprintAStarStatus } from './objectFootprintPathPlanning';

export type TaskWaypointLike = {
  coordinates_x: number;
  coordinates_y: number;
  label?: string | null;
};

export type TaskRoutePoint = NavigationPoint;

export type TaskRouteSegment = {
  from: NavigationPoint;
  target: NavigationPoint;
  status: ObjectFootprintAStarStatus | 'fallback-direct';
  path: NavigationPoint[];
  waypointIndex: number;
};

export type TaskObjectAvoidanceRoute = {
  path: TaskRoutePoint[];
  segments: TaskRouteSegment[];
  warnings: string[];
};

export type TaskObjectAvoidanceOptions = ObjectFootprintAStarOptions & {
  /** Include the current robot position as the start before the first waypoint. */
  includeCurrentPosition?: boolean;
  /** Keep the task executable if A* cannot solve one segment. */
  fallbackToDirect?: boolean;
};

const DEFAULT_OPTIONS: Required<Pick<TaskObjectAvoidanceOptions, 'includeCurrentPosition' | 'fallbackToDirect'>> = {
  includeCurrentPosition: true,
  fallbackToDirect: true,
};

function asPointFromWaypoint(waypoint: TaskWaypointLike): NavigationPoint | null {
  const x = Number(waypoint?.coordinates_x);
  const z = Number(waypoint?.coordinates_y);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { x, z };
}

function areSamePoint(a: NavigationPoint, b: NavigationPoint, epsilon = 0.001): boolean {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.z - b.z) <= epsilon;
}

function appendPath(target: NavigationPoint[], source: NavigationPoint[]): void {
  source.forEach((point) => {
    const last = target[target.length - 1];
    if (!last || !areSamePoint(last, point)) target.push(point);
  });
}

export function buildTaskObjectAvoidanceRoute(args: {
  blueprint3d: any;
  item: any;
  waypoints: TaskWaypointLike[];
  options?: TaskObjectAvoidanceOptions;
}): TaskObjectAvoidanceRoute {
  const options = { ...DEFAULT_OPTIONS, ...(args.options ?? {}) };
  const warnings: string[] = [];
  const segments: TaskRouteSegment[] = [];
  const path: TaskRoutePoint[] = [];

  const waypointPoints = (args.waypoints ?? [])
    .map(asPointFromWaypoint)
    .filter((point): point is NavigationPoint => point != null);

  if (!args.item?.position || waypointPoints.length === 0) {
    return { path, segments, warnings: ['No hay robot o waypoints válidos para calcular la ruta.'] };
  }

  const currentPosition = {
    x: Number(args.item.position.x),
    z: Number(args.item.position.z),
  };

  if (!Number.isFinite(currentPosition.x) || !Number.isFinite(currentPosition.z)) {
    return { path, segments, warnings: ['La posición actual del robot no es válida.'] };
  }

  let cursor = options.includeCurrentPosition ? currentPosition : waypointPoints[0];
  if (options.includeCurrentPosition) path.push(cursor);

  const startIndex = options.includeCurrentPosition ? 0 : 1;
  if (!options.includeCurrentPosition && waypointPoints.length > 0) path.push(waypointPoints[0]);

  for (let i = startIndex; i < waypointPoints.length; i++) {
    const target = waypointPoints[i];
    if (areSamePoint(cursor, target)) continue;

    const result = buildObjectFootprintAStarPath({
      blueprint3d: args.blueprint3d,
      start: cursor,
      target,
      movingItem: args.item,
      options,
    });

    if (result.status === 'ok' || result.status === 'direct') {
      appendPath(path, result.path);
      segments.push({ from: cursor, target, status: result.status, path: result.path, waypointIndex: i });
    } else if (options.fallbackToDirect) {
      const directPath = [cursor, target];
      appendPath(path, directPath);
      segments.push({ from: cursor, target, status: 'fallback-direct', path: directPath, waypointIndex: i });
      warnings.push(`A* no encontró ruta para el tramo ${i + 1}; se ha usado línea directa. Estado: ${result.status}.`);
    } else {
      warnings.push(`A* no encontró ruta para el tramo ${i + 1}. Estado: ${result.status}.`);
      break;
    }

    cursor = target;
  }

  return { path, segments, warnings };
}
