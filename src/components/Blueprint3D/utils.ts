// Utility functions for Blueprint3D components

/**
 * Generate a unique identifier (UID) for blueprint definitions
 * Uses crypto.randomUUID() if available, otherwise falls back to a custom implementation
 */
export const generateUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Ensure a blueprint object has a UID, generating one if missing
 */
export const ensureBlueprintUID = (blueprintData: any): any => {
  if (!blueprintData.uid) {
    blueprintData.uid = generateUID();
  }
  return blueprintData;
};

/**
 * Create a default floorplan configuration
 */
export const createDefaultFloorplan = () => {
  const newUID = generateUID();
  return {
    "uid": newUID,
    "floorplan": {
      "corners": {
        "f90da5e3-9e0e-eba7-173d-eb0b071e838e": {"x": 204.85099999999989, "y": 289.052},
        "da026c08-d76a-a944-8e7b-096b752da9ed": {"x": 672.2109999999999, "y": 289.052},
        "4e3d65cb-54c0-0681-28bf-bddcc7bdb571": {"x": 672.2109999999999, "y": -178.308},
        "71d4f128-ae80-3d58-9bd2-711c6ce6cdf2": {"x": 204.85099999999989, "y": -178.308}
      },
      "walls": [
        {
          "corner1": "71d4f128-ae80-3d58-9bd2-711c6ce6cdf2",
          "corner2": "f90da5e3-9e0e-eba7-173d-eb0b071e838e",
          "frontTexture": {"url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0},
          "backTexture": {"url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0}
        },
        {
          "corner1": "f90da5e3-9e0e-eba7-173d-eb0b071e838e",
          "corner2": "da026c08-d76a-a944-8e7b-096b752da9ed",
          "frontTexture": {"url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0},
          "backTexture": {"url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0}
        },
        {
          "corner1": "da026c08-d76a-a944-8e7b-096b752da9ed",
          "corner2": "4e3d65cb-54c0-0681-28bf-bddcc7bdb571",
          "frontTexture": {"url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0},
          "backTexture": {"url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0}
        },
        {
          "corner1": "4e3d65cb-54c0-0681-28bf-bddcc7bdb571",
          "corner2": "71d4f128-ae80-3d58-9bd2-711c6ce6cdf2",
          "frontTexture": {"url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0},
          "backTexture": {"url": "/plan3d/rooms/textures/wallmap.png", "stretch": true, "scale": 0}
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
};
