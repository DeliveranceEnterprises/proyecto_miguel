import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiWifi, FiWifiOff, FiRefreshCw } from 'react-icons/fi';
import { useBlueprint3D } from './Blueprint3DApp';
import { DevicesService } from '../../client';
import type { DevicePublic } from '../../client';
import { useOrganizationContext } from '../../hooks/useOrganizationContext';

// ─────────────────────────────────────────────────────────────────────────────
// GLB model map  ← SOURCE OF TRUTH for which devices to show
//
// Add/remove entries here to control what appears in the "Add Devices" panel.
// The KEY is matched against device.image (without extension, normalised) from
// the API to enrich each card with real device info.
// ─────────────────────────────────────────────────────────────────────────────
const DEVICE_MODEL_MAP: Record<string, { model: string; thumbnail: string; type: number }> = {
  viggo_sc50: {
    model: '/public/assets/glb/devices/viggo_sc50.glb',
    thumbnail: '/public/assets/images/devices/viggo_sc50.png',
    type: 1,
  },
  allybot: {
    model: '/public/assets/glb/devices/allybot.glb',
    thumbnail: '/public/assets/images/devices/allybot.png',
    type: 1,
  },
  pandabot: {
    model: '/public/assets/glb/devices/pandabot.glb',
    thumbnail: '/public/assets/images/devices/pandabot.png',
    type: 1,
  },
  pudu_ketty: {
    model: '/public/assets/glb/devices/pudu_ketty.glb',
    thumbnail: '/public/assets/images/devices/pudu_ketty.png',
    type: 1,
  },
  pudu_bellabot: {
    model: '/public/assets/glb/devices/pudu_bellabot.glb',
    thumbnail: '/public/assets/images/devices/pudu_bellabot.png',
    type: 1,
  },
  eniscope: {
    model: '/public/assets/glb/devices/eniscope.glb',
    thumbnail: '/public/assets/images/devices/eniscope.png',
    type: 1,
  }

};

const NOT_FOUND_THUMBNAIL = '/public/assets/images/devices/image_not_found.png';

// Normalise a string to match DEVICE_MODEL_MAP keys
const normalise = (s: string) => s.toLowerCase().trim().replace(/[\s\-.]+/g, '_');

// For a given DEVICE_MODEL_MAP key, find the matching device from the API
// Matches: device.image (without extension) → mapKey
function findApiDevice(mapKey: string, apiDevices: DevicePublic[]): DevicePublic | null {
  for (const device of apiDevices) {
    if (device.image) {
      const imgKey = normalise(device.image.replace(/\.(png|jpg|jpeg|webp)$/i, ''));
      if (imgKey === mapKey || imgKey.includes(mapKey) || mapKey.includes(imgKey)) return device;
    }
    if (normalise(device.model) === mapKey) return device;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge colours per category
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  robot: '#3182CE',
  iot: '#38A169',
  meter: '#DD6B20',
  sensor: '#805AD5',
};

// A display entry: enriched from API if found, otherwise only map key info
interface DisplayDevice {
  mapKey: string;
  asset: { model: string; thumbnail: string; type: number };
  apiDevice: DevicePublic | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const AddDevices: React.FC = () => {
  const { blueprint3d, onStateChange } = useBlueprint3D();
  const { getActiveOrganizationId } = useOrganizationContext();

  const [displayDevices, setDisplayDevices] = useState<DisplayDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = async () => {
    const orgId = getActiveOrganizationId();
    setIsLoading(true);
    setError(null);

    // Fetch all API devices (fail gracefully – still show the map entries)
    let apiDevices: DevicePublic[] = [];
    try {
      if (orgId) {
        const response = await DevicesService.getDevicesOwn({ ownerId: orgId });
        apiDevices = response.data;
      }
    } catch (err) {
      console.error('Failed to load devices from API:', err);
      setError('Could not load device info from server. Showing configured models only.');
    }

    // Build display list from DEVICE_MODEL_MAP (one card per map entry)
    const entries: DisplayDevice[] = Object.entries(DEVICE_MODEL_MAP).map(([mapKey, asset]) => ({
      mapKey,
      asset,
      apiDevice: findApiDevice(mapKey, apiDevices),
    }));

    setDisplayDevices(entries);
    setIsLoading(false);
  };

  useEffect(() => {
    loadDevices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddDevice = (entry: DisplayDevice) => {
    if (!blueprint3d?.model?.scene) return;

    const { asset, apiDevice, mapKey } = entry;
    const isGLB = asset.model.toLowerCase().endsWith('.glb');

    const metadata = {
      itemName: apiDevice?.name ?? mapKey,
      resizable: true,
      modelUrl: asset.model,
      itemType: asset.type,
      format: isGLB ? 'glb' : 'json',
      deviceId: apiDevice?.uid ?? mapKey,
      deviceCategory: apiDevice?.category ?? '',
      deviceModel: apiDevice?.model ?? mapKey,
      deviceImage: apiDevice?.image ?? mapKey,
      deviceEnabled: apiDevice?.enabled ?? false,
    };

    try {
      blueprint3d.model.scene.addItem(asset.type, asset.model, metadata);
      onStateChange('DESIGN');
      console.log(`[AddDevices] Added "${metadata.itemName}" → ${asset.model}`);
    } catch (err) {
      console.error('[AddDevices] Failed to add device to scene:', err);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
      }}>
        <button
          onClick={() => onStateChange('DESIGN')}
          style={buttonStyle('#596A6E')}
          onMouseEnter={e => applyHover(e, '#4A5B5F')}
          onMouseLeave={e => applyHover(e, '#596A6E')}
        >
          <FiArrowLeft style={{ marginRight: '6px' }} />
          Return to Design
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={loadDevices}
          disabled={isLoading}
          style={buttonStyle('#2B6CB0', isLoading)}
          title="Reload devices from server"
        >
          <FiRefreshCw style={{ marginRight: '6px', animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* ── Title ── */}
      <div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
        <h5 style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#2D3748' }}>
          Add Device to Scene
        </h5>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#718096' }}>
          Click a device to place its 3D model in the floor plan.
        </p>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>

        {/* Error (non-blocking — map entries still render) */}
        {error && (
          <div style={alertStyle}>
            {error}
            <button
              onClick={loadDevices}
              style={{ marginLeft: '8px', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: '80px',
                borderRadius: '8px',
                background: 'linear-gradient(90deg, #EDF2F7 25%, #E2E8F0 50%, #EDF2F7 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s infinite',
              }} />
            ))}
          </div>
        )}

        {/* Devices Grid — one card per DEVICE_MODEL_MAP entry */}
        {!isLoading && (
          <div className="row" id="devices-wrapper" style={{ marginTop: '12px' }}>
            {displayDevices.map(entry => {
              const { mapKey, asset, apiDevice } = entry;
              // Use real info from API if matched, else fall back to key name
              const name = apiDevice?.name ?? mapKey;
              const category = apiDevice?.category ?? '';
              const model = apiDevice?.model ?? '';
              const enabled = apiDevice?.enabled ?? false;
              const mileage = (apiDevice as any)?.mileage;
              const catColor = CATEGORY_COLORS[category.toLowerCase()] ?? '#718096';
              const hasApiInfo = apiDevice !== null;

              // Only show device thumbnail when it exists in the org; otherwise image_not_found
              const thumbnail = hasApiInfo ? asset.thumbnail : NOT_FOUND_THUMBNAIL;

              return (
                <div key={mapKey} className="col-sm-4" style={{ marginBottom: '12px' }}>
                  <a
                    className="thumbnail add-item"
                    onClick={() => handleAddDevice(entry)}
                    title={`Add ${name} to scene`}
                    style={{
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '8px',
                      border: `1px solid ${hasApiInfo && enabled ? '#C6F6D5' : '#E2E8F0'}`,
                      background: hasApiInfo && enabled ? '#F0FFF4' : '#FAFAFA',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = '';
                      (e.currentTarget as HTMLElement).style.transform = '';
                    }}
                  >
                    {/* Online/offline indicator */}
                    <div style={{
                      position: 'absolute', top: '6px', right: '6px',
                      color: hasApiInfo && enabled ? '#38A169' : '#A0AEC0',
                      fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px',
                    }}>
                      {hasApiInfo && enabled ? <FiWifi size={12} /> : <FiWifiOff size={12} />}
                    </div>

                    {/* Thumbnail */}
                    <img
                      src={thumbnail}
                      alt={name}
                      style={{ width: '64px', height: '64px', objectFit: 'contain' }}
                      onError={e => { (e.currentTarget as HTMLImageElement).src = NOT_FOUND_THUMBNAIL; }}
                    />

                    {/* Name */}
                    <span style={{ fontSize: '12px', fontWeight: 600, textAlign: 'center', color: '#2D3748', lineHeight: 1.3 }}>
                      {name}
                    </span>

                    {/* Category badge — only if matched in API */}
                    {hasApiInfo && category && (
                      <span style={{
                        fontSize: '10px', padding: '1px 6px', borderRadius: '999px',
                        background: catColor, color: '#fff', fontWeight: 600, textTransform: 'capitalize',
                      }}>
                        {category}
                      </span>
                    )}

                    {/* Model name — only if matched in API */}
                    {hasApiInfo && model && (
                      <span style={{ fontSize: '10px', color: '#718096', textAlign: 'center' }}>
                        {model}
                      </span>
                    )}

                    {/* Badge for devices not present in the organisation */}
                    {!hasApiInfo && (
                      <span style={{
                        fontSize: '10px', padding: '1px 6px', borderRadius: '999px',
                        background: '#A0AEC0', color: '#fff', fontWeight: 600,
                      }}>
                        Not in org
                      </span>
                    )}

                    {/* Mileage */}
                    {mileage !== undefined && mileage !== null && (
                      <span style={{ fontSize: '10px', color: '#A0AEC0', textAlign: 'center' }}>
                        🛞 {mileage} km
                      </span>
                    )}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────────────────────────────────────
function buttonStyle(bg: string, disabled = false): React.CSSProperties {
  return {
    backgroundColor: bg,
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '7px 14px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    opacity: disabled ? 0.6 : 1,
  };
}

function applyHover(e: React.MouseEvent<HTMLButtonElement>, bg: string) {
  (e.currentTarget as HTMLButtonElement).style.backgroundColor = bg;
}

const alertStyle: React.CSSProperties = {
  backgroundColor: '#FFF5F5',
  border: '1px solid #FC8181',
  borderRadius: '6px',
  padding: '10px 14px',
  color: '#C53030',
  fontSize: '13px',
  marginTop: '12px',
};

export default AddDevices;
