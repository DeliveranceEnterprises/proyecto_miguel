import { DevicesService } from '../client';
import { OpenAPI } from '../client/core/OpenAPI';

const LIVE_STATUS_MODELS = new Set(['Real-robot', 'Deliverance-robot']);
const LIVE_STATUS_SOURCES = new Set(['deliverance']);

export function isLiveStatusModel(model?: string | null): boolean {
  return LIVE_STATUS_MODELS.has(String(model ?? '').trim());
}

export function isLiveStatusDevice(device?: any): boolean {
  if (!device) return false;

  const integrationSource = String(device.integration_source ?? '').trim().toLowerCase();
  const remoteUid = String(device.remote_uid ?? '').trim();

  return Boolean(
    device.live_status_enabled === true ||
    LIVE_STATUS_SOURCES.has(integrationSource) ||
    remoteUid ||
    isLiveStatusModel(device.model)
  );
}

export async function fetchDeviceStatus(params: {
  uid: string;
  isRealMode: boolean;
}): Promise<any> {
  const { uid, isRealMode } = params;

  if (!isRealMode) {
    const localRes = await DevicesService.getDeviceStatus({ uid });
    return (localRes as any)?.data ?? localRes;
  }

  const token = localStorage.getItem('access_token') || '';
  const base = OpenAPI.BASE || '';
  const url = `${base}/api/v1/devices/${encodeURIComponent(uid)}/status/live`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Live status request failed with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('[deviceStatus] Falling back to local status endpoint:', error);
    const localRes = await DevicesService.getDeviceStatus({ uid });
    return (localRes as any)?.data ?? localRes;
  }
}
