import React, { useEffect, useRef, useState } from 'react';
import Viewer from './Viewer';
import Floorplanner from './Floorplanner';
import AddItems from './AddItems';
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
  };
}

// Define the application states
type AppState = 'DESIGN' | 'FLOORPLAN' | 'SHOP';

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

        // Load jQuery first (required by Blueprint3D)
        const jqueryScript = document.createElement('script');
        jqueryScript.src = jquerySrc;
        jqueryScript.onerror = (error) => {
          console.error('Failed to load jQuery:', error);
        };
        jqueryScript.onload = () => {
          console.log('jQuery loaded');
          console.log('jQuery version:', (window as any).jQuery?.fn?.jquery || 'unknown');

          // Load Three.js
          const threeScript = document.createElement('script');
          threeScript.src = threeSrc;
          threeScript.onerror = (error) => {
            console.error('Failed to load Three.js:', error);
          };
          threeScript.onload = () => {
            console.log('Three.js loaded');
            console.log('Three.js version:', (window as any).THREE?.REVISION || 'unknown');

            // Load GLTFLoader (must be after Three.js, before Blueprint3D)
            const gltfLoaderScript = document.createElement('script');
            gltfLoaderScript.src = '/plan3d/js/GLTFLoader.js';
            gltfLoaderScript.onerror = (error) => {
              console.warn('Failed to load GLTFLoader (GLB support disabled):', error);
              // Continue loading blueprint3d even if GLTFLoader fails
              loadBp3d();
            };
            gltfLoaderScript.onload = () => {
              console.log('GLTFLoader loaded – THREE.GLTFLoader:', !!(window as any).THREE?.GLTFLoader);
              loadBp3d();
            };
            document.head.appendChild(gltfLoaderScript);

            function loadBp3d() {
              // Load Blueprint3D library
              const bp3dScript = document.createElement('script');
              bp3dScript.src = bp3dSrc;
              bp3dScript.onerror = (error) => {
                console.error('Failed to load Blueprint3D script:', error);
              };
              bp3dScript.onload = () => {
                console.log('Blueprint3D library loaded');

                // Add a small delay to ensure the script is fully executed
                setTimeout(() => {
                  // Check if BP3D is available globally (like in the original example)
                  if (typeof BP3D !== 'undefined') {
                    console.log('BP3D is available globally:', BP3D);
                    // Also assign it to window for consistency
                    (window as any).BP3D = BP3D;
                    setIsInitialized(true);
                  } else {
                    console.error('BP3D not found globally after loading');
                    console.log('Available globals:', Object.keys(window).filter(key => key.includes('BP3D')));

                    // Try to find any BP3D-related objects
                    const allGlobals = Object.keys(window);
                    const bp3dRelated = allGlobals.filter(key => key.toLowerCase().includes('bp3d') || key.toLowerCase().includes('blueprint'));
                    console.log('BP3D related globals:', bp3dRelated);

                    // Check if there are any console errors
                    console.log('Checking for console errors...');
                  }
                }, 200); // Increased delay
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
      console.log('Waiting for initialization:', {
        isInitialized,
        hasBP3D: typeof BP3D !== 'undefined',
        componentMounted: componentMounted.current
      });
      return;
    }

    console.log('Starting Blueprint3D initialization...');

    const initializeBlueprint3D = (retryCount = 0) => {
      try {
        // Wait for DOM elements to be available
        const viewerElement = document.getElementById('viewer');
        const floorplannerElement = document.getElementById('floorplanner-canvas');

        console.log('DOM elements check (attempt ' + (retryCount + 1) + '):', {
          viewer: viewerElement,
          floorplanner: floorplannerElement
        });

        // Additional debugging: check all elements with 'viewer' in the ID
        const allElements = document.querySelectorAll('[id*="viewer"], [id*="canvas"], [id*="floorplanner"]');
        console.log('All related DOM elements found:', Array.from(allElements).map(el => ({ id: el.id, tagName: el.tagName })));

        // Debug: check what's actually in the body
        console.log('Body children:', Array.from(document.body.children).map(el => ({ id: el.id, className: el.className, tagName: el.tagName })));

        // Debug: check the main container
        const mainContainer = document.querySelector('.main');
        if (mainContainer) {
          console.log('Main container children:', Array.from(mainContainer.children).map(el => ({ id: el.id, className: el.className, tagName: el.tagName })));
        } else {
          console.log('Main container not found');
        }

        if (!viewerElement || !floorplannerElement) {
          if (retryCount < 20) { // Max 20 retries (1 second total)
            console.log('DOM elements not ready yet, retrying... (attempt ' + (retryCount + 1) + '/20)');
            setTimeout(() => initializeBlueprint3D(retryCount + 1), 50);
            return;
          } else {
            console.error('Failed to find DOM elements after 20 attempts. Check if React components are rendering correctly.');
            return;
          }
        }

        console.log('All DOM elements found, proceeding with initialization');

        // Initialize Blueprint3D with the same options as the original example
        const opts = {
          floorplannerElement: 'floorplanner-canvas',
          threeElement: '#viewer',
          threeCanvasElement: null, // Not used but expected by constructor
          textureDir: assetsBaseUrl.replace(/\/$/, '') + '/rooms/textures/',
          widget: false
        };

        console.log('Initializing Blueprint3D with options:', opts);

        // Pre-check: Make sure jQuery can find the viewer element
        const jQueryViewer = (window as any).$('#viewer');
        console.log('jQuery viewer element:', jQueryViewer);
        console.log('jQuery viewer length:', jQueryViewer.length);
        console.log('jQuery viewer get(0):', jQueryViewer.get(0));

        if (jQueryViewer.length === 0) {
          console.error('jQuery cannot find #viewer element!');
          return;
        }

        // Pre-check: Make sure THREE.js is properly loaded
        const THREE = (window as any).THREE;
        console.log('THREE.js library:', THREE);
        console.log('THREE.PerspectiveCamera:', THREE?.PerspectiveCamera);
        console.log('THREE.WebGLRenderer:', THREE?.WebGLRenderer);

        if (!THREE || !THREE.PerspectiveCamera || !THREE.WebGLRenderer) {
          console.error('THREE.js library not properly loaded!');
          return;
        }

        // Ensure Blueprint3D relative texture paths resolve under /plan3d/
        try {
          const textureBase = assetsBaseUrl.replace(/\/$/, '') + '/';
          // Legacy ImageUtils loader used by blueprint3d.js
          if (THREE.ImageUtils && typeof THREE.ImageUtils.loadTexture === 'function') {
            const originalLoadTexture = THREE.ImageUtils.loadTexture.bind(THREE.ImageUtils);
            THREE.ImageUtils.loadTexture = function (url: string, ...rest: any[]) {
              const fixedUrl = /^(https?:\/\/|data:|\/)/.test(url) ? url : (textureBase + url);
              return originalLoadTexture(fixedUrl, ...rest as [any]);
            };
          }
        } catch (e) {
          console.warn('Could not wrap THREE.ImageUtils.loadTexture for path fixing:', e);
        }

        const bp3d = new BP3D.Blueprint3d(opts);
        console.log('Blueprint3D instance created:', bp3d);

        // Debug the three.js setup
        if (bp3d.three) {
          console.log('Three.js instance:', bp3d.three);
          console.log('Three.js element:', bp3d.three.element);

          // Check if camera was created properly
          if (bp3d.three.getCamera) {
            const camera = bp3d.three.getCamera();
            console.log('Camera instance:', camera);
            console.log('Camera type:', camera?.constructor?.name);
            if (camera && (window as any).THREE) {
              console.log('Is camera a THREE.Camera?', camera instanceof (window as any).THREE.Camera);
              console.log('Is camera a THREE.PerspectiveCamera?', camera instanceof (window as any).THREE.PerspectiveCamera);
            }
          }
        }

        // Set up event handlers for item selection
        if (bp3d.three) {
          // Item selection callbacks
          if (bp3d.three.itemSelectedCallbacks) {
            bp3d.three.itemSelectedCallbacks.add((item: any) => {
              console.log('Item selected:', item);
              setSelectedItem(item);
            });
          }

          if (bp3d.three.itemUnselectedCallbacks) {
            bp3d.three.itemUnselectedCallbacks.add(() => {
              console.log('Item unselected');
              setSelectedItem(null);
            });
          }

          // Loading callbacks
          if (bp3d.model && bp3d.model.scene) {
            if (bp3d.model.scene.itemLoadingCallbacks) {
              bp3d.model.scene.itemLoadingCallbacks.add(() => {
                console.log('Item loading started');
                setIsLoading(true);
              });
            }

            if (bp3d.model.scene.itemLoadedCallbacks) {
              bp3d.model.scene.itemLoadedCallbacks.add(() => {
                console.log('Item loading finished');
                setIsLoading(false);
              });
            }
          }

          // Wall and floor click callbacks for texture selection
          if (bp3d.three.wallClicked) {
            bp3d.three.wallClicked.add((wall: any) => {
              console.log('Wall clicked:', wall);
              setSelectedWall(wall);
              setSelectedFloor(null);
              setSelectedItem(null);
            });
          }

          if (bp3d.three.floorClicked) {
            bp3d.three.floorClicked.add((floor: any) => {
              console.log('Floor clicked:', floor);
              setSelectedFloor(floor);
              setSelectedWall(null);
              setSelectedItem(null);
            });
          }

          if (bp3d.three.nothingClicked) {
            bp3d.three.nothingClicked.add(() => {
              console.log('Nothing clicked - resetting texture selection');
              setSelectedWall(null);
              setSelectedFloor(null);
            });
          }

          // Ensure the controller is properly set up but start disabled
          if (bp3d.three.getController) {
            const controller = bp3d.three.getController();
            if (controller) {
              controller.enabled = false; // Start disabled - only enable in editing mode
              console.log('Controller initialized but disabled:', controller.enabled);
            }
          }

          // Make sure the three.js scene is properly initialized
          if (bp3d.three.updateWindowSize) {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
              bp3d.three.updateWindowSize();
              console.log('Three.js window size updated');

              // Additional setup to ensure proper interaction
              const viewerElement = document.getElementById('viewer');
              if (viewerElement) {
                // Make sure the viewer element can receive focus and events
                viewerElement.style.outline = 'none';
                viewerElement.tabIndex = -1;

                // Ensure controller is properly enabled for item interaction
                if (bp3d.three.getController) {
                  const controller = bp3d.three.getController();
                  if (controller && controller.needsUpdate !== undefined) {
                    controller.needsUpdate = true;
                  }
                }

                console.log('Viewer element configured for interaction');
              }
            }, 100);
          }
        }

        setBlueprint3d(bp3d);

        // Don't load a default floorplan - let the user select a scene first
        console.log('Blueprint3D initialized successfully, ready for scene loading');
      } catch (error) {
        console.error('Error creating Blueprint3D instance:', error);
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(() => initializeBlueprint3D(0), 100);
    });
  }, [isInitialized]);

  const handleStateChange = (newState: AppState) => {
    setAppState(newState);

    // Handle state-specific actions like in the original example
    if (blueprint3d) {
      if (newState === 'FLOORPLAN') {
        // Update floorplan view
        if (blueprint3d.floorplanner) {
          blueprint3d.floorplanner.reset();
          // Add a small delay to ensure the DOM is updated before resizing
          setTimeout(() => {
            const floorplannerElement = document.getElementById('floorplanner');
            if (floorplannerElement && blueprint3d.floorplanner) {
              const rect = floorplannerElement.getBoundingClientRect();
              const height = window.innerHeight - rect.top;
              floorplannerElement.style.height = height + 'px';
              blueprint3d.floorplanner.resizeView();

              // Center the floorplan view
              setTimeout(() => {
                if (blueprint3d.floorplanner && blueprint3d.floorplanner.reset) {
                  blueprint3d.floorplanner.reset();
                  console.log('Floorplanner view reset and centered');
                }
              }, 50);
            }
          }, 100);
        }
      } else if (newState === 'DESIGN') {
        // Update 3D view
        if (blueprint3d.three) {
          blueprint3d.three.updateWindowSize();
          // Center the camera when switching to design view
          setTimeout(() => {
            if (blueprint3d.three && blueprint3d.three.centerCamera) {
              blueprint3d.three.centerCamera();
              console.log('Camera centered on design view switch');
            }
          }, 100);
        }
        if (blueprint3d.model && blueprint3d.model.floorplan) {
          blueprint3d.model.floorplan.update();
        }
      }

      // Stop spinning when changing states
      if (blueprint3d.three && blueprint3d.three.stopSpin) {
        blueprint3d.three.stopSpin();
      }

      // Set item unselected when changing states
      if (blueprint3d.three && blueprint3d.three.getController) {
        const controller = blueprint3d.three.getController();
        if (controller && controller.setSelectedObject) {
          controller.setSelectedObject(null);
        }
      }
    }
  };

  const handleItemSelect = (item: any) => {
    setSelectedItem(item);
  };

  const handleItemUnselect = () => {
    setSelectedItem(null);
  };

  const handleLoadingChange = (loading: boolean) => {
    setIsLoading(loading);
  };

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
    // Clear all selections in React state
    setSelectedWall(null);
    setSelectedFloor(null);
    setSelectedItem(null);

    // Also clear selections in Blueprint3D's controller
    if (blueprint3d?.three?.getController) {
      const controller = blueprint3d.three.getController();
      if (controller && controller.setSelectedObject) {
        controller.setSelectedObject(null);
      }
    }
  };

  const handleUIDChange = (uid: string) => {
    setCurrentUID(uid);
  };

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
            {
              "corner1": "71d4f128-ae80-3d58-9bd2-711c6ce6cdf2",
              "corner2": "f90da5e3-9e0e-eba7-173d-eb0b071e838e",
              "frontTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 },
              "backTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 }
            },
            {
              "corner1": "f90da5e3-9e0e-eba7-173d-eb0b071e838e",
              "corner2": "da026c08-d76a-a944-8e7b-096b752da9ed",
              "frontTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 },
              "backTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 }
            },
            {
              "corner1": "da026c08-d76a-a944-8e7b-096b752da9ed",
              "corner2": "4e3d65cb-54c0-0681-28bf-bddcc7bdb571",
              "frontTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 },
              "backTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 }
            },
            {
              "corner1": "4e3d65cb-54c0-0681-28bf-bddcc7bdb571",
              "corner2": "71d4f128-ae80-3d58-9bd2-711c6ce6cdf2",
              "frontTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 },
              "backTexture": { "url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0 }
            }
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
      console.log('Loading new design with floor texture:', JSON.stringify(defaultFloorplan, null, 2));
      blueprint3d.model.loadSerialized(JSON.stringify(defaultFloorplan));
      // Update UID in context
      handleUIDChange(newUID);
      // Ensure floor textures are applied after load
      setTimeout(() => {
        try {
          const rooms = (blueprint3d as any)?.model?.floorplan?.getRooms?.();
          if (rooms && rooms.length) {
            const floorUrl = '/plan3d/rooms/textures/hardwood.png';
            rooms.forEach((room: any) => room.setTexture(floorUrl, true, 400));
            console.log('Applied floor texture to rooms (new plan):', floorUrl);
          }
        } catch (e) {
          console.warn('Could not apply floor textures for new plan:', e);
        }
      }, 0);
    }
  };

  const handleLoadPlan = (planData: any) => {
    if (blueprint3d?.model) {
      console.log('Loading plan into viewer:', planData);

      // Ensure we switch to design view to show the loaded plan
      handleStateChange('DESIGN');

      // Load the plan data
      blueprint3d.model.loadSerialized(JSON.stringify(planData));

      // Update the current UID
      if (planData.uid) {
        handleUIDChange(planData.uid);
      }

      // Apply floor textures after loading
      setTimeout(() => {
        try {
          const rooms = (blueprint3d as any)?.model?.floorplan?.getRooms?.();
          if (rooms && rooms.length && planData.floorplan?.newFloorTextures) {
            rooms.forEach((room: any) => {
              // Try to find the appropriate texture for this room
              const textureKeys = Object.keys(planData.floorplan.newFloorTextures);
              if (textureKeys.length > 0) {
                const textureConfig = planData.floorplan.newFloorTextures[textureKeys[0]];
                room.setTexture(textureConfig.url, true, textureConfig.scale || 400);
              }
            });
            console.log('Applied floor textures to loaded plan');
          }
        } catch (e) {
          console.warn('Could not apply floor textures for loaded plan:', e);
        }
      }, 100);
    }
  };

  // Expose functions to parent component
  React.useImperativeHandle(ref, () => ({
    loadPlan: handleLoadPlan,
    createNewPlan: handleCreateNewPlan,
    clearSelections: handleClearSelections,
    setControllerEnabled: (enabled: boolean) => {
      console.log('🔧 setControllerEnabled called with:', enabled);
      if (blueprint3d?.three?.getController) {
        const controller = blueprint3d.three.getController();
        if (controller) {
          controller.enabled = enabled;
          console.log('✅ Blueprint3D controller enabled set to:', enabled);
          console.log('🔍 Controller object:', controller);

          // ¡Hemos eliminado toda la lógica de viewerElement.style.pointerEvents!
          // Con 'controller.enabled = enabled' es suficiente.
        } else {
          console.error('❌ Controller is null after getController()');
        }
      } else {
        console.error('❌ Blueprint3D or getController not available');
        console.log('🔍 Blueprint3D state:', {
          hasBlueprint3d: !!blueprint3d,
          hasThree: !!blueprint3d?.three,
          hasGetController: !!blueprint3d?.three?.getController
        });
      }
    },
  }));

  // Always render the DOM elements, but show loading state when needed

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
      onSelectedFloorChange
    }}>
      <div className="blueprint3d-app">
        <div className="container-fluid">
          <div className="row main-row">
            <div className="col-xs-12 main">
              {/* Always render the viewer div initially for Blueprint3D initialization */}
              <div id="viewer" className={appState === 'DESIGN' ? 'active' : ''}>
                <Viewer />
              </div>

              {/* Always render the floorplanner div for initialization */}
              <div id="floorplanner" className={appState === 'FLOORPLAN' ? 'active' : ''}>
                <canvas id="floorplanner-canvas"></canvas>
                <Floorplanner />
              </div>

              <div id="add-items" className={appState === 'SHOP' ? 'active' : ''}>
                <AddItems />
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
