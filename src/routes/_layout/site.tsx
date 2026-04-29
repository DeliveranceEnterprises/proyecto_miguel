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
  Select
} from "@chakra-ui/react";

import { createFileRoute } from "@tanstack/react-router";
import Blueprint3DApp, { Blueprint3DAppRef } from "../../components/Blueprint3D/Blueprint3DApp";
import ScenesList from "../../components/Blueprint3D/ScenesList";
import RobotInfoPanel from "../../components/Blueprint3D/RobotInfoPanel";
import PredictionPanel from "../../components/Blueprint3D/PredictionPanel";
import "../../components/Blueprint3D/Blueprint3DApp.css";
import { useOrganizationContext } from "../../hooks/useOrganizationContext";
import { createDefaultFloorplan } from "../../utils/utils";
import { OrganizationsService, ScenesService } from "../../client";
import useCustomToast from "../../hooks/useCustomToast";
import { useState, useRef, useEffect, useCallback, type SyntheticEvent } from "react";
import { FiSave, FiTrash2, FiX } from "react-icons/fi";
import {
  applyWallRelativePlacement,
  getCurrentWallRelativePlacement,
  getWallPlacementOptions,
} from "../../utils/floorplanWallPositioning";

export const Route = createFileRoute("/_layout/site")({
  component: Site,
});

type RealModePanel = "robots" | "prediction" | null;

const SITE_NAVIGATION_STATE_KEY = "site:navigation-state";

type StoredSiteNavigationState = {
  selectedScene: string | null;
  previousSimulationScene: string | null;
  isRealMode: boolean;
  openRealPanel: RealModePanel;
};

function readStoredSiteNavigationState(): StoredSiteNavigationState | null {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.sessionStorage.getItem(SITE_NAVIGATION_STATE_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as Partial<StoredSiteNavigationState>;

    return {
      selectedScene: typeof parsed.selectedScene === "string" ? parsed.selectedScene : null,
      previousSimulationScene:
        typeof parsed.previousSimulationScene === "string"
          ? parsed.previousSimulationScene
          : null,
      isRealMode: parsed.isRealMode === true,
      openRealPanel:
        parsed.openRealPanel === "robots" || parsed.openRealPanel === "prediction"
          ? parsed.openRealPanel
          : null,
    };
  } catch (error) {
    console.warn("Could not read stored site navigation state:", error);
    return null;
  }
}

function clearStoredSiteNavigationState() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(SITE_NAVIGATION_STATE_KEY);
  } catch (error) {
    console.warn("Could not clear stored site navigation state:", error);
  }
}

type ChargerEditorValues = {
  sceneX: number;
  sceneZ: number;
  rotationDeg: number;
  realOriginX: number;
  realOriginY: number;
  realRotationOffsetRad: number;
  xScale: number;
  yScale: number;
  xOffset: number;
  yOffset: number;
};

type ChargerEditorFormValues = {
  sceneX: string;
  sceneZ: string;
  rotationDeg: string;
  realOriginX: string;
  realOriginY: string;
  realRotationOffsetRad: string;
  xScale: string;
  yScale: string;
  xOffset: string;
  yOffset: string;
};

type ItemDimensionsFormValues = {
  width: string;
  height: string;
  depth: string;
};

type WallPlacementFormValues = {
  wallId: string;
  alongM: string;
  offsetM: string;
};

const roundTo = (value: number, decimals = 3) => Number(Number(value || 0).toFixed(decimals));
const radToDeg = (rad: number) => rad * (180 / Math.PI);
const degToRad = (deg: number) => deg * (Math.PI / 180);

const isChargerItem = (item: any) => {
  if (!item) return false;
  const metadata = item.metadata || {};
  return metadata.anchor_type === "charger" || item.anchor_type === "charger" || metadata.itemName === "Cargador";
};

const getItemMetadataNumber = (item: any, key: string, fallback = 0) => {
  const metadata = item?.metadata;
  const raw = metadata && typeof metadata === "object" ? metadata[key] : undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const ensureItemMetadata = (item: any) => {
  if (!item.metadata || typeof item.metadata !== "object") {
    item.metadata = {};
  }
  return item.metadata;
};

const markItemDirty = (item: any) => {
  if (!item) return;
  if (item.scene) {
    item.scene.needsUpdate = true;
  }
  if (typeof item.changed === "function") {
    item.changed();
  }
};

const getChargerEditorValues = (item: any): ChargerEditorValues => ({
  sceneX: roundTo(Number(item?.position?.x) || 0),
  sceneZ: roundTo(Number(item?.position?.z) || 0),
  rotationDeg: roundTo(radToDeg(Number(item?.rotation?.y) || 0), 2),
  realOriginX: roundTo(getItemMetadataNumber(item, "real_origin_x", 0)),
  realOriginY: roundTo(getItemMetadataNumber(item, "real_origin_y", 0)),
  realRotationOffsetRad: roundTo(getItemMetadataNumber(item, "real_rotation_offset_rad", 0), 4),
  xScale: roundTo(getItemMetadataNumber(item, "x_scale", 100)),
  yScale: roundTo(getItemMetadataNumber(item, "y_scale", 100)),
  xOffset: roundTo(getItemMetadataNumber(item, "x_offset", 0)),
  yOffset: roundTo(getItemMetadataNumber(item, "y_offset", 0)),
});

const chargerValuesToForm = (values: ChargerEditorValues): ChargerEditorFormValues => ({
  sceneX: values.sceneX.toString(),
  sceneZ: values.sceneZ.toString(),
  rotationDeg: values.rotationDeg.toString(),
  realOriginX: values.realOriginX.toString(),
  realOriginY: values.realOriginY.toString(),
  realRotationOffsetRad: values.realRotationOffsetRad.toString(),
  xScale: values.xScale.toString(),
  yScale: values.yScale.toString(),
  xOffset: values.xOffset.toString(),
  yOffset: values.yOffset.toString(),
});

const chargerFormToValues = (form: ChargerEditorFormValues): ChargerEditorValues => ({
  sceneX: Number(form.sceneX) || 0,
  sceneZ: Number(form.sceneZ) || 0,
  rotationDeg: Number(form.rotationDeg) || 0,
  realOriginX: Number(form.realOriginX) || 0,
  realOriginY: Number(form.realOriginY) || 0,
  realRotationOffsetRad: Number(form.realRotationOffsetRad) || 0,
  xScale: Number(form.xScale) || 0,
  yScale: Number(form.yScale) || 0,
  xOffset: Number(form.xOffset) || 0,
  yOffset: Number(form.yOffset) || 0,
});

const applyChargerEditorValues = (item: any, values: ChargerEditorValues) => {
  if (!item) return;
  const metadata = ensureItemMetadata(item);

  item.position.x = Number(values.sceneX) || 0;
  item.position.z = Number(values.sceneZ) || 0;
  item.rotation.y = degToRad(Number(values.rotationDeg) || 0);

  metadata.real_origin_x = Number(values.realOriginX) || 0;
  metadata.real_origin_y = Number(values.realOriginY) || 0;
  metadata.real_rotation_offset_rad = Number(values.realRotationOffsetRad) || 0;
  metadata.x_scale = Number(values.xScale) || 0;
  metadata.y_scale = Number(values.yScale) || 0;
  metadata.x_offset = Number(values.xOffset) || 0;
  metadata.y_offset = Number(values.yOffset) || 0;

  if (!metadata.anchor_uid) {
    metadata.anchor_uid = item.anchor_uid || `charger-${Date.now()}`;
  }
  metadata.anchor_type = "charger";
  item.anchor_uid = metadata.anchor_uid;
  item.anchor_type = "charger";
  item.linked_robot_uid = metadata.linked_robot_uid ?? item.linked_robot_uid ?? null;

  markItemDirty(item);
};

function EditorOverlay({ children }: { children: any }) {
  return (
    <Box
      position="absolute"
      inset={0}
      zIndex={40}
      pointerEvents="none"
      overflow="hidden"
    >
      {children}
    </Box>
  );
}

function ItemEditingPanel({
  selectedItem,
  onClose,
  onStartFloorplanPlacement,
  isFloorplanPlacementActive,
  refreshKey,
  onItemUpdated,
  onSaveItem,
  isSavingItem,
  onFormFocusChange,
  getBlueprint3D,
}: {
  selectedItem: any;
  onClose: () => void;
  onStartFloorplanPlacement?: (item: any) => void;
  isFloorplanPlacementActive?: boolean;
  refreshKey?: number;
  onItemUpdated?: () => void;
  onSaveItem?: () => Promise<void> | void;
  isSavingItem?: boolean;
  onFormFocusChange?: (focused: boolean) => void;
  getBlueprint3D?: () => any;
}) {
  const [itemDimensions, setItemDimensions] = useState<ItemDimensionsFormValues>({
    width: "0.00",
    height: "0.00",
    depth: "0.00",
  });

  const baseDimensionsRef = useRef({ width: 0, height: 0, depth: 0 });
  const prevSelectedItemRef = useRef<any>(null);
  const [isFixed, setIsFixed] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [chargerValues, setChargerValues] = useState<ChargerEditorFormValues>(() =>
    chargerValuesToForm(getChargerEditorValues(selectedItem))
  );
  const [wallPlacement, setWallPlacement] = useState<WallPlacementFormValues>({
    wallId: "",
    alongM: "0.00",
    offsetM: "0.00",
  });

  const cardBg = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.800", "white");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const wallOptions = getWallPlacementOptions(getBlueprint3D?.());

  useEffect(() => {
    if (prevSelectedItemRef.current !== selectedItem) {
      prevSelectedItemRef.current = selectedItem;
      setIsDirty(false);
    }
  }, [selectedItem]);

  useEffect(() => {
    if (selectedItem && !isDirty) {
      const cmToM = (cm: number) => cm / 100;

      const dims = {
        width: cmToM(selectedItem.getWidth()).toFixed(2),
        height: cmToM(selectedItem.getHeight()).toFixed(2),
        depth: cmToM(selectedItem.getDepth()).toFixed(2),
      };

      setItemDimensions(dims);
      baseDimensionsRef.current = {
        width: Number(dims.width),
        height: Number(dims.height),
        depth: Number(dims.depth),
      };

      setIsFixed(selectedItem.fixed || false);

      if (isChargerItem(selectedItem)) {
        setChargerValues(chargerValuesToForm(getChargerEditorValues(selectedItem)));
      }

      const currentWallPlacement = getCurrentWallRelativePlacement(getBlueprint3D?.(), selectedItem);
      if (currentWallPlacement) {
        setWallPlacement({
          wallId: currentWallPlacement.wallId,
          alongM: currentWallPlacement.alongM.toFixed(2),
          offsetM: currentWallPlacement.offsetM.toFixed(2),
        });
      } else if (wallOptions.length > 0) {
        setWallPlacement((prev) => ({
          ...prev,
          wallId: prev.wallId || wallOptions[0].id,
        }));
      }
    }
  }, [selectedItem, refreshKey, isDirty]);

  const handleDeleteItem = () => {
    if (selectedItem) selectedItem.remove();
  };

  const stopScenePointerEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    const nativeEvent = event.nativeEvent as Event & {
      stopImmediatePropagation?: () => void;
    };
    nativeEvent.stopImmediatePropagation?.();
  };

  const handleDimensionChange = (
    dimension: keyof ItemDimensionsFormValues,
    value: string
  ) => {
    setIsDirty(true);
    setItemDimensions((prev) => ({ ...prev, [dimension]: value }));
  };

  const handleResize = () => {
    if (!selectedItem) return;

    const base = baseDimensionsRef.current;
    const current = {
      width: Number(itemDimensions.width),
      height: Number(itemDimensions.height),
      depth: Number(itemDimensions.depth),
    };

    if (
      !Number.isFinite(current.width) ||
      !Number.isFinite(current.height) ||
      !Number.isFinite(current.depth) ||
      current.width <= 0 ||
      current.height <= 0 ||
      current.depth <= 0
    ) {
      return;
    }

    const ratios = {
      width: base.width > 0 ? current.width / base.width : 1,
      height: base.height > 0 ? current.height / base.height : 1,
      depth: base.depth > 0 ? current.depth / base.depth : 1,
    };

    const changedDim = (Object.keys(ratios) as Array<"width" | "height" | "depth">).reduce(
      (a, b) => (Math.abs(ratios[a] - 1) >= Math.abs(ratios[b] - 1) ? a : b)
    );

    const ratio = ratios[changedDim];

    const newDims = {
      width: Number((base.width * ratio).toFixed(2)),
      height: Number((base.height * ratio).toFixed(2)),
      depth: Number((base.depth * ratio).toFixed(2)),
    };

    const mToCm = (m: number) => m * 100;
    selectedItem.resize(
      mToCm(newDims.height),
      mToCm(newDims.width),
      mToCm(newDims.depth),
    );

    setItemDimensions({
      width: newDims.width.toFixed(2),
      height: newDims.height.toFixed(2),
      depth: newDims.depth.toFixed(2),
    });
    setIsDirty(false);

    baseDimensionsRef.current = { ...newDims };
    onItemUpdated?.();
  };

  const handleResizeIndependent = () => {
    if (!selectedItem) return;

    const current = {
      width: Number(itemDimensions.width),
      height: Number(itemDimensions.height),
      depth: Number(itemDimensions.depth),
    };

    if (
      !Number.isFinite(current.width) ||
      !Number.isFinite(current.height) ||
      !Number.isFinite(current.depth) ||
      current.width <= 0 ||
      current.height <= 0 ||
      current.depth <= 0
    ) {
      return;
    }

    const newDims = {
      width: Number(current.width.toFixed(2)),
      height: Number(current.height.toFixed(2)),
      depth: Number(current.depth.toFixed(2)),
    };

    const mToCm = (m: number) => m * 100;

    // Blueprint3D expects resize(height, width, depth) in centimeters.
    // Here each axis is passed directly so width, height and depth can change independently.
    selectedItem.resize(
      mToCm(newDims.height),
      mToCm(newDims.width),
      mToCm(newDims.depth),
    );

    setItemDimensions({
      width: newDims.width.toFixed(2),
      height: newDims.height.toFixed(2),
      depth: newDims.depth.toFixed(2),
    });
    setIsDirty(false);

    baseDimensionsRef.current = { ...newDims };
    onItemUpdated?.();
  };

  const handleSaveItem = async () => {
    await onSaveItem?.();
  };

  const handleFixedChange = (checked: boolean) => {
    if (selectedItem) {
      selectedItem.setFixed(checked);
      setIsFixed(checked);
      onItemUpdated?.();
    }
  };

  const handleWallPlacementChange = (
    field: keyof WallPlacementFormValues,
    value: string
  ) => {
    setWallPlacement((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApplyWallPlacement = () => {
    if (!selectedItem) return;

    const applied = applyWallRelativePlacement(
      getBlueprint3D?.(),
      selectedItem,
      wallPlacement.wallId,
      Number(wallPlacement.alongM),
      Number(wallPlacement.offsetM)
    );

    if (!applied) return;

    const currentWallPlacement = getCurrentWallRelativePlacement(getBlueprint3D?.(), selectedItem);
    if (currentWallPlacement) {
      setWallPlacement({
        wallId: currentWallPlacement.wallId,
        alongM: currentWallPlacement.alongM.toFixed(2),
        offsetM: currentWallPlacement.offsetM.toFixed(2),
      });
    }

    if (isChargerItem(selectedItem)) {
      setChargerValues(chargerValuesToForm(getChargerEditorValues(selectedItem)));
    }

    setIsDirty(false);
    onItemUpdated?.();
  };

  const handleChargerValueChange = (
    field: keyof ChargerEditorFormValues,
    value: string
  ) => {
    setIsDirty(true);
    setChargerValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApplyChargerValues = () => {
    if (!selectedItem || !isChargerItem(selectedItem)) return;
    applyChargerEditorValues(selectedItem, chargerFormToValues(chargerValues));
    setChargerValues(chargerValuesToForm(getChargerEditorValues(selectedItem)));
    setIsDirty(false);
    onItemUpdated?.();
    onClose();
  };

  if (!selectedItem) return null;

  return (
    <EditorOverlay>
      <Card
        position="absolute"
        top={{ base: "18px", md: "18px" }}
        right={{ base: "16px", md: "16px" }}
        width={{ base: "300px", md: "340px" }}
        maxH="calc(100% - 36px)"
        display="flex"
        flexDirection="column"
        bg={cardBg}
        color={textColor}
        borderColor={borderColor}
        borderWidth="1px"
        boxShadow="2xl"
        zIndex={41}
        pointerEvents="auto"
        onMouseDown={stopScenePointerEvent}
        onPointerDown={stopScenePointerEvent}
        onTouchStart={stopScenePointerEvent}
        onFocusCapture={() => onFormFocusChange?.(true)}
        onBlurCapture={(event) => {
          const nextFocusedElement = event.relatedTarget as Node | null;
          if (!event.currentTarget.contains(nextFocusedElement)) {
            onFormFocusChange?.(false);
          }
        }}
      >
        <CardBody p={4} overflowY="auto" flex="1">
          <VStack spacing={4} align="stretch">
            <Box>
              <Flex justify="space-between" align="center" mb={2}>
                <Text fontSize="lg" fontWeight="bold">
                  {selectedItem.metadata?.itemName || "Selected Item"}
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
                Dimensions (meters)
              </Text>

              {(["width", "height", "depth"] as const).map((dim) => (
                <FormControl key={dim}>
                  <FormLabel fontSize="sm" textTransform="capitalize">
                    {dim}
                  </FormLabel>
                  <NumberInput
                    size="sm"
                    value={itemDimensions[dim]}
                    onChange={(valueAsString) => {
                      handleDimensionChange(dim, valueAsString);
                    }}
                    min={0.01}
                    step={0.1}
                    precision={2}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
              ))}
            </VStack>

            <Button
              colorScheme="blue"
              variant="solid"
              size="sm"
              onClick={handleResize}
            >
              Resize (proportional)
            </Button>

            <Button
              colorScheme="blue"
              variant="outline"
              size="sm"
              onClick={handleResizeIndependent}
            >
              Apply dimensions (independent)
            </Button>

            <Button
              leftIcon={<FiSave />}
              colorScheme="green"
              variant="solid"
              size="sm"
              onClick={handleSaveItem}
              isLoading={isSavingItem}
              loadingText="Guardando"
            >
              Guardar objeto
            </Button>

            <VStack spacing={3} align="stretch">
              <Divider />

              <Text fontSize="sm" fontWeight="medium" color="gray.500">
                Posicionamiento exacto respecto a paredes
              </Text>

              <FormControl>
                <FormLabel fontSize="sm">Pared de referencia</FormLabel>
                <Select
                  size="sm"
                  value={wallPlacement.wallId}
                  onChange={(event) => handleWallPlacementChange("wallId", event.target.value)}
                  isDisabled={wallOptions.length === 0}
                >
                  {wallOptions.length === 0 && (
                    <option value="">No hay paredes disponibles</option>
                  )}
                  {wallOptions.map((wall) => (
                    <option key={wall.id} value={wall.id}>
                      {wall.label}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Metros desde el inicio de la pared</FormLabel>
                <NumberInput
                  size="sm"
                  value={wallPlacement.alongM}
                  min={0}
                  step={0.05}
                  precision={2}
                  onChange={(valueAsString) => handleWallPlacementChange("alongM", valueAsString)}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Separación desde la pared hasta el objeto</FormLabel>
                <NumberInput
                  size="sm"
                  value={wallPlacement.offsetM}
                  min={0}
                  step={0.05}
                  precision={2}
                  onChange={(valueAsString) => handleWallPlacementChange("offsetM", valueAsString)}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <Button
                colorScheme="teal"
                variant="solid"
                size="sm"
                onClick={handleApplyWallPlacement}
                isDisabled={wallOptions.length === 0 || !wallPlacement.wallId}
              >
                Aplicar posición exacta
              </Button>
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

            {isChargerItem(selectedItem) && (
              <VStack spacing={3} align="stretch">
                <Divider />
                <Text fontSize="sm" fontWeight="medium" color="gray.500">
                  Charger placement & calibration
                </Text>

                {([
                  ["sceneX", "X escena", 0.1, 3],
                  ["sceneZ", "Z escena", 0.1, 3],
                  ["rotationDeg", "Rotación (grados)", 0.1, 2],
                  ["realOriginX", "Origen real X", 0.01, 3],
                  ["realOriginY", "Origen real Y", 0.01, 3],
                  ["realRotationOffsetRad", "Offset angular real (rad)", 0.001, 4],
                  ["xScale", "Escala X", 0.1, 3],
                  ["yScale", "Escala Y", 0.1, 3],
                  ["xOffset", "Offset X", 0.01, 3],
                  ["yOffset", "Offset Y", 0.01, 3],
                ] as const).map(([field, label, step, precision]) => (
                  <FormControl key={field}>
                    <FormLabel fontSize="sm">{label}</FormLabel>
                    <NumberInput
                      size="sm"
                      value={chargerValues[field]}
                      onChange={(valueAsString) => {
                        handleChargerValueChange(field, valueAsString);
                      }}
                      step={step}
                      precision={precision}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                ))}

                <Button
                  colorScheme="blue"
                  variant="solid"
                  size="sm"
                  onClick={handleApplyChargerValues}
                >
                  Aplicar ajustes del cargador
                </Button>

                <Button
                  colorScheme={isFloorplanPlacementActive ? "orange" : "teal"}
                  variant={isFloorplanPlacementActive ? "solid" : "outline"}
                  size="sm"
                  onClick={() => onStartFloorplanPlacement?.(selectedItem)}
                >
                  {isFloorplanPlacementActive ? "Esperando click en floorplan…" : "Colocar en floorplan"}
                </Button>
              </VStack>
            )}

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
    </EditorOverlay>
  );
}

function WallFloorEditingPanel({
  selectedWall,
  selectedFloor,
  onClose
}: {
  selectedWall: any;
  selectedFloor: any;
  onClose: () => void;
}) {
  const cardBg = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.800", "white");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  const stopScenePointerEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    const nativeEvent = event.nativeEvent as Event & {
      stopImmediatePropagation?: () => void;
    };
    nativeEvent.stopImmediatePropagation?.();
  };

  const wallTextures = [
    { name: "Default Wall", url: "/plan3d/rooms/textures/wallmap.png", thumbnail: "/plan3d/rooms/textures/wallmap.png", stretch: true, scale: 0 },
    { name: "Yellow Wall", url: "/plan3d/rooms/textures/wallmap_yellow.png", thumbnail: "/plan3d/rooms/thumbnails/thumbnail_wallmap_yellow.png", stretch: true, scale: 0 },
    { name: "Light Brick", url: "/plan3d/rooms/textures/light_brick.jpg", thumbnail: "/plan3d/rooms/thumbnails/thumbnail_light_brick.jpg", stretch: false, scale: 100 },
    { name: "Light Wood", url: "/plan3d/rooms/textures/light_fine_wood.jpg", thumbnail: "/plan3d/rooms/thumbnails/thumbnail_light_fine_wood.jpg", stretch: false, scale: 300 },
  ];

  const floorTextures = [
    { name: "Hardwood", url: "/plan3d/rooms/textures/hardwood.png", thumbnail: "/plan3d/rooms/textures/hardwood.png", stretch: false, scale: 400 },
    { name: "Marble Tiles", url: "/plan3d/rooms/textures/marbletiles.jpg", thumbnail: "/plan3d/rooms/thumbnails/thumbnail_marbletiles.jpg", stretch: false, scale: 300 },
    { name: "Light Wood", url: "/plan3d/rooms/textures/light_fine_wood.jpg", thumbnail: "/plan3d/rooms/thumbnails/thumbnail_light_fine_wood.jpg", stretch: false, scale: 300 },
  ];

  useEffect(() => {
    const preloadImages = (textures: any[]) => {
      textures.forEach((texture) => {
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

    console.log("🔄 Starting texture preload...");
    preloadImages([...wallTextures, ...floorTextures]);
  }, []);

  const handleTextureChange = (textureUrl: string, stretch: boolean, scale: number) => {
    console.log(`🎨 Applying texture: ${textureUrl}`, { stretch, scale });

    try {
      if (selectedWall) {
        console.log("🧱 Applying to wall:", selectedWall);
        selectedWall.setTexture(textureUrl, stretch, scale);
      } else if (selectedFloor) {
        console.log("🏠 Applying to floor:", selectedFloor);
        selectedFloor.setTexture(textureUrl, stretch, scale);
      } else {
        console.error("❌ No wall or floor selected!");
        return;
      }

      onClose();
    } catch (error) {
      console.error("❌ Texture application failed:", error);
    }
  };

  const selectedObject = selectedWall || selectedFloor;
  if (!selectedObject) {
    return null;
  }

  const isWall = !!selectedWall;
  const textures = isWall ? wallTextures : floorTextures;
  const objectType = isWall ? "Wall" : "Floor";

  return (
    <EditorOverlay>
      <Card
        position="absolute"
        top={{ base: "18px", md: "18px" }}
        left={{ base: "16px", md: "16px" }}
        width="280px"
        bg={cardBg}
        color={textColor}
        borderColor={borderColor}
        borderWidth="1px"
        boxShadow="2xl"
        zIndex={41}
        pointerEvents="auto"
        onMouseDown={stopScenePointerEvent}
        onPointerDown={stopScenePointerEvent}
        onTouchStart={stopScenePointerEvent}
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
                  onClick={onClose}
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
    </EditorOverlay>
  );
}

function Site() {
  const bgColor = useColorModeValue("ui.light", "ui.dark");
  const cardBg = useColorModeValue("white", "gray.800");

  const { activeOrganizationContext } = useOrganizationContext();
  const initialSiteNavigationStateRef = useRef<StoredSiteNavigationState | null>(
    readStoredSiteNavigationState()
  );
  const initialSiteNavigationState = initialSiteNavigationStateRef.current;

  const [selectedScene, setSelectedScene] = useState<string | null>(
    initialSiteNavigationState?.selectedScene ?? null
  );
  const prevSimulationSceneRef = useRef<string | null>(
    initialSiteNavigationState?.previousSimulationScene ?? null
  );
  const [isRealMode, setIsRealMode] = useState<boolean>(
    initialSiteNavigationState?.isRealMode ?? false
  );
  const [hasLoadedScene, setHasLoadedScene] = useState<boolean>(false);
  const [isEditingMode, setIsEditingMode] = useState<boolean>(false);
  const [openRealPanel, setOpenRealPanel] = useState<RealModePanel>(
    initialSiteNavigationState?.openRealPanel ?? null
  );
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedItemRevision, setSelectedItemRevision] = useState(0);
  const [isSavingSelectedItem, setIsSavingSelectedItem] = useState(false);
  const [isFloorplanPlacementActive, setIsFloorplanPlacementActive] = useState(false);
  const [selectedWall, setSelectedWall] = useState<any>(null);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);

  const showToast = useCustomToast();
  const blueprint3DRef = useRef<Blueprint3DAppRef>(null);
  const scenesListRef = useRef<any>(null);
  const sceneLoadRequestRef = useRef(0);
  const prevSimulationSceneSnapshotRef = useRef<any | null>(null);
  const prevOrgUidRef = useRef<string | undefined>(activeOrganizationContext?.uid);
  const hasRestoredInitialSceneRef = useRef(false);
  const hasHandledInitialRealModePanelResetRef = useRef(false);
  const hasReusedStoredSimulationSceneRef = useRef(false);

  useEffect(() => {
    const currentOrgUid = activeOrganizationContext?.uid;
    const prevOrgUid = prevOrgUidRef.current;

    if (prevOrgUid !== undefined && currentOrgUid !== prevOrgUid) {
      console.log("Organization context changed, resetting viewer");
      sceneLoadRequestRef.current += 1;
      prevSimulationSceneRef.current = null;
      prevSimulationSceneSnapshotRef.current = null;
      setHasLoadedScene(false);
      setSelectedScene(null);

      showToast(
        "Context Changed",
        "Viewer reset due to organization change. Please select a new scene.",
        "success"
      );
    }

    prevOrgUidRef.current = currentOrgUid;
  }, [activeOrganizationContext?.uid, showToast]);

  const getViewerSceneSnapshot = () => {
    try {
      const blueprint = blueprint3DRef.current?.getBlueprint3D?.();
      const serialized = blueprint?.model?.exportSerialized?.();
      return serialized ? JSON.parse(serialized) : null;
    } catch (error) {
      console.warn("Could not read current viewer snapshot:", error);
      return null;
    }
  };

  const waitForBlueprint3DReady = async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const blueprint = blueprint3DRef.current?.getBlueprint3D?.();

      if (blueprint?.model) {
        return true;
      }

      await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
    }

    return false;
  };

  const loadPlanIntoViewer = (planData: any) => {
    const blueprintApp = blueprint3DRef.current;
    const blueprint = blueprintApp?.getBlueprint3D?.();

    if (!blueprintApp || !blueprint?.model) {
     throw new Error("Blueprint3D viewer not ready");
    }

    blueprintApp.loadPlan({
      uid: planData?.uid,
      floorplan: {
        corners: planData?.floorplan?.corners || {},
        walls: planData?.floorplan?.walls || [],
        wallTextures: planData?.floorplan?.wallTextures || [],
        floorTextures: planData?.floorplan?.floorTextures || {},
        newFloorTextures: planData?.floorplan?.newFloorTextures || {},
      },
      items: planData?.items || [],
    });
  };

  const loadSceneIntoViewer = async (
    sceneId: string,
    options?: {
      showSuccessToast?: boolean;
      bypassEditingGuard?: boolean;
    }
  ) => {
    if (isEditingMode && !options?.bypassEditingGuard) {
      showToast(
        "Cannot Change Scene",
        "Please finish editing or cancel editing before selecting a different scene.",
        "error"
      );
      return false;
    }

    const requestId = ++sceneLoadRequestRef.current;
    setIsFloorplanPlacementActive(false);
    console.log("Selected scene:", sceneId);

    const viewerReady = await waitForBlueprint3DReady();

    if (requestId !== sceneLoadRequestRef.current) {
      return false;
    }

    if (!viewerReady) {
      showToast(
        "Viewer Not Ready",
        "The 3D viewer is still initializing. Please try again in a moment.",
        "error"
      );
      return false;
    }

    try {
      const sceneData = await ScenesService.readScene({ sceneId });

      if (requestId !== sceneLoadRequestRef.current) {
        return false;
      }

      loadPlanIntoViewer({
        uid: sceneData.uid,
        floorplan: sceneData.floorplan,
        items: sceneData.items || [],
      });

      setSelectedScene(sceneData.uid);
      setHasLoadedScene(true);

      if (options?.showSuccessToast !== false) {
        showToast(
          "Scene Loaded",
          `Scene ${sceneData.uid.substring(0, 8)}... has been loaded successfully`,
          "success"
        );
      }

      return true;
    } catch (error) {
      if (requestId === sceneLoadRequestRef.current) {
        console.error("Error loading scene:", error);
        showToast(
          "Load Failed",
          "Failed to load the selected scene. Please try again.",
          "error"
        );
      }
      return false;
    }
  };

  useEffect(() => {
    if (hasRestoredInitialSceneRef.current) return;
    hasRestoredInitialSceneRef.current = true;

    const storedState = initialSiteNavigationStateRef.current;

    if (storedState && !storedState.isRealMode && storedState.selectedScene) {
      void loadSceneIntoViewer(storedState.selectedScene, {
        showSuccessToast: false,
        bypassEditingGuard: true,
      });
    }

    clearStoredSiteNavigationState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const orgId = activeOrganizationContext?.uid;
    if (!orgId) return;

    if (isRealMode) {
      const canReuseStoredSimulationScene =
        initialSiteNavigationStateRef.current?.isRealMode === true &&
        !hasReusedStoredSimulationSceneRef.current &&
        Boolean(prevSimulationSceneRef.current);

      if (canReuseStoredSimulationScene) {
        hasReusedStoredSimulationSceneRef.current = true;
      } else {
        prevSimulationSceneRef.current = selectedScene;
        prevSimulationSceneSnapshotRef.current = getViewerSceneSnapshot();
      }

      const setupRealModeScene = async () => {
        try {
          const scenesData = await OrganizationsService.readOrganizationScenes({ id: orgId });
          const scenes = scenesData?.data || [];
          const realModeScene = scenes.find((s) => s.label === "Real Mode Scene");

          if (realModeScene?.uid) {
            await loadSceneIntoViewer(realModeScene.uid, {
              showSuccessToast: false,
              bypassEditingGuard: true,
            });
            return;
          }

          let sourceFloorplan: any = { corners: {}, walls: [], wallTextures: [], floorTextures: {}, newFloorTextures: {} };
          let sourceItems: any[] = [];
          const sourceSceneId = prevSimulationSceneRef.current || selectedScene;

          if (sourceSceneId) {
            try {
              const sourceScene = await ScenesService.readScene({ sceneId: sourceSceneId });
              sourceFloorplan = sourceScene.floorplan || sourceFloorplan;
              sourceItems = (sourceScene.items || []).filter((item: any) => {
                const meta = item?.metadata ?? item;
                return !meta?.device_uid && !meta?.deviceId;
              });
            } catch (copyError) {
              console.warn("Could not clone the current simulation scene from the API:", copyError);
            }
          }

          if ((!sourceItems.length && (!sourceFloorplan?.walls || !sourceFloorplan.walls.length)) && prevSimulationSceneSnapshotRef.current) {
            sourceFloorplan = prevSimulationSceneSnapshotRef.current.floorplan || sourceFloorplan;
            sourceItems = (prevSimulationSceneSnapshotRef.current.items || []).filter((item: any) => {
              const meta = item?.metadata ?? item;
              return !meta?.device_uid && !meta?.deviceId;
            });
          }

          const newScene = await ScenesService.createScene({
            requestBody: {
              label: "Real Mode Scene",
              organization_id: orgId,
              floorplan: sourceFloorplan,
              items: sourceItems,
            },
          });

          if (newScene?.uid) {
            await loadSceneIntoViewer(newScene.uid, {
              showSuccessToast: false,
              bypassEditingGuard: true,
            });
          }
        } catch (error) {
          console.error("Failed to setup Real Mode Scene:", error);
          showToast("Error", "Could not initialize the Real Mode Scene.", "error");
        }
      };

      void setupRealModeScene();
    } else {
      const restorePreviousSimulationScene = async () => {
        const sceneToRestore = prevSimulationSceneRef.current;

        if (sceneToRestore) {
          const restored = await loadSceneIntoViewer(sceneToRestore, {
            showSuccessToast: false,
            bypassEditingGuard: true,
          });

          if (restored) {
            return;
          }
        }

        const snapshot = prevSimulationSceneSnapshotRef.current;
        if (snapshot) {
          try {
            loadPlanIntoViewer(snapshot);
            setSelectedScene(snapshot.uid || sceneToRestore || null);
            setHasLoadedScene(true);
            return;
          } catch (error) {
            console.error("Failed to restore simulation snapshot:", error);
          }
        }

        setSelectedScene(null);
        setHasLoadedScene(false);
      };

      void restorePreviousSimulationScene();
    }
  }, [isRealMode, activeOrganizationContext?.uid]);

  const handleToggleRealPanel = (panel: Exclude<RealModePanel, null>) => {
    setOpenRealPanel((prev) => (prev === panel ? null : panel));
  };

  const handleCreateNewPlan = () => {
    if (isEditingMode) {
      showToast(
        "Cannot Create New Plan",
        "Please finish editing or cancel editing before creating a new plan.",
        "error"
      );
      return;
    }

    const defaultPlan = createDefaultFloorplan();
    console.log("Creating new plan:", defaultPlan);

    if (blueprint3DRef.current) {
      sceneLoadRequestRef.current += 1;
      setIsFloorplanPlacementActive(false);
      loadPlanIntoViewer(defaultPlan);
      setSelectedScene(defaultPlan.uid || null);
      setHasLoadedScene(true);
      console.log("Plan loaded into viewer automatically");
    } else {
      console.warn("Blueprint3D ref not available, plan not loaded");
    }
  };

  const handleSceneSelection = async (sceneId: string) => {
    await loadSceneIntoViewer(sceneId, { showSuccessToast: true });
  };

  const handleSceneSaved = (sceneId: string) => {
    console.log("Scene saved, refreshing scenes list:", sceneId);
    setSelectedScene(sceneId);
    setHasLoadedScene(true);

    if (scenesListRef.current && scenesListRef.current.refreshScenes) {
      scenesListRef.current.refreshScenes();
    }
  };


  const buildScenePayloadFromViewer = () => {
    const blueprint = blueprint3DRef.current?.getBlueprint3D();
    const raw = blueprint?.model?.exportSerialized?.();

    if (!raw) {
      throw new Error("Blueprint3D export is not available");
    }

    const parsedData = JSON.parse(raw);

    return {
      uid: parsedData?.uid || selectedScene || "",
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

  const handleSaveSelectedItem = async () => {
    const activeOrgId = activeOrganizationContext?.uid;

    if (!activeOrgId) {
      showToast(
        "Organization Required",
        "Please select an organization before saving the object.",
        "error"
      );
      return;
    }

    setIsSavingSelectedItem(true);

    try {
      const scenePayload = buildScenePayloadFromViewer();
      const sceneId = scenePayload.uid || selectedScene || undefined;
      let response;

      if (sceneId) {
        try {
          await ScenesService.readScene({ sceneId });
          response = await ScenesService.updateScene({
            sceneId,
            requestBody: {
              floorplan: scenePayload.floorplan,
              items: scenePayload.items,
              organization_id: activeOrgId,
            },
          });
        } catch (_error) {
          response = await ScenesService.createScene({
            requestBody: {
              organization_id: activeOrgId,
              floorplan: scenePayload.floorplan,
              items: scenePayload.items,
            },
          });
        }
      } else {
        response = await ScenesService.createScene({
          requestBody: {
            organization_id: activeOrgId,
            floorplan: scenePayload.floorplan,
            items: scenePayload.items,
          },
        });
      }

      if (response?.uid) {
        setSelectedScene(response.uid);
        setHasLoadedScene(true);
      }

      scenesListRef.current?.refreshScenes?.();
      setSelectedItemRevision((value) => value + 1);

      showToast(
        "Objeto guardado",
        "El objeto seleccionado se ha guardado con sus dimensiones, posición y rotación actuales.",
        "success"
      );
    } catch (error) {
      console.error("Error saving selected item:", error);
      showToast(
        "Save Failed",
        "Failed to save the selected object. Please check the console for details or try again.",
        "error"
      );
    } finally {
      setIsSavingSelectedItem(false);
    }
  };

  const handleEditingModeChange = useCallback((editingMode: boolean) => {
    setIsEditingMode(editingMode);

    const shouldEnableController = Boolean(
      editingMode && !isFloorplanPlacementActive
    );
    blueprint3DRef.current?.setControllerEnabled(shouldEnableController);

    if (!editingMode) {
      setSelectedItem(null);
      setSelectedWall(null);
      setSelectedFloor(null);
      setIsFloorplanPlacementActive(false);

      if (blueprint3DRef.current) {
        blueprint3DRef.current.clearSelections();
      }
    }
  }, [isFloorplanPlacementActive]);

  useEffect(() => {
    const shouldEnableController = Boolean(
      isEditingMode && !isFloorplanPlacementActive
    );
    blueprint3DRef.current?.setControllerEnabled(shouldEnableController);
  }, [isEditingMode, isFloorplanPlacementActive, selectedScene]);

  const handleFormFocusChange = useCallback((focused: boolean) => {
    const shouldEnableController = Boolean(
      !focused && isEditingMode && !isFloorplanPlacementActive
    );
    blueprint3DRef.current?.setControllerEnabled(shouldEnableController);
  }, [isEditingMode, isFloorplanPlacementActive]);

  const handleSelectedItemChange = useCallback((item: any) => {
    setSelectedItem(item);
    setSelectedItemRevision((value) => value + 1);
    if (!item) {
      setIsFloorplanPlacementActive(false);
    }
  }, []);

  const handleSelectedWallChange = useCallback((wall: any) => {
    setSelectedWall(wall);
  }, []);

  const handleSelectedFloorChange = useCallback((floor: any) => {
    setSelectedFloor(floor);
  }, []);

  const cancelFloorplanPlacement = (returnToDesign = true) => {
    setIsFloorplanPlacementActive(false);
    if (returnToDesign) {
      blueprint3DRef.current?.setView?.("DESIGN");
    }
  };

  const handleStartFloorplanPlacement = (item: any) => {
    if (!item || !isChargerItem(item)) return;
    applyChargerEditorValues(item, getChargerEditorValues(item));
    setSelectedWall(null);
    setSelectedFloor(null);
    setIsFloorplanPlacementActive(true);
    blueprint3DRef.current?.setView?.("FLOORPLAN");

    const bp = blueprint3DRef.current?.getBlueprint3D?.();
    const BP3DLib = (window as any).BP3D;
    const moveMode = BP3DLib?.Floorplanner?.floorplannerModes?.MOVE;
    if (bp?.floorplanner && moveMode !== undefined) {
      bp.floorplanner.setMode(moveMode);
    }
  };

  useEffect(() => {
    if (!isFloorplanPlacementActive || !selectedItem || !isChargerItem(selectedItem)) {
      return;
    }

    const canvas = document.getElementById("floorplanner-canvas");
    if (!canvas) return;

    const handleCanvasClick = (event: MouseEvent) => {
      const bp = blueprint3DRef.current?.getBlueprint3D?.();
      const floorplanner = bp?.floorplanner;
      if (!floorplanner) return;

      const rect = canvas.getBoundingClientRect();
      const cmPerPixel = Number(floorplanner.cmPerPixel) || 1;
      const originX = Number(floorplanner.originX) || 0;
      const originY = Number(floorplanner.originY) || 0;

      const targetX = (event.clientX - rect.left) * cmPerPixel + originX * cmPerPixel;
      const targetZ = (event.clientY - rect.top) * cmPerPixel + originY * cmPerPixel;

      selectedItem.position.x = targetX;
      selectedItem.position.z = targetZ;
      applyChargerEditorValues(selectedItem, {
        ...getChargerEditorValues(selectedItem),
        sceneX: roundTo(targetX),
        sceneZ: roundTo(targetZ),
      });
      setSelectedItemRevision((value) => value + 1);
      cancelFloorplanPlacement(true);
    };

    canvas.addEventListener("click", handleCanvasClick);
    return () => {
      canvas.removeEventListener("click", handleCanvasClick);
    };
  }, [isFloorplanPlacementActive, selectedItem]);

  useEffect(() => {
    if (!hasHandledInitialRealModePanelResetRef.current) {
      hasHandledInitialRealModePanelResetRef.current = true;
      return;
    }

    setOpenRealPanel(null);
  }, [isRealMode]);

  useEffect(() => {
    if (selectedItem || isEditingMode) {
      setOpenRealPanel(null);
    }
  }, [selectedItem, isEditingMode]);

  const handleCloseTexturePanel = () => {
    console.log("🚪 handleCloseTexturePanel called - clearing wall/floor selections");
    setSelectedWall(null);
    setSelectedFloor(null);

    if (blueprint3DRef.current) {
      console.log("🔧 Calling clearSelections on Blueprint3D ref");
      blueprint3DRef.current.clearSelections();
    } else {
      console.error("❌ Blueprint3D ref is null!");
    }
  };

  return (
    <Container maxW="full" bg={bgColor} minH="100vh">
      <Box pt={12} px={4} height="100vh" overflowY="auto">
        <Flex justify="space-between" align="center" mb={8} wrap="wrap" gap={4}>
          <Heading size="lg" textAlign={{ base: "center", md: "left" }}>
            Site Management
          </Heading>

          <Box
            display="flex"
            alignItems="center"
            bg={isRealMode ? "blue.950" : "gray.100"}
            borderRadius="full"
            p="3px"
            transition="all 0.3s ease"
            border="1px solid"
            borderColor={isRealMode ? "blue.400" : "gray.300"}
            boxShadow={isRealMode ? "0 0 12px rgba(66,153,225,0.3)" : "inset 0 1px 3px rgba(0,0,0,0.1)"}
            cursor="pointer"
            onClick={() => setIsRealMode(!isRealMode)}
            userSelect="none"
          >
            <Box
              px={3}
              py={1}
              borderRadius="full"
              bg={!isRealMode ? "white" : "transparent"}
              boxShadow={!isRealMode ? "0 1px 4px rgba(0,0,0,0.15)" : "none"}
              transition="all 0.3s ease"
              display="flex"
              alignItems="center"
              gap={1.5}
            >
              <Box
                w="6px"
                h="6px"
                borderRadius="full"
                bg={!isRealMode ? "gray.500" : "gray.400"}
                opacity={!isRealMode ? 1 : 0.4}
                transition="all 0.3s ease"
              />
              <Text
                fontSize="xs"
                fontWeight="600"
                letterSpacing="0.05em"
                textTransform="uppercase"
                color={!isRealMode ? "gray.700" : "gray.400"}
                transition="all 0.3s ease"
              >
                Simulation
              </Text>
            </Box>

            <Box
              px={3}
              py={1}
              borderRadius="full"
              bg={isRealMode ? "blue.500" : "transparent"}
              boxShadow={isRealMode ? "0 1px 8px rgba(66,153,225,0.5)" : "none"}
              transition="all 0.3s ease"
              display="flex"
              alignItems="center"
              gap={1.5}
            >
              <Box
                w="6px"
                h="6px"
                borderRadius="full"
                bg={isRealMode ? "white" : "gray.500"}
                opacity={isRealMode ? 1 : 0.4}
                transition="all 0.3s ease"
                boxShadow={isRealMode ? "0 0 6px white" : "none"}
              />
              <Text
                fontSize="xs"
                fontWeight="600"
                letterSpacing="0.05em"
                textTransform="uppercase"
                color={isRealMode ? "white" : "gray.500"}
                transition="all 0.3s ease"
              >
                Real Mode
              </Text>
            </Box>
          </Box>
        </Flex>

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
            {!isRealMode && (
              <Box flexBasis={{ base: "100%", md: "20%" }} height="100%">
                <ScenesList
                  ref={scenesListRef}
                  title="Scenes List"
                  selectedId={selectedScene}
                  setSelectedId={handleSceneSelection}
                  onCreateNewPlan={handleCreateNewPlan}
                />
              </Box>
            )}

            <Box flexBasis={{ base: "100%", md: isRealMode ? "100%" : "80%" }} height="100%">
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
                  <Blueprint3DApp
                    ref={blueprint3DRef}
                    isRealMode={isRealMode}
                    pauseDeviceSync={isEditingMode}
                    onSceneSaved={handleSceneSaved}
                    onEditingModeChange={handleEditingModeChange}
                    onSelectedItemChange={handleSelectedItemChange}
                    onSelectedWallChange={handleSelectedWallChange}
                    onSelectedFloorChange={handleSelectedFloorChange}
                  />

                  {isFloorplanPlacementActive && (
                    <Box
                      position="absolute"
                      top={4}
                      left={4}
                      zIndex={30}
                      bg={useColorModeValue("white", "gray.800")}
                      borderWidth="1px"
                      borderColor={useColorModeValue("gray.200", "gray.600")}
                      boxShadow="lg"
                      borderRadius="md"
                      px={4}
                      py={3}
                      maxW="420px"
                    >
                      <Text fontWeight="bold" mb={1}>
                        Colocación exacta del cargador
                      </Text>
                      <Text fontSize="sm" color={useColorModeValue("gray.600", "gray.300")} mb={3}>
                        Haz click en el floorplan para fijar la posición exacta del cargador. Al terminar se volverá automáticamente a la vista 3D.
                      </Text>
                      <Button size="sm" variant="outline" onClick={() => cancelFloorplanPlacement(true)}>
                        Cancelar colocación
                      </Button>
                    </Box>
                  )}

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

                  {selectedItem && isEditingMode && (
                    <ItemEditingPanel
                      selectedItem={selectedItem}
                      refreshKey={selectedItemRevision}
                      isFloorplanPlacementActive={isFloorplanPlacementActive}
                      onItemUpdated={() => setSelectedItemRevision((value) => value + 1)}
                      onSaveItem={handleSaveSelectedItem}
                      isSavingItem={isSavingSelectedItem}
                      onFormFocusChange={handleFormFocusChange}
                      onStartFloorplanPlacement={handleStartFloorplanPlacement}
                      getBlueprint3D={() => blueprint3DRef.current?.getBlueprint3D?.()}
                      onClose={() => {
                        cancelFloorplanPlacement(true);
                        setSelectedItem(null);
                        setSelectedWall(null);
                        setSelectedFloor(null);
                        setSelectedItemRevision((value) => value + 1);
                        blueprint3DRef.current?.clearSelections();
                      }}
                    />
                  )}

                  {isEditingMode && (
                    <WallFloorEditingPanel
                      selectedWall={selectedWall}
                      selectedFloor={selectedFloor}
                      onClose={handleCloseTexturePanel}
                    />
                  )}

                  {!selectedItem && !isEditingMode && (
                    <Box
                      position="absolute"
                      top={4}
                      right={4}
                      zIndex={30}
                      display="flex"
                      flexDirection="row"
                      justifyContent="flex-end"
                      alignItems="flex-start"
                      gap={3}
                      pointerEvents="auto"
                      maxHeight="calc(100% - 32px)"
                    >
                      <RobotInfoPanel
                        blueprint3DRef={blueprint3DRef}
                        isVisible={isRealMode}
                        isOpen={openRealPanel === "robots"}
                        onToggle={() => handleToggleRealPanel("robots")}
                      />
                      <PredictionPanel
                        isVisible={isRealMode}
                        isOpen={openRealPanel === "prediction"}
                        onToggle={() => handleToggleRealPanel("prediction")}
                        returnState={{
                          selectedScene,
                          previousSimulationScene: prevSimulationSceneRef.current,
                          isRealMode,
                          openRealPanel,
                        }}
                      />
                    </Box>
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