# Blueprint3D Integration

This directory contains the Blueprint3D 3D interior design application components that have been integrated into the main project.

## Components

- **`Blueprint3DApp.tsx`** - Main application component that initializes the 3D engine
- **`Sidebar.tsx`** - Navigation sidebar with mode switching and item management
- **`Viewer.tsx`** - 3D viewport with camera controls and file operations
- **`Floorplanner.tsx`** - 2D floorplan editing tools
- **`AddItems.tsx`** - Furniture and item catalog
- **`Blueprint3DApp.css`** - Styling for the 3D application
- **`index.ts`** - Export file for easy component importing

## Features

- **3D Design Mode**: Interactive 3D viewport for designing rooms
- **Floorplan Editor**: 2D floorplan creation and editing
- **Item Catalog**: Add furniture, doors, windows, and decorations
- **Texture Management**: Apply different materials to walls and floors
- **File Operations**: Save, load, and export designs
- **Camera Controls**: Zoom, pan, and navigate the 3D space

## Usage

The Blueprint3D application is integrated into the site page (`src/routes/_layout/site.tsx`). Users can:

1. Navigate to the site page
2. The 3D Blueprint Designer will automatically load
3. Use the sidebar to switch between Design, Floorplan, and Add Items modes
4. Click and drag to navigate the 3D space
5. Add furniture from the catalog to their design
6. Save designs for later use

## Dependencies

The application dynamically loads the following external libraries:
- **jQuery** (`/plan3d/js/jquery.js`) - Required by Blueprint3D
- **Three.js** (`/plan3d/js/three.min.js`) - 3D graphics engine
- **Blueprint3D** (`/plan3d/js/blueprint3d.js`) - Main 3D application library

## Assets

All 3D models, textures, and UI assets are located in the `public/plan3d/` directory:
- **Models**: Furniture, doors, windows, and decorative items
- **Textures**: Wall and floor materials
- **CSS**: Bootstrap and custom styling
- **Fonts**: Glyphicons for UI elements

## Technical Details

- Built with React and TypeScript
- Uses React Context for state management
- Dynamically loads external JavaScript libraries
- Responsive design with Bootstrap CSS
- Integrates seamlessly with the existing Chakra UI theme

## Troubleshooting

If the 3D application doesn't load:
1. Check that all assets are in the `public/plan3d/` directory
2. Verify that the JavaScript libraries are accessible
3. Check the browser console for any loading errors
4. Ensure the CSS files are properly imported



