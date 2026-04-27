import { useEffect, useRef, type MutableRefObject } from 'react';
import { fetchDeviceStatus } from '../utils/deviceStatus';
import { rotateItemTowardsMovement } from '../utils/robotOrientation';

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
  isRealMode: boolean,
  paused = false
) {
  const lastKnownRef = useRef<Record<string, { x: number; y: number; status: string }>>({});

  useEffect(() => {
    if (!blueprint3d || paused) return;

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

          const last = lastKnownRef.current[uid];
          if (last && last.x === newX && last.y === newY && last.status === newStatus) return;

          const previousX = Number(item.position?.x);
          const previousZ = Number(item.position?.z);
          const hasPreviousScenePosition = Number.isFinite(previousX) && Number.isFinite(previousZ);
          const dx = hasPreviousScenePosition ? newX - previousX : last ? newX - last.x : 0;
          const dz = hasPreviousScenePosition ? newY - previousZ : last ? newY - last.y : 0;

          rotateItemTowardsMovement(item, dx, dz);

          lastKnownRef.current[uid] = { x: newX, y: newY, status: newStatus };

          item.position.set(newX, item.position.y, newY);
          scene.needsUpdate = true;
        })
      );
    };

    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [blueprint3d, simulatingUidRef, isRealMode, paused]);
}
