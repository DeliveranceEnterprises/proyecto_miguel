import React, { useState, useEffect } from 'react';
import { FiSave, FiCodepen, FiPlus, FiEdit, FiX } from 'react-icons/fi';
import { useBlueprint3D } from './Blueprint3DApp';
import { useOrganizationContext } from '../../hooks/useOrganizationContext';
import { ScenesService } from '../../client';
import type { SceneCreate, SceneUpdate } from '../../client/types.gen';
import useCustomToast from '../../hooks/useCustomToast';
import { passwordRules } from '../../utils';

const Viewer: React.FC = () => {
  const { blueprint3d, currentUID, onUIDChange, onSceneSaved, onStateChange, onEditingModeChange } = useBlueprint3D();
  const { getActiveOrganizationId } = useOrganizationContext();
  const showToast = useCustomToast();
  const [isEditingMode, setIsEditingMode] = useState(false);

  // Helper function to check if a scene exists
  const checkSceneExists = async (sceneId: string): Promise<boolean> => {
    try {
      await ScenesService.readScene({ sceneId });
      return true;
    } catch (error) {
      // If the scene doesn't exist, the API will return an error
      return false;
    }
  };

  const handleZoomIn = () => {
    if (blueprint3d?.three?.controls) {
      blueprint3d.three.controls.dollyIn(1.1);
      blueprint3d.three.controls.update();
    }
  };

  const handleZoomOut = () => {
    if (blueprint3d?.three?.controls) {
      blueprint3d.three.controls.dollyOut(1.1);
      blueprint3d.three.controls.update();
    }
  };

  const handleResetView = () => {
    if (blueprint3d?.three?.centerCamera) {
      blueprint3d.three.centerCamera();
    }
  };

  const handlePan = (direction: 'left' | 'right' | 'up' | 'down') => {
    if (blueprint3d?.three?.controls) {
      const panSpeed = 30;
      switch (direction) {
        case 'up':
          blueprint3d.three.controls.panXY(0, panSpeed);
          break;
        case 'down':
          blueprint3d.three.controls.panXY(0, -panSpeed);
          break;
        case 'left':
          blueprint3d.three.controls.panXY(panSpeed, 0);
          break;
        case 'right':
          blueprint3d.three.controls.panXY(-panSpeed, 0);
          break;
      }
      blueprint3d.three.controls.update();
    }
  };



  const handleSaveDesign = async () => {
    if (!blueprint3d?.model) {
      console.error('Blueprint3D model not available');
      return;
    }

    const activeOrgId = getActiveOrganizationId();
    if (!activeOrgId) {
      console.error('No active organization context found');
      showToast(
        'Organization Required',
        'Please select an organization before saving the plan.',
        'error'
      );
      return;
    }

    try {
      const data = blueprint3d.model.exportSerialized();
      const parsedData = JSON.parse(data);
      
      console.log('Raw blueprint data:', parsedData);

      // Check if we're updating an existing scene or creating a new one
      const isExistingScene = currentUID && await checkSceneExists(currentUID);
      
      let response;
      
      if (isExistingScene) {
        console.log('Updating existing scene:', currentUID);
        
        // Transform the blueprint data for update (SceneUpdate format)
        const updateData: SceneUpdate = {
          floorplan: {
            corners: parsedData.floorplan?.corners || {},
            walls: parsedData.floorplan?.walls || []
          },
          items: parsedData.items || [],
          organization_id: activeOrgId
        };

        console.log('Updating scene via API:', updateData);

        // PUT to update the existing scene
        response = await ScenesService.updateScene({
          sceneId: currentUID,
          requestBody: updateData
        });

        console.log('Scene updated successfully:', response);

        showToast(
          'Scene Updated Successfully!',
          `Your scene ${currentUID.substring(0, 8)}... has been updated`,
          'success'
        );
        
        // Exit editing mode after successful save
        setIsEditingMode(false);
        // Notify parent component about editing mode change
        if (onEditingModeChange) {
          onEditingModeChange(false);
        }
        
      } else {
        console.log('Creating new scene');
        
        // Transform the blueprint data for creation (SceneCreate format)
        const createData: SceneCreate = {
          organization_id: activeOrgId,
          floorplan: {
            corners: parsedData.floorplan?.corners || {},
            walls: parsedData.floorplan?.walls || []
          },
          items: parsedData.items || []
        };

        console.log('Creating scene via API:', createData);

        // POST to create a new scene
        response = await ScenesService.createScene({
          requestBody: createData
        });

        console.log('Scene created successfully:', response);

        // Update the current UID with the new scene's UID
        if (response.uid) {
          onUIDChange(response.uid);
        }

        showToast(
          'Scene Created Successfully!',
          `Your new scene has been saved with ID: ${response.uid}`,
          'success'
        );
        
        // Exit editing mode after successful save
        setIsEditingMode(false);
        // Notify parent component about editing mode change
        if (onEditingModeChange) {
          onEditingModeChange(false);
        }
      }
      
      // Notify parent component that a scene was saved (for both create and update)
      if (onSceneSaved && response.uid) {
        onSceneSaved(response.uid);
      }

    } catch (error) {
      console.error('Error saving scene:', error);
      showToast(
        'Save Failed',
        'Failed to save scene. Please check the console for details or try again.',
        'error'
      );
    }
  };


  const handleEnterEditMode = () => {
    setIsEditingMode(true);
    // Notify parent component about editing mode change
    if (onEditingModeChange) {
      onEditingModeChange(true);
    }
  };

  // Opción 1: Función flecha (la más común en React)


  const handleCancelEditing = async () => {
    try {
      // If we have a current scene UID, reload it from the server
      if (currentUID) {
        console.log('Canceling editing, reloading scene:', currentUID);
        
        // Check if the scene still exists
        const exists = await checkSceneExists(currentUID);
        if (exists) {
          // Fetch the scene data from the API
          const sceneData = await ScenesService.readScene({ sceneId: currentUID });
          
          // Transform the scene data to the format expected by Blueprint3D
          const blueprintData = {
            uid: sceneData.uid,
            floorplan: sceneData.floorplan,
            items: sceneData.items || []
          };
          
          // Reload the scene into the Blueprint3D viewer
          if (blueprint3d?.model) {
            blueprint3d.model.loadSerialized(JSON.stringify(blueprintData));
            console.log('Scene reloaded successfully after cancel:', currentUID);
            
            showToast(
              'Changes Discarded',
              'Scene has been restored to its last saved version',
              'success'
            );
          }
        } else {
          console.warn('Scene no longer exists, cannot reload');
          showToast(
            'Scene Not Found',
            'The scene no longer exists. Changes have been discarded.',
            'error'
          );
        }
      } else {
        console.log('No current scene to reload');
      }
    } catch (error) {
      console.error('Error reloading scene after cancel:', error);
      showToast(
        'Reload Failed',
        'Failed to reload the last saved version. Changes may still be present.',
        'error'
      );
    }
    
    setIsEditingMode(false);
    // Notify parent component about editing mode change
    if (onEditingModeChange) {
      onEditingModeChange(false);
    }
    // Return to design view when canceling editing
    onStateChange('DESIGN');
  };

  useEffect(() => {
    const loadSceneData = async () => {
      // Solo cargamos si hay un ID y el modelo 3D está listo
      if (currentUID && blueprint3d?.model) {
        try {
          console.log("Cargando nueva escena:", currentUID);
          
          // 1. Pedimos los datos de la nueva escena a la API
          const sceneData = await ScenesService.readScene({ sceneId: currentUID });
          
          // 2. Preparamos el formato (por seguridad, para evitar fallos si viene vacío)
          const formatData = {
            floorplan: sceneData.floorplan || { corners: {}, walls: [] },
            items: sceneData.items || [],
            uid: sceneData.uid
          };

          // 3. Inyectamos los datos en el motor 3D
          blueprint3d.model.loadSerialized(JSON.stringify(formatData));
          
        } catch (error) {
          console.error("Error al cargar la escena automática:", error);
        }
      } else if (!currentUID && blueprint3d?.model) {
        // Si no hay ID (porque borraste la última), limpiamos la pantalla
        blueprint3d.model.loadSerialized(JSON.stringify({ 
            floorplan: { corners: {}, walls: [] }, 
            items: [] 
        }));
      }
    };

    loadSceneData();
  }, [currentUID, blueprint3d]);

  return (
    <>
      {/* Main Controls */}
      <div id="main-controls" style={{ display: 'flex', gap: '8px', padding: '12px' }}>
        {!isEditingMode ? (
          // AQUI ESTAN LOS CAMBIOS PRINCIPALES
          <>
            <button 
              onClick={handleEnterEditMode}
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
              <FiEdit style={{ marginRight: '6px' }} /> Edit Scene
            </button>
          </>
        ) : (
          // Show all editing buttons when in editing mode
          <>
            <button 
              onClick={handleSaveDesign}
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
              <FiSave style={{ marginRight: '6px' }} /> Save Plan
            </button>
            
            <button 
              onClick={(e) => { e.preventDefault(); onStateChange('FLOORPLAN'); }}
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
              <FiCodepen style={{ marginRight: '6px' }} /> Edit Floorplan
            </button>
            
            <button 
              onClick={(e) => { e.preventDefault(); onStateChange('SHOP'); }}
              style={{
                backgroundColor: '#EEEEEE',
                color: '#1A202C',
                border: '1px solid #E2E8F0',
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
                e.currentTarget.style.backgroundColor = '#E2E8F0';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#EEEEEE';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              }}
            >
              <FiPlus style={{ marginRight: '6px' }} /> Add Items
            </button>
            
            <button 
              onClick={handleCancelEditing}
              style={{
                backgroundColor: '#E53E3E',
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
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                marginLeft: 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#C53030';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#E53E3E';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              }}
            >
              <FiX style={{ marginRight: '6px' }} /> Cancel Editing
            </button>
          </>
        )}
      </div>

      {/* Camera Controls */}
      <div id="camera-controls">
        <a href="#" className="btn btn-default bottom" onClick={handleZoomOut}>
          <span className="glyphicon glyphicon-zoom-out"></span>
        </a>
        <a href="#" className="btn btn-default bottom" onClick={handleResetView}>
          <span className="glyphicon glyphicon glyphicon-home"></span>
        </a>
        <a href="#" className="btn btn-default bottom" onClick={handleZoomIn}>
          <span className="glyphicon glyphicon-zoom-in"></span>
        </a>
        
        <span>&nbsp;</span>

        <a className="btn btn-default bottom" href="#" onClick={() => handlePan('left')}>
          <span className="glyphicon glyphicon-arrow-left"></span>
        </a>
        <span className="btn-group-vertical">
          <a className="btn btn-default" href="#" onClick={() => handlePan('up')}>
            <span className="glyphicon glyphicon-arrow-up"></span>
          </a>
          <a className="btn btn-default" href="#" onClick={() => handlePan('down')}>
            <span className="glyphicon glyphicon-arrow-down"></span>
          </a>
        </span>
        <a className="btn btn-default bottom" href="#" onClick={() => handlePan('right')}>
          <span className="glyphicon glyphicon-arrow-right"></span>
        </a>
      </div>

      {/* Discrete UID Display */}
      {currentUID && (
        <div 
          id="scene-uid" 
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            fontSize: '10px',
            color: 'rgba(0, 0, 0, 0.3)',
            fontFamily: 'monospace',
            userSelect: 'none',
            pointerEvents: 'none',
            zIndex: 1000
          }}
          title={`Scene ID: ${currentUID}`}
        >
          {currentUID.substring(0, 8)}
        </div>
      )}

    </>
  );
};

export default Viewer;
