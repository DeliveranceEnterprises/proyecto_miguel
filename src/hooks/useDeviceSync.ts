/**
 * useDeviceSync — sincronización bidireccional entre mock_status (API) y la escena 3D.
 *
 * Cada 500 ms:
 * 1. Status → Escena: lee todos los estados de la API y mueve los items 3D
 * a sus coordenadas (salvo que ese dispositivo esté siendo simulado o editado por el usuario).
 * 2. Escena → Status: detecta items que el usuario ha movido y sube
 * sus nuevas coordenadas a la API.
 */

import { useEffect, useRef } from 'react';
import { DevicesService } from '../client';

const POLL_INTERVAL = 500;
const MOVE_THRESHOLD = 2;

interface SyncOptions {
  blueprint3d: any;
  currentUID: string;
  simulatingUidRef: React.MutableRefObject<string | null>;
  selectedItemUid?: string | null; // <-- Recibimos el ID del objeto que estás tocando
}

export function useDeviceSync({ blueprint3d, currentUID, simulatingUidRef, selectedItemUid = null }: SyncOptions): void {
  // Snapshot de posiciones del tick anterior { [device_uid]: {x, z} }
  const prevPositionsRef = useRef<Record<string, { x: number; z: number }>>({});
  // Evita ticks concurrentes
  const tickRunningRef = useRef(false);

  useEffect(() => {
    if (!blueprint3d) return;

    const tick = async () => {
      // Ya NO detenemos todo el tick, dejamos que la función corra.
      
      if (tickRunningRef.current) return;
      tickRunningRef.current = true;

      try {
        const scene = blueprint3d.model?.scene as any;
        if (!scene?.getItems) return;

        const items: any[] = scene.getItems() ?? [];

        // Solo items que tengan device_uid en metadata
        const deviceItems = items.filter(it => {
          const meta = it?.metadata;
          return meta?.device_uid || meta?.deviceId;
        });

        if (deviceItems.length === 0) return;

        // Mapa uid (minúsculas) → item
        const itemByUid: Record<string, any> = {};
        for (const it of deviceItems) {
          const meta = it.metadata;
          const uid = String(meta?.device_uid ?? meta?.deviceId ?? '').toLowerCase();
          if (uid) itemByUid[uid] = it;
        }

        // ── 1. Status → Escena ────────────────────────────────────────────────
        try {
          const statusRes = await DevicesService.readDevicesStatus({ limit: 500 });
          const statuses = statusRes?.data ?? [];
          let needsRender = false;

          for (const status of statuses) {
            const uid = String(status.uid ?? '').toLowerCase();
            if (!uid) continue;

            // No mover el dispositivo que está siendo animado por TaskList
            if (
              simulatingUidRef.current &&
              simulatingUidRef.current.toLowerCase() === uid
            ) continue;

            // <-- EL FRENO SELECTIVO -->
            // Si el objeto actual de la API es el mismo que tienes seleccionado en la interfaz,
            // ignoramos sus coordenadas de la base de datos para no machacar tu edición local.
            if (selectedItemUid && selectedItemUid === uid) continue;

            const item = itemByUid[uid];
            if (!item?.position) continue;

            const ax = status.coordinates_x ?? 0;
            const az = status.coordinates_y ?? 0; // API .y === escena .z

            // Ignorar si la API aún no tiene posición real
            if (ax === 0 && az === 0) continue;

            const dx = Math.abs(item.position.x - ax);
            const dz = Math.abs(item.position.z - az);

            if (dx > MOVE_THRESHOLD || dz > MOVE_THRESHOLD) {
              // Usar .set() para que Three.js detecte el cambio correctamente
              item.position.set(ax, item.position.y, az);

              // Marcar la escena como sucia para que re-renderice
              if (item.scene) item.scene.needsUpdate = true;

              needsRender = true;
            }
          }

          if (needsRender) {
            blueprint3d?.three?.needsUpdate?.();
            blueprint3d?.three?.renderer?.render?.(
              blueprint3d.three.scene,
              blueprint3d.three.camera,
            );
          }
        } catch {
          // Error de red — saltamos este tick sin romper el ciclo
        }

        // ── 2. Escena → Status ────────────────────────────────────────────────
        const prev = prevPositionsRef.current;
        const movedItems: Array<{ uid: string; x: number; z: number }> = [];

        for (const [uid, item] of Object.entries(itemByUid)) {
          if (!item?.position) continue;
          const x = item.position.x as number;
          const z = item.position.z as number;

          const last = prev[uid];
          if (last) {
            const dx = Math.abs(x - last.x);
            const dz = Math.abs(z - last.z);
            if (dx > MOVE_THRESHOLD || dz > MOVE_THRESHOLD) {
              movedItems.push({ uid, x, z });
            }
          }
          // Actualizar snapshot siempre
          prev[uid] = { x, z };
        }

        // Subir posiciones movidas a la API (fire-and-forget)
        for (const { uid, x, z } of movedItems) {
          DevicesService.updateDeviceStatus({
            uid,
            requestBody: {
              coordinates_x: x,
              coordinates_y: z,      // escena z ↔ API y (coordenada 2D de planta)
              last_connection: new Date().toISOString(),
            } as any,
          }).catch(() => { /* ignorar fallos individuales */ });
        }
      } finally {
        tickRunningRef.current = false;
      }
    };

    const intervalId = setInterval(tick, POLL_INTERVAL);

    // Limpiar al desmontar o cambiar dependencias
    return () => clearInterval(intervalId);
  }, [blueprint3d, currentUID, selectedItemUid]); // <-- Actualizamos las dependencias
}