import React, { useState, useEffect, useRef } from 'react';
import { FiSave, FiCodepen, FiPlus, FiEdit, FiX, FiClipboard, FiList, FiMap } from 'react-icons/fi';

import { useBlueprint3D } from './Blueprint3DApp';
import { useOrganizationContext } from '../../hooks/useOrganizationContext';
import { ScenesService, OrganizationsService } from '../../client';
import type { SceneCreate, SceneUpdate } from '../../client/types.gen';
import useCustomToast from '../../hooks/useCustomToast';

const Viewer: React.FC = () => {
  const { blueprint3d, currentUID, onUIDChange, onSceneSaved, onStateChange, onEditingModeChange, appState, isRealMode, selectedItem } = useBlueprint3D();
  const { getActiveOrganizationId } = useOrganizationContext();
  const showToast = useCustomToast();
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [objectDimensions, setObjectDimensions] = useState({ height: 0, width: 0, depth: 0 });
  const [isSavingObject, setIsSavingObject] = useState(false);

  // Scene picker dropdown state
  const [showScenePicker, setShowScenePicker] = useState(false);
  const [simScenes, setSimScenes] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const scenePickerRef = useRef<HTMLDivElement>(null);
  const editSnapshotRef = useRef<string | null>(null);

  const buildSerializedScene = (sceneData: any) => JSON.stringify({
    uid: sceneData?.uid ?? currentUID ?? '',
    floorplan: {
      corners: sceneData?.floorplan?.corners || {},
      walls: sceneData?.floorplan?.walls || [],
      wallTextures: sceneData?.floorplan?.wallTextures || [],
      floorTextures: sceneData?.floorplan?.floorTextures || {},
      newFloorTextures: sceneData?.floorplan?.newFloorTextures || {},
    },
    items: sceneData?.items || [],
  });

  const getExportedScenePayload = () => {
    const raw = blueprint3d?.model?.exportSerialized?.();
    if (!raw) {
      throw new Error('Blueprint3D export is not available');
    }

    const parsedData = JSON.parse(raw);
    return {
      uid: parsedData?.uid || currentUID || '',
      floorplan: {
        corners: parsedData?.floorplan?.corners || {},
        walls: parsedData?.floorplan?.walls || [],
        wallTextures: parsedData?.floorplan?.wallTextures || [],
        floorTextures: parsedData?.floorplan?.floorTextures || {},
        newFloorTextures: parsedData?.floorplan?.newFloorTextures || {},
      },
      items: parsedData?.items || [],
    };
  };

  const restoreScenePayload = (scenePayload: any) => {
    if (!blueprint3d?.model) return;
    blueprint3d.model.loadSerialized(buildSerializedScene(scenePayload));
    if (scenePayload?.uid) {
      onUIDChange(scenePayload.uid);
    }
  };

  const captureEditSnapshot = () => {
    try {
      const payload = getExportedScenePayload();
      editSnapshotRef.current = JSON.stringify(payload);
    } catch (error) {
      console.warn('Could not capture edit snapshot:', error);
    }
  };

  const filterOutRobotItems = (items: any[] = []) =>
    items.filter((item: any) => {
      const meta = item?.metadata ?? item;
      return !meta?.device_uid && !meta?.deviceId;
    });


  const roundDimension = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

  const readSelectedItemDimensions = () => {
    if (!selectedItem) return { height: 0, width: 0, depth: 0 };
    return {
      height: roundDimension(Number(selectedItem.getHeight?.() ?? 0)),
      width: roundDimension(Number(selectedItem.getWidth?.() ?? 0)),
      depth: roundDimension(Number(selectedItem.getDepth?.() ?? 0)),
    };
  };

  const refreshSelectedItemDimensions = () => {
    setObjectDimensions(readSelectedItemDimensions());
  };

  const applySelectedItemDimension = (axis: 'height' | 'width' | 'depth', rawValue: string) => {
    if (!selectedItem) return;

    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue) || nextValue <= 0) return;

    const current = readSelectedItemDimensions();
    const next = {
      ...current,
      [axis]: nextValue,
    };

    selectedItem.resize?.(next.height, next.width, next.depth);
    if (selectedItem.scene) selectedItem.scene.needsUpdate = true;
    blueprint3d?.three?.needsUpdate?.();
    setObjectDimensions(next);
  };

  useEffect(() => {
    refreshSelectedItemDimensions();
  }, [selectedItem]);

  // Close picker when clicking outside
  useEffect(() => {
    if (!showScenePicker) return;
    const handler = (e: MouseEvent) => {
      if (scenePickerRef.current && !scenePickerRef.current.contains(e.target as Node)) {
        setShowScenePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showScenePicker]);

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



  const persistCurrentScene = async ({ exitEditing }: { exitEditing: boolean }) => {
    if (!blueprint3d?.model) {
      console.error('Blueprint3D model not available');
      return null;
    }

    const activeOrgId = getActiveOrganizationId();
    if (!activeOrgId) {
      console.error('No active organization context found');
      showToast(
        'Organization Required',
        'Please select an organization before saving the plan.',
        'error'
      );
      return null;
    }

    const scenePayload = getExportedScenePayload();
    const wasExistingScene = Boolean(currentUID) && await checkSceneExists(currentUID);

    let response;

    if (wasExistingScene) {
      const updateData: SceneUpdate = {
        floorplan: scenePayload.floorplan,
        items: scenePayload.items,
        organization_id: activeOrgId,
      };

      response = await ScenesService.updateScene({
        sceneId: currentUID,
        requestBody: updateData,
      });
    } else {
      const createData: SceneCreate = {
        organization_id: activeOrgId,
        floorplan: scenePayload.floorplan,
        items: scenePayload.items,
      };

      response = await ScenesService.createScene({
        requestBody: createData,
      });
    }

    if (response?.uid) {
      onUIDChange(response.uid);
      editSnapshotRef.current = JSON.stringify({
        ...scenePayload,
        uid: response.uid,
      });
      onSceneSaved?.(response.uid);
    }

    if (exitEditing) {
      setIsEditingMode(false);
      onEditingModeChange?.(false);
      onStateChange('DESIGN');
    }

    return { response, wasExistingScene };
  };

  const handleSaveDesign = async () => {
    try {
      const result = await persistCurrentScene({ exitEditing: true });
      if (!result) return;

      if (result.wasExistingScene) {
        showToast(
          'Scene Updated Successfully!',
          `Your scene ${currentUID.substring(0, 8)}... has been updated`,
          'success'
        );
      } else {
        showToast(
          'Scene Created Successfully!',
          `Your new scene has been saved with ID: ${result.response.uid}`,
          'success'
        );
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

  const handleSaveSelectedObject = async () => {
    if (!selectedItem) return;
    setIsSavingObject(true);
    try {
      const result = await persistCurrentScene({ exitEditing: false });
      if (!result) return;

      refreshSelectedItemDimensions();
      showToast(
        'Object Saved',
        'The object dimensions, position, rotation and metadata have been saved.',
        'success'
      );
    } catch (error) {
      console.error('Error saving selected object:', error);
      showToast(
        'Object Save Failed',
        'Could not save the selected object. Check console for details.',
        'error'
      );
    } finally {
      setIsSavingObject(false);
    }
  };



  const handleEnterEditMode = () => {
    captureEditSnapshot();
    setIsEditingMode(true);
    onStateChange('DESIGN');
    if (onEditingModeChange) {
      onEditingModeChange(true);
    }
  };

  /** Open the scene picker and load the list of simulation scenes */
  const handleOpenScenePicker = async () => {
    if (showScenePicker) {
      setShowScenePicker(false);
      return;
    }
    const orgId = getActiveOrganizationId();
    if (!orgId) return;
    try {
      const scenesData = await OrganizationsService.readOrganizationScenes({ id: orgId });
      const allScenes = scenesData?.data || [];
      // Only show scenes that are not Real Mode Scene or Imported Scene
      const filtered = allScenes.filter(
        (s: any) => s.label !== 'Real Mode Scene' && s.label !== 'Imported Scene'
      );
      setSimScenes(filtered);
    } catch (e) {
      console.error('Failed to fetch scenes for picker', e);
    }
    setShowScenePicker(true);
  };

  /** Load the base Real Mode Scene */
  const handleLoadBaseScene = async () => {
    setShowScenePicker(false);
    const orgId = getActiveOrganizationId();
    if (!orgId) return;
    try {
      const scenesData = await OrganizationsService.readOrganizationScenes({ id: orgId });
      const allScenes = scenesData?.data || [];
      const base = allScenes.find((s: any) => s.label === 'Real Mode Scene');
      if (!base) {
        showToast('Not Found', 'Real Mode Scene not found.', 'error');
        return;
      }
      const sceneData = await ScenesService.readScene({ sceneId: base.uid });
      if (blueprint3d?.model) {
        blueprint3d.model.loadSerialized(JSON.stringify({
          uid: sceneData.uid,
          floorplan: sceneData.floorplan,
          items: sceneData.items || []
        }));
        onUIDChange(sceneData.uid);
        showToast('Base Scene Loaded', 'The Real Mode Scene has been restored.', 'success');
      }
    } catch (e) {
      console.error('Failed to load base scene', e);
      showToast('Error', 'Could not load the base scene.', 'error');
    }
  };

  /** Import a simulation scene into Real Mode without robot items */
  const handleImportScene = async (simScene: any) => {
    setShowScenePicker(false);
    setIsImporting(true);
    try {
      const srcScene = await ScenesService.readScene({ sceneId: simScene.uid });
      const filteredItems = filterOutRobotItems(srcScene.items || []);

      if (blueprint3d?.model) {
        restoreScenePayload({
          uid: currentUID,
          floorplan: srcScene.floorplan,
          items: filteredItems,
        });

        showToast(
          'Scene Imported',
          `"${simScene.label || simScene.uid.substring(0, 8)}" loaded without robots.`,
          'success'
        );
      }
    } catch (e) {
      console.error('Failed to import scene', e);
      showToast('Import Failed', 'Could not import the scene. Check console for details.', 'error');
    } finally {
      setIsImporting(false);
    }
  };


  const handleCancelEditing = async () => {
    try {
      if (currentUID && await checkSceneExists(currentUID)) {
        const sceneData = await ScenesService.readScene({ sceneId: currentUID });
        restoreScenePayload({
          uid: sceneData.uid,
          floorplan: sceneData.floorplan,
          items: sceneData.items || [],
        });

        editSnapshotRef.current = buildSerializedScene({
          uid: sceneData.uid,
          floorplan: sceneData.floorplan,
          items: sceneData.items || [],
        });

        showToast(
          'Changes Discarded',
          'Scene has been restored to its last saved version.',
          'success'
        );
      } else if (editSnapshotRef.current && blueprint3d?.model) {
        const snapshot = JSON.parse(editSnapshotRef.current);
        restoreScenePayload(snapshot);
        showToast(
          'Changes Discarded',
          'The plan has been restored to the state it had before editing.',
          'success'
        );
      } else {
        showToast(
          'Nothing to Restore',
          'There is no saved snapshot available for this plan.',
          'error'
        );
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
    if (onEditingModeChange) {
      onEditingModeChange(false);
    }
    onStateChange('DESIGN');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Main Controls — hidden when a side panel (SHOP, DEVICES, TASKS) is active */}
      <div
        id="main-controls"
        style={{
          display: (appState === 'SHOP' || appState === 'DEVICES' || appState === 'TASKS' || appState === 'FLOORPLAN') ? 'none' : 'flex',
          gap: '8px',
          padding: '12px',
          pointerEvents: 'auto',
        }}
      >
        {/* VIEW MODE buttons: always in DOM, toggled with display not conditional render */}
        <div style={{ display: !isEditingMode ? 'contents' : 'none' }}>
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

          {/* ── Scene Picker — only in Real Mode ───────────────────────────── */}
          {isRealMode && (
            <div ref={scenePickerRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button
                onClick={handleOpenScenePicker}
                disabled={isImporting}
                style={{
                  backgroundColor: '#2C7A7B',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isImporting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  opacity: isImporting ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isImporting) {
                    e.currentTarget.style.backgroundColor = '#285E61';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#2C7A7B';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                }}
              >
                <FiMap style={{ marginRight: '6px' }} />
                {isImporting ? 'Importing...' : 'Choose Scene'}
              </button>

              {showScenePicker && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    minWidth: '240px',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    border: '1px solid #E2E8F0',
                    zIndex: 9999,
                    overflow: 'hidden',
                  }}
                >
                  {/* Option 1 – Base Scene */}
                  <div
                    onClick={handleLoadBaseScene}
                    style={{
                      padding: '10px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#2D3748',
                      borderBottom: '1px solid #EDF2F7',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#EBF8FF')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    🏠 Base Scene
                  </div>

                  {/* Divider label */}
                  <div style={{ padding: '6px 16px 4px', fontSize: '11px', color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                    Import from Simulation
                  </div>

                  {/* Option 2 – Simulation scenes list */}
                  {simScenes.length === 0 ? (
                    <div style={{ padding: '8px 16px', fontSize: '13px', color: '#718096' }}>
                      No simulation scenes found
                    </div>
                  ) : (
                    simScenes.map((scene) => (
                      <div
                        key={scene.uid}
                        onClick={() => handleImportScene(scene)}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px',
                          color: '#2D3748',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#F0FFF4')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        📋 {scene.label || scene.uid.substring(0, 8)}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {!isRealMode && (
            <button
              onClick={(e) => { e.preventDefault(); onStateChange('TASK_LIST' as any); }}
              style={{
                backgroundColor: '#6B46C1',
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
                e.currentTarget.style.backgroundColor = '#553C9A';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#6B46C1';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              }}
            >
              <FiList style={{ marginRight: '6px' }} /> View Tasks
            </button>
          )}
        </div>

        {/* EDIT MODE buttons: always in DOM, toggled with display not conditional render */}
        <div style={{ display: isEditingMode ? 'contents' : 'none' }}>
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
            onClick={(e) => { e.preventDefault(); onStateChange('DEVICES'); }}
            style={{
              backgroundColor: '#2B6CB0',
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
              e.currentTarget.style.backgroundColor = '#2C5282';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2B6CB0';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            }}
          >
            <FiPlus style={{ marginRight: '6px' }} /> Add Devices
          </button>

          {!isRealMode && (
            <button
              onClick={(e) => { e.preventDefault(); onStateChange('TASKS'); }}
              style={{
                backgroundColor: '#DD6B20',
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
                e.currentTarget.style.backgroundColor = '#C05621';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#DD6B20';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              }}
            >
              <FiClipboard style={{ marginRight: '6px' }} /> Add Tasks
            </button>
          )}

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
        </div>
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

    </div>
  );
};

export default Viewer;
