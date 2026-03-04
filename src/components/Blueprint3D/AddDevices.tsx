import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiWifi, FiWifiOff, FiRefreshCw, FiLock, FiChevronDown } from 'react-icons/fi';
import { useBlueprint3D } from './Blueprint3DApp';
import { DevicesService, OrganizationsService } from '../../client';
import type { DevicePublic } from '../../client';
import { useOrganizationContext } from '../../hooks/useOrganizationContext';

// ─────────────────────────────────────────────────────────────────────────────
// GLB model map — SOURCE OF TRUTH for which devices have a 3D model
// ─────────────────────────────────────────────────────────────────────────────
const DEVICE_MODEL_MAP: Record<string, { model: string; thumbnail: string; type: number; label: string }> = {
  viggo_sc50: {
    model: '/assets/glb/devices/viggo_sc50.glb',
    thumbnail: '/assets/images/devices/viggo_sc50.png',
    type: 1,
    label: 'Viggo SC50',
  },
  allybot: {
    model: '/assets/glb/devices/allybot.glb',
    thumbnail: '/assets/images/devices/allybot.png',
    type: 1,
    label: 'Allybot',
  },
  pandabot: {
    model: '/assets/glb/devices/pandabot.glb',
    thumbnail: '/assets/images/devices/pandabot.png',
    type: 1,
    label: 'Pandabot',
  },
  pudu_bellabot: {
    model: '/assets/glb/devices/pudu_bellabot.glb',
    thumbnail: '/assets/images/devices/pudu_bellabot.png',
    type: 1,
    label: 'Pudu Bellabot',
  },
  pudu_ketty: {
    model: '/assets/glb/devices/pudu_ketty.glb',
    thumbnail: '/assets/images/devices/pudu_ketty.png',
    type: 1,
    label: 'Pudu Ketty',
  },
  eniscope: {
    model: '/assets/glb/devices/eniscope.glb',
    thumbnail: '/assets/images/devices/eniscope.png',
    type: 1,
    label: 'Eniscope',
  },
};

const NOT_FOUND_THUMBNAIL = '/assets/images/devices/image_not_found.png';

const normalise = (s?: string | null) =>
  (s ?? '').toLowerCase().trim().replace(/[\s\-.]+/g, '_');

function findMapKey(device: DevicePublic): string | undefined {
  const imgKey = device.image
    ? normalise(device.image.replace(/\.(png|jpg|jpeg|webp)$/i, ''))
    : null;
  const modelKey = normalise(device.model);
  for (const k of Object.keys(DEVICE_MODEL_MAP)) {
    if (imgKey && (imgKey === k || imgKey.includes(k) || k.includes(imgKey))) return k;
    if (modelKey && modelKey === k) return k;
  }
  return undefined;
}

function getOccupiedUidsFromCurrentScene(blueprint3d: any): Set<string> {
  const occupied = new Set<string>();
  try {
    const raw = blueprint3d?.model?.exportSerialized?.();
    if (!raw) return occupied;
    const parsed = JSON.parse(raw);
    const items: any[] = parsed?.items ?? [];
    for (const item of items) {
      const meta = item?.metadata ?? item;
      const uid = String(meta?.device_uid ?? meta?.deviceId ?? '').trim();
      if (uid) occupied.add(uid);
    }
  } catch (e) {
    console.warn('[AddDevices] Could not parse current scene:', e);
  }
  return occupied;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ModelGroup {
  mapKey: string;           // e.g. 'allybot'
  asset: typeof DEVICE_MODEL_MAP[string];
  units: DevicePublic[];     // all API devices matching this model
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const AddDevices: React.FC = () => {
  const { blueprint3d, onStateChange } = useBlueprint3D();
  const { getActiveOrganizationId } = useOrganizationContext();

  const [groups, setGroups] = useState<ModelGroup[]>([]);
  const [ungrouped, setUngrouped] = useState<DevicePublic[]>([]);   // devices with no GLB
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [occupiedUids, setOccupiedUids] = useState<Set<string>>(new Set());

  // Which model card is expanded in the bottom panel
  const [selectedMapKey, setSelectedMapKey] = useState<string | null>(null);

  // ── Load all devices + compute occupied UIDs ───────────────────────────────
  const loadAll = async () => {
    const orgId = getActiveOrganizationId();
    setLoading(true);
    setError(null);

    let devices: DevicePublic[] = [];
    try {
      if (orgId) {
        const res = await DevicesService.getDevicesOwn({ ownerId: orgId });
        devices = res.data;
      }
    } catch (err) {
      console.error('[AddDevices] Failed to load devices:', err);
      setError('Could not load devices from server.');
    }

    // Group by mapKey
    const buckets: Record<string, DevicePublic[]> = {};
    const noModel: DevicePublic[] = [];
    for (const d of devices) {
      const k = findMapKey(d);
      if (k) {
        if (!buckets[k]) buckets[k] = [];
        buckets[k].push(d);
      } else {
        noModel.push(d);
      }
    }
    setGroups(
      Object.entries(buckets).map(([mapKey, units]) => ({
        mapKey,
        asset: DEVICE_MODEL_MAP[mapKey],
        units,
      }))
    );
    setUngrouped(noModel);

    // Compute occupied UIDs
    const occupied = new Set<string>();
    getOccupiedUidsFromCurrentScene(blueprint3d).forEach(uid => occupied.add(uid));
    try {
      if (orgId) {
        const scenesRes = await OrganizationsService.readOrganizationScenes({ id: orgId, limit: 500 });
        const nameToUid = new Map<string, string>(
          devices.map(d => [d.name.toLowerCase().trim(), d.uid])
        );
        for (const scene of scenesRes.data) {
          for (const item of scene.items ?? []) {
            const uid = nameToUid.get((item.item_name ?? '').toLowerCase().trim());
            if (uid) occupied.add(uid);
          }
        }
      }
    } catch (err) {
      console.warn('[AddDevices] Could not fetch scenes for occupied check:', err);
    }
    setOccupiedUids(occupied);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Add a device unit to the scene ────────────────────────────────────────
  const handleAddDevice = (device: DevicePublic) => {
    if (!blueprint3d?.model?.scene) return;
    const mapKey = findMapKey(device);
    if (!mapKey) return;
    const asset = DEVICE_MODEL_MAP[mapKey];
    const isGLB = asset.model.toLowerCase().endsWith('.glb');
    const metadata = {
      itemName: device.name,
      resizable: true,
      modelUrl: asset.model,
      itemType: asset.type,
      format: isGLB ? 'glb' : 'json',
      device_uid: device.uid,
      deviceId: device.uid,
      deviceCategory: device.category ?? '',
      deviceModel: device.model ?? '',
      deviceImage: device.image ?? '',
      deviceMapKey: mapKey,
      deviceEnabled: device.enabled ?? false,
    };
    try {
      blueprint3d.model.scene.addItem(asset.type, asset.model, metadata);
      setOccupiedUids(prev => new Set([...prev, device.uid]));

      // Initialize (or confirm) the device status entry so the sync hook can track it
      DevicesService.updateDeviceStatus({
        uid: device.uid,
        requestBody: {
          device_name: device.name,
          status: 'Idle',
          coordinates_x: 0,
          coordinates_y: 0,
          last_connection: new Date().toISOString(),
        } as any,
      }).catch(err => console.warn('[AddDevices] Could not init device status:', err));

      onStateChange('DESIGN');
    } catch (err) {
      console.error('[AddDevices] Failed to add device:', err);
    }
  };

  const selectedGroup = groups.find(g => g.mapKey === selectedMapKey) ?? null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F7F9FC' }}>

      {/* ── Sticky header ── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', gap: '8px',
        background: '#fff',
        flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <button onClick={() => onStateChange('DESIGN')} style={btnStyle('#596A6E')}
          onMouseEnter={e => hover(e, '#4A5B5F')} onMouseLeave={e => hover(e, '#596A6E')}>
          <FiArrowLeft style={{ marginRight: '6px' }} /> Return to Design
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={loadAll} disabled={loading} style={btnStyle('#2B6CB0', loading)}
          title="Reload devices">
          <FiRefreshCw style={{ marginRight: '6px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* ── Title ── */}
      <div style={{ padding: '14px 16px 10px', flexShrink: 0 }}>
        <h5 style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#1A202C' }}>Select a robot model</h5>
        <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#718096' }}>
          Tap a model to see available units. <span style={{ color: '#E53E3E', fontWeight: 600 }}>Occupied</span> units are already placed.
        </p>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>

        {/* Error */}
        {error && (
          <div style={alertStyle}>
            {error}
            <button onClick={loadAll} style={{ marginLeft: '8px', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
              Retry
            </button>
          </div>
        )}

        {/* Skeleton grid */}
        {loading && (
          <div style={gridStyle}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                borderRadius: '10px', height: '130px',
                background: 'linear-gradient(90deg,#EDF2F7 25%,#E2E8F0 50%,#EDF2F7 75%)',
                backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
              }} />
            ))}
          </div>
        )}

        {/* Model grid */}
        {!loading && groups.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#A0AEC0' }}>
            <FiWifiOff size={36} style={{ marginBottom: '10px' }} />
            <p style={{ margin: 0, fontSize: '14px' }}>No devices with 3D models found.</p>
          </div>
        )}

        {!loading && groups.length > 0 && (
          <div style={gridStyle}>
            {groups.map(group => {
              const freeCount = group.units.filter(u => !occupiedUids.has(u.uid)).length;
              const totalCount = group.units.length;
              const isSelected = selectedMapKey === group.mapKey;
              const allOccupied = freeCount === 0;

              return (
                <div
                  key={group.mapKey}
                  onClick={() => setSelectedMapKey(isSelected ? null : group.mapKey)}
                  style={{
                    borderRadius: '10px',
                    border: `2px solid ${isSelected ? '#3182CE' : allOccupied ? '#FED7D7' : '#E2E8F0'}`,
                    background: isSelected ? '#EBF8FF' : allOccupied ? '#FFF5F5' : '#fff',
                    padding: '12px 10px 10px',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    boxShadow: isSelected ? '0 0 0 3px rgba(49,130,206,0.2)' : '0 1px 4px rgba(0,0,0,0.07)',
                    transition: 'all 0.18s ease',
                    position: 'relative',
                    userSelect: 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)';
                  }}
                >
                  {/* Free/total badge */}
                  <div style={{
                    position: 'absolute', top: '7px', right: '8px',
                    fontSize: '10px', fontWeight: 700,
                    padding: '2px 6px', borderRadius: '999px',
                    background: allOccupied ? '#FEB2B2' : '#C6F6D5',
                    color: allOccupied ? '#C53030' : '#276749',
                  }}>
                    {freeCount}/{totalCount} free
                  </div>

                  {/* Thumbnail */}
                  <div style={{
                    width: '64px', height: '64px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <img
                      src={group.asset.thumbnail}
                      alt={group.asset.label}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      onError={e => { (e.currentTarget as HTMLImageElement).src = NOT_FOUND_THUMBNAIL; }}
                    />
                  </div>

                  {/* Label */}
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#2D3748', textAlign: 'center', lineHeight: 1.3 }}>
                    {group.asset.label}
                  </span>

                  {/* Chevron indicator */}
                  <FiChevronDown
                    size={14}
                    style={{
                      color: '#A0AEC0',
                      transition: 'transform 0.2s',
                      transform: isSelected ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* ── Detail panel: units of selected model ── */}
        {selectedGroup && (
          <div style={{
            marginTop: '16px',
            borderRadius: '10px',
            border: '1px solid #BEE3F8',
            background: '#fff',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(49,130,206,0.1)',
            animation: 'slideDown 0.2s ease-out',
          }}>
            {/* Panel header */}
            <div style={{
              padding: '10px 14px',
              background: 'linear-gradient(90deg, #EBF8FF, #fff)',
              borderBottom: '1px solid #BEE3F8',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <img
                src={selectedGroup.asset.thumbnail}
                alt={selectedGroup.asset.label}
                style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                onError={e => { (e.currentTarget as HTMLImageElement).src = NOT_FOUND_THUMBNAIL; }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A202C' }}>{selectedGroup.asset.label}</div>
                <div style={{ fontSize: '11px', color: '#718096' }}>
                  {selectedGroup.units.filter(u => !occupiedUids.has(u.uid)).length} units available
                </div>
              </div>
            </div>

            {/* Unit list */}
            <div style={{ padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedGroup.units.map(device => {
                const isOccupied = occupiedUids.has(device.uid);
                return (
                  <div key={device.uid} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${isOccupied ? '#FED7D7' : '#C6F6D5'}`,
                    background: isOccupied ? '#FFF5F5' : '#F0FFF4',
                  }}>
                    {/* Status dot */}
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                      background: isOccupied ? '#E53E3E' : '#38A169',
                      boxShadow: `0 0 0 2px ${isOccupied ? '#FEB2B2' : '#C6F6D5'}`,
                    }} />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#2D3748', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {device.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#718096', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>#{device.uid.slice(0, 8)}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          {device.enabled ? <FiWifi size={10} color="#38A169" /> : <FiWifiOff size={10} color="#A0AEC0" />}
                          {device.enabled ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    {isOccupied ? (
                      <div style={{
                        fontSize: '11px', fontWeight: 700, color: '#C53030',
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: '#FED7D7', padding: '4px 8px', borderRadius: '6px',
                        flexShrink: 0,
                      }}>
                        <FiLock size={11} /> Occupied
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddDevice(device)}
                        style={{ ...btnStyle('#3182CE'), flexShrink: 0, fontSize: '12px', padding: '5px 12px' }}
                        onMouseEnter={e => hover(e, '#2B6CB0')}
                        onMouseLeave={e => hover(e, '#3182CE')}
                      >
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Devices without 3D model (collapsed, subtle) ── */}
        {!loading && ungrouped.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <p style={{ fontSize: '11px', color: '#A0AEC0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              No 3D model available ({ungrouped.length})
            </p>
            {ungrouped.map(device => (
              <div key={device.uid} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '8px',
                border: '1px solid #E2E8F0', background: '#FAFAFA',
                marginBottom: '6px', opacity: 0.7,
              }}>
                <img
                  src={NOT_FOUND_THUMBNAIL}
                  alt={device.name}
                  style={{ width: '32px', height: '32px', objectFit: 'contain', opacity: 0.5 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#4A5568' }}>{device.name}</div>
                  <div style={{ fontSize: '10px', color: '#A0AEC0' }}>{device.model}</div>
                </div>
                <div style={{ fontSize: '10px', color: '#A0AEC0', background: '#EDF2F7', padding: '3px 7px', borderRadius: '5px' }}>
                  No model
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '10px',
  marginTop: '4px',
};

function btnStyle(bg: string, disabled = false): React.CSSProperties {
  return {
    backgroundColor: bg, color: 'white', border: 'none',
    borderRadius: '6px', padding: '7px 14px',
    fontSize: '13px', fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center',
    transition: 'background-color 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    opacity: disabled ? 0.6 : 1,
  };
}

function hover(e: React.MouseEvent<HTMLButtonElement>, bg: string) {
  (e.currentTarget as HTMLButtonElement).style.backgroundColor = bg;
}

const alertStyle: React.CSSProperties = {
  backgroundColor: '#FFF5F5', border: '1px solid #FC8181',
  borderRadius: '6px', padding: '10px 14px',
  color: '#C53030', fontSize: '13px', marginTop: '12px',
};

export default AddDevices;