export type RobotTargetPreview = {
  group: any;
  marker: any;
  line: any;
};

export type RobotTargetPreviewRegistry = Record<string, RobotTargetPreview>;

const TARGET_MARKER_Y = 8;
const TRAJECTORY_LINE_Y = 5;
const TARGET_MARKER_RADIUS = 7;
const TRAJECTORY_LINE_COLOR = 0x3182ce;
const TRAJECTORY_DOT_SIZE = 2;
const TRAJECTORY_DOT_GAP = 5;

function getThree(): any | null {
  return typeof window !== 'undefined' ? (window as any).THREE : null;
}

function getScene3(blueprint3d: any): any | null {
  return blueprint3d?.model?.scene?.getScene?.() ?? null;
}

function makeLineGeometry(THREE: any, fromX: number, fromZ: number, toX: number, toZ: number): any {
  const points = [
    new THREE.Vector3(fromX, TRAJECTORY_LINE_Y, fromZ),
    new THREE.Vector3(toX, TRAJECTORY_LINE_Y, toZ),
  ];

  if (THREE.Geometry) {
    const geometry = new THREE.Geometry();
    geometry.vertices.push(...points);
    return geometry;
  }

  return new THREE.BufferGeometry().setFromPoints(points);
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

function updateLineGeometry(line: any, THREE: any, fromX: number, fromZ: number, toX: number, toZ: number): void {
  const geometry = line?.geometry;
  if (!geometry) return;

  if (Array.isArray(geometry.vertices) && geometry.vertices.length >= 2) {
    geometry.vertices[0].set(fromX, TRAJECTORY_LINE_Y, fromZ);
    geometry.vertices[1].set(toX, TRAJECTORY_LINE_Y, toZ);
    geometry.verticesNeedUpdate = true;
    updateLineDistances(line);
    return;
  }

  if (geometry.attributes?.position) {
    const position = geometry.attributes.position;
    position.setXYZ(0, fromX, TRAJECTORY_LINE_Y, fromZ);
    position.setXYZ(1, toX, TRAJECTORY_LINE_Y, toZ);
    position.needsUpdate = true;
    geometry.computeBoundingSphere?.();
    updateLineDistances(line);
    return;
  }

  const nextGeometry = makeLineGeometry(THREE, fromX, fromZ, toX, toZ);
  geometry.dispose?.();
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

function createPreview(THREE: any, uid: string, fromX: number, fromZ: number, toX: number, toZ: number): RobotTargetPreview {
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
  marker.position.set(toX, TARGET_MARKER_Y, toZ);
  group.add(marker);

  const line = new THREE.Line(
    makeLineGeometry(THREE, fromX, fromZ, toX, toZ),
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

  return { group, marker, line };
}

export function showRobotTargetPreview(args: {
  blueprint3d: any;
  uid: string;
  item: any;
  targetX: number;
  targetZ: number;
  previews: RobotTargetPreviewRegistry;
}): boolean {
  const THREE = getThree();
  const scene3 = getScene3(args.blueprint3d);
  if (!THREE || !scene3 || !args.item?.position) return false;
  if (!Number.isFinite(args.targetX) || !Number.isFinite(args.targetZ)) return false;

  const fromX = Number(args.item.position.x);
  const fromZ = Number(args.item.position.z);
  if (!Number.isFinite(fromX) || !Number.isFinite(fromZ)) return false;

  let preview = args.previews[args.uid];
  if (!preview) {
    preview = createPreview(THREE, args.uid, fromX, fromZ, args.targetX, args.targetZ);
    args.previews[args.uid] = preview;
    scene3.add(preview.group);
  }

  preview.marker.position.set(args.targetX, TARGET_MARKER_Y, args.targetZ);
  updateLineGeometry(preview.line, THREE, fromX, fromZ, args.targetX, args.targetZ);

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
}): boolean {
  const preview = args.previews[args.uid];
  const THREE = getThree();
  if (!preview || !THREE) return false;

  preview.marker.position.set(args.targetX, TARGET_MARKER_Y, args.targetZ);
  updateLineGeometry(preview.line, THREE, args.currentX, args.currentZ, args.targetX, args.targetZ);
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
