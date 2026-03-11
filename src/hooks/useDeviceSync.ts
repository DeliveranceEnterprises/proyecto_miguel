import { useEffect, useRef } from 'react';
import { DevicesService } from '../client';


const POLL_INTERVAL = 500;

export function useDeviceSync(
  blueprint3d: any,
  simulatingUidRef: React.MutableRefObject<string | null>
) {
  const lastKnownRef = useRef<Record<string, { x: number; y: number; status: string }>>({});

  useEffect(() => {
    if (!blueprint3d) return;

    const poll = async () => {
      const scene = blueprint3d?.model?.scene;
      if (!scene) return;

      const items: any[] = scene.getItems?.() ?? [];
      const deviceItems = items.filter(item => item.device_uid);
      if (deviceItems.length === 0) return;

      await Promise.allSettled(
        deviceItems.map(async (item) => {
          const uid: string = item.device_uid;

          // No mover el robot que está siendo simulado
          if (simulatingUidRef.current === uid) return;

          let statusData: any;
          try {
            const res = await DevicesService.getDeviceStatus({ uid });
            statusData = res.data ?? res;
          } catch {
            return;
          }

          const newX: number = statusData?.coordinates_x ?? 0;
          const newY: number = statusData?.coordinates_y ?? 0;
          const newStatus: string = statusData?.status ?? '';

          const last = lastKnownRef.current[uid];
          if (last && last.x === newX && last.y === newY && last.status === newStatus) return;

          lastKnownRef.current[uid] = { x: newX, y: newY, status: newStatus };

          item.position.set(newX, item.position.y, newY);
          scene.needsUpdate = true;
        })
      );
    };

    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);

  }, [blueprint3d, simulatingUidRef]);
}