import {
  Box,
  Container,
  Text,
  Heading,
  useColorModeValue,
  Card,
  CardBody,
  Flex,
  Center,
  Button,
  VStack,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Switch,
  FormControl,
  FormLabel,
  Divider,
  IconButton,
} from "@chakra-ui/react";

import { createFileRoute } from "@tanstack/react-router";
import Blueprint3DApp, { Blueprint3DAppRef } from "../../components/Blueprint3D/Blueprint3DApp";
import ScenesList from "../../components/Blueprint3D/ScenesList";
import "../../components/Blueprint3D/Blueprint3DApp.css";
import { useOrganizationContext } from "../../hooks/useOrganizationContext";
import { createDefaultFloorplan } from "../../components/Blueprint3D/utils";
import { ScenesService } from "../../client";
import useCustomToast from "../../hooks/useCustomToast";
import { useState, useRef, useEffect } from "react";
import { FiTrash2, FiX } from "react-icons/fi";

export const Route = createFileRoute("/_layout/site22")({
  component: Site,
});

// Item Editing Panel Component - receives selectedItem and onClose as props to avoid context issues
function ItemEditingPanel({ selectedItem, onClose }: { selectedItem: any, onClose: () => void }) {
  const [itemDimensions, setItemDimensions] = useState({ width: 0, height: 0, depth: 0 });
  const [isFixed, setIsFixed] = useState(false);
  
  const cardBg = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.800", "white");
  const borderColor = useColorModeValue("gray.200", "gray.600");

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
    }
  }, [selectedItem]);

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

  if (!selectedItem) {
    return null;
  }

  return (
    <Card
      position="absolute"
      top={4}
      right={4}
      width="280px"
      bg={cardBg}
      color={textColor}
      borderColor={borderColor}
      borderWidth="1px"
      boxShadow="lg"
      zIndex={20}
    >
      <CardBody p={4}>
        <VStack spacing={4} align="stretch">
          <Box>
            <Flex justify="space-between" align="center" mb={2}>
              <Text fontSize="lg" fontWeight="bold">
                {selectedItem.metadata?.itemName || 'Selected Item'}
              </Text>
              <IconButton 
                aria-label="Close item panel" 
                icon={<FiX />} 
                size="sm" 
                variant="ghost" 
                onClick={onClose} 
              />
            </Flex>
            <Divider />
          </Box>

          <VStack spacing={3} align="stretch">
            <Text fontSize="sm" fontWeight="medium" color="gray.500">
              Dimensions (inches)
            </Text>
            
            <FormControl>
              <FormLabel fontSize="sm">Width</FormLabel>
              <NumberInput
                size="sm"
                value={itemDimensions.width}
                onChange={(_, value) => handleDimensionChange('width', value || 0)}
                min={1}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Height</FormLabel>
              <NumberInput
                size="sm"
                value={itemDimensions.height}
                onChange={(_, value) => handleDimensionChange('height', value || 0)}
                min={1}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Depth</FormLabel>
              <NumberInput
                size="sm"
                value={itemDimensions.depth}
                onChange={(_, value) => handleDimensionChange('depth', value || 0)}
                min={1}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
          </VStack>

          <FormControl display="flex" alignItems="center">
            <FormLabel fontSize="sm" mb={0}>
              Fixed Position
            </FormLabel>
            <Switch
              isChecked={isFixed}
              onChange={(e) => handleFixedChange(e.target.checked)}
              colorScheme="blue"
            />
          </FormControl>

          <Button
            leftIcon={<FiTrash2 />}
            colorScheme="red"
            variant="outline"
            size="sm"
            onClick={handleDeleteItem}
          >
            Delete Item
          </Button>
        </VStack>
      </CardBody>
    </Card>
  );
}

// Wall/Floor Editing Panel Component - receives selectedWall/selectedFloor as props
function WallFloorEditingPanel({ selectedWall, selectedFloor, onClose }: { selectedWall: any, selectedFloor: any, onClose: () => void }) {
  const cardBg = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.800", "white");
  const borderColor = useColorModeValue("gray.200", "gray.600");



  // Available textures with proper parameters (url, stretch, scale)
  const wallTextures = [
    { name: 'Default Wall', url: '/plan3d/rooms/textures/wallmap.png', thumbnail: '/plan3d/rooms/textures/wallmap.png', stretch: true, scale: 0 },
    { name: 'Yellow Wall', url: '/plan3d/rooms/textures/wallmap_yellow.png', thumbnail: '/plan3d/rooms/thumbnails/thumbnail_wallmap_yellow.png', stretch: true, scale: 0 },
    { name: 'Light Brick', url: '/plan3d/rooms/textures/light_brick.jpg', thumbnail: '/plan3d/rooms/thumbnails/thumbnail_light_brick.jpg', stretch: false, scale: 100 },
    { name: 'Light Wood', url: '/plan3d/rooms/textures/light_fine_wood.jpg', thumbnail: '/plan3d/rooms/thumbnails/thumbnail_light_fine_wood.jpg', stretch: false, scale: 300 },
  ];

  const floorTextures = [
    { name: 'Hardwood', url: '/plan3d/rooms/textures/hardwood.png', thumbnail: '/plan3d/rooms/textures/hardwood.png', stretch: false, scale: 400 },
    { name: 'Marble Tiles', url: '/plan3d/rooms/textures/marbletiles.jpg', thumbnail: '/plan3d/rooms/thumbnails/thumbnail_marbletiles.jpg', stretch: false, scale: 300 },
    { name: 'Light Wood', url: '/plan3d/rooms/textures/light_fine_wood.jpg', thumbnail: '/plan3d/rooms/thumbnails/thumbnail_light_fine_wood.jpg', stretch: false, scale: 300 },
  ];

  // Preload texture images for faster loading
  useEffect(() => {
    const preloadImages = (textures: any[]) => {
      textures.forEach(texture => {
        const img = new Image();
        img.onload = () => console.log(`✅ Preloaded: ${texture.url}`);
        img.onerror = (e) => console.error(`❌ Failed to preload: ${texture.url}`, e);
        img.src = texture.url;
        
        const thumbImg = new Image();
        thumbImg.onload = () => console.log(`✅ Preloaded thumbnail: ${texture.thumbnail}`);
        thumbImg.onerror = (e) => console.error(`❌ Failed to preload thumbnail: ${texture.thumbnail}`, e);
        thumbImg.src = texture.thumbnail;
      });
    };

    console.log('🔄 Starting texture preload...');
    preloadImages([...wallTextures, ...floorTextures]);
  }, []); // Empty dependency array since texture arrays are static

  const handleTextureChange = (textureUrl: string, stretch: boolean, scale: number) => {
    console.log(`🎨 Applying texture: ${textureUrl}`, { stretch, scale });
    
    try {
      if (selectedWall) {
        console.log('🧱 Applying to wall:', selectedWall);
        selectedWall.setTexture(textureUrl, stretch, scale);
      } else if (selectedFloor) {
        console.log('🏠 Applying to floor:', selectedFloor);
        selectedFloor.setTexture(textureUrl, stretch, scale);
      } else {
        console.error('❌ No wall or floor selected!');
        return;
      }
      
      // Close menu immediately after texture application
      onClose();
      
    } catch (error) {
      console.error('❌ Texture application failed:', error);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const selectedObject = selectedWall || selectedFloor;
  if (!selectedObject) {
    return null;
  }

  const isWall = !!selectedWall;
  const textures = isWall ? wallTextures : floorTextures;
  const objectType = isWall ? 'Wall' : 'Floor';

  return (
    <Card
      position="absolute"
      top={4}
      left={4}
      width="280px"
      bg={cardBg}
      color={textColor}
      borderColor={borderColor}
      borderWidth="1px"
      boxShadow="lg"
      zIndex={20}
    >
      <CardBody p={4}>
        <VStack spacing={4} align="stretch">
          <Box>
            <Flex justify="space-between" align="center" mb={2}>
              <Text fontSize="lg" fontWeight="bold">
                {objectType} Texture
              </Text>
              <IconButton
                aria-label="Close texture panel"
                icon={<FiX />}
                size="sm"
                variant="ghost"
                onClick={handleClose}
              />
            </Flex>
            <Divider />
          </Box>

          <VStack spacing={3} align="stretch">
            <Text fontSize="sm" fontWeight="medium" color="gray.500">
              Select a texture:
            </Text>
            
            <Box maxHeight="300px" overflowY="auto">
              <VStack spacing={2}>
                {textures.map((texture, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    colorScheme="gray"
                    size="sm"
                    width="full"
                    height="60px"
                    onClick={() => handleTextureChange(texture.url, texture.stretch, texture.scale)}
                    leftIcon={
                      <Box
                        width="40px"
                        height="40px"
                        borderRadius="4px"
                        backgroundImage={`url(${texture.thumbnail})`}
                        backgroundSize="cover"
                        backgroundPosition="center"
                        border="1px solid"
                        borderColor="gray.300"
                      />
                    }
                    justifyContent="flex-start"
                    px={3}
                  >
                    <Text fontSize="sm" ml={2}>
                      {texture.name}
                    </Text>
                  </Button>
                ))}
              </VStack>
            </Box>
          </VStack>
        </VStack>
      </CardBody>
    </Card>
  );
}

function Site() {
  const bgColor = useColorModeValue("ui.light", "ui.dark");
  const cardBg = useColorModeValue("white", "gray.800");
  
  // Get the active organization context
  const { activeOrganizationContext } = useOrganizationContext();
  
  // State for selected scene
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  
  // State to track if a scene has been loaded
  const [hasLoadedScene, setHasLoadedScene] = useState<boolean>(false);
  
  // State to track if user is in editing mode
  const [isEditingMode, setIsEditingMode] = useState<boolean>(false);
  
  // State to track selected item for editing
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  // State to track selected wall/floor for texture editing
  const [selectedWall, setSelectedWall] = useState<any>(null);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);
  
  // Toast for notifications
  const showToast = useCustomToast();
  
  // Ref to access Blueprint3D functions
  const blueprint3DRef = useRef<Blueprint3DAppRef>(null);
  
  // Ref to access ScenesList functions for refreshing
  const scenesListRef = useRef<any>(null);
  
  // Track the previous organization UID to detect actual changes
  const prevOrgUidRef = useRef<string | undefined>(activeOrganizationContext?.uid);
  
  // Effect to handle organization context changes
  useEffect(() => {
    const currentOrgUid = activeOrganizationContext?.uid;
    const prevOrgUid = prevOrgUidRef.current;
    
    // Only reset if the organization actually changed (not on initial load)
    if (prevOrgUid !== undefined && currentOrgUid !== prevOrgUid) {
      console.log('Organization context changed, resetting viewer');
      
      // Reset the viewer when organization context changes
      setHasLoadedScene(false);
      setSelectedScene(null);
      
      // Show notification about the reset
      showToast(
        'Context Changed',
        'Viewer reset due to organization change. Please select a new scene.',
        'success'
      );
    }
    
    // Update the ref for next comparison
    prevOrgUidRef.current = currentOrgUid;
  }, [activeOrganizationContext?.uid, showToast]); // Only depend on organization UID and showToast
  
  // Handle creating a new plan
  const handleCreateNewPlan = () => {
    // Prevent creating new plans while in editing mode
    if (isEditingMode) {
      showToast(
        'Cannot Create New Plan',
        'Please finish editing or cancel editing before creating a new plan.',
        'error'
      );
      return;
    }
    
    const defaultPlan = createDefaultFloorplan();
    console.log('Creating new plan:', defaultPlan);
    
    // Load the plan into the Blueprint3D viewer
    if (blueprint3DRef.current) {
      blueprint3DRef.current.loadPlan(defaultPlan);
      setHasLoadedScene(true);
      console.log('Plan loaded into viewer automatically');
    } else {
      console.warn('Blueprint3D ref not available, plan not loaded');
    }
  };
  
  // Handle scene selection and loading
  const handleSceneSelection = async (sceneId: string) => {
    // Prevent scene changes while in editing mode
    if (isEditingMode) {
      showToast(
        'Cannot Change Scene',
        'Please finish editing or cancel editing before selecting a different scene.',
        'error'
      );
      return;
    }
    
    setSelectedScene(sceneId);
    console.log("Selected scene:", sceneId);
    
    try {
      // Fetch the scene data from the API
      console.log('Fetching scene data for:', sceneId);
      const sceneData = await ScenesService.readScene({ sceneId });
      
      console.log('Scene data received:', sceneData);
      
      // Transform the scene data to the format expected by Blueprint3D
      const blueprintData = {
        uid: sceneData.uid,
        floorplan: sceneData.floorplan,
        items: sceneData.items || []
      };
      
      // Load the scene into the Blueprint3D viewer
      if (blueprint3DRef.current) {
        blueprint3DRef.current.loadPlan(blueprintData);
        setHasLoadedScene(true);
        console.log('Scene loaded into viewer:', sceneId);
        
        showToast(
          'Scene Loaded',
          `Scene ${sceneId.substring(0, 8)}... has been loaded successfully`,
          'success'
        );
      } else {
        console.warn('Blueprint3D ref not available, scene not loaded');
        showToast(
          'Load Error',
          'Blueprint3D viewer not ready. Please try again.',
          'error'
        );
      }
    } catch (error) {
      console.error('Error loading scene:', error);
      showToast(
        'Load Failed',
        'Failed to load the selected scene. Please try again.',
        'error'
      );
    }
  };

  // Handle when a scene is saved
  const handleSceneSaved = (sceneId: string) => {
    console.log('Scene saved, refreshing scenes list:', sceneId);
    
    // Refresh the scenes list if the ref is available
    if (scenesListRef.current && scenesListRef.current.refreshScenes) {
      scenesListRef.current.refreshScenes();
    }
  };

  // Handle editing mode changes
  const handleEditingModeChange = (editingMode: boolean) => {
    setIsEditingMode(editingMode);
    
    // Control Blueprint3D controller enabled state based on editing mode
    if (blueprint3DRef.current) {
      blueprint3DRef.current.setControllerEnabled(editingMode);
    }
    
    // Clear selections when exiting editing mode
    if (!editingMode) {
      setSelectedItem(null);
      setSelectedWall(null);
      setSelectedFloor(null);
      
      // Also clear Blueprint3D selections
      if (blueprint3DRef.current) {
        blueprint3DRef.current.clearSelections();
      }
    }
  };

  // Handle selected item changes
  const handleSelectedItemChange = (item: any) => {
    setSelectedItem(item);
  };

  // Handle selected wall changes
  const handleSelectedWallChange = (wall: any) => {
    setSelectedWall(wall);
  };

  // Handle selected floor changes
  const handleSelectedFloorChange = (floor: any) => {
    setSelectedFloor(floor);
  };

  // Handle closing the wall/floor texture panel
  const handleCloseTexturePanel = () => {
    console.log('🚪 handleCloseTexturePanel called - clearing wall/floor selections');
    // Clear the local state to hide the dialog
    setSelectedWall(null);
    setSelectedFloor(null);
    
    // Also clear Blueprint3D selections
    if (blueprint3DRef.current) {
      console.log('🔧 Calling clearSelections on Blueprint3D ref');
      blueprint3DRef.current.clearSelections();
    } else {
      console.error('❌ Blueprint3D ref is null!');
    }
  };

  return (
    <Container maxW="full" bg={bgColor} minH="100vh">
      <Box pt={12} px={4} height="100vh" overflowY="auto">
        <Heading size="lg" textAlign={{ base: "center", md: "left" }} mb={8}>
          Site Management
        </Heading>
        
        {/* Organization Context Header */}
        {activeOrganizationContext && (
          <Box
            bg={useColorModeValue("blue.50", "blue.900")}
            border="1px solid"
            borderColor={useColorModeValue("blue.200", "blue.700")}
            borderRadius="md"
            p={3}
            mb={4}
          >
            <Text fontSize="sm" color={useColorModeValue("blue.700", "blue.200")} fontWeight="medium">
              📍 Viewing site from: <strong>{activeOrganizationContext.name}</strong>
            </Text>
          </Box>
        )}

        {!activeOrganizationContext && (
          <Box
            bg={useColorModeValue("yellow.50", "yellow.900")}
            border="1px solid"
            borderColor={useColorModeValue("yellow.200", "yellow.700")}
            borderRadius="md"
            p={3}
            mb={4}
          >
            <Text fontSize="sm" color={useColorModeValue("yellow.700", "yellow.200")} fontWeight="medium">
              ⚠️ Please select an organization from the sidebar to start designing
            </Text>
          </Box>
        )}
        
        <Box
          bg={cardBg}
          borderRadius="lg"
          p={6}
          boxShadow="sm"
          height="75%"
        >
          <Flex gap="20px" direction={{ base: "column", md: "row" }} height="100%">
            {/* Left: Scenes List */}
            <Box flexBasis={{ base: "100%", md: "20%" }} height="100%">
              <ScenesList
                ref={scenesListRef}
                title="Scenes List"
                selectedId={selectedScene}
                setSelectedId={handleSceneSelection}
                onCreateNewPlan={handleCreateNewPlan}
              />
            </Box>

            {/* Right: Blueprint3D Application */}
            <Box flexBasis={{ base: "100%", md: "80%" }} height="100%">
              <Card
                height="100%"
                width="100%"
                variant="outline"
                borderColor={useColorModeValue("gray.200", "gray.600")}
              >
                <CardBody 
                  height="100%" 
                  p={0}
                  overflow="hidden"
                  position="relative"
                >
                  {/* Always render Blueprint3D Application for ref availability */}
                  <Blueprint3DApp 
                    ref={blueprint3DRef}
                    onSceneSaved={handleSceneSaved}
                    onEditingModeChange={handleEditingModeChange}
                    onSelectedItemChange={handleSelectedItemChange}
                    onSelectedWallChange={handleSelectedWallChange}
                    onSelectedFloorChange={handleSelectedFloorChange}
                  />
                  
                  {/* Show overlay message when no scene is loaded */}
                  {!hasLoadedScene && (
                    <Center 
                      position="absolute" 
                      top={0} 
                      left={0} 
                      right={0} 
                      bottom={0} 
                      bg={useColorModeValue("white", "gray.800")}
                      zIndex={10}
                    >
                      <Text 
                        fontSize="lg" 
                        color={useColorModeValue("gray.500", "gray.400")}
                        textAlign="center"
                      >
                        Select a scene to view details
                      </Text>
                    </Center>
                  )}
                  
                  {/* Item Editing Panel - appears when an item is selected AND in editing mode */}
                  {selectedItem && isEditingMode && (
                    <ItemEditingPanel 
                      selectedItem={selectedItem} 
                      onClose={() => {
                        if (blueprint3DRef.current) {
                          blueprint3DRef.current.clearSelections();
                        }
                      }}
                    />
                  )}
                  
                  {/* Wall/Floor Editing Panel - appears when a wall or floor is selected AND in editing mode */}
                  {isEditingMode && (
                    <WallFloorEditingPanel 
                      selectedWall={selectedWall} 
                      selectedFloor={selectedFloor} 
                      onClose={handleCloseTexturePanel}
                    />
                  )}
                </CardBody>
              </Card>
            </Box>
          </Flex>
        </Box>
      </Box>
    </Container>
  );
}
