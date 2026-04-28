import { buildRobotObjectAvoidancePath, type NavigationPoint } from './objectFootprintPathPlanning';

export type RobotTargetPreviewPoint = NavigationPoint;

export type RobotTargetPreview = {
  group: any;
  marker: any;
  line: any;
  path: RobotTargetPreviewPoint[];
};

export type RobotTargetPreviewRegistry = Record<string, RobotTargetPreview>;

export type RobotTargetPreviewPathOptions = {
  robotRadiusCm?: number;
  obstaclePaddingCm?: number;
  gridSizeCm?: number;
  boundsPaddingCm?: number;
  maxGridNodes?: number;
  includeDevices?: boolean;
  includeRobots?: boolean;
};

const TARGET_MARKER_Y = 8;
const TRAJECTORY_LINE_Y = 5;
const TARGET_MARKER_RADIUS = 7;
const TRAJECTORY_LINE_COLOR = 0x3182ce;
const TRAJECTORY_DOT_SIZE = 2;
const TRAJECTORY_DOT_GAP = 5;

const DEFAULT_PATH_OPTIONS: Required<RobotTargetPreviewPathOptions> = {
  robotRadiusCm: 35,
  obstaclePaddingCm: 15,
  gridSizeCm: 25,
  boundsPaddingCm: 150,
  maxGridNodes: 70000,
  includeDevices: true,
  includeRobots: false,
};

function getThree(): any | null {
  return typeof window !== 'undefined' ? (window as any).THREE : null;
}

function getScene3(blueprint3d: any): any | null {
  return blueprint3d?.model?.scene?.getScene?.() ?? null;
}

function isFinitePoint(point: RobotTargetPreviewPoint | null | undefined): point is RobotTargetPreviewPoint {
  return Boolean(point) && Number.isFinite(point!.x) && Number.isFinite(point!.z);
}

function samePoint(a: RobotTargetPreviewPoint, b: RobotTargetPreviewPoint, tolerance = 0.001): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) <= tolerance;
}

function normalizePath(points: RobotTargetPreviewPoint[]): RobotTargetPreviewPoint[] {
  const normalized: RobotTargetPreviewPoint[] = [];

  for (const point of points) {
    if (!isFinitePoint(point)) continue;

    const next = { x: Number(point.x), z: Number(point.z) };
    const previous = normalized[normalized.length - 1];
    if (!previous || !samePoint(previous, next)) {
      normalized.push(next);
    }
  }

  return normalized;
}

function makeDirectPath(fromX: number, fromZ: number, toX: number, toZ: number): RobotTargetPreviewPoint[] {
  return normalizePath([
    { x: fromX, z: fromZ },
    { x: toX, z: toZ },
  ]);
}

function makeLineGeometry(THREE: any, path: RobotTargetPreviewPoint[]): any {
  const points = normalizePath(path);
  const safePoints = points.length >= 2 ? points : [
    points[0] ?? { x: 0, z: 0 },
    points[0] ?? { x: 0, z: 0 },
  ];

  const vertices = safePoints.map((point) => new THREE.Vector3(point.x, TRAJECTORY_LINE_Y, point.z));

  if (THREE.Geometry) {
    const geometry = new THREE.Geometry();
    geometry.vertices.push(...vertices);
    return geometry;
  }

  return new THREE.BufferGeometry().setFromPoints(vertices);
}

function updateLineDistances(line: any): void {
  const geometry = line?.geometry;
  if (!geometry) return;

  if (typeof geometry.computeLineDistances === 'function') {
    geometry.computeLineDistances();
    geometry.lineDistancesNeedUpdate = true;
    return;
  }

  line?.computeLineDistances?.();
}

function updateLineGeometry(line: any, THREE: any, path: RobotTargetPreviewPoint[]): void {
  if (!line) return;

  const normalizedPath = normalizePath(path);
  const safePath = normalizedPath.length >= 2 ? normalizedPath : makeDirectPath(
    normalizedPath[0]?.x ?? 0,
    normalizedPath[0]?.z ?? 0,
    normalizedPath[0]?.x ?? 0,
    normalizedPath[0]?.z ?? 0
  );

  const geometry = line.geometry;
  const hasLegacyVertices = Array.isArray(geometry?.vertices);
  const currentPointCount = hasLegacyVertices
    ? geometry.vertices.length
    : geometry?.attributes?.position?.count;

  if (geometry && currentPointCount === safePath.length) {
    if (hasLegacyVertices) {
      safePath.forEach((point, index) => {
        geometry.vertices[index].set(point.x, TRAJECTORY_LINE_Y, point.z);
      });
      geometry.verticesNeedUpdate = true;
      geometry.computeBoundingSphere?.();
      updateLineDistances(line);
      return;
    }

    if (geometry.attributes?.position) {
      const position = geometry.attributes.position;
      safePath.forEach((point, index) => {
        position.setXYZ(index, point.x, TRAJECTORY_LINE_Y, point.z);
      });
      position.needsUpdate = true;
      geometry.computeBoundingSphere?.();
      updateLineDistances(line);
      return;
    }
  }

  const nextGeometry = makeLineGeometry(THREE, safePath);
  geometry?.dispose?.();
  line.geometry = nextGeometry;
  updateLineDistances(line);
}

function disposeObject3D(object: any): void {
  object?.traverse?.((child: any) => {
    child?.geometry?.dispose?.();
    const material = child?.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry?.dispose?.());
    } else {
      material?.dispose?.();
    }
  });
}

function createPreview(
  THREE: any,
  uid: string,
  path: RobotTargetPreviewPoint[],
  targetX: number,
  targetZ: number
): RobotTargetPreview {
  const group = new THREE.Group();
  group.name = `robot_target_preview_${uid}`;
  group.raycast = () => undefined;
  group.userData = {
    ...(group.userData ?? {}),
    isRobotTargetPreview: true,
    deviceUid: uid,
  };

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(TARGET_MARKER_RADIUS, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0xff7043, depthTest: false, transparent: true, opacity: 0.9 })
  );
  marker.name = `robot_target_point_${uid}`;
  marker.raycast = () => undefined;
  marker.renderOrder = 999;
  marker.position.set(targetX, TARGET_MARKER_Y, targetZ);
  group.add(marker);

  const line = new THREE.Line(
    makeLineGeometry(THREE, path),
    new THREE.LineDashedMaterial({
      color: TRAJECTORY_LINE_COLOR,
      linewidth: 3,
      dashSize: TRAJECTORY_DOT_SIZE,
      gapSize: TRAJECTORY_DOT_GAP,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    })
  );
  line.name = `robot_target_trajectory_${uid}`;
  line.raycast = () => undefined;
  line.renderOrder = 998;
  updateLineDistances(line);
  group.add(line);

  return { group, marker, line, path: normalizePath(path) };
}

export function buildRobotTargetPreviewPath(args: {
  blueprint3d: any;
  item: any;
  targetX: number;
  targetZ: number;
  options?: RobotTargetPreviewPathOptions;
}): RobotTargetPreviewPoint[] | null {
  const fromX = Number(args.item?.position?.x);
  const fromZ = Number(args.item?.position?.z);
  if (!Number.isFinite(fromX) || !Number.isFinite(fromZ)) return null;
  if (!Number.isFinite(args.targetX) || !Number.isFinite(args.targetZ)) return null;

  const plannedPath = buildRobotObjectAvoidancePath({
    blueprint3d: args.blueprint3d,
    item: args.item,
    targetX: args.targetX,
    targetZ: args.targetZ,
    options: {
      ...DEFAULT_PATH_OPTIONS,
      ...(args.options ?? {}),
    },
  });

  return normalizePath(plannedPath ?? makeDirectPath(fromX, fromZ, args.targetX, args.targetZ));
}

export function showRobotTargetPreview(args: {
  blueprint3d: any;
  uid: string;
  item: any;
  targetX: number;
  targetZ: number;
  previews: RobotTargetPreviewRegistry;
  path?: RobotTargetPreviewPoint[] | null;
  pathOptions?: RobotTargetPreviewPathOptions;
}): boolean {
  const THREE = getThree();
  const scene3 = getScene3(args.blueprint3d);
  if (!THREE || !scene3 || !args.item?.position) return false;
  if (!Number.isFinite(args.targetX) || !Number.isFinite(args.targetZ)) return false;

  const fromX = Number(args.item.position.x);
  const fromZ = Number(args.item.position.z);
  if (!Number.isFinite(fromX) || !Number.isFinite(fromZ)) return false;

  const path = normalizePath(
    args.path ??
    buildRobotTargetPreviewPath({
      blueprint3d: args.blueprint3d,
      item: args.item,
      targetX: args.targetX,
      targetZ: args.targetZ,
      options: args.pathOptions,
    }) ??
    makeDirectPath(fromX, fromZ, args.targetX, args.targetZ)
  );

  const safePath = path.length >= 2 ? path : makeDirectPath(fromX, fromZ, args.targetX, args.targetZ);

  let preview = args.previews[args.uid];
  if (!preview) {
    preview = createPreview(THREE, args.uid, safePath, args.targetX, args.targetZ);
    args.previews[args.uid] = preview;
    scene3.add(preview.group);
  }

  preview.path = safePath;
  preview.marker.position.set(args.targetX, TARGET_MARKER_Y, args.targetZ);
  updateLineGeometry(preview.line, THREE, safePath);

  args.blueprint3d?.three?.needsUpdate?.();
  return true;
}

export function updateRobotTargetPreview(args: {
  uid: string;
  currentX: number;
  currentZ: number;
  targetX: number;
  targetZ: number;
  previews: RobotTargetPreviewRegistry;
  path?: RobotTargetPreviewPoint[] | null;
}): boolean {
  const preview = args.previews[args.uid];
  const THREE = getThree();
  if (!preview || !THREE) return false;

  const path = normalizePath(
    args.path ?? makeDirectPath(args.currentX, args.currentZ, args.targetX, args.targetZ)
  );
  const safePath = path.length >= 2 ? path : makeDirectPath(args.currentX, args.currentZ, args.targetX, args.targetZ);

  preview.path = safePath;
  preview.marker.position.set(args.targetX, TARGET_MARKER_Y, args.targetZ);
  updateLineGeometry(preview.line, THREE, safePath);
  return true;
}

export function clearRobotTargetPreview(previews: RobotTargetPreviewRegistry, uid: string, blueprint3d?: any): void {
  const preview = previews[uid];
  if (!preview) return;

  const scene3 = getScene3(blueprint3d);
  scene3?.remove?.(preview.group);
  disposeObject3D(preview.group);
  delete previews[uid];
  blueprint3d?.three?.needsUpdate?.();
}

export function clearAllRobotTargetPreviews(previews: RobotTargetPreviewRegistry, blueprint3d?: any): void {
  Object.keys(previews).forEach((uid) => clearRobotTargetPreview(previews, uid, blueprint3d));
}
