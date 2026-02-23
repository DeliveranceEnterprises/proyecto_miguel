import React, { useEffect, useState } from 'react';
import { FiMove, FiEdit2, FiTrash2, FiCheck } from 'react-icons/fi';
import { useBlueprint3D } from './Blueprint3DApp';

const Floorplanner: React.FC = () => {
  const { blueprint3d, onStateChange } = useBlueprint3D();
  const [currentMode, setCurrentMode] = useState('MOVE');
  const [showDrawHint, setShowDrawHint] = useState(false);

  useEffect(() => {
    if (blueprint3d?.floorplanner && typeof (window as any).BP3D !== 'undefined') {
      const BP3D = (window as any).BP3D;
      // Set up mode change callbacks like the original
      blueprint3d.floorplanner.modeResetCallbacks.add((mode: any) => {
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
      });

      // Set up window resize handler
      const handleResize = () => {
        handleWindowResize();
      };
      window.addEventListener('resize', handleResize);

      // Initial resize
      handleWindowResize();

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [blueprint3d]);

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
    }
  };

  const handleUpdateFloorplan = () => {
    if (blueprint3d?.floorplanner) {
      blueprint3d.floorplanner.reset();
    }
    onStateChange('DESIGN');
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


