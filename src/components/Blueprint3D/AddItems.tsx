import React, { useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { useBlueprint3D } from './Blueprint3DApp';

// Define item categories and items based on the original items.js
const itemCategories = [
  {
    name: 'Doors & Windows',
    items: [
      { name: 'Closed Door', image: 'plan3d/models/thumbnails/thumbnail_Screen_Shot_2014-10-27_at_8.04.12_PM.png', model: 'plan3d/models/js/closed-door28x80_baked.js', type: 7 },
      { name: 'Open Door', image: 'plan3d/models/thumbnails/thumbnail_Screen_Shot_2014-10-27_at_8.22.46_PM.png', model: 'plan3d/models/js/open_door.js', type: 7 },
      { name: 'Window', image: 'plan3d/models/thumbnails/thumbnail_window.png', model: 'plan3d/models/js/whitewindow.js', type: 3 },
    ]
  },
  {
    name: 'Furniture',
    items: [
      { name: 'Chair', image: 'plan3d/models/thumbnails/thumbnail_Church-Chair-oak-white_1024x1024.jpg', model: 'plan3d/models/js/gus-churchchair-whiteoak.js', type: 1 },
      { name: 'Red Chair', image: 'plan3d/models/thumbnails/thumbnail_tn-orange.png', model: 'plan3d/models/js/ik-ekero-orange_baked.js', type: 1 },
      { name: 'Blue Chair', image: 'plan3d/models/thumbnails/thumbnail_ekero-blue3.png', model: 'plan3d/models/js/ik-ekero-blue_baked.js', type: 1 },
      { name: 'Full Bed', image: 'plan3d/models/thumbnails/thumbnail_nordli-bed-frame__0159270_PE315708_S4.JPG', model: 'plan3d/models/js/ik_nordli_full.js', type: 1 },
      { name: 'Coffee Table - Wood', image: 'plan3d/models/thumbnails/thumbnail_stockholm-coffee-table__0181245_PE332924_S4.JPG', model: 'plan3d/models/js/ik-stockholmcoffee-brown.js', type: 1 },
      { name: 'Dining Table', image: 'plan3d/models/thumbnails/thumbnail_scholar-dining-table.jpg', model: 'plan3d/models/js/cb-scholartable_baked.js', type: 1 },
      { name: 'Dining table', image: 'plan3d/models/thumbnails/thumbnail_Screen_Shot_2014-01-28_at_6.49.33_PM.png', model: 'plan3d/models/js/BlakeAvenuejoshuatreecheftable.js', type: 1 },
    ]
  },
  {
    name: 'Storage',
    items: [
      { name: 'Dresser - Dark Wood', image: 'plan3d/models/thumbnails/thumbnail_matera_dresser_5.png', model: 'plan3d/models/js/DWR_MATERA_DRESSER2.js', type: 1 },
      { name: 'Dresser - White', image: 'plan3d/models/thumbnails/thumbnail_img25o.jpg', model: 'plan3d/models/js/we-narrow6white_baked.js', type: 1 },
      { name: 'Bedside table - Shale', image: 'plan3d/models/thumbnails/thumbnail_Blu-Dot-Shale-Bedside-Table.jpg', model: 'plan3d/models/js/bd-shalebedside-smoke_baked.js', type: 1 },
      { name: 'Bedside table - White', image: 'plan3d/models/thumbnails/thumbnail_arch-white-oval-nightstand.jpg', model: 'plan3d/models/js/cb-archnight-white_baked.js', type: 1 },
      { name: 'Wardrobe - White', image: 'plan3d/models/thumbnails/thumbnail_TN-ikea-kvikine.png', model: 'plan3d/models/js/ik-kivine_baked.js', type: 1 },
      { name: 'Bookshelf', image: 'plan3d/models/thumbnails/thumbnail_kendall-walnut-bookcase.jpg', model: 'plan3d/models/js/cb-kendallbookcasewalnut_baked.js', type: 1 },
      { name: 'Media Console - White', image: 'plan3d/models/thumbnails/thumbnail_clapboard-white-60-media-console-1.jpg', model: 'plan3d/models/js/cb-clapboard_baked.js', type: 1 },
      { name: 'Media Console - Black', image: 'plan3d/models/thumbnails/thumbnail_moore-60-media-console-1.jpg', model: 'plan3d/models/js/cb-moore_baked.js', type: 1 },
      { name: 'Side Table', image: 'plan3d/models/thumbnails/thumbnail_Screen_Shot_2014-02-21_at_1.24.58_PM.png', model: 'plan3d/models/js/GUSossingtonendtable.js', type: 1 },
    ]
  },
  {
    name: 'Seating',
    items: [
      { name: 'Sectional - Olive', image: 'plan3d/models/thumbnails/thumbnail_img21o.jpg', model: 'plan3d/models/js/we-crosby2piece-greenbaked.js', type: 1 },
      { name: 'Sofa - Grey', image: 'plan3d/models/thumbnails/thumbnail_rochelle-sofa-3.jpg', model: 'plan3d/models/js/cb-rochelle-gray_baked.js', type: 1 },
    ]
  },
  {
    name: 'Decor & Lighting',
    items: [
      { name: 'Wooden Trunk', image: 'plan3d/models/thumbnails/thumbnail_teca-storage-trunk.jpg', model: 'plan3d/models/js/cb-tecs_baked.js', type: 1 },
      { name: 'Floor Lamp', image: 'plan3d/models/thumbnails/thumbnail_ore-white.png', model: 'plan3d/models/js/ore-3legged-white_baked.js', type: 1 },
      { name: 'NYC Poster', image: 'plan3d/models/thumbnails/thumbnail_nyc2.jpg', model: 'plan3d/models/js/nyc-poster2.js', type: 2 },
    ]
  },
  {
    name: 'Floor Coverings',
    items: [
      { name: 'Blue Rug', image: 'plan3d/models/thumbnails/thumbnail_cb-blue-block60x96.png', model: 'plan3d/models/js/cb-blue-block-60x96.js', type: 8 },
      { name: 'Alfombra', image: 'plan3d/models/thumbnails/robot.png', model: 'plan3d/models/js/robot_model.js', type: 8 },
      { name: 'Alfombra Personalizado', image: 'plan3d/models/thumbnails/personalizado.png', model: 'plan3d/models/js/robot_model.js', type: 8 },

    ]
  }
];

const AddItems: React.FC = () => {
  const { blueprint3d, onStateChange } = useBlueprint3D();

  const handleAddItem = (item: any) => {
    if (blueprint3d?.model?.scene) {
      try {
        // Add item to the scene with metadata
        const metadata = {
          itemName: item.name,
          resizable: true,
          modelUrl: item.model,
          itemType: item.type
        };
        
        blueprint3d.model.scene.addItem(item.type, item.model, metadata);
        
        // Switch back to design view
        onStateChange('DESIGN');
        
        console.log(`Added item: ${item.name}`);
      } catch (error) {
        console.error('Failed to add item:', error);
      }
    }
  };

  return (
    <div>
      {/* Return Button */}
      <div style={{ padding: '12px', borderBottom: '1px solid #E2E8F0' }}>
        <button 
          onClick={() => onStateChange('DESIGN')}
          style={{
            backgroundColor: '#596A6E',
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
            e.currentTarget.style.backgroundColor = '#4A5B5F';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#596A6E';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
          }}
        >
          <FiArrowLeft style={{ marginRight: '6px' }} /> Return to Design
        </button>
      </div>
      
      {/* Items Grid */}
      <div className="row" id="items-wrapper">
        {itemCategories.flatMap(category => 
          category.items.map(item => (
            <div key={item.name} className="col-sm-4">
              <a 
                className="thumbnail add-item" 
                data-model-name={item.name}
                data-model-url={item.model}
                data-model-type={item.type}
                onClick={() => handleAddItem(item)}
                style={{ cursor: 'pointer' }}
              >
                <img src={item.image} alt={item.name} />
                {item.name}
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AddItems;
