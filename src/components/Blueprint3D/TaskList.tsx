import React, { useEffect, useRef, useState } from 'react';
import {
    FiArrowLeft, FiRefreshCw, FiPlay, FiSquare,
    FiMapPin, FiClock, FiTag, FiActivity, FiWifiOff,
    FiChevronDown, FiChevronRight, FiTrash2,
} from 'react-icons/fi';
import { useBlueprint3D } from './Blueprint3DApp';
import { DevicesService, TasksService } from '../../client';  // ← añadir TasksService
import type { DevicePublic, TaskPublic } from '../../client';
import { useOrganizationContext } from '../../hooks/useOrganizationContext';
import { ScenesService } from '../../client';


// ─── helpers ─────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
    robot: '#3182CE', iot: '#38A169', meter: '#DD6B20', sensor: '#805AD5',
};
const STATUS_COLORS: Record<string, string> = {
    Running: '#38A169', Scheduled: '#2B6CB0', Completed: '#718096', Failed: '#E53E3E',
};

function fmtDate(iso: string): string {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function normalise(s: string): string {
    return s.toLowerCase().trim().replace(/[\s\-.]+/g, '_');
}

/** Multi-strategy lookup — same logic as AddTasks.tsx findDeviceItemInScene */
function findDeviceItemInScene(items: any[], device: DevicePublic): any {
    const devUid = String(device.uid ?? '').toLowerCase();
    const devModel = normalise(String(device.model ?? ''));
    const devName = normalise(String(device.name ?? ''));

    // Pass 1 – exact UID
    const byUid = items.find(it => {
        const meta = it?.metadata;
        const id = String(meta?.deviceId ?? meta?.device_uid ?? '').toLowerCase();
        return id && id === devUid;
    });
    if (byUid) return byUid;

    // Pass 2 – model name
    if (devModel) {
        const byModel = items.find(it => {
            const m = normalise(String(it?.metadata?.deviceModel ?? ''));
            return m && (m === devModel || m.includes(devModel) || devModel.includes(m));
        });
        if (byModel) return byModel;
    }

    // Pass 3 – model URL substring
    if (devModel || devName) {
        const byUrl = items.find(it => {
            const url = normalise(String(it?.metadata?.modelUrl ?? ''));
            return url && (url.includes(devModel) || url.includes(devName));
        });
        if (byUrl) return byUrl;
    }

    return undefined;
}



// ─── Component ───────────────────────────────────────────────────────────────
const TaskList: React.FC = () => {
    const { blueprint3d, onStateChange, currentUID } = useBlueprint3D();
    const { getActiveOrganizationId } = useOrganizationContext();

    const [devices, setDevices] = useState<DevicePublic[]>([]);
    const [tasksByDevice, setTasksByDevice] = useState<Record<string, TaskPublic[]>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // Simulation state
    const [simulating, setSimulating] = useState<string | null>(null); // task uid
    const rafRef = useRef<number | null>(null);
    const pathGroupRef = useRef<any>(null);

    // ── Load devices + their tasks ────────────────────────────────────────────
    const load = async () => {
        const orgId = getActiveOrganizationId();
        setLoading(true);
        setError(null);
        try {
            if (!orgId) { setError('No active organisation selected.'); return; }
            const devRes = await DevicesService.getDevicesOwn({ ownerId: orgId });
            const devList = devRes.data;
            setDevices(devList);

            // Fetch tasks for every device in parallel
            const taskMap: Record<string, TaskPublic[]> = {};
            await Promise.all(devList.map(async (d) => {
                try {
                    const res = await DevicesService.getDeviceTasks({ uid: d.uid });
                    taskMap[d.uid] = res.data ?? [];
                } catch {
                    taskMap[d.uid] = [];
                }
            }));
            setTasksByDevice(taskMap);
            // Auto-expand devices that have tasks
            const auto: Record<string, boolean> = {};
            devList.forEach(d => { if ((taskMap[d.uid] ?? []).length > 0) auto[d.uid] = true; });
            setExpanded(auto);
        } catch (err: any) {
            setError('Could not load tasks: ' + (err?.message ?? String(err)));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (!rafRef.current) {
                clearPath();
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Path drawing ─────────────────────────────────────────────────────────
    const clearPath = () => {
        try {
            const g = pathGroupRef.current;
            if (!g) return;
            const s3 = (blueprint3d?.model?.scene as any)?.getScene?.();
            if (s3) s3.remove(g);
            (blueprint3d as any)?.three?.needsUpdate?.();
            pathGroupRef.current = null;
        } catch { /* ignore */ }
    };

    const savePosition = async () => {
        if (!blueprint3d?.model || !currentUID) return;
        try {
            const data = JSON.parse(blueprint3d.model.exportSerialized());
            await ScenesService.updateScene({
                sceneId: currentUID,
                requestBody: {
                    floorplan: data.floorplan,
                    items: data.items || [],
                    organization_id: getActiveOrganizationId()
                }
            });
        } catch (err) {
            console.error('Error guardando posición:', err);
        }
    };

    const deleteTask = async (taskUid: string, deviceUid: string) => {
        if (!confirm('¿Eliminar esta tarea?')) return;
        try {
            await TasksService.deleteTask({ uid: taskUid });
            setTasksByDevice((prev: Record<string, TaskPublic[]>) => ({  // ← tipo explícito
                ...prev,
                [deviceUid]: (prev[deviceUid] ?? []).filter((t: TaskPublic) => t.uid !== taskUid),
            }));
        } catch (err: any) {
            alert('Error al eliminar la tarea: ' + (err?.message ?? String(err)));
        }
    };

    const drawPath = (task: TaskPublic) => {
        const THREE = (window as any).THREE;
        if (!THREE || !blueprint3d?.model?.scene) return;
        const s3 = (blueprint3d.model.scene as any).getScene?.();
        if (!s3) return;
        clearPath();
        const group = new THREE.Group();
        task.waypoints.forEach((wp, i) => {
            const m = new THREE.Mesh(
                new THREE.SphereGeometry(8, 14, 14),
                new THREE.MeshBasicMaterial({ color: 0x2B6CB0 }),
            );
            m.position.set(wp.coordinates_x, 8, wp.coordinates_y);
            m.name = `tl_wp_${i}`;
            group.add(m);
        });
        if (task.waypoints.length >= 2) {
            const geom = new THREE.Geometry();
            task.waypoints.forEach(wp => geom.vertices.push(new THREE.Vector3(wp.coordinates_x, 5, wp.coordinates_y)));
            group.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0x3182CE, linewidth: 2 })));
        }
        s3.add(group);
        pathGroupRef.current = group;
        (blueprint3d as any)?.three?.needsUpdate?.();
    };

    // ── Simulation ────────────────────────────────────────────────────────────
    const stopSim = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        setSimulating(null);
        clearPath();
    };

    const runTask = (task: TaskPublic, device: DevicePublic) => {
        const THREE = (window as any).THREE;
        if (!THREE || !blueprint3d?.model?.scene || task.waypoints.length === 0) return;

        const items = (blueprint3d.model.scene as any).getItems?.() ?? [];
        const deviceItem = findDeviceItemInScene(items as any[], device);
        if (!deviceItem) {
            alert(`Robot "${device.name}" no encontrado en la escena 3D.\nAsegúrate de añadirlo con "Add Devices" antes de ejecutar tareas.`);
            return;
        }

        drawPath(task);
        const y = Number(deviceItem.position?.y ?? 0);
        const pts = task.waypoints.map(wp => new THREE.Vector3(wp.coordinates_x, y, wp.coordinates_y));
        let idx = 0;
        setSimulating(task.uid);

       const animate = (now: number) => {
            if (idx >= pts.length) {
                (blueprint3d as any)?.three?.needsUpdate?.();
                savePosition();          // ← tarea completada
                stopSim();
                return;
            }
            const dt = (animate as any)._last ? (now - (animate as any)._last) / 1000 : 0.016;
            (animate as any)._last = now;

            const pos = deviceItem.position;
            const tgt = pts[idx];
            const delta = new THREE.Vector3(tgt.x - pos.x, 0, tgt.z - pos.z);
            const dist = delta.length();
            const step = 120 * dt;

            if (dist <= step) {
                pos.x = tgt.x;
                pos.z = tgt.z;
                idx++;
            } else {
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

        // Close UI
        onStateChange('DESIGN');
        setTimeout(() => blueprint3d?.three?.updateWindowSize?.(), 150);
    };

    const toggleDevice = (uid: string) =>
        setExpanded(prev => ({ ...prev, [uid]: !prev[uid] }));

    // ── Render ────────────────────────────────────────────────────────────────
    const totalTasks = Object.values(tasksByDevice).reduce((a, b) => a + b.length, 0);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, background: '#FAFAFA' }}>
                <button
                    onClick={() => { stopSim(); clearPath(); onStateChange('DESIGN'); setTimeout(() => blueprint3d?.three?.updateWindowSize?.(), 150); }}
                    style={btn('#596A6E')}
                    onMouseEnter={e => hover(e, '#4A5B5F')}
                    onMouseLeave={e => hover(e, '#596A6E')}
                >
                    <FiArrowLeft style={{ marginRight: '5px' }} /> Back
                </button>
                <span style={{ flex: 1 }} />
                <button onClick={load} disabled={loading} style={btn('#2B6CB0', loading)} title="Reload">
                    <FiRefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                </button>
            </div>

            {/* Title */}
            <div style={{ padding: '10px 14px 6px', flexShrink: 0 }}>
                <h5 style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#2D3748', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FiActivity size={14} /> Saved Tasks
                    {totalTasks > 0 && <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '999px', background: '#2B6CB0', color: '#fff', fontWeight: 600 }}>{totalTasks}</span>}
                </h5>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#718096' }}>
                    Grouped by robot. Press <strong>▶ Run</strong> to replay a task in the 3D scene.
                </p>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>

                {error && (
                    <div style={alertS}>
                        {error}
                        <button onClick={load} style={{ marginLeft: '6px', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>Retry</button>
                    </div>
                )}

                {loading && [1, 2, 3].map(i => (
                    <div key={i} style={{ height: '52px', borderRadius: '8px', margin: '8px 0', background: 'linear-gradient(90deg,#EDF2F7 25%,#E2E8F0 50%,#EDF2F7 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                ))}

                {!loading && !error && devices.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: '#A0AEC0' }}>
                        <FiWifiOff size={28} style={{ marginBottom: '8px' }} />
                        <p style={{ margin: 0, fontSize: '13px' }}>No devices in this organisation.</p>
                    </div>
                )}

                {!loading && devices.map(device => {
                    const tasks = tasksByDevice[device.uid] ?? [];
                    const catColor = CATEGORY_COLORS[(device.category ?? '').toLowerCase()] ?? '#718096';
                    const isOpen = expanded[device.uid] ?? false;

                    return (
                        <div key={device.uid} style={{ marginTop: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>

                            {/* Device row */}
                            <div
                                onClick={() => toggleDevice(device.uid)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: '#F7FAFC', cursor: 'pointer', userSelect: 'none' }}
                            >
                                {isOpen ? <FiChevronDown size={13} style={{ flexShrink: 0, color: '#718096' }} /> : <FiChevronRight size={13} style={{ flexShrink: 0, color: '#718096' }} />}
                                <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: '#2D3748' }}>{device.name}</span>
                                {device.category && (
                                    <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '999px', background: catColor, color: '#fff', fontWeight: 600 }}>{device.category}</span>
                                )}
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: tasks.length > 0 ? '#EBF8FF' : '#F7FAFC', color: tasks.length > 0 ? '#2B6CB0' : '#A0AEC0', fontWeight: 600, border: '1px solid', borderColor: tasks.length > 0 ? '#BEE3F8' : '#E2E8F0' }}>
                                    {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* Tasks list */}
                            {isOpen && (
                                <div style={{ borderTop: '1px solid #EDF2F7' }}>
                                    {tasks.length === 0 && (
                                        <p style={{ margin: 0, padding: '12px', fontSize: '11px', color: '#A0AEC0', textAlign: 'center' }}>No tasks saved for this device.</p>
                                    )}
                                    {tasks.map(task => {
                                        const isRunning = simulating === task.uid;
                                        const statusColor = STATUS_COLORS[task.status] ?? '#718096';

                                        return (
                                            <div key={task.uid} style={{ padding: '10px 12px', borderBottom: '1px solid #EDF2F7', background: isRunning ? '#EBF8FF' : '#fff', transition: 'background 0.2s' }}>

                                                {/* Task header */}
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '6px' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#2D3748', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                            <FiTag size={11} />
                                                            {task.task_name}
                                                            <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '999px', background: statusColor + '22', color: statusColor, fontWeight: 600, border: `1px solid ${statusColor}55` }}>{task.status}</span>
                                                        </div>
                                                        <div style={{ fontSize: '10px', color: '#718096', marginTop: '3px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><FiActivity size={9} /> {task.type}</span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><FiClock size={9} /> {fmtDate(task.start_time)}</span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><FiMapPin size={9} /> {task.waypoints.length} WP</span>
                                                        </div>
                                                    </div>

                                                    {/* Run / Stop button */}
                                                    {isRunning ? (
                                                        <button onClick={stopSim}
                                                            style={{ ...btn('#EF4444'), padding: '5px 8px', fontSize: '11px' }}
                                                            onMouseEnter={e => hover(e, '#DC2626')}
                                                            onMouseLeave={e => hover(e, '#EF4444')}
                                                        >
                                                            <FiSquare size={11} style={{ marginRight: '3px' }} /> Stop
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => runTask(task, device)}
                                                            disabled={task.waypoints.length === 0 || (simulating !== null && simulating !== task.uid)}
                                                            style={{ ...btn('#2563EB', task.waypoints.length === 0 || (simulating !== null && simulating !== task.uid)), padding: '5px 8px', fontSize: '11px' }}
                                                            onMouseEnter={e => { if (task.waypoints.length > 0 && !simulating) hover(e, '#1D4ED8'); }}
                                                            onMouseLeave={e => { if (task.waypoints.length > 0 && !simulating) hover(e, '#2563EB'); }}
                                                        >
                                                            <FiPlay size={11} style={{ marginRight: '3px' }} /> Run
                                                        </button>
                                                    )}
                                                    {/* ← Botón eliminar nuevo */}
                                                    <button
                                                        onClick={() => deleteTask(task.uid, device.uid)}
                                                        disabled={isRunning}
                                                        style={{ ...btn('#E53E3E', isRunning), padding: '5px 8px', fontSize: '11px' }}
                                                        onMouseEnter={e => { if (!isRunning) hover(e, '#C53030'); }}
                                                        onMouseLeave={e => { if (!isRunning) hover(e, '#E53E3E'); }}
                                                        title="Eliminar tarea"
                                                    >
                                                        <FiTrash2 size={11} />
                                                    </button>
                                                </div>

                                                {/* Waypoints mini-list */}
                                                {task.waypoints.length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {task.waypoints.map((wp, i) => (
                                                            <span key={i} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: '#EDF2F7', color: '#4A5568' }}>
                                                                #{i + 1} ({wp.coordinates_x.toFixed(0)}, {wp.coordinates_y.toFixed(0)})
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>
        </div>
    );
};

// ── Style helpers ──────────────────────────────────────────────────────────
function btn(bg: string, disabled = false): React.CSSProperties {
    return { backgroundColor: bg, color: 'white', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', opacity: disabled ? 0.6 : 1 };
}
function hover(e: React.MouseEvent<HTMLButtonElement>, bg: string) {
    (e.currentTarget as HTMLButtonElement).style.backgroundColor = bg;
}
const alertS: React.CSSProperties = { backgroundColor: '#FFF5F5', border: '1px solid #FC8181', borderRadius: '6px', padding: '8px 12px', color: '#C53030', fontSize: '12px', marginTop: '10px' };

export default TaskList;
