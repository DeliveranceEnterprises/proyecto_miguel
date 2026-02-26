import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiWifi, FiWifiOff, FiRefreshCw, FiX, FiInfo } from 'react-icons/fi';
import { useBlueprint3D } from './Blueprint3DApp';
import { DevicesService } from '../../client';
import type { DevicePublic } from '../../client';
import { useOrganizationContext } from '../../hooks/useOrganizationContext';

// ─────────────────────────────────────────────────────────────────────────────
// GLB model map — SOURCE OF TRUTH for which devices have a 3D model.
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
};

const NOT_FOUND_THUMBNAIL = '/public/assets/images/devices/image_not_found.png';

// Normalise a string to match DEVICE_MODEL_MAP keys
const normalise = (s: string) => s.toLowerCase().trim().replace(/[\s\-.]+/g, '_');

// For a given DEVICE_MODEL_MAP key, find the matching device from the API
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

  const [view, setView] = useState<'catalog' | 'all'>('catalog');
  const [displayDevices, setDisplayDevices] = useState<DisplayDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DisplayDevice | null>(null);

  const [allApiDevices, setAllApiDevices] = useState<DevicePublic[]>([]);
  const [allDevicesLoading, setAllDevicesLoading] = useState(false);
  const [allDevicesError, setAllDevicesError] = useState<string | null>(null);

  const loadDevices = async () => {
    const orgId = getActiveOrganizationId();
    setIsLoading(true);
    setError(null);

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

  const loadAllApiDevices = async () => {
    const orgId = getActiveOrganizationId();
    setAllDevicesLoading(true);
    setAllDevicesError(null);
    try {
      if (orgId) {
        const response = await DevicesService.getDevicesOwn({ ownerId: orgId });
        setAllApiDevices(response.data);
      } else {
        setAllApiDevices([]);
        setAllDevicesError('No active organization selected.');
      }
    } catch (err) {
      console.error('Failed to load all devices:', err);
      setAllDevicesError('Could not load devices from server.');
    } finally {
      setAllDevicesLoading(false);
    }
  };

  const handleOpenAllDevices = () => {
    setView('all');
    loadAllApiDevices();
  };

  const handleAddApiDevice = (device: DevicePublic) => {
    if (!blueprint3d?.model?.scene) return;
    const imgKey = device.image
      ? normalise(device.image.replace(/\.(png|jpg|jpeg|webp)$/i, ''))
      : normalise(device.model);
    const mapKey = Object.keys(DEVICE_MODEL_MAP).find(
      k => k === imgKey || imgKey.includes(k) || k.includes(imgKey)
    );
    if (!mapKey) return;
    const asset = DEVICE_MODEL_MAP[mapKey];
    const isGLB = asset.model.toLowerCase().endsWith('.glb');
    const metadata = {
      itemName: device.name,
      resizable: true,
      modelUrl: asset.model,
      itemType: asset.type,
      format: isGLB ? 'glb' : 'json',
      deviceId: device.uid,
      deviceCategory: device.category ?? '',
      deviceModel: device.model,
      deviceImage: device.image ?? '',
      deviceEnabled: device.enabled ?? false,
    };
    try {
      blueprint3d.model.scene.addItem(asset.type, asset.model, metadata);
      onStateChange('DESIGN');
    } catch (err) {
      console.error('[AddDevices] Failed to add device:', err);
    }
  };

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
          onClick={() => view === 'all' ? setView('catalog') : onStateChange('DESIGN')}
          style={buttonStyle('#596A6E')}
          onMouseEnter={e => applyHover(e, '#4A5B5F')}
          onMouseLeave={e => applyHover(e, '#596A6E')}
        >
          <FiArrowLeft style={{ marginRight: '6px' }} />
          {view === 'all' ? 'Back to Catalog' : 'Return to Design'}
        </button>

        {view === 'catalog' && (
          <button
            onClick={handleOpenAllDevices}
            style={buttonStyle('#2D3748')}
            onMouseEnter={e => applyHover(e, '#1A202C')}
            onMouseLeave={e => applyHover(e, '#2D3748')}
          >
            <FiWifi style={{ marginRight: '6px' }} />
            All Devices
          </button>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={view === 'all' ? loadAllApiDevices : loadDevices}
          disabled={view === 'all' ? allDevicesLoading : isLoading}
          style={buttonStyle('#2B6CB0', view === 'all' ? allDevicesLoading : isLoading)}
          title="Reload devices from server"
        >
          <FiRefreshCw style={{ marginRight: '6px', animation: (view === 'all' ? allDevicesLoading : isLoading) ? 'spin 1s linear infinite' : 'none' }} />
          {(view === 'all' ? allDevicesLoading : isLoading) ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* ── Title ── */}
      <div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
        <h5 style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#2D3748' }}>
          {view === 'all' ? 'All Organisation Devices' : 'Add Device to Scene'}
        </h5>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#718096' }}>
          {view === 'all'
            ? 'All devices registered in your organisation. Devices with a 3D model can be added to the scene.'
            : 'Click a device to place its 3D model in the floor plan.'}
        </p>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>

        {/* ══════════════════════════════════ ALL DEVICES VIEW ══════════════════════ */}
        {view === 'all' && (
          <>
            {allDevicesError && (
              <div style={alertStyle}>
                {allDevicesError}
                <button onClick={loadAllApiDevices} style={{ marginLeft: '8px', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>Retry</button>
              </div>
            )}

            {allDevicesLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{
                    height: '56px', borderRadius: '8px',
                    background: 'linear-gradient(90deg, #EDF2F7 25%, #E2E8F0 50%, #EDF2F7 75%)',
                    backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
                  }} />
                ))}
              </div>
            )}

            {!allDevicesLoading && allApiDevices.length === 0 && !allDevicesError && (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#A0AEC0' }}>
                <FiWifiOff size={32} style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '14px' }}>No devices found in this organisation.</p>
              </div>
            )}

            {!allDevicesLoading && allApiDevices.map(device => {
              const imgKey = device.image
                ? normalise(device.image.replace(/\.(png|jpg|jpeg|webp)$/i, ''))
                : normalise(device.model);
              const mapKey = Object.keys(DEVICE_MODEL_MAP).find(
                k => k === imgKey || imgKey.includes(k) || k.includes(imgKey)
              );
              const hasGlb = !!mapKey;
              const asset = mapKey ? DEVICE_MODEL_MAP[mapKey] : null;
              const catColor = CATEGORY_COLORS[(device.category ?? '').toLowerCase()] ?? '#718096';
              const thumbnail = asset ? asset.thumbnail : NOT_FOUND_THUMBNAIL;

              return (
                <div key={device.uid} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px',
                  marginTop: '8px',
                  borderRadius: '8px',
                  border: `1px solid ${hasGlb ? '#BEE3F8' : '#E2E8F0'}`,
                  background: hasGlb ? '#EBF8FF' : '#FAFAFA',
                  transition: 'box-shadow 0.15s ease',
                }}>
                  <div style={{ width: '48px', height: '48px', flexShrink: 0, backgroundColor: '#F7FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                    <img src={thumbnail} alt={device.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      onError={e => { (e.currentTarget as HTMLImageElement).src = NOT_FOUND_THUMBNAIL; }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#2D3748', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {device.name}
                      </span>
                      {device.category && (
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: catColor, color: '#fff', fontWeight: 600, textTransform: 'capitalize', flexShrink: 0 }}>
                          {device.category}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: device.enabled ? '#38A169' : '#A0AEC0', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                        {device.enabled ? <FiWifi size={11} /> : <FiWifiOff size={11} />}
                        {device.enabled ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#718096' }}>{device.model}</span>
                  </div>

                  {hasGlb ? (
                    <button
                      onClick={() => handleAddApiDevice(device)}
                      style={{ ...buttonStyle('#3182CE'), flexShrink: 0, fontSize: '12px', padding: '5px 10px' }}
                      onMouseEnter={e => applyHover(e, '#2B6CB0')}
                      onMouseLeave={e => applyHover(e, '#3182CE')}
                      title="Add 3D model to scene"
                    >
                      Add to Scene
                    </button>
                  ) : (
                    <button
                      disabled
                      style={{ ...buttonStyle('#A0AEC0', true), flexShrink: 0, fontSize: '12px', padding: '5px 10px' }}
                      title="No 3D model available for this device"
                    >
                      No 3D model
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ══════════════════════════════════ CATALOG VIEW ══════════════════════════ */}
        {view === 'catalog' && (
          <>
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

            {!isLoading && (
              <div className="row" id="devices-wrapper" style={{ marginTop: '12px' }}>
                {displayDevices.map(entry => {
                  const { mapKey, asset, apiDevice } = entry;
                  const name = apiDevice?.name ?? mapKey;
                  const category = apiDevice?.category ?? '';
                  const model = apiDevice?.model ?? '';
                  const enabled = apiDevice?.enabled ?? false;
                  const mileage = (apiDevice as any)?.mileage;
                  const catColor = CATEGORY_COLORS[category.toLowerCase()] ?? '#718096';
                  const hasApiInfo = apiDevice !== null;
                  const thumbnail = hasApiInfo ? asset.thumbnail : NOT_FOUND_THUMBNAIL;

                  return (
                    <div key={mapKey} className="col-sm-4" style={{ marginBottom: '12px' }}>
                      <a
                        className="thumbnail add-item"
                        onClick={() => setSelectedDevice(entry)}
                        title={`View details for ${name}`}
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
                        <div style={{
                          position: 'absolute', top: '6px', right: '6px',
                          color: hasApiInfo && enabled ? '#38A169' : '#A0AEC0',
                          fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px',
                        }}>
                          {hasApiInfo && enabled ? <FiWifi size={12} /> : <FiWifiOff size={12} />}
                        </div>

                        <img
                          src={thumbnail}
                          alt={name}
                          style={{ width: '64px', height: '64px', objectFit: 'contain' }}
                          onError={e => { (e.currentTarget as HTMLImageElement).src = NOT_FOUND_THUMBNAIL; }}
                        />

                        <span style={{ fontSize: '12px', fontWeight: 600, textAlign: 'center', color: '#2D3748', lineHeight: 1.3 }}>
                          {name}
                        </span>

                        {hasApiInfo && category && (
                          <span style={{
                            fontSize: '10px', padding: '1px 6px', borderRadius: '999px',
                            background: catColor, color: '#fff', fontWeight: 600, textTransform: 'capitalize',
                          }}>
                            {category}
                          </span>
                        )}

                        {hasApiInfo && model && (
                          <span style={{ fontSize: '10px', color: '#718096', textAlign: 'center' }}>
                            {model}
                          </span>
                        )}

                        {!hasApiInfo && (
                          <span style={{
                            fontSize: '10px', padding: '1px 6px', borderRadius: '999px',
                            background: '#A0AEC0', color: '#fff', fontWeight: 600,
                          }}>
                            Not in org
                          </span>
                        )}

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
          </>
        )}
      </div>

      {/* ── Device Details Modal ── */}
      {selectedDevice && (
        <DeviceDetailsModal
          entry={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onConfirm={() => {
            handleAddDevice(selectedDevice);
            setSelectedDevice(null);
          }}
        />
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Device Details Modal Component (MODIFIED TO MATCH FIRST CODE STYLE)
// ─────────────────────────────────────────────────────────────────────────────
function DeviceDetailsModal({ entry, onClose, onConfirm }: { entry: DisplayDevice; onClose: () => void; onConfirm: () => void }) {
  const { mapKey, asset, apiDevice } = entry;
  const name = apiDevice?.name ?? mapKey;
  //const category = apiDevice?.category ?? 'Unknown'; // Not needed for list style if we just show text
  //const model = apiDevice?.model ?? mapKey;
  const hasApiInfo = apiDevice !== null;
  const thumbnail = hasApiInfo ? asset.thumbnail : NOT_FOUND_THUMBNAIL;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(2px)',
      animation: 'fadeIn 0.2s ease-out'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '10px', // Adjusted to match first code somewhat
        width: '400px', // Slightly narrower like a panel
        maxWidth: '90%',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideUp 0.3s ease-out'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{
          padding: '14px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#fff' // White background like first code
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1A202C' }}>
            Device details
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A0AEC0', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiX size={20} />
          </button>
        </div>

        {/* Content - STYLE COPIED FROM CODE A */}
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', maxHeight: '70vh' }}>
          
          {/* Image Box (styled like Code A) */}
          <div style={{
            width: '100%',
            height: '160px',
            borderRadius: '8px',
            background: '#F7FAFC',
            border: '1px solid #EDF2F7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            <img 
              src={thumbnail} 
              alt={name} 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={e => { (e.currentTarget as HTMLImageElement).src = NOT_FOUND_THUMBNAIL; }}
            />
          </div>

          {/* Details List (styled like Code A) */}
          {!hasApiInfo ? (
             <div style={{ color: '#718096', fontSize: '13px' }}>
                This device is configured in the 3D map but no API data was found for it (or you are not logged in).
             </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', fontSize: '14px', color: '#1A202C' }}>
              <div><b>Name:</b> {apiDevice.name}</div>
              <div><b>Model:</b> {apiDevice.model}</div>
              <div><b>Category:</b> {apiDevice.category}</div>
              <div><b>Serial:</b> {(apiDevice as any).serial_number || '-'}</div>
              <div><b>MAC:</b> {(apiDevice as any).mac_address || '-'}</div>
              <div><b>Enabled:</b> {apiDevice.enabled ? 'Yes' : 'No'}</div>
              <div><b>Owner org:</b> {apiDevice.owner_id}</div>
              <div><b>Description:</b> {apiDevice.description || '-'}</div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '14px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E0', backgroundColor: '#fff', color: '#4A5568', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#3182CE', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Place device in world
          </button>
        </div>
      </div>
    </div>
  );
}

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