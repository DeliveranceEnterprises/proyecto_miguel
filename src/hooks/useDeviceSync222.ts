import { useEffect, useRef, type MutableRefObject } from 'react';
import { fetchDeviceStatus } from '../utils/deviceStatus';
import { scheduleSmoothRobotMove, tickSmoothRobotMoves, type RobotPositionSampleRegistry, type SmoothRobotMoveRegistry } from '../utils/smoothRobotMovement';
import { clearAllRobotTargetPreviews, clearRobotTargetPreview, showRobotTargetPreview, updateRobotTargetPreview, type RobotTargetPreviewRegistry } from '../utils/robotTargetPreview';

const POLL_INTERVAL = 500;

function getItemDeviceUid(item: any): string {
  return String(
    item?.device_uid ??
    item?.metadata?.device_uid ??
    item?.metadata?.deviceId ??
    item?.deviceId ??
    ''
  ).trim();
}

export function useDeviceSync(
  blueprint3d: any,
  simulatingUidRef: MutableRefObject<string | null>,
  isRealMode: boolean
) {
  const lastKnownRef = useRef<RobotPositionSampleRegistry>({});
  const smoothMovesRef = useRef<SmoothRobotMoveRegistry>({});
  const targetPreviewsRef = useRef<RobotTargetPreviewRegistry>({});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!blueprint3d) return;

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
              minDurationMs: 120,
              maxDurationMs: 1200,
              minMovement: 0.001,
              snapFirstUpdate: true,
            },
          });

          if (scheduledMove) {
            showRobotTargetPreview({
              blueprint3d,
              uid,
              item,
              targetX: newX,
              targetZ: newY,
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
  }, [blueprint3d, simulatingUidRef, isRealMode]);
}
