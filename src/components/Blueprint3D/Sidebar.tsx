import React, { useState, useEffect } from 'react';
import { useBlueprint3D } from './Blueprint3DApp';

const Sidebar: React.FC = () => {
  const { appState, onStateChange, selectedItem, isLoading, selectedWall, selectedFloor, onTextureReset } = useBlueprint3D();
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [itemDimensions, setItemDimensions] = useState({ width: 0, height: 0, depth: 0 });
  const [isFixed, setIsFixed] = useState(false);

  useEffect(() => {
    if (selectedItem) {
      // Convert cm to inches for display
      const cmToIn = (cm: number) => cm / 2.54;
      setItemDimensions({
        width: Math.round(cmToIn(selectedItem.getWidth())),
        height: Math.round(cmToIn(selectedItem.getHeight())),
        depth: Math.round(cmToIn(selectedItem.getDepth()))
      });
      setIsFixed(selectedItem.fixed || false);
      setContextMenuVisible(true);
    } else {
      setContextMenuVisible(false);
    }
  }, [selectedItem]);

  const handleStateChange = (e: React.MouseEvent, newState: 'DESIGN' | 'FLOORPLAN' | 'SHOP') => {
    e.preventDefault();
    onStateChange(newState);
  };

  const handleDeleteItem = () => {
    if (selectedItem) {
      selectedItem.remove();
    }
  };

  const handleDimensionChange = (dimension: 'width' | 'height' | 'depth', value: number) => {
    if (selectedItem) {
      const inToCm = (inches: number) => inches * 2.54;
      const newDimensions = { ...itemDimensions, [dimension]: value };
      
      selectedItem.resize(
        inToCm(newDimensions.height),
        inToCm(newDimensions.width),
        inToCm(newDimensions.depth)
      );
      
      setItemDimensions(newDimensions);
    }
  };

  const handleFixedChange = (checked: boolean) => {
    if (selectedItem) {
      selectedItem.setFixed(checked);
      setIsFixed(checked);
    }
  };

  const handleTextureSelect = (textureUrl: string, textureStretch: boolean, textureScale: number) => {
    if (selectedWall) {
      selectedWall.setTexture(textureUrl, textureStretch, textureScale);
    } else if (selectedFloor) {
      selectedFloor.setTexture(textureUrl, textureStretch, textureScale);
    }
    // Reset texture selection after applying
    onTextureReset();
  };

  return (
    <div className="col-xs-3 sidebar">
      {/* Main Navigation */}
      <ul className="nav nav-sidebar">
        <li id="floorplan_tab" className={appState === 'FLOORPLAN' ? 'active' : ''}>
          <a href="#" onClick={(e) => handleStateChange(e, 'FLOORPLAN')}>
            Edit Floorplan
            <span className="glyphicon glyphicon-chevron-right pull-right"></span>
          </a>
        </li>
        <li id="design_tab" className={appState === 'DESIGN' ? 'active' : ''}>
          <a href="#" onClick={(e) => handleStateChange(e, 'DESIGN')}>
            Design
            <span className="glyphicon glyphicon-chevron-right pull-right"></span>
          </a>
        </li>
        <li id="items_tab" className={appState === 'SHOP' ? 'active' : ''}>
          <a href="#" onClick={(e) => handleStateChange(e, 'SHOP')}>
            Add Items
            <span className="glyphicon glyphicon-chevron-right pull-right"></span>
          </a>
        </li>
      </ul>
      <hr />

      {/* Context Menu */}
      {contextMenuVisible && selectedItem && (
        <div id="context-menu">
          <div style={{ margin: '0 20px' }}>
            <span id="context-menu-name" className="lead">{selectedItem.metadata?.itemName || 'Selected Item'}</span>
            <br /><br />
            <button className="btn btn-block btn-danger" id="context-menu-delete" onClick={handleDeleteItem}>
              <span className="glyphicon glyphicon-trash"></span> 
              Delete Item
            </button>
            <br />
            <div className="panel panel-default">
              <div className="panel-heading">Adjust Size</div>
              <div className="panel-body" style={{ color: '#333333' }}>
                <div className="form form-horizontal">
                  <div className="form-group">
                    <label className="col-sm-5 control-label">Width</label>
                    <div className="col-sm-6">
                      <input 
                        type="number" 
                        className="form-control" 
                        id="item-width"
                        value={itemDimensions.width}
                        onChange={(e) => handleDimensionChange('width', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="col-sm-5 control-label">Depth</label>
                    <div className="col-sm-6">
                      <input 
                        type="number" 
                        className="form-control" 
                        id="item-depth"
                        value={itemDimensions.depth}
                        onChange={(e) => handleDimensionChange('depth', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="col-sm-5 control-label">Height</label>
                    <div className="col-sm-6">
                      <input 
                        type="number" 
                        className="form-control" 
                        id="item-height"
                        value={itemDimensions.height}
                        onChange={(e) => handleDimensionChange('height', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
                <small><span className="text-muted">Measurements in inches.</span></small>
              </div>
            </div>
            <label>
              <input 
                type="checkbox" 
                id="fixed" 
                checked={isFixed}
                onChange={(e) => handleFixedChange(e.target.checked)}
              /> 
              Lock in place
            </label>
            <br /><br />
          </div>
        </div>
      )}

      {/* Floor textures */}
      {selectedFloor && (
        <div id="floorTexturesDiv" style={{ padding: '0 20px' }}>
          <div className="panel panel-default">
            <div className="panel-heading">Adjust Floor</div>
            <div className="panel-body" style={{ color: '#333333' }}>
              <div className="col-sm-6" style={{ padding: '3px' }}>
                <a 
                  href="#" 
                  className="thumbnail texture-select-thumbnail" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleTextureSelect("/plan3d/rooms/textures/light_fine_wood.jpg", false, 300);
                  }}
                >
                  <img alt="Thumbnail light fine wood" src="/plan3d/rooms/thumbnails/thumbnail_light_fine_wood.jpg" />
                </a>
              </div>
              <div className="col-sm-6" style={{ padding: '3px' }}>
                <a 
                  href="#" 
                  className="thumbnail texture-select-thumbnail" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleTextureSelect("/plan3d/rooms/textures/hardwood.png", false, 400);
                  }}
                >
                  <img alt="Thumbnail hardwood" src="/plan3d/rooms/thumbnails/thumbnail_light_fine_wood.jpg" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wall Textures */}
      {selectedWall && (
        <div id="wallTextures" style={{ padding: '0 20px' }}>
          <div className="panel panel-default">
            <div className="panel-heading">Adjust Wall</div>
            <div className="panel-body" style={{ color: '#333333' }}>
              <div className="col-sm-6" style={{ padding: '3px' }}>
                <a 
                  href="#" 
                  className="thumbnail texture-select-thumbnail" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleTextureSelect("/plan3d/rooms/textures/marbletiles.jpg", false, 300);
                  }}
                >
                  <img alt="Thumbnail marbletiles" src="/plan3d/rooms/thumbnails/thumbnail_marbletiles.jpg" />
                </a>
              </div>
              <div className="col-sm-6" style={{ padding: '3px' }}>
                <a 
                  href="#" 
                  className="thumbnail texture-select-thumbnail" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleTextureSelect("/plan3d/rooms/textures/wallmap_yellow.png", true, 0);
                  }}
                >
                  <img alt="Thumbnail wallmap yellow" src="/plan3d/rooms/thumbnails/thumbnail_wallmap_yellow.png" />
                </a>
              </div>
              <div className="col-sm-6" style={{ padding: '3px' }}>
                <a 
                  href="#" 
                  className="thumbnail texture-select-thumbnail" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleTextureSelect("/plan3d/rooms/textures/light_brick.jpg", false, 100);
                  }}
                >
                  <img alt="Thumbnail light brick" src="/plan3d/rooms/thumbnails/thumbnail_light_brick.jpg" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
