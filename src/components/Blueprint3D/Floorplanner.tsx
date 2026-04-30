import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiMove, FiEdit2, FiTrash2, FiCheck } from 'react-icons/fi';
import { useBlueprint3D } from './Blueprint3DApp';
import {
  clearObjectFootprintsOverlay,
  drawObjectFootprintsOverlay,
  removeObjectFootprintsOverlay,
} from '../../utils/floorplanFootprintOverlay';
import type { FootprintPoint, SceneItemFootprint } from '../../utils/itemFootprints';

const pointInPolygon = (point: FootprintPoint, polygon: FootprintPoint[]) => {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];

    const intersects =
      pi.z > point.z !== pj.z > point.z &&
      point.x < ((pj.x - pi.x) * (point.z - pi.z)) / ((pj.z - pi.z) || 1) + pi.x;

    if (intersects) inside = !inside;
  }

  return inside;
};

const eventToFloorplanPoint = (
  blueprint3d: any,
  canvas: HTMLCanvasElement,
  event: MouseEvent
): FootprintPoint | null => {
  const floorplanner = blueprint3d?.floorplanner;
  if (!floorplanner) return null;

  const rect = canvas.getBoundingClientRect();
  const cmPerPixel = Number(floorplanner.cmPerPixel) || 1;
  const originX = Number(floorplanner.originX) || 0;
  const originY = Number(floorplanner.originY) || 0;

  return {
    x: (event.clientX - rect.left) * cmPerPixel + originX * cmPerPixel,
    z: (event.clientY - rect.top) * cmPerPixel + originY * cmPerPixel,
  };
};

const Floorplanner: React.FC = () => {
  const {
    blueprint3d,
    onStateChange,
    onItemSelect,
    onItemUnselect,
  } = useBlueprint3D();
  const [currentMode, setCurrentMode] = useState('MOVE');
  const [showDrawHint, setShowDrawHint] = useState(false);
  const [showObjectFootprints, setShowObjectFootprints] = useState(false);
  const [showChargerFootprints, setShowChargerFootprints] = useState(false);
  const [objectFootprintCount, setObjectFootprintCount] = useState(0);
  const [chargerFootprintCount, setChargerFootprintCount] = useState(0);
  const [selectedFootprint, setSelectedFootprint] = useState<SceneItemFootprint | null>(null);
  const overlayRafRef = useRef<number | null>(null);
  const scheduleObjectOverlayDrawRef = useRef<() => void>(() => {});
  const footprintsRef = useRef<SceneItemFootprint[]>([]);

  const drawObjectOverlay = useCallback(() => {
    if (!blueprint3d) return;

    const footprints = drawObjectFootprintsOverlay(blueprint3d, {
      visible: showObjectFootprints || showChargerFootprints,
      includeLabels: false,
      selectedFootprintId: selectedFootprint?.id ?? null,
      includeObjects: showObjectFootprints,
      includeDevices: showObjectFootprints,
      includeRobots: false,
      includeChargers: showChargerFootprints,
    });

    footprintsRef.current = footprints;
    setObjectFootprintCount(footprints.filter((footprint) => !footprint.isCharger).length);
    setChargerFootprintCount(footprints.filter((footprint) => footprint.isCharger).length);
  }, [blueprint3d, showObjectFootprints, showChargerFootprints, selectedFootprint?.id]);

  const scheduleObjectOverlayDraw = useCallback(() => {
    if (overlayRafRef.current !== null) {
      window.cancelAnimationFrame(overlayRafRef.current);
    }

    overlayRafRef.current = window.requestAnimationFrame(() => {
      overlayRafRef.current = null;
      drawObjectOverlay();
    });
  }, [drawObjectOverlay]);

  useEffect(() => {
    scheduleObjectOverlayDrawRef.current = scheduleObjectOverlayDraw;
  }, [scheduleObjectOverlayDraw]);

  useEffect(() => {
    if (showObjectFootprints || showChargerFootprints) {
      scheduleObjectOverlayDraw();
    }
  }, [scheduleObjectOverlayDraw, selectedFootprint?.id, showObjectFootprints, showChargerFootprints]);

  useEffect(() => {
    if (blueprint3d?.floorplanner && typeof (window as any).BP3D !== 'undefined') {
      const BP3D = (window as any).BP3D;
      // Set up mode change callbacks like the original
      const handleModeReset = (mode: any) => {
        if (mode === BP3D.Floorplanner.floorplannerModes.MOVE) {
          setCurrentMode('MOVE');
          setShowDrawHint(false);
        } else if (mode === BP3D.Floorplanner.floorplannerModes.DRAW) {
          setCurrentMode('DRAW');
          setShowDrawHint(true);
          handleWindowResize();
        } else if (mode === BP3D.Floorplanner.floorplannerModes.DELETE) {
          setCurrentMode('DELETE');
          setShowDrawHint(false);
        }

        scheduleObjectOverlayDrawRef.current();
      };

      blueprint3d.floorplanner.modeResetCallbacks.add(handleModeReset);

      // Set up window resize handler
      const handleResize = () => {
        handleWindowResize();
        scheduleObjectOverlayDrawRef.current();
      };
      window.addEventListener('resize', handleResize);

      // Initial resize
      handleWindowResize();
      scheduleObjectOverlayDrawRef.current();

      return () => {
        window.removeEventListener('resize', handleResize);
        blueprint3d.floorplanner.modeResetCallbacks?.remove?.(handleModeReset);
      };
    }
  }, [blueprint3d]);

  useEffect(() => {
    if (!blueprint3d) {
      clearObjectFootprintsOverlay();
      setObjectFootprintCount(0);
      setChargerFootprintCount(0);
      setSelectedFootprint(null);
      footprintsRef.current = [];
      return;
    }

    if (!showObjectFootprints && !showChargerFootprints) {
      clearObjectFootprintsOverlay();
      setObjectFootprintCount(0);
      setChargerFootprintCount(0);
      setSelectedFootprint(null);
      footprintsRef.current = [];
      return;
    }

    const canvas = document.getElementById('floorplanner-canvas');
    const scene = blueprint3d.model?.scene as any;

    const scheduleDrawAfterFloorplannerUpdate = () => {
      scheduleObjectOverlayDraw();
    };

    scheduleObjectOverlayDraw();

    canvas?.addEventListener('mousedown', scheduleDrawAfterFloorplannerUpdate);
    canvas?.addEventListener('mousemove', scheduleDrawAfterFloorplannerUpdate);
    canvas?.addEventListener('mouseup', scheduleDrawAfterFloorplannerUpdate);
    canvas?.addEventListener('mouseleave', scheduleDrawAfterFloorplannerUpdate);
    canvas?.addEventListener('wheel', scheduleDrawAfterFloorplannerUpdate);

    scene?.itemLoadedCallbacks?.add?.(scheduleDrawAfterFloorplannerUpdate);
    scene?.itemLoadingCallbacks?.add?.(scheduleDrawAfterFloorplannerUpdate);

    return () => {
      canvas?.removeEventListener('mousedown', scheduleDrawAfterFloorplannerUpdate);
      canvas?.removeEventListener('mousemove', scheduleDrawAfterFloorplannerUpdate);
      canvas?.removeEventListener('mouseup', scheduleDrawAfterFloorplannerUpdate);
      canvas?.removeEventListener('mouseleave', scheduleDrawAfterFloorplannerUpdate);
      canvas?.removeEventListener('wheel', scheduleDrawAfterFloorplannerUpdate);

      scene?.itemLoadedCallbacks?.remove?.(scheduleDrawAfterFloorplannerUpdate);
      scene?.itemLoadingCallbacks?.remove?.(scheduleDrawAfterFloorplannerUpdate);

      if (overlayRafRef.current !== null) {
        window.cancelAnimationFrame(overlayRafRef.current);
        overlayRafRef.current = null;
      }
    };
  }, [blueprint3d, scheduleObjectOverlayDraw, showObjectFootprints, showChargerFootprints]);

  useEffect(() => {
    if (!blueprint3d || (!showObjectFootprints && !showChargerFootprints) || currentMode !== 'MOVE') return;

    const canvas = document.getElementById('floorplanner-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const handleClick = (event: MouseEvent) => {
      const point = eventToFloorplanPoint(blueprint3d, canvas, event);
      if (!point) return;

      const hit = footprintsRef.current
        .filter((footprint) => pointInPolygon(point, footprint.points))
        .sort((a, b) => a.areaCm2 - b.areaCm2)[0] ?? null;

      if (!hit) {
        setSelectedFootprint(null);
        onItemUnselect();
        scheduleObjectOverlayDraw();
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setSelectedFootprint(hit);
      onItemSelect(hit.item);
      scheduleObjectOverlayDraw();
    };

    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('click', handleClick);
    };
  }, [blueprint3d, currentMode, onItemSelect, onItemUnselect, scheduleObjectOverlayDraw, showObjectFootprints, showChargerFootprints]);

  useEffect(() => {
    return () => {
      if (overlayRafRef.current !== null) {
        window.cancelAnimationFrame(overlayRafRef.current);
        overlayRafRef.current = null;
      }
      removeObjectFootprintsOverlay();
    };
  }, []);

  const handleWindowResize = () => {
    if (blueprint3d?.floorplanner) {
      const floorplannerElement = document.getElementById('floorplanner');
      if (floorplannerElement) {
        const rect = floorplannerElement.getBoundingClientRect();
        const height = window.innerHeight - rect.top;
        floorplannerElement.style.height = height + 'px';
        blueprint3d.floorplanner.resizeView();
      }
    }
  };

  const handleModeChange = (mode: string) => {
    if (blueprint3d?.floorplanner && typeof (window as any).BP3D !== 'undefined') {
      const BP3D = (window as any).BP3D;
      let bp3dMode;
      switch (mode) {
        case 'MOVE':
          bp3dMode = BP3D.Floorplanner.floorplannerModes.MOVE;
          break;
        case 'DRAW':
          bp3dMode = BP3D.Floorplanner.floorplannerModes.DRAW;
          break;
        case 'DELETE':
          bp3dMode = BP3D.Floorplanner.floorplannerModes.DELETE;
          break;
        default:
          bp3dMode = BP3D.Floorplanner.floorplannerModes.MOVE;
      }
      blueprint3d.floorplanner.setMode(bp3dMode);
      scheduleObjectOverlayDraw();
    }
  };

  const handleUpdateFloorplan = () => {
    if (blueprint3d?.floorplanner) {
      blueprint3d.floorplanner.reset();
    }
    onStateChange('DESIGN');
  };

  const handleObjectFootprintsToggle = () => {
    setShowObjectFootprints((current) => {
      const next = !current;
      if (!next && selectedFootprint && !selectedFootprint.isCharger) {
        setSelectedFootprint(null);
        onItemUnselect();
      }
      return next;
    });
  };

  const handleChargerFootprintsToggle = () => {
    setShowChargerFootprints((current) => {
      const next = !current;
      if (!next && selectedFootprint?.isCharger) {
        setSelectedFootprint(null);
        onItemUnselect();
      }
      return next;
    });
  };

  const getButtonStyle = (isActive: boolean) => ({
    backgroundColor: isActive ? '#48BB78' : '#EEEEEE',
    color: isActive ? 'white' : '#1A202C',
    border: isActive ? 'none' : '1px solid #E2E8F0',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: isActive ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    opacity: isActive ? 0.9 : 1
  });

  const getButtonHoverStyle = (isActive: boolean) => ({
    backgroundColor: isActive ? '#48BB78' : '#E2E8F0',
    transform: isActive ? 'none' : 'translateY(-1px)',
    boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.1)' : '0 4px 8px rgba(0, 0, 0, 0.15)'
  });

  const objectFootprintsToggleStyle = {
    backgroundColor: '#FFFFFF',
    color: '#1A202C',
    border: '1px solid #E2E8F0',
    borderRadius: '999px',
    padding: '6px 12px 6px 8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    marginLeft: '4px',
  } as React.CSSProperties;

  const getSliderTrackStyle = (isActive: boolean) => ({
    width: '36px',
    height: '20px',
    borderRadius: '999px',
    backgroundColor: isActive ? '#3182CE' : '#CBD5E0',
    position: 'relative',
    transition: 'background-color 0.2s ease',
    flex: '0 0 auto',
  }) as React.CSSProperties;

  const getSliderKnobStyle = (isActive: boolean) => ({
    position: 'absolute',
    top: '2px',
    left: isActive ? '18px' : '2px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
    transition: 'left 0.2s ease',
  }) as React.CSSProperties;

  return (
    <>
      <div id="floorplanner-controls" style={{ display: 'flex', gap: '8px', padding: '12px', borderBottom: '1px solid #E2E8F0' }}>
        <button 
          id="move" 
          onClick={() => handleModeChange('MOVE')}
          style={getButtonStyle(currentMode === 'MOVE')}
          onMouseEnter={(e) => {
            if (currentMode !== 'MOVE') {
              Object.assign(e.currentTarget.style, getButtonHoverStyle(false));
            }
          }}
          onMouseLeave={(e) => {
            if (currentMode !== 'MOVE') {
              Object.assign(e.currentTarget.style, getButtonStyle(false));
            }
          }}
        >
          <FiMove style={{ marginRight: '6px' }} />
          Move Walls
        </button>
        
        <button 
          id="draw" 
          onClick={() => handleModeChange('DRAW')}
          style={getButtonStyle(currentMode === 'DRAW')}
          onMouseEnter={(e) => {
            if (currentMode !== 'DRAW') {
              Object.assign(e.currentTarget.style, getButtonHoverStyle(false));
            }
          }}
          onMouseLeave={(e) => {
            if (currentMode !== 'DRAW') {
              Object.assign(e.currentTarget.style, getButtonStyle(false));
            }
          }}
        >
          <FiEdit2 style={{ marginRight: '6px' }} />
          Draw Walls
        </button>
        
        <button 
          id="delete" 
          onClick={() => handleModeChange('DELETE')}
          style={getButtonStyle(currentMode === 'DELETE')}
          onMouseEnter={(e) => {
            if (currentMode !== 'DELETE') {
              Object.assign(e.currentTarget.style, getButtonHoverStyle(false));
            }
          }}
          onMouseLeave={(e) => {
            if (currentMode !== 'DELETE') {
              Object.assign(e.currentTarget.style, getButtonStyle(false));
            }
          }}
        >
          <FiTrash2 style={{ marginRight: '6px' }} />
          Delete Walls
        </button>

        <button
          id="toggle-object-footprints"
          type="button"
          aria-pressed={showObjectFootprints}
          onClick={handleObjectFootprintsToggle}
          style={objectFootprintsToggleStyle}
          title="Mostrar u ocultar la superficie ocupada por los objetos del plano"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }}
        >
          <span style={getSliderTrackStyle(showObjectFootprints)}>
            <span style={getSliderKnobStyle(showObjectFootprints)} />
          </span>
          <span>
            {showObjectFootprints
              ? `Objetos visibles${objectFootprintCount > 0 ? ` (${objectFootprintCount})` : ''}`
              : 'Mostrar objetos'}
          </span>
        </button>

        <button
          id="toggle-charger-footprints"
          type="button"
          aria-pressed={showChargerFootprints}
          onClick={handleChargerFootprintsToggle}
          style={objectFootprintsToggleStyle}
          title="Mostrar u ocultar los cargadores en el plano"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }}
        >
          <span style={getSliderTrackStyle(showChargerFootprints)}>
            <span style={getSliderKnobStyle(showChargerFootprints)} />
          </span>
          <span>
            {showChargerFootprints
              ? `Cargadores robot visibles${chargerFootprintCount > 0 ? ` (${chargerFootprintCount})` : ''}`
              : 'Mostrar cargadores robot'}
          </span>
        </button>
        
        <div style={{ marginLeft: 'auto' }}>
          <button 
            id="update-floorplan" 
            onClick={handleUpdateFloorplan}
            style={{
              backgroundColor: '#48BB78',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#38A169';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#48BB78';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            }}
          >
            <FiCheck style={{ marginRight: '6px' }} />
            Done
          </button>
        </div>
      </div>
      {showDrawHint && (
        <div id="draw-walls-hint" style={{ 
          padding: '8px 12px', 
          backgroundColor: '#FFF3CD', 
          border: '1px solid #FFEAA7',
          borderRadius: '4px',
          margin: '8px 12px',
          fontSize: '14px',
          color: '#856404'
        }}>
          Press the "Esc" key to stop drawing walls
        </div>
      )}
    </>
  );
};

export default Floorplanner;
