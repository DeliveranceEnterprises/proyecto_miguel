import React, { useEffect, useRef, useState } from 'react';
import {
  FiArrowLeft, FiRefreshCw, FiWifi, FiWifiOff,
  FiCheckCircle, FiAlertCircle, FiClipboard, FiChevronRight,
  FiMapPin, FiTrash2, FiPlay, FiSquare
} from 'react-icons/fi';
import { useBlueprint3D } from './Blueprint3DApp';
import { DevicesService, TasksService } from '../../client';
import type { DevicePublic, TaskCreate, Waypoint } from '../../client';
import { useOrganizationContext } from '../../hooks/useOrganizationContext';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const TASK_TYPES = ['Delivery', 'Cleaning', 'Patrolling', 'Escorting'];
const TASK_STATUSES = ['Scheduled', 'Running'];

const CATEGORY_COLORS: Record<string, string> = {
  robot: '#3182CE', iot: '#38A169', meter: '#DD6B20', sensor: '#805AD5',
};

function parseHashParams(url?: string | null): Record<string, string> {
  if (!url) return {};
  const idx = url.indexOf('#');
  if (idx < 0) return {};
  const params = new URLSearchParams(url.slice(idx + 1));
  const out: Record<string, string> = {};
  params.forEach((v, k) => { out[k] = v; });
  return out;
}

function getDeviceUidFromItem(item: any): string {
  const meta = item?.metadata;
  if (meta?.device_uid) return String(meta.device_uid);
  const hash = parseHashParams(meta?.modelUrl);
  return hash.device_uid ? String(hash.device_uid) : '';
}

/**
 * Try every known way to get the Three.js camera from a BP3D instance.
 */
function getBP3DCamera(bp3d: any): any {
  if (!bp3d?.three) return null;
  const t = bp3d.three;
  if (typeof t.getCamera === 'function') {
    const cam = t.getCamera();
    if (cam) return cam;
  }
  if (t.camera) return t.camera;
  if (t.renderer?.camera) return t.renderer.camera;
  if (t.controls?.object) return t.controls.object;
  try {
    const scene3 = typeof t.getScene === 'function' ? t.getScene() : null;
    if (scene3) {
      let found: any = null;
      scene3.traverse((obj: any) => { if (!found && obj.isCamera) found = obj; });
      if (found) return found;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Get the actual Three.js <canvas> inside #viewer.
 * Using its bounding rect avoids coordinate errors when the canvas
 * doesn't fill the full viewer div.
 */
function getViewerCanvas(): HTMLCanvasElement | null {
  const viewer = document.getElementById('viewer');
  if (!viewer) return null;
  return viewer.querySelector('canvas');
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const AddTasks: React.FC = () => {
  const { blueprint3d, onStateChange } = useBlueprint3D();
  const { getActiveOrganizationId } = useOrganizationContext();

  const [step, setStep] = useState<'select-device' | 'create-task'>('select-device');

  const [devices, setDevices] = useState<DevicePublic[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DevicePublic | null>(null);

  const [taskName, setTaskName] = useState('');
  const [taskType, setTaskType] = useState(TASK_TYPES[0]);
  const [taskStatus, setTaskStatus] = useState(TASK_STATUSES[0]);
  const [startTime, setStartTime] = useState('');

  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [waypointHint, setWaypointHint] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isSimulating, setIsSimulating] = useState(false);
  const rafRef = useRef<number | null>(null);
  const pathGroupRef = useRef<any>(null);

  // ── Load devices ──────────────────────────────────────────────────────────
  const loadDevices = async () => {
    const orgId = getActiveOrganizationId();
    setIsLoadingDevices(true);
    setDevicesError(null);
    try {
      if (orgId) {
        const response = await DevicesService.getDevicesOwn({ ownerId: orgId });
        setDevices(response.data);
      } else {
        setDevices([]);
        setDevicesError('No active organization selected.');
      }
    } catch (err) {
      console.error('[AddTasks] Failed to load devices:', err);
      setDevicesError('Could not load devices from server.');
    } finally {
      setIsLoadingDevices(false);
    }
  };

  useEffect(() => { loadDevices(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Path drawing ──────────────────────────────────────────────────────────
  const clearPathGroup = () => {
    try {
      const group = pathGroupRef.current;
      if (!group) return;
      const scene3 = (blueprint3d?.model?.scene as any)?.getScene?.();
      if (scene3) scene3.remove(group);
      (blueprint3d as any)?.three?.needsUpdate?.();
      pathGroupRef.current = null;
    } catch { /* ignore */ }
  };

  const redrawPath = (wps: Waypoint[]) => {
    const THREE = (window as any).THREE;
    if (!THREE) return;
    const scene3 = (blueprint3d?.model?.scene as any)?.getScene?.();
    if (!scene3) return;

    clearPathGroup();
    const group = new THREE.Group();

    wps.forEach((wp: Waypoint, idx: number) => {
      const geom = new THREE.SphereGeometry(8, 14, 14);
      const mat = new THREE.MeshBasicMaterial({ color: 0xDD6B20 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(wp.coordinates_x, 8, wp.coordinates_y);
      mesh.name = `wp_sphere_${idx}`;
      group.add(mesh);
    });

    if (wps.length >= 2) {
      const lineGeom = new THREE.Geometry();
      wps.forEach((wp: Waypoint) => {
        lineGeom.vertices.push(new THREE.Vector3(wp.coordinates_x, 5, wp.coordinates_y));
      });
      const lineMat = new THREE.LineBasicMaterial({ color: 0x2B6CB0, linewidth: 2 });
      const line = new THREE.Line(lineGeom, lineMat);
      line.name = 'wp_line';
      group.add(line);
    }

    scene3.add(group);
    pathGroupRef.current = group;
    (blueprint3d as any)?.three?.needsUpdate?.();
  };

  useEffect(() => {
    if (step === 'create-task') redrawPath(waypoints);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints, step]);

  // ── Waypoint picker ───────────────────────────────────────────────────────
  //
  // Uses a document-level mousedown listener in CAPTURE PHASE.
  // Capture phase fires before any element-level handler (jQuery, Three.js,
  // OrbitControls, Blueprint3D — all registered later on the canvas).
  //
  // IMPORTANT: Three.js r69 does NOT have Raycaster.setFromCamera().
  // We replicate the exact same approach as blueprint3d.js Controller:
  //   1. Element-relative pixel coords → NDC (-1…+1)
  //   2. Vector3(ndcX, ndcY, 0.5).unproject(camera)
  //   3. direction = unprojected.sub(camera.position).normalize()
  //   4. new Raycaster(camera.position, direction)
  //
  useEffect(() => {
    if (step !== 'create-task') return;

    const bp3dRef = blueprint3d;

    const onMouseDown = (e: MouseEvent) => {
      // Only Shift + primary button
      if (!e.shiftKey || e.button !== 0) return;

      // Only when click is inside the #viewer div
      const viewer = document.getElementById('viewer');
      if (!viewer || !viewer.contains(e.target as Node)) return;

      // Block Blueprint3D/jQuery from seeing this event
      e.stopImmediatePropagation();
      e.preventDefault();

      const THREE = (window as any).THREE;
      const $ = (window as any).jQuery || (window as any).$;
      if (!THREE) { console.warn('[WP] THREE not on window'); return; }

      // ── Get camera (same approach as BP3D) ──────────────────────────
      const t = (bp3dRef as any)?.three;
      const camera = typeof t?.getCamera === 'function' ? t.getCamera() : null;
      if (!camera) { console.warn('[WP] Camera not found'); return; }

      // ── Element-relative coords (like BP3D Controller.mouseMoveEvent) ──
      // BP3D uses jQuery: element.offset(), element.innerWidth/Height
      const $el = $ ? $(viewer) : null;
      let relX: number, relY: number, elW: number, elH: number;

      if ($el && typeof $el.offset === 'function') {
        const off = $el.offset();
        relX = e.clientX - off.left;
        relY = e.clientY - off.top;
        elW = $el.innerWidth();
        elH = $el.innerHeight();
      } else {
        const rect = viewer.getBoundingClientRect();
        relX = e.clientX - rect.left;
        relY = e.clientY - rect.top;
        elW = rect.width;
        elH = rect.height;
      }

      if (!elW || !elH) { console.warn('[WP] Element size is 0'); return; }

      // ── NDC (Normalized Device Coordinates) ─────────────────────────
      const ndcX = (relX / elW) * 2 - 1;
      const ndcY = -(relY / elH) * 2 + 1;

      // ── Manual unproject (Three.js r69 compatible) ──────────────────
      // Same as BP3D Controller's mouseToVec3 → getIntersections
      const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
      vector.unproject(camera);
      const direction = vector.sub(camera.position).normalize();
      const raycaster = new THREE.Raycaster(camera.position.clone(), direction);

      let point: any = null;

      // Strategy 1 — intersect actual floor planes (like BP3D checkWallsAndFloors)
      try {
        const floorPlanes: any[] = (bp3dRef as any)?.model?.floorplan?.floorPlanes?.() ?? [];
        if (floorPlanes.length > 0) {
          const hits = raycaster.intersectObjects(floorPlanes, false);
          if (hits.length > 0) point = hits[0].point;
        }
      } catch { /* ignore */ }

      // Strategy 2 — Y=0 ground plane (reliable fallback)
      if (!point) {
        try {
          const gp = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const tgt = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(gp, tgt)) point = tgt;
        } catch { /* ignore */ }
      }

      if (!point) { console.warn('[WP] No intersection found'); return; }

      console.log('[WP] Waypoint added at', point.x.toFixed(1), point.z.toFixed(1));

      setWaypoints((prev: Waypoint[]) => ([...prev, {
        timestamp: new Date().toISOString(),
        coordinates_x: point.x,
        coordinates_y: point.z,   // Three.js Z → 2D Y
        level: 0,
        label: `WP${prev.length + 1}`,
      }]));
      setWaypointHint(true);
      setTimeout(() => setWaypointHint(false), 900);
    };

    // TRUE = capture phase → runs before any element handler
    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [step, blueprint3d]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => { clearPathGroup(); stopSimulation(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Select device → form ──────────────────────────────────────────────────
  const handleSelectDevice = (device: DevicePublic) => {
    setSelectedDevice(device);
    setSubmitResult(null);
    setTaskName('');
    setTaskType(TASK_TYPES[0]);
    setTaskStatus(TASK_STATUSES[0]);
    setWaypoints([]);
    const now = new Date();
    setStartTime(new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setStep('create-task');
  };

  const removeWaypoint = (idx: number) =>
    setWaypoints(prev => prev.filter((_, i) => i !== idx));

  // ── Simulation ────────────────────────────────────────────────────────────
  const stopSimulation = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setIsSimulating(false);
  };

  const startSimulation = () => {
    const THREE = (window as any).THREE;
    if (!THREE || !blueprint3d?.model?.scene || !selectedDevice || waypoints.length === 0) return;

    const items = (blueprint3d.model.scene as any).getItems?.() ?? [];
    const deviceItem = (items as any[]).find(it => getDeviceUidFromItem(it) === selectedDevice.uid);
    if (!deviceItem) {
      setSubmitResult({ success: false, message: 'Robot not found in the 3D scene.' });
      return;
    }

    const y = Number(deviceItem.position?.y ?? 0);
    const points = waypoints.map(wp => new THREE.Vector3(wp.coordinates_x, y, wp.coordinates_y));
    let idx = 0;
    setIsSimulating(true);

    const animate = (now: number) => {
      if (idx >= points.length) {
        (blueprint3d as any)?.three?.needsUpdate?.();
        stopSimulation();
        setSubmitResult({ success: true, message: 'Simulation complete.' });
        return;
      }
      const dt = (animate as any)._last ? (now - (animate as any)._last) / 1000 : 0.016;
      (animate as any)._last = now;

      const pos = deviceItem.position;
      const target = points[idx];
      const delta = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z);
      const dist = delta.length();
      const step = 120 * dt;

      if (dist <= step) { pos.x = target.x; pos.z = target.z; idx++; }
      else {
        delta.normalize();
        pos.x += delta.x * step;
        pos.z += delta.z * step;
        deviceItem.rotation.y = Math.atan2(delta.x, delta.z);
      }
      if (deviceItem?.scene) deviceItem.scene.needsUpdate = true;
      (blueprint3d as any)?.three?.needsUpdate?.();
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
  };

  // ── Submit task ───────────────────────────────────────────────────────────
  const handleCreateTask = async () => {
    if (!selectedDevice || !taskName.trim()) return;
    setIsSubmitting(true);
    setSubmitResult(null);
    try {
      const body: TaskCreate = {
        device_uid: selectedDevice.uid,
        task_name: taskName.trim(),
        type: taskType,
        status: taskStatus,
        start_time: new Date(startTime).toISOString(),
        waypoints,
      };
      const result = await TasksService.createTask({ requestBody: body });
      setSubmitResult({ success: true, message: `Task "${result.task_name}" created (ID: ${result.uid.substring(0, 8)}…)` });
      setTaskName('');
    } catch (err: any) {
      const message = err?.body?.detail || err?.message || 'Unknown error';
      setSubmitResult({ success: false, message: String(message) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    clearPathGroup(); stopSimulation();
    setStep('select-device'); setSelectedDevice(null);
    setSubmitResult(null); setWaypoints([]);
  };

  const handleClose = () => {
    clearPathGroup(); stopSimulation();
    onStateChange('DESIGN');
    setTimeout(() => blueprint3d?.three?.updateWindowSize?.(), 150);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, background: '#FAFAFA' }}>
        <button
          onClick={() => step === 'create-task' ? handleBack() : handleClose()}
          style={btnStyle('#596A6E')}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => hoverBtn(e, '#4A5B5F')}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => hoverBtn(e, '#596A6E')}
        >
          <FiArrowLeft style={{ marginRight: '5px' }} />
          {step === 'create-task' ? 'Devices' : 'Back'}
        </button>
        <span style={{ flex: 1 }} />
        {step === 'select-device' && (
          <button onClick={loadDevices} disabled={isLoadingDevices} style={btnStyle('#2B6CB0', isLoadingDevices)} title="Refresh">
            <FiRefreshCw size={13} style={{ animation: isLoadingDevices ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        )}
      </div>

      {/* Title */}
      <div style={{ padding: '10px 14px 6px', flexShrink: 0 }}>
        <h5 style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#2D3748', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FiClipboard size={14} />
          {step === 'select-device' ? 'Select Device' : `New Task — ${selectedDevice?.name}`}
        </h5>
        {step === 'create-task' && (
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#718096', lineHeight: 1.4 }}>
            Fill the form, then <strong>Shift+click on the 3D scene</strong> to add waypoints.
          </p>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>

        {/* STEP 1: Device list */}
        {step === 'select-device' && (
          <>
            {devicesError && (
              <div style={alertStyle}>
                {devicesError}
                <button onClick={loadDevices} style={{ marginLeft: '6px', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>Retry</button>
              </div>
            )}
            {isLoadingDevices && [1, 2, 3].map(i => (
              <div key={i} style={{ height: '52px', borderRadius: '8px', margin: '8px 0', background: 'linear-gradient(90deg,#EDF2F7 25%,#E2E8F0 50%,#EDF2F7 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
            ))}
            {!isLoadingDevices && !devicesError && devices.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#A0AEC0' }}>
                <FiWifiOff size={28} style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '13px' }}>No devices in this organisation.</p>
              </div>
            )}
            {!isLoadingDevices && devices.map((device: DevicePublic) => {
              const catColor = CATEGORY_COLORS[(device.category ?? '').toLowerCase()] ?? '#718096';
              return (
                <div
                  key={device.uid}
                  onClick={() => handleSelectDevice(device)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', marginTop: '8px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#FAFAFA', cursor: 'pointer', transition: 'all 0.15s ease' }}
                  onMouseEnter={(e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.borderColor = '#DD6B20'; (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 10px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#2D3748' }}>{device.name}</span>
                      {device.category && (
                        <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '999px', background: catColor, color: '#fff', fontWeight: 600 }}>{device.category}</span>
                      )}
                      <span style={{ fontSize: '10px', color: device.enabled ? '#38A169' : '#A0AEC0', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        {device.enabled ? <FiWifi size={10} /> : <FiWifiOff size={10} />}
                        {device.enabled ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#718096' }}>{device.model}</span>
                  </div>
                  <FiChevronRight size={16} style={{ color: '#A0AEC0', flexShrink: 0 }} />
                </div>
              );
            })}
          </>
        )}

        {/* STEP 2: Task form */}
        {step === 'create-task' && selectedDevice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: '#EBF8FF', border: '1px solid #BEE3F8' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2B6CB0' }}>{selectedDevice.name}</span>
              {selectedDevice.category && (
                <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '999px', background: CATEGORY_COLORS[(selectedDevice.category ?? '').toLowerCase()] ?? '#718096', color: '#fff', fontWeight: 600 }}>
                  {selectedDevice.category}
                </span>
              )}
            </div>

            <div>
              <label style={labelStyle}>Task Name *</label>
              <input type="text" value={taskName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaskName(e.target.value)} placeholder="e.g. Patrol Room 301" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Type</label>
              <select value={taskType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTaskType(e.target.value)} style={inputStyle}>
                {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Initial Status</label>
              <select value={taskStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTaskStatus(e.target.value)} style={inputStyle}>
                {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Start Time</label>
              <input type="datetime-local" value={startTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartTime(e.target.value)} style={inputStyle} />
            </div>

            {/* Waypoints */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  <FiMapPin size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Waypoints ({waypoints.length})
                </label>
                {waypoints.length > 0 && (
                  <button onClick={() => setWaypoints([])} style={{ fontSize: '11px', color: '#E53E3E', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
                    Clear all
                  </button>
                )}
              </div>

              <div style={{
                padding: '8px 10px', borderRadius: '6px',
                border: `1px dashed ${waypointHint ? '#DD6B20' : '#CBD5E0'}`,
                background: waypointHint ? '#FFFAF0' : '#F7FAFC',
                fontSize: '11px', color: waypointHint ? '#C05621' : '#718096',
                textAlign: 'center', transition: 'all 0.2s ease',
                marginBottom: waypoints.length > 0 ? '8px' : 0,
              }}>
                {waypointHint ? '✓ ¡Waypoint añadido!' : '⇧ Shift + Click en la escena 3D'}
              </div>

              {waypoints.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                  {waypoints.map((wp: Waypoint, idx: number) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '6px', background: '#F0FFF4', border: '1px solid #C6F6D5', fontSize: '11px', color: '#276749' }}>
                      <FiMapPin size={11} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1 }}><strong>#{idx + 1}</strong> x:{wp.coordinates_x.toFixed(0)} z:{wp.coordinates_y.toFixed(0)}</span>
                      <button onClick={() => removeWaypoint(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E53E3E', padding: 0, display: 'flex', alignItems: 'center' }} title="Remove">
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                onClick={handleCreateTask}
                disabled={isSubmitting || !taskName.trim()}
                style={{ ...btnStyle('#16A34A', isSubmitting || !taskName.trim()), justifyContent: 'center', padding: '10px', fontSize: '13px', fontWeight: 600 }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (!isSubmitting && taskName.trim()) hoverBtn(e, '#15803d'); }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { if (!isSubmitting && taskName.trim()) hoverBtn(e, '#16A34A'); }}
              >
                {isSubmitting ? 'Saving…' : 'Save Task'}
              </button>

              {isSimulating ? (
                <button onClick={stopSimulation} style={{ ...btnStyle('#EF4444'), justifyContent: 'center', padding: '10px', fontSize: '13px', fontWeight: 600 }}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => hoverBtn(e, '#DC2626')}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => hoverBtn(e, '#EF4444')}>
                  <FiSquare size={13} style={{ marginRight: '4px' }} /> Stop
                </button>
              ) : (
                <button onClick={startSimulation} disabled={waypoints.length === 0}
                  style={{ ...btnStyle('#2563EB', waypoints.length === 0), justifyContent: 'center', padding: '10px', fontSize: '13px', fontWeight: 600 }}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (waypoints.length > 0) hoverBtn(e, '#1D4ED8'); }}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { if (waypoints.length > 0) hoverBtn(e, '#2563EB'); }}>
                  <FiPlay size={13} style={{ marginRight: '4px' }} /> Run
                </button>
              )}
            </div>

            {submitResult && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${submitResult.success ? '#C6F6D5' : '#FC8181'}`, background: submitResult.success ? '#F0FFF4' : '#FFF5F5', fontSize: '12px', color: submitResult.success ? '#276749' : '#C53030', animation: 'slideUp 0.3s ease-out' }}>
                {submitResult.success ? <FiCheckCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> : <FiAlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />}
                <span>{submitResult.message}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
};

// Style helpers
function btnStyle(bg: string, disabled = false): React.CSSProperties {
  return { backgroundColor: bg, color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', opacity: disabled ? 0.6 : 1 };
}
function hoverBtn(e: React.MouseEvent<HTMLButtonElement>, bg: string) {
  (e.currentTarget as HTMLButtonElement).style.backgroundColor = bg;
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#4A5568', marginBottom: '4px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', fontSize: '12px', border: '1px solid #CBD5E0', borderRadius: '6px', outline: 'none', backgroundColor: '#fff', color: '#2D3748', boxSizing: 'border-box' };
const alertStyle: React.CSSProperties = { backgroundColor: '#FFF5F5', border: '1px solid #FC8181', borderRadius: '6px', padding: '8px 12px', color: '#C53030', fontSize: '12px', marginTop: '10px' };

export default AddTasks;