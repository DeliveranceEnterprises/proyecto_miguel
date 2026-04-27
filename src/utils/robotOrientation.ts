const DEFAULT_MIN_MOVEMENT = 0.5;

function readNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Optional calibration hook for GLB models whose visual front is not +Z.
 * Store any of these metadata values in radians to rotate the computed heading.
 */
export function getItemHeadingOffsetRad(item: any): number {
  const metadata = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};
  return readNumber(
    metadata.movement_heading_offset_rad ??
    metadata.heading_offset_rad ??
    metadata.rotation_offset_rad ??
    metadata.real_rotation_offset_rad ??
    item?.movement_heading_offset_rad ??
    item?.heading_offset_rad ??
    item?.rotation_offset_rad,
    0
  );
}

export function getHeadingFromDelta(
  dx: number,
  dz: number,
  item?: any,
  minMovement = DEFAULT_MIN_MOVEMENT
): number | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return null;

  const min = Math.max(0, Number(minMovement) || 0);
  if ((dx * dx + dz * dz) <= min * min) return null;

  return Math.atan2(dx, dz) + getItemHeadingOffsetRad(item);
}

/**
 * Rotates a Blueprint3D/Three.js item so its local +Z front points along the
 * movement vector in the X/Z floor plane. Returns true if a rotation was applied.
 */
export function rotateItemTowardsMovement(
  item: any,
  dx: number,
  dz: number,
  minMovement = DEFAULT_MIN_MOVEMENT
): boolean {
  if (!item?.rotation) return false;

  const heading = getHeadingFromDelta(dx, dz, item, minMovement);
  if (heading == null) return false;

  item.rotation.y = heading;
  return true;
}
