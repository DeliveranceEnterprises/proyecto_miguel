import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import Viewer from './Viewer';
import Floorplanner from './Floorplanner';
import AddItems from './AddItems';
import AddDevices from './AddDevices';
import AddTasks from './AddTasks';
import TaskList from './TaskList';
import { useDeviceSync } from '../../hooks/useDeviceSync';
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

interface Blueprint3DInstance {
  opts: any;
  model: {
    scene: {
      addItem: (type: number, url: string, metadata: any) => void;
      itemLoadingCallbacks?: { add: (callback: Function) => void };
      itemLoadedCallbacks?: { add: (callback: Function) => void };
      getItems?: () => any[];
    };
    floorplan: {
      update: () => void;
      getRooms?: () => any[];
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
    itemSelectedCallbacks?: { add: (callback: Function) => void };
    itemUnselectedCallbacks?: { add: (callback: Function) => void };
    wallClicked?: { add: (callback: Function) => void };
    floorClicked?: { add: (callback: Function) => void };
    nothingClicked?: { add: (callback: Function) => void };
    stopSpin?: () => void;
  };
  floorplanner: {
    setMode: (mode: string) => void;
    reset: () => void;
    resizeView: () => void;
    modeResetCallbacks?: { add: (callback: Function) => void };
    mouseX: number;
    mouseY: number;
    originX?: number;
    originY?: number;
    cmPerPixel?: number;
    pixelsPerCm?: number;
  };
}

type AppState = 'DESIGN' | 'FLOORPLAN' | 'SHOP' | 'DEVICES' | 'TASKS' | 'TASK_LIST';

interface Blueprint3DContextType {
  blueprint3d: Blueprint3DInstance | null;
  appState: AppState;
  isRealMode: boolean;
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
  simulatingUidRef: React.MutableRefObject<string | null>;
}

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
  isRealMode?: boolean;
  pauseDeviceSync?: boolean;
}

export interface Blueprint3DAppRef {
  loadPlan: (planData: any) => void;
  createNewPlan: () => void;
  clearSelections: () => void;
  setControllerEnabled: (enabled: boolean) => void;
  getSceneDeviceUids: () => string[];
  setView: (state: AppState) => void;
  getBlueprint3D: () => Blueprint3DInstance | null;
}

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
  isRealMode = false,
  pauseDeviceSync = false,
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
  const simulatingUidRef = useRef<string | null>(null);

  const scriptsLoadedRef = useRef(false);
  const bp3dInstanceRef = useRef<Blueprint3DInstance | null>(null);
  const controllerEnabledRef = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const initTimeoutRef = useRef<number | null>(null);

  useDeviceSync(blueprint3d, simulatingUidRef, isRealMode, pauseDeviceSync);

  useEffect(() => {
    componentMounted.current = true;
    return () => {
      componentMounted.current = false;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (initTimeoutRef.current !== null) {
        window.clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      bp3dInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (onSelectedItemChange) onSelectedItemChange(selectedItem);
  }, [selectedItem, onSelectedItemChange]);

  useEffect(() => {
    if (onSelectedWallChange) onSelectedWallChange(selectedWall);
  }, [selectedWall, onSelectedWallChange]);

  useEffect(() => {
    if (onSelectedFloorChange) onSelectedFloorChange(selectedFloor);
  }, [selectedFloor, onSelectedFloorChange]);

  useEffect(() => {
    if (scriptsLoadedRef.current) return;
    scriptsLoadedRef.current = true;

    let cancelled = false;

    const loadScript = (src: string): Promise<void> =>
      new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
        if (existing) {
          if (existing.dataset.loaded === 'true') {
            resolve();
            return;
          }

          const onLoad = () => {
            existing.dataset.loaded = 'true';
            resolve();
          };
          const onError = () => reject(new Error(`Failed to load script: ${src}`));

          existing.addEventListener('load', onLoad, { once: true });
          existing.addEventListener('error', onError, { once: true });
          return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = false;

        script.onload = () => {
          script.dataset.loaded = 'true';
          resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

        document.head.appendChild(script);
      });

    const loadBlueprint3D = async () => {
      try {
        if ((window as any).BP3D && (window as any).THREE && (window as any).jQuery) {
          if (!cancelled) setIsInitialized(true);
          return;
        }

        await loadScript(jquerySrc);
        await loadScript(threeSrc);

        try {
          await loadScript('/plan3d/js/GLTFLoader.js');
        } catch (error) {
          console.warn('Failed to load GLTFLoader:', error);
        }

        await loadScript(bp3dSrc);

        if (cancelled) return;

        if (typeof (window as any).BP3D === 'undefined' && typeof BP3D !== 'undefined') {
          (window as any).BP3D = BP3D;
        }

        if (typeof (window as any).BP3D !== 'undefined') {
          setIsInitialized(true);
        } else {
          console.error('BP3D not found globally after loading');
        }
      } catch (error) {
        console.error('Failed to initialize Blueprint3D:', error);
      }
    };

    void loadBlueprint3D();

    return () => {
      cancelled = true;
    };
  }, [jquerySrc, threeSrc, bp3dSrc]);

  useEffect(() => {
    if (!isInitialized || !componentMounted.current || bp3dInstanceRef.current) {
      return;
    }

    const initializeBlueprint3D = () => {
      const viewerElement = document.getElementById('viewer');
      const floorplannerCanvas = document.getElementById('floorplanner-canvas');

      if (!viewerElement || !floorplannerCanvas) {
        return;
      }

      if (!(window as any).jQuery?.('#viewer')?.length) {
        console.error('jQuery cannot find #viewer element');
        return;
      }

      const THREE = (window as any).THREE;
      const BP3DLib = (window as any).BP3D ?? (typeof BP3D !== 'undefined' ? BP3D : undefined);

      if (!THREE || !THREE.PerspectiveCamera || !THREE.WebGLRenderer) {
        console.error('THREE.js library not properly loaded');
        return;
      }

      if (!BP3DLib?.Blueprint3d) {
        console.error('Blueprint3D library not available');
        return;
      }

      try {
        const textureBase = assetsBaseUrl.replace(/\/$/, '') + '/';
        if (
          THREE.ImageUtils &&
          typeof THREE.ImageUtils.loadTexture === 'function' &&
          !THREE.ImageUtils.__wrappedByApp
        ) {
          const originalLoadTexture = THREE.ImageUtils.loadTexture.bind(THREE.ImageUtils);
          THREE.ImageUtils.loadTexture = function (url: string, ...rest: any[]) {
            const rawUrl = String(url ?? '');

            let fixedUrl = rawUrl;
            if (!/^(https?:\/\/|data:|blob:|\/)/.test(rawUrl)) {
              if (rawUrl.startsWith('plan3d/')) {
                fixedUrl = '/' + rawUrl;
              } else if (rawUrl.startsWith('models/') || rawUrl.startsWith('rooms/')) {
                fixedUrl = textureBase + rawUrl;
              }
            }
            return originalLoadTexture(fixedUrl, ...rest as [any]);
          };
          THREE.ImageUtils.__wrappedByApp = true;
        }
      } catch (e) {
        console.warn('Could not wrap THREE.ImageUtils.loadTexture:', e);
      }

      const opts = {
        floorplannerElement: 'floorplanner-canvas',
        threeElement: '#viewer',
        threeCanvasElement: null,
        textureDir: assetsBaseUrl.replace(/\/$/, '') + '/rooms/textures/',
        widget: false,
      };

      try {
        const bp3d = new BP3DLib.Blueprint3d(opts) as Blueprint3DInstance;

        bp3dInstanceRef.current = bp3d;
        setBlueprint3d(bp3d);

        bp3d.three?.itemSelectedCallbacks?.add?.((item: any) => {
          setSelectedItem(item);
        });

        bp3d.three?.itemUnselectedCallbacks?.add?.(() => {
          setSelectedItem(null);
        });

        bp3d.model?.scene?.itemLoadingCallbacks?.add?.(() => setIsLoading(true));
        bp3d.model?.scene?.itemLoadedCallbacks?.add?.(() => setIsLoading(false));

        bp3d.three?.wallClicked?.add?.((wall: any) => {
          setSelectedWall(wall);
          setSelectedFloor(null);
          setSelectedItem(null);
        });

        bp3d.three?.floorClicked?.add?.((floor: any) => {
          setSelectedFloor(floor);
          setSelectedWall(null);
          setSelectedItem(null);
        });

        bp3d.three?.nothingClicked?.add?.(() => {
          setSelectedWall(null);
          setSelectedFloor(null);
        });

        const controller = bp3d.three?.getController?.();
        if (controller) {
          controller.enabled = controllerEnabledRef.current;
        }

        viewerElement.style.outline = 'none';
        viewerElement.tabIndex = -1;

        bp3d.three?.updateWindowSize?.();

        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = new ResizeObserver(() => {
          bp3d.three?.updateWindowSize?.();
        });
        resizeObserverRef.current.observe(viewerElement);
      } catch (error) {
        console.error('Error creating Blueprint3D instance:', error);
      }
    };

    rafRef.current = requestAnimationFrame(() => {
      initTimeoutRef.current = window.setTimeout(() => {
        initializeBlueprint3D();
      }, 100);
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (initTimeoutRef.current !== null) {
        window.clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      bp3dInstanceRef.current = null;
    };
  }, [isInitialized, assetsBaseUrl]);

  useEffect(() => {
    const controller = blueprint3d?.three?.getController?.();
    if (controller) {
      controller.enabled = controllerEnabledRef.current;
    }
  }, [blueprint3d, appState, currentUID]);


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
                blueprint3d.floorplanner?.reset?.();
              }, 50);
            }
          }, 100);
        }
      } else if (newState === 'DESIGN') {
        blueprint3d.three?.updateWindowSize?.();
        setTimeout(() => {
          blueprint3d.three?.centerCamera?.();
        }, 100);

        blueprint3d.model?.floorplan?.update?.();
      }

      blueprint3d.three?.stopSpin?.();

      const controller = blueprint3d.three?.getController?.();
      controller?.setSelectedObject?.(null);
    }
  };

  const handleItemSelect = (item: any) => setSelectedItem(item);
  const handleItemUnselect = () => setSelectedItem(null);
  const handleLoadingChange = (loading: boolean) => setIsLoading(loading);
  const handleWallSelect = (wall: any) => {
    setSelectedWall(wall);
    setSelectedFloor(null);
    setSelectedItem(null);
  };
  const handleFloorSelect = (floor: any) => {
    setSelectedFloor(floor);
    setSelectedWall(null);
    setSelectedItem(null);
  };
  const handleTextureReset = () => {
    setSelectedWall(null);
    setSelectedFloor(null);
  };

  const handleClearSelections = () => {
    setSelectedWall(null);
    setSelectedFloor(null);
    setSelectedItem(null);

    const controller = blueprint3d?.three?.getController?.();
    controller?.setSelectedObject?.(null);
  };

  const handleUIDChange = (uid: string) => setCurrentUID(uid);

  const handleCreateNewPlan = () => {
    if (blueprint3d?.model) {
      const newUID = generateUID();
      const defaultFloorplan = {
        uid: newUID,
        floorplan: {
          corners: {
            "f90da5e3-9e0e-eba7-173d-eb0b071e838e": { x: 204.85099999999989, y: 289.052 },
            "da026c08-d76a-a944-8e7b-096b752da9ed": { x: 672.2109999999999, y: 289.052 },
            "4e3d65cb-54c0-0681-28bf-bddcc7bdb571": { x: 672.2109999999999, y: -178.308 },
            "71d4f128-ae80-3d58-9bd2-711c6ce6cdf2": { x: 204.85099999999989, y: -178.308 }
          },
          walls: [
            { corner1: "71d4f128-ae80-3d58-9bd2-711c6ce6cdf2", corner2: "f90da5e3-9e0e-eba7-173d-eb0b071e838e", frontTexture: { url: "/plan3d/rooms/textures/wallmap.png", stretch: true, scale: 0 }, backTexture: { url: "/plan3d/rooms/textures/wallmap.png", stretch: true, scale: 0 } },
            { corner1: "f90da5e3-9e0e-eba7-173d-eb0b071e838e", corner2: "da026c08-d76a-a944-8e7b-096b752da9ed", frontTexture: { url: "/plan3d/rooms/textures/wallmap.png", stretch: true, scale: 0 }, backTexture: { url: "/plan3d/rooms/textures/wallmap.png", stretch: true, scale: 0 } },
            { corner1: "da026c08-d76a-a944-8e7b-096b752da9ed", corner2: "4e3d65cb-54c0-0681-28bf-bddcc7bdb571", frontTexture: { url: "/plan3d/rooms/textures/wallmap.png", stretch: true, scale: 0 }, backTexture: { url: "/plan3d/rooms/textures/wallmap.png", stretch: true, scale: 0 } },
            { corner1: "4e3d65cb-54c0-0681-28bf-bddcc7bdb571", corner2: "71d4f128-ae80-3d58-9bd2-711c6ce6cdf2", frontTexture: { url: "/plan3d/rooms/textures/wallmap.png", stretch: true, scale: 0 }, backTexture: { url: "/plan3d/rooms/textures/wallmap.png", stretch: true, scale: 0 } }
          ],
          wallTextures: [],
          floorTextures: {},
          newFloorTextures: {
            "4e3d65cb-54c0-0681-28bf-bddcc7bdb571,71d4f128-ae80-3d58-9bd2-711c6ce6cdf2,da026c08-d76a-a944-8e7b-096b752da9ed,f90da5e3-9e0e-eba7-173d-eb0b071e838e": {
              url: "/plan3d/rooms/textures/hardwood.png",
              scale: 400
            }
          }
        },
        items: []
      };

      blueprint3d.model.loadSerialized(JSON.stringify(defaultFloorplan));
      handleUIDChange(newUID);

      setTimeout(() => {
        try {
          const rooms = blueprint3d?.model?.floorplan?.getRooms?.();
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

      if (planData.uid) {
        handleUIDChange(planData.uid);
      }

      setTimeout(() => {
        try {
          const rooms = blueprint3d?.model?.floorplan?.getRooms?.();
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
      controllerEnabledRef.current = enabled;
      const controller = blueprint3d?.three?.getController?.();
      if (controller) {
        controller.enabled = enabled;
      }
    },
    getSceneDeviceUids: (): string[] => {
      const scene: any = blueprint3d?.model?.scene;
      const items: any[] = scene?.getItems?.() ?? [];
      return items
        .filter((item: any) => !!item.device_uid)
        .map((item: any) => item.device_uid as string);
    },
    setView: (state: AppState) => {
      handleStateChange(state);
    },
    getBlueprint3D: () => blueprint3d,
  }));

  const isTasksMode = appState === 'TASKS';
  const isTaskListMode = appState === 'TASK_LIST';
  const isSidePanel = isTasksMode || isTaskListMode;

  return (
    <Blueprint3DContext.Provider
      value={{
        blueprint3d,
        appState,
        isRealMode,
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
        simulatingUidRef,
        onWaypointPick: (cb) => {
          const viewerEl = document.getElementById('viewer');
          if (!viewerEl) return () => {};

          let wasMoved = false;
          const onMouseDown = () => { wasMoved = false; };
          const onMouseMove = () => { wasMoved = true; };

          const handler = (e: MouseEvent) => {
            if (wasMoved) return;
            if (!blueprint3d?.three) return;

            const camera = blueprint3d.three.getCamera?.();
            const bpScene = blueprint3d.three.getScene?.();
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
      }}
    >
      <div className="blueprint3d-app">
        <div className="container-fluid">
          <div className="row main-row">
            <div
              className={`col-xs-12 main${isSidePanel ? ' tasks-mode' : ''}`}
              style={isSidePanel ? {
                display: 'flex',
                flexDirection: 'row',
                height: '100%',
                overflow: 'hidden',
                position: 'relative',
              } : { position: 'relative' }}
            >
              <div
                id="viewer"
                className={appState === 'DESIGN' || appState === 'TASKS' || appState === 'TASK_LIST' ? 'active' : ''}
                style={isSidePanel ? {
                  flex: '1 1 0%',
                  minWidth: 0,
                  height: '100%',
                  position: 'relative',
                } : undefined}
              />

              <div
                id="viewer-controls"
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              >
                <Viewer />
              </div>

              <div
                id="floorplanner"
                className={appState === 'FLOORPLAN' ? 'active' : ''}
              >
                <canvas id="floorplanner-canvas" />
                <Floorplanner />
              </div>

              <div id="add-items" className={appState === 'SHOP' ? 'active' : ''}>
                <AddItems />
              </div>

              <div id="add-devices" className={appState === 'DEVICES' ? 'active' : ''}>
                <AddDevices />
              </div>

              {isTasksMode && (
                <div
                  id="add-tasks"
                  className="active"
                  style={{
                    flex: '0 0 340px',
                    width: '340px',
                    height: '100%',
                    overflowY: 'auto',
                    borderLeft: '1px solid #E2E8F0',
                    background: '#FAFAFA',
                    boxShadow: '-2px 0 12px rgba(0,0,0,0.07)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <AddTasks />
                </div>
              )}

              {isTaskListMode && (
                <div
                  id="task-list"
                  className="active"
                  style={{
                    flex: '0 0 360px',
                    width: '360px',
                    height: '100%',
                    overflowY: 'auto',
                    borderLeft: '1px solid #E2E8F0',
                    background: '#FAFAFA',
                    boxShadow: '-2px 0 12px rgba(0,0,0,0.07)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <TaskList />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Blueprint3DContext.Provider>
  );
});

Blueprint3DApp.displayName = 'Blueprint3DApp';

export default Blueprint3DApp;