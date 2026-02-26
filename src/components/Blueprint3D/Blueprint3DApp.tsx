import React, { useEffect, useRef, useState } from 'react';
import Viewer from './Viewer';
import Floorplanner from './Floorplanner';
import AddItems from './AddItems';
import AddDevices from './AddDevices';
import AddTasks from './AddTasks';
import { generateUID } from './utils';

// Declare global window interface
declare global {
  interface Window {
    BP3D: any;
    jQuery: any;
    THREE: any;
  }
  const BP3D: any;
}

// Define the Blueprint3D class structure based on the original code
interface Blueprint3DInstance {
  opts: any;
  model: {
    scene: {
      addItem: (type: number, url: string, metadata: any) => void;
      itemLoadingCallbacks: { add: (callback: Function) => void };
      itemLoadedCallbacks: { add: (callback: Function) => void };
    };
    floorplan: {
      update: () => void;
    };
    loadSerialized: (data: string) => void;
    exportSerialized: () => string;
  };
  three: {
    controls: {
      dollyIn: (factor: number) => void;
      dollyOut: (factor: number) => void;
      panXY: (x: number, y: number) => void;
      update: () => void;
    };
    centerCamera: () => void;
    updateWindowSize: () => void;
    getController: () => { setSelectedObject: (obj: any) => void; enabled: boolean };
    getCamera: () => any;
    getScene: () => any;
    needsUpdate: () => void;
    itemSelectedCallbacks: { add: (callback: Function) => void };
    itemUnselectedCallbacks: { add: (callback: Function) => void };
    wallClicked: { add: (callback: Function) => void };
    floorClicked: { add: (callback: Function) => void };
    nothingClicked: { add: (callback: Function) => void };
    stopSpin: () => void;
  };
  floorplanner: {
    setMode: (mode: string) => void;
    reset: () => void;
    resizeView: () => void;
    modeResetCallbacks: { add: (callback: Function) => void };
    mouseX: number;
    mouseY: number;
  };
}

// Define the application states
type AppState = 'DESIGN' | 'FLOORPLAN' | 'SHOP' | 'DEVICES' | 'TASKS';

// Define the Blueprint3D context
interface Blueprint3DContextType {
  blueprint3d: Blueprint3DInstance | null;
  appState: AppState;
  selectedItem: any;
  isLoading: boolean;
  selectedWall: any;
  selectedFloor: any;
  assetsBaseUrl: string;
  currentUID: string;
  onStateChange: (state: AppState) => void;
  onItemSelect: (item: any) => void;
  onItemUnselect: () => void;
  onLoadingChange: (loading: boolean) => void;
  onWallSelect: (wall: any) => void;
  onFloorSelect: (floor: any) => void;
  onTextureReset: () => void;
  onUIDChange: (uid: string) => void;
  createNewPlan: () => void;
  loadPlan: (planData: any) => void;
  onSceneSaved?: (sceneId: string) => void;
  onEditingModeChange?: (editingMode: boolean) => void;
  onSelectedItemChange?: (item: any) => void;
  onSelectedWallChange?: (wall: any) => void;
  onSelectedFloorChange?: (floor: any) => void;
  onWaypointPick?: (callback: (x: number, z: number) => void) => (() => void);
}

// Create the context
export const Blueprint3DContext = React.createContext<Blueprint3DContextType | null>(null);

export interface Blueprint3DAppProps {
  jquerySrc?: string;
  threeSrc?: string;
  bp3dSrc?: string;
  assetsBaseUrl?: string;
  onSceneSaved?: (sceneId: string) => void;
  onEditingModeChange?: (editingMode: boolean) => void;
  onSelectedItemChange?: (item: any) => void;
  onSelectedWallChange?: (wall: any) => void;
  onSelectedFloorChange?: (floor: any) => void;
}

export interface Blueprint3DAppRef {
  loadPlan: (planData: any) => void;
  createNewPlan: () => void;
  clearSelections: () => void;
  setControllerEnabled: (enabled: boolean) => void;
}

// Hook to use the Blueprint3D context
export const useBlueprint3D = () => {
  const context = React.useContext(Blueprint3DContext);
  if (!context) {
    throw new Error('useBlueprint3D must be used within a Blueprint3DProvider');
  }
  return context;
};

const Blueprint3DApp = React.forwardRef<Blueprint3DAppRef, Blueprint3DAppProps>(({
  jquerySrc = '/plan3d/js/jquery.js',
  threeSrc = '/plan3d/js/three.min.js',
  bp3dSrc = '/plan3d/js/blueprint3d.js',
  assetsBaseUrl = '/plan3d/',
  onSceneSaved,
  onEditingModeChange,
  onSelectedItemChange,
  onSelectedWallChange,
  onSelectedFloorChange,
}, ref) => {
  const [appState, setAppState] = useState<AppState>('DESIGN');
  const [blueprint3d, setBlueprint3d] = useState<Blueprint3DInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedWall, setSelectedWall] = useState<any>(null);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUID, setCurrentUID] = useState<string>('');
  const componentMounted = useRef(false);

  // Track when component mounts
  useEffect(() => {
    componentMounted.current = true;
    return () => {
      componentMounted.current = false;
    };
  }, []);

  // Notify parent when selected item changes
  useEffect(() => {
    if (onSelectedItemChange) {
      onSelectedItemChange(selectedItem);
    }
  }, [selectedItem, onSelectedItemChange]);

  // Notify parent when selected wall changes
  useEffect(() => {
    if (onSelectedWallChange) {
      onSelectedWallChange(selectedWall);
    }
  }, [selectedWall, onSelectedWallChange]);

  // Notify parent when selected floor changes
  useEffect(() => {
    if (onSelectedFloorChange) {
      onSelectedFloorChange(selectedFloor);
    }
  }, [selectedFloor, onSelectedFloorChange]);

  useEffect(() => {
    // Load and initialize Blueprint3D library
    const loadBlueprint3D = async () => {
      try {
        console.log('Loading Blueprint3D library...');

        const jqueryScript = document.createElement('script');
        jqueryScript.src = jquerySrc;
        jqueryScript.onerror = (error) => {
          console.error('Failed to load jQuery:', error);
        };
        jqueryScript.onload = () => {
          console.log('jQuery loaded');

          const threeScript = document.createElement('script');
          threeScript.src = threeSrc;
          threeScript.onerror = (error) => {
            console.error('Failed to load Three.js:', error);
          };
          threeScript.onload = () => {
            console.log('Three.js loaded');

            const gltfLoaderScript = document.createElement('script');
            gltfLoaderScript.src = '/plan3d/js/GLTFLoader.js';
            gltfLoaderScript.onerror = (error) => {
              console.warn('Failed to load GLTFLoader:', error);
              loadBp3d();
            };
            gltfLoaderScript.onload = () => {
              console.log('GLTFLoader loaded');
              loadBp3d();
            };
            document.head.appendChild(gltfLoaderScript);

            function loadBp3d() {
              const bp3dScript = document.createElement('script');
              bp3dScript.src = bp3dSrc;
              bp3dScript.onerror = (error) => {
                console.error('Failed to load Blueprint3D script:', error);
              };
              bp3dScript.onload = () => {
                console.log('Blueprint3D library loaded');
                setTimeout(() => {
                  if (typeof BP3D !== 'undefined') {
                    (window as any).BP3D = BP3D;
                    setIsInitialized(true);
                  } else {
                    console.error('BP3D not found globally after loading');
                  }
                }, 200);
              };
              document.head.appendChild(bp3dScript);
            }
          };

          document.head.appendChild(threeScript);
        };

        document.head.appendChild(jqueryScript);

      } catch (error) {
        console.error('Failed to initialize Blueprint3D:', error);
      }
    };

    loadBlueprint3D();
  }, []);

  // Initialize Blueprint3D after DOM elements are available
  useEffect(() => {
    if (!isInitialized || typeof BP3D === 'undefined' || !componentMounted.current) {
      return;
    }

    const initializeBlueprint3D = (retryCount = 0) => {
      try {
        const viewerElement = document.getElementById('viewer');
        const floorplannerElement = document.getElementById('floorplanner-canvas');

        if (!viewerElement || !floorplannerElement) {
          if (retryCount < 20) {
            setTimeout(() => initializeBlueprint3D(retryCount + 1), 50);
            return;
          } else {
            console.error('Failed to find DOM elements after 20 attempts.');
            return;
          }
        }

        const opts = {
          floorplannerElement: 'floorplanner-canvas',
          threeElement: '#viewer',
          threeCanvasElement: null,
          textureDir: assetsBaseUrl.replace(/\/$/, '') + '/rooms/textures/',
          widget: false
        };

        const jQueryViewer = (window as any).$('#viewer');
        if (jQueryViewer.length === 0) {
          console.error('jQuery cannot find #viewer element!');
          return;
        }

        const THREE = (window as any).THREE;
        if (!THREE || !THREE.PerspectiveCamera || !THREE.WebGLRenderer) {
          console.error('THREE.js library not properly loaded!');
          return;
        }

        try {
          const textureBase = assetsBaseUrl.replace(/\/$/, '') + '/';
          if (THREE.ImageUtils && typeof THREE.ImageUtils.loadTexture === 'function') {
            const originalLoadTexture = THREE.ImageUtils.loadTexture.bind(THREE.ImageUtils);
            THREE.ImageUtils.loadTexture = function (url: string, ...rest: any[]) {
              const fixedUrl = /^(https?:\/\/|data:|\/)/.test(url) ? url : (textureBase + url);
              return originalLoadTexture(fixedUrl, ...rest as [any]);
            };
          }
        } catch (e) {
          console.warn('Could not wrap THREE.ImageUtils.loadTexture:', e);
        }

        const bp3d = new BP3D.Blueprint3d(opts);

        if (bp3d.three) {
          if (bp3d.three.itemSelectedCallbacks) {
            bp3d.three.itemSelectedCallbacks.add((item: any) => {
              setSelectedItem(item);
            });
          }

          if (bp3d.three.itemUnselectedCallbacks) {
            bp3d.three.itemUnselectedCallbacks.add(() => {
              setSelectedItem(null);
            });
          }

          if (bp3d.model && bp3d.model.scene) {
            if (bp3d.model.scene.itemLoadingCallbacks) {
              bp3d.model.scene.itemLoadingCallbacks.add(() => setIsLoading(true));
            }
            if (bp3d.model.scene.itemLoadedCallbacks) {
              bp3d.model.scene.itemLoadedCallbacks.add(() => setIsLoading(false));
            }
          }

          if (bp3d.three.wallClicked) {
            bp3d.three.wallClicked.add((wall: any) => {
              setSelectedWall(wall);
              setSelectedFloor(null);
              setSelectedItem(null);
            });
          }

          if (bp3d.three.floorClicked) {
            bp3d.three.floorClicked.add((floor: any) => {
              setSelectedFloor(floor);
              setSelectedWall(null);
              setSelectedItem(null);
            });
          }

          if (bp3d.three.nothingClicked) {
            bp3d.three.nothingClicked.add(() => {
              setSelectedWall(null);
              setSelectedFloor(null);
            });
          }

          if (bp3d.three.getController) {
            const controller = bp3d.three.getController();
            if (controller) {
              controller.enabled = false;
            }
          }

          if (bp3d.three.updateWindowSize) {
            setTimeout(() => {
              bp3d.three.updateWindowSize();
              const viewerElement = document.getElementById('viewer');
              if (viewerElement) {
                viewerElement.style.outline = 'none';
                viewerElement.tabIndex = -1;
              }
            }, 100);
          }
        }

        setBlueprint3d(bp3d);
      } catch (error) {
        console.error('Error creating Blueprint3D instance:', error);
      }
    };

    requestAnimationFrame(() => {
      setTimeout(() => initializeBlueprint3D(0), 100);
    });
  }, [isInitialized]);

  const handleStateChange = (newState: AppState) => {
    setAppState(newState);

    if (blueprint3d) {
      if (newState === 'FLOORPLAN') {
        if (blueprint3d.floorplanner) {
          blueprint3d.floorplanner.reset();
          setTimeout(() => {
            const floorplannerElement = document.getElementById('floorplanner');
            if (floorplannerElement && blueprint3d.floorplanner) {
              const rect = floorplannerElement.getBoundingClientRect();
              const height = window.innerHeight - rect.top;
              floorplannerElement.style.height = height + 'px';
              blueprint3d.floorplanner.resizeView();
              setTimeout(() => {
                if (blueprint3d.floorplanner?.reset) {
                  blueprint3d.floorplanner.reset();
                }
              }, 50);
            }
          }, 100);
        }
      } else if (newState === 'DESIGN') {
        if (blueprint3d.three) {
          blueprint3d.three.updateWindowSize();
          setTimeout(() => {
            blueprint3d.three?.centerCamera?.();
          }, 100);
        }
        if (blueprint3d.model?.floorplan) {
          blueprint3d.model.floorplan.update();
        }
      } else if (newState === 'TASKS') {
        // Give the flex layout time to render, then resize the 3D canvas
        setTimeout(() => {
          blueprint3d.three?.updateWindowSize?.();
          console.log('[Blueprint3DApp] Scene resized for TASKS split layout');
        }, 150);
      }

      if (blueprint3d.three?.stopSpin) {
        blueprint3d.three.stopSpin();
      }

      if (blueprint3d.three?.getController) {
        const controller = blueprint3d.three.getController();
        if (controller?.setSelectedObject) {
          controller.setSelectedObject(null);
        }
      }
    }
  };

  const handleItemSelect = (item: any) => setSelectedItem(item);
  const handleItemUnselect = () => setSelectedItem(null);
  const handleLoadingChange = (loading: boolean) => setIsLoading(loading);
  const handleWallSelect = (wall: any) => { setSelectedWall(wall); setSelectedFloor(null); setSelectedItem(null); };
  const handleFloorSelect = (floor: any) => { setSelectedFloor(floor); setSelectedWall(null); setSelectedItem(null); };
  const handleTextureReset = () => { setSelectedWall(null); setSelectedFloor(null); };

  const handleClearSelections = () => {
    setSelectedWall(null);
    setSelectedFloor(null);
    setSelectedItem(null);
    if (blueprint3d?.three?.getController) {
      const controller = blueprint3d.three.getController();
      if (controller?.setSelectedObject) {
        controller.setSelectedObject(null);
      }
    }
  };

  const handleUIDChange = (uid: string) => setCurrentUID(uid);

  const handleCreateNewPlan = () => {
    if (blueprint3d?.model) {
      const newUID = generateUID();
      const defaultFloorplan = {
        "uid": newUID,
        "floorplan": {
          "corners": {
            "f90da5e3-9e0e-eba7-173d-eb0b071e838e": { "x": 204.85099999999989, "y": 289.052 },
            "da026c08-d76a-a944-8e7b-096b752da9ed": { "x": 672.2109999999999, "y": 289.052 },
            "4e3d65cb-54c0-0681-28bf-bddcc7bdb571": { "x": 672.2109999999999, "y": -178.308 },
            "71d4f128-ae80-3d58-9bd2-711c6ce6cdf2": { "x": 204.85099999999989, "y": -178.308 }
          },
          "walls": [
            { "corner1": "71d4f128-ae80-3d58-9bd2-711c6ce6cdf2", "corner2": "f90da5e3-9e0e-eba7-173d-eb0b071e838e", "frontTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 }, "backTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 } },
            { "corner1": "f90da5e3-9e0e-eba7-173d-eb0b071e838e", "corner2": "da026c08-d76a-a944-8e7b-096b752da9ed", "frontTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 }, "backTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 } },
            { "corner1": "da026c08-d76a-a944-8e7b-096b752da9ed", "corner2": "4e3d65cb-54c0-0681-28bf-bddcc7bdb571", "frontTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 }, "backTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 } },
            { "corner1": "4e3d65cb-54c0-0681-28bf-bddcc7bdb571", "corner2": "71d4f128-ae80-3d58-9bd2-711c6ce6cdf2", "frontTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 }, "backTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 } }
          ],
          "wallTextures": [],
          "floorTextures": {},
          "newFloorTextures": {
            "4e3d65cb-54c0-0681-28bf-bddcc7bdb571,71d4f128-ae80-3d58-9bd2-711c6ce6cdf2,da026c08-d76a-a944-8e7b-096b752da9ed,f90da5e3-9e0e-eba7-173d-eb0b071e838e": {
              "url": "/plan3d/rooms/textures/hardwood.png",
              "scale": 400
            }
          }
        },
        "items": []
      };
      blueprint3d.model.loadSerialized(JSON.stringify(defaultFloorplan));
      handleUIDChange(newUID);
      setTimeout(() => {
        try {
          const rooms = (blueprint3d as any)?.model?.floorplan?.getRooms?.();
          if (rooms?.length) {
            rooms.forEach((room: any) => room.setTexture('/plan3d/rooms/textures/hardwood.png', true, 400));
          }
        } catch (e) {
          console.warn('Could not apply floor textures:', e);
        }
      }, 0);
    }
  };

  const handleLoadPlan = (planData: any) => {
    if (blueprint3d?.model) {
      handleStateChange('DESIGN');
      blueprint3d.model.loadSerialized(JSON.stringify(planData));
      if (planData.uid) handleUIDChange(planData.uid);
      setTimeout(() => {
        try {
          const rooms = (blueprint3d as any)?.model?.floorplan?.getRooms?.();
          if (rooms?.length && planData.floorplan?.newFloorTextures) {
            rooms.forEach((room: any) => {
              const textureKeys = Object.keys(planData.floorplan.newFloorTextures);
              if (textureKeys.length > 0) {
                const textureConfig = planData.floorplan.newFloorTextures[textureKeys[0]];
                room.setTexture(textureConfig.url, true, textureConfig.scale || 400);
              }
            });
          }
        } catch (e) {
          console.warn('Could not apply floor textures:', e);
        }
      }, 100);
    }
  };

  React.useImperativeHandle(ref, () => ({
    loadPlan: handleLoadPlan,
    createNewPlan: handleCreateNewPlan,
    clearSelections: handleClearSelections,
    setControllerEnabled: (enabled: boolean) => {
      if (blueprint3d?.three?.getController) {
        const controller = blueprint3d.three.getController();
        if (controller) {
          controller.enabled = enabled;
        }
      }
    },
  }));

  // ─── Styles for the TASKS split layout ───────────────────────────────────────
  const isTasksMode = appState === 'TASKS';

  return (
    <Blueprint3DContext.Provider value={{
      blueprint3d,
      appState,
      selectedItem,
      isLoading,
      selectedWall,
      selectedFloor,
      assetsBaseUrl,
      currentUID,
      onStateChange: handleStateChange,
      onItemSelect: handleItemSelect,
      onItemUnselect: handleItemUnselect,
      onLoadingChange: handleLoadingChange,
      onWallSelect: handleWallSelect,
      onFloorSelect: handleFloorSelect,
      onTextureReset: handleTextureReset,
      onUIDChange: handleUIDChange,
      createNewPlan: handleCreateNewPlan,
      loadPlan: handleLoadPlan,
      onSceneSaved,
      onEditingModeChange,
      onSelectedItemChange,
      onSelectedWallChange,
      onSelectedFloorChange,
      onWaypointPick: (cb) => {
        const viewerEl = document.getElementById('viewer');
        if (!viewerEl) return () => { };

        let wasMoved = false;
        const onMouseDown = () => { wasMoved = false; };
        const onMouseMove = () => { wasMoved = true; };

        const handler = (e: MouseEvent) => {
          if (wasMoved) return;
          if (!blueprint3d?.three) return;
          const camera = blueprint3d.three.getCamera();
          const bpScene = blueprint3d.three.getScene();
          if (!camera || !bpScene) return;

          const THREE = (window as any).THREE;
          if (!THREE) return;

          const rect = viewerEl.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          );

          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, camera);

          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const target = new THREE.Vector3();
          const hit = raycaster.ray.intersectPlane(groundPlane, target);
          if (hit) cb(target.x, target.z);
        };

        viewerEl.addEventListener('mousedown', onMouseDown);
        viewerEl.addEventListener('mousemove', onMouseMove);
        viewerEl.addEventListener('mouseup', handler as EventListener);
        return () => {
          viewerEl.removeEventListener('mousedown', onMouseDown);
          viewerEl.removeEventListener('mousemove', onMouseMove);
          viewerEl.removeEventListener('mouseup', handler as EventListener);
        };
      },
    }}>

      <div className="blueprint3d-app">
        <div className="container-fluid">
          <div className="row main-row">
            {/*
             * LAYOUT:
             *   - TASKS mode  → flex row: [viewer flex:1] | [AddTasks panel 340px]
             *   - Other modes → single column as before
             */}
            <div
              className={`col-xs-12 main${isTasksMode ? ' tasks-mode' : ''}`}
              style={isTasksMode ? {
                display: 'flex',
                flexDirection: 'row',
                height: '100%',
                overflow: 'hidden',
              } : {}}
            >
              {/* ── 3D Viewer ─────────────────────────────────────────────── */}
              <div
                id="viewer"
                className={appState === 'DESIGN' || appState === 'TASKS' ? 'active' : ''}
                style={isTasksMode ? {
                  flex: '1 1 0%',
                  minWidth: 0,
                  height: '100%',
                  cursor: 'crosshair',
                  position: 'relative',
                } : undefined}
              >
                <Viewer />
              </div>

              {/* ── Floorplanner ──────────────────────────────────────────── */}
              <div
                id="floorplanner"
                className={appState === 'FLOORPLAN' ? 'active' : ''}
              >
                <canvas id="floorplanner-canvas" />
                <Floorplanner />
              </div>

              {/* ── Add Items ─────────────────────────────────────────────── */}
              <div id="add-items" className={appState === 'SHOP' ? 'active' : ''}>
                <AddItems />
              </div>

              {/* ── Add Devices ───────────────────────────────────────────── */}
              <div id="add-devices" className={appState === 'DEVICES' ? 'active' : ''}>
                <AddDevices />
              </div>

              {/* ── Add Tasks — SIDE PANEL (not overlay) ──────────────────── */}
              <div
                id="add-tasks"
                className={appState === 'TASKS' ? 'active' : ''}
                style={isTasksMode ? {
                  flex: '0 0 340px',
                  width: '340px',
                  height: '100%',
                  overflowY: 'auto',
                  borderLeft: '1px solid #E2E8F0',
                  background: '#FAFAFA',
                  boxShadow: '-2px 0 12px rgba(0,0,0,0.07)',
                  display: 'flex',
                  flexDirection: 'column',
                } : undefined}
              >
                <AddTasks />
              </div>

            </div>
          </div>
        </div>
      </div>
    </Blueprint3DContext.Provider>
  );
});

Blueprint3DApp.displayName = 'Blueprint3DApp';

export default Blueprint3DApp;