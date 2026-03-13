import React, { useEffect, useRef, useState } from 'react';
import { DevicesService } from '../../client';
import { StatusPublic } from '../../client/types.gen';
import { Blueprint3DAppRef } from './Blueprint3DApp';

const POLL_INTERVAL = 1000;

interface RobotInfoPanelProps {
    blueprint3DRef: React.RefObject<Blueprint3DAppRef>;
    isVisible: boolean;
    hasSelectedItem?: boolean;
}

function getBatteryColor(level: number): string {
    if (level <= 10) return '#FF4560';
    if (level <= 25) return '#FF9F43';
    if (level <= 50) return '#FFC107';
    return '#00C49F';
}

function getStatusConfig(status: string): { color: string; bg: string; dot: string; label: string } {
    const s = (status || '').toLowerCase();
    if (s === 'idle') return { color: '#A3E635', bg: 'rgba(163,230,53,0.12)', dot: '#A3E635', label: 'Idle' };
    if (s === 'running' || s === 'active' || s === 'busy' || s === 'in progress' || s === 'inprogress')
        // Always label as 'Running' regardless of the exact API string
        return { color: '#38BDF8', bg: 'rgba(56,189,248,0.12)', dot: '#38BDF8', label: 'Running' };
    if (s === 'charging') return { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', dot: '#FBBF24', label: 'Charging' };
    if (s === 'error' || s === 'offline')
        return { color: '#F87171', bg: 'rgba(248,113,113,0.12)', dot: '#F87171', label: 'Error' };
    return { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', dot: '#94A3B8', label: status || 'Unknown' };
}

function truncateUid(uid: string): string {
    if (!uid) return '—';
    return uid.substring(0, 8) + '…';
}

function formatCoord(val: number | null | undefined): string {
    if (val == null) return '—';
    return val.toFixed(1);
}

function BatteryBar({ level }: { level: number }) {
    const color = getBatteryColor(level);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
                style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        height: '100%',
                        width: `${Math.max(level, 2)}%`,
                        borderRadius: 4,
                        background: `linear-gradient(90deg, ${color}99, ${color})`,
                        boxShadow: `0 0 6px ${color}66`,
                        transition: 'width 0.6s ease, background 0.4s ease',
                    }}
                />
            </div>
            <span
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: color,
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: 32,
                    textAlign: 'right',
                }}
            >
                {level}%
            </span>
            {/* Battery icon */}
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0.5" y="0.5" width="13" height="9" rx="1.5" stroke={color} strokeOpacity="0.6" />
                <rect x="13.5" y="3" width="2" height="4" rx="1" fill={color} fillOpacity="0.5" />
                <rect x="1.5" y="1.5" width={`${Math.max((11 * level) / 100, 0.5).toFixed(1)}`} height="7" rx="1"
                    fill={color}
                    style={{ transition: 'width 0.6s ease' }}
                />
            </svg>
        </div>
    );
}

function PulsingDot({ color }: { color: string }) {
    return (
        <span style={{ position: 'relative', display: 'inline-block', width: 8, height: 8 }}>
            <span
                style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: color,
                    animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                    opacity: 0.6,
                }}
            />
            <span
                style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: color,
                }}
            />
        </span>
    );
}

function RobotCard({ status }: { status: StatusPublic }) {
    const hasTask = !!status.task_id;
    // If a task is assigned (task_id set), ALWAYS show as Running regardless of what the backend says
    const displayStatus = hasTask ? 'Running' : (status.status || 'Unknown');
    const statusCfg = getStatusConfig(displayStatus);

    const [hovered, setHovered] = useState(false);

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: hovered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${hovered ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 12,
                padding: '12px 14px',
                marginBottom: 8,
                transition: 'background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                transform: hovered ? 'translateY(-1px)' : 'none',
                boxShadow: hovered ? '0 4px 20px rgba(0,0,0,0.3)' : 'none',
                cursor: 'default',
            }}
        >
            {/* Header: Name + Status badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span
                    style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#F1F5F9',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '60%',
                    }}
                >
                    {status.device_name}
                </span>
                <span
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        background: statusCfg.bg,
                        border: `1px solid ${statusCfg.color}33`,
                        borderRadius: 20,
                        padding: '2px 8px',
                        fontSize: 10,
                        fontWeight: 600,
                        color: statusCfg.color,
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                    }}
                >
                    <PulsingDot color={statusCfg.dot} />
                    {statusCfg.label.toUpperCase()}
                </span>
            </div>

            {/* UID */}
            <div style={{ marginBottom: 8 }}>
                <label style={styles.label}>UID</label>
                <span style={{ ...styles.monoValue, color: '#94A3B8' }}>{truncateUid(status.uid)}</span>
            </div>

            {/* Battery */}
            <div style={{ marginBottom: 8 }}>
                <label style={styles.label}>Batería</label>
                <BatteryBar level={status.battery_level ?? 0} />
            </div>

            {/* Position */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                    <label style={styles.label}>X</label>
                    <span style={styles.monoValue}>{formatCoord(status.coordinates_x)}</span>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={styles.label}>Y</label>
                    <span style={styles.monoValue}>{formatCoord(status.coordinates_y)}</span>
                </div>
            </div>

            {/* Task */}
            <div>
                <label style={styles.label}>Tarea activa</label>
                {hasTask ? (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'rgba(56,189,248,0.1)',
                            border: '1px solid rgba(56,189,248,0.25)',
                            borderRadius: 6,
                            padding: '3px 8px',
                            marginTop: 3,
                        }}
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                            <circle cx="5" cy="5" r="4" stroke="#38BDF8" strokeWidth="1.5" fill="none" />
                            <circle cx="5" cy="5" r="1.5" fill="#38BDF8">
                                <animateTransform
                                    attributeName="transform"
                                    type="rotate"
                                    from="0 5 5"
                                    to="360 5 5"
                                    dur="2s"
                                    repeatCount="indefinite"
                                />
                            </circle>
                        </svg>
                        <span style={{ ...styles.monoValue, color: '#38BDF8', fontSize: 11 }}>
                            {status.task_id!.substring(0, 12)}…
                        </span>
                    </div>
                ) : (
                    <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', fontStyle: 'italic' }}>
                        Sin tarea
                    </span>
                )}
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    label: {
        display: 'block',
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'rgba(148,163,184,0.7)',
        marginBottom: 3,
    },
    monoValue: {
        display: 'block',
        fontSize: 12,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        color: '#CBD5E1',
        fontVariantNumeric: 'tabular-nums',
    },
};

export default function RobotInfoPanel({ blueprint3DRef, isVisible, hasSelectedItem }: RobotInfoPanelProps) {
    const [statuses, setStatuses] = useState<StatusPublic[]>([]);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (hasSelectedItem) {
            setIsCollapsed(true);
        }
    }, [hasSelectedItem]);

    const fetchStatuses = async () => {
        // Get only the UIDs of devices currently loaded in the 3D scene
        const sceneUids = blueprint3DRef.current?.getSceneDeviceUids?.() ?? [];
        if (sceneUids.length === 0) {
            setStatuses([]);
            return;
        }

        const results = await Promise.allSettled(
            sceneUids.map((uid) =>
                DevicesService.getDeviceStatus({ uid })
                    .then((res: any) => (res as any)?.data ?? res)
            )
        );

        const resolved: StatusPublic[] = results
            .filter((r): r is PromiseFulfilledResult<StatusPublic> => r.status === 'fulfilled')
            .map((r) => r.value)
            .filter((s) => s && s.uid);

        setStatuses(resolved);
        setLastUpdated(new Date());
    };

    useEffect(() => {
        if (!isVisible) {
            setStatuses([]);
            return;
        }

        fetchStatuses();
        intervalRef.current = setInterval(fetchStatuses, POLL_INTERVAL);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isVisible]);

    if (!isVisible) return null;

    return (
        <>
            {/* Keyframe animations injected once */}
            <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

            <div
                style={{
                    width: isCollapsed ? 48 : 280,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'panelSlideIn 0.3s ease forwards',
                    transition: 'width 0.3s ease',
                    pointerEvents: 'auto',
                }}
            >
                {/* Panel header */}
                <div
                    style={{
                        background: 'rgba(15,23,42,0.85)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(99,179,237,0.3)',
                        borderRadius: isCollapsed ? 12 : '12px 12px 0 0',
                        padding: isCollapsed ? '10px' : '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'space-between',
                        gap: 8,
                        boxShadow: '0 0 24px rgba(99,179,237,0.15)',
                        flexShrink: 0,
                        cursor: 'pointer',
                    }}
                    onClick={() => setIsCollapsed((c) => !c)}
                    title={isCollapsed ? 'Expandir panel de robots' : 'Colapsar panel de robots'}
                >
                    {!isCollapsed && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 8,
                                        background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 0 10px rgba(59,130,246,0.5)',
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="10" rx="2" />
                                        <circle cx="12" cy="5" r="2" />
                                        <line x1="12" y1="7" x2="12" y2="11" />
                                        <line x1="7" y1="16" x2="7" y2="16" strokeWidth="3" />
                                        <line x1="12" y1="16" x2="12" y2="16" strokeWidth="3" />
                                        <line x1="17" y1="16" x2="17" y2="16" strokeWidth="3" />
                                    </svg>
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9', letterSpacing: '0.02em' }}>
                                        Robots en escena
                                    </div>
                                    {lastUpdated && (
                                        <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.6)', marginTop: 1 }}>
                                            {lastUpdated.toLocaleTimeString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div
                                    style={{
                                        background: 'rgba(99,179,237,0.15)',
                                        border: '1px solid rgba(99,179,237,0.3)',
                                        borderRadius: 20,
                                        padding: '2px 9px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#63B3ED',
                                    }}
                                >
                                    {statuses.length}
                                </div>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round">
                                    <polyline points="3,5 7,9 11,5" />
                                </svg>
                            </div>
                        </>
                    )}

                    {isCollapsed && (
                        <div
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 10px rgba(59,130,246,0.5)',
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="10" rx="2" />
                                <circle cx="12" cy="5" r="2" />
                                <line x1="12" y1="7" x2="12" y2="11" />
                                <line x1="7" y1="16" x2="7" y2="16" strokeWidth="3" />
                                <line x1="12" y1="16" x2="12" y2="16" strokeWidth="3" />
                                <line x1="17" y1="16" x2="17" y2="16" strokeWidth="3" />
                            </svg>
                        </div>
                    )}
                </div>

                {/* Robot cards scrollable body */}
                {!isCollapsed && (
                    <div
                        style={{
                            overflowY: 'auto',
                            background: 'rgba(10,18,35,0.8)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                            border: '1px solid rgba(99,179,237,0.15)',
                            borderTop: 'none',
                            borderRadius: '0 0 12px 12px',
                            padding: 10,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'rgba(99,179,237,0.3) transparent',
                        }}
                    >
                        {statuses.length === 0 ? (
                            <div
                                style={{
                                    padding: '24px 0',
                                    textAlign: 'center',
                                    color: 'rgba(148,163,184,0.5)',
                                    fontSize: 12,
                                }}
                            >
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }}>
                                    <rect x="3" y="11" width="18" height="10" rx="2" />
                                    <circle cx="12" cy="5" r="2" />
                                    <line x1="12" y1="7" x2="12" y2="11" />
                                </svg>
                                No hay robots en esta escena
                            </div>
                        ) : (
                            statuses.map((s) => <RobotCard key={s.uid} status={s} />)
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
