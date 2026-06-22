import { useEffect, useRef, type MutableRefObject } from 'react';
import { fetchDeviceStatus } from '../utils/deviceStatus';
import {
  scheduleSmoothRobotMove,
  tickSmoothRobotMoves,
  type RobotPathPoint,
  type RobotPositionSampleRegistry,
  type SmoothRobotMoveRegistry,
} from '../utils/smoothRobotMovement';
import {
  buildRobotTargetPreviewPath,
  clearAllRobotTargetPreviews,
  clearRobotTargetPreview,
  showRobotTargetPreview,
  updateRobotTargetPreview,
  type RobotTargetPreviewRegistry,
} from '../utils/robotTargetPreview';

const REAL_MODE_MOVEMENT_SECONDS = 5;

const POLL_INTERVAL = 500;

const ROBOT_PATH_OPTIONS = {
  robotRadiusCm: 35,
  obstaclePaddingCm: 15,
  gridSizeCm: 25,
  boundsPaddingCm: 150,
  maxGridNodes: 70000,
  includeDevices: true,
  includeRobots: false,
};

function getItemDeviceUid(item: any): string {
  return String(
    item?.device_uid ??
    item?.metadata?.device_uid ??
    item?.metadata?.deviceId ??
    item?.deviceId ??
    ''
  ).trim();
}

function buildDirectPath(item: any, targetX: number, targetZ: number): RobotPathPoint[] {
  return [
    {
      x: Number(item?.position?.x),
      z: Number(item?.position?.z),
    },
    { x: targetX, z: targetZ },
  ].filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z));
}

function buildNavigationPath(args: {
  blueprint3d: any;
  item: any;
  targetX: number;
  targetZ: number;
}): RobotPathPoint[] {
  const plannedPath = buildRobotTargetPreviewPath({
    blueprint3d: args.blueprint3d,
    item: args.item,
    targetX: args.targetX,
    targetZ: args.targetZ,
    options: ROBOT_PATH_OPTIONS,
  });

  const path = plannedPath && plannedPath.length >= 2
    ? plannedPath
    : buildDirectPath(args.item, args.targetX, args.targetZ);

  return path.length >= 2 ? path : [{ x: args.targetX, z: args.targetZ }, { x: args.targetX, z: args.targetZ }];
}

export function useDeviceSync(
  blueprint3d: any,
  simulatingUidRef: MutableRefObject<string | null>,
  isRealMode: boolean,
  paused = false
) {
  const lastKnownRef = useRef<RobotPositionSampleRegistry>({});
  const smoothMovesRef = useRef<SmoothRobotMoveRegistry>({});
  const targetPreviewsRef = useRef<RobotTargetPreviewRegistry>({});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!blueprint3d || paused) return;

    const runSmoothMovementFrame = () => {
      rafRef.current = null;

      const { hasActiveMoves, didUpdate } = tickSmoothRobotMoves({
        moves: smoothMovesRef.current,
        isUidBlocked: (uid) => simulatingUidRef.current === uid,
        onMoveFrame: (frame) => {
          updateRobotTargetPreview({
            uid: frame.uid,
            currentX: frame.currentX,
            currentZ: frame.currentZ,
            targetX: frame.targetX,
            targetZ: frame.targetZ,
            path: frame.path,
            previews: targetPreviewsRef.current,
          });
        },
        onMoveComplete: (frame) => {
          clearRobotTargetPreview(targetPreviewsRef.current, frame.uid, blueprint3d);
        },
        onMoveCancel: (uid) => {
          clearRobotTargetPreview(targetPreviewsRef.current, uid, blueprint3d);
        },
      });

      if (didUpdate) {
        const scene = blueprint3d?.model?.scene;
        if (scene) scene.needsUpdate = true;
        blueprint3d?.three?.needsUpdate?.();
      }

      if (hasActiveMoves) {
        rafRef.current = requestAnimationFrame(runSmoothMovementFrame);
      }
    };

    const ensureSmoothMovementLoop = () => {
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(runSmoothMovementFrame);
      }
    };

    const poll = async () => {
      const scene = blueprint3d?.model?.scene;
      if (!scene) return;

      const items: any[] = scene.getItems?.() ?? [];
      const deviceItems = items.filter((item) => Boolean(getItemDeviceUid(item)));
      if (deviceItems.length === 0) return;

      await Promise.allSettled(
        deviceItems.map(async (item) => {
          const uid = getItemDeviceUid(item);
          if (!uid) return;

          if (simulatingUidRef.current === uid) return;

          let statusData: any;
          try {
            statusData = await fetchDeviceStatus({
              uid,
              isRealMode,
              forceRefresh: isRealMode,
            });
          } catch {
            return;
          }

          if (statusData?.coordinates_x == null || statusData?.coordinates_y == null) return;

          const newX: number = Number(statusData.coordinates_x);
          const newY: number = Number(statusData.coordinates_y);
          const newStatus: string = statusData?.status ?? '';
          if (!Number.isFinite(newX) || !Number.isFinite(newY)) return;

          const lastSample = lastKnownRef.current[uid];

          if (
            lastSample &&
            Math.abs(lastSample.x - newX) <= 0.001 &&
            Math.abs(lastSample.z - newY) <= 0.001 &&
            lastSample.status === newStatus
          ) {
            return;
          }

          const navigationPath = buildNavigationPath({
            blueprint3d,
            item,
            targetX: newX,
            targetZ: newY,
          });

          const scheduledMove = scheduleSmoothRobotMove({
            uid,
            item,
            targetX: newX,
            targetZ: newY,
            status: newStatus,
            moves: smoothMovesRef.current,
            samples: lastKnownRef.current,
            options: {
              defaultDurationMs: POLL_INTERVAL,
              fixedDurationMs: isRealMode ? REAL_MODE_MOVEMENT_SECONDS * 1000 : undefined,
              minDurationMs: 120,
              maxDurationMs: 1200,
              minMovement: 0.001,
              snapFirstUpdate: true,
              path: navigationPath,
            },
          });

          if (scheduledMove) {
            showRobotTargetPreview({
              blueprint3d,
              uid,
              item,
              targetX: newX,
              targetZ: newY,
              path: navigationPath,
              previews: targetPreviewsRef.current,
            });
            ensureSmoothMovementLoop();
          } else {
            scene.needsUpdate = true;
            blueprint3d?.three?.needsUpdate?.();
          }
        })
      );
    };

    const interval = setInterval(poll, POLL_INTERVAL);
    return () => {
      clearInterval(interval);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      smoothMovesRef.current = {};
      clearAllRobotTargetPreviews(targetPreviewsRef.current, blueprint3d);
    };
  }, [blueprint3d, simulatingUidRef, isRealMode, paused]);
}
