import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Flex,
  Text,
  useColorModeValue,
  Card,
  CardBody,
  Icon,
  Button,
  IconButton,
  Input,
  useToast,
} from "@chakra-ui/react";
import { FiMap, FiPlus, FiEdit2, FiCheck, FiX, FiTrash2 } from "react-icons/fi";
import { OrganizationsService, ScenesService } from "../../client";
import type { ScenePublic } from "../../client/types.gen";
import { useOrganizationContext } from "../../hooks/useOrganizationContext";


interface ScenesListProps {
  title: string;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void | Promise<void>;
  onCreateNewPlan?: () => void;
}

interface ScenesListRef {
  refreshScenes: () => void;
}

interface SceneItem {
  id: string;
  name: string;
  itemCount: number;
}

const ScenesList = React.forwardRef<ScenesListRef, ScenesListProps>(({ title, selectedId, setSelectedId, onCreateNewPlan }, ref) => {
  const unselectedBg = useColorModeValue("gray.50", "gray.700");
  const selectedBg = useColorModeValue("ui.secondary", "ui.secondary");
  const hoverBg = useColorModeValue("gray.100", "gray.600");
  const cardBg = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.800", "white");
  const subTextColor = useColorModeValue("gray.600", "gray.300");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const scrollbarThumbColor = useColorModeValue("#CBD5E0", "#4A5568");
  const scrollbarThumbHoverColor = useColorModeValue("#A0AEC0", "#2D3748");  

  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const toast = useToast();
  const { getActiveOrganizationId } = useOrganizationContext();

  const fetchScenesForOrganization = async () => {
    const activeOrgId = getActiveOrganizationId();

    if (!activeOrgId) {
      console.warn("No active organization context found");
      setScenes([]);
      return;
    }

    setIsLoading(true);
    try {
      const scenesData = await OrganizationsService.readOrganizationScenes({
        id: activeOrgId,
      });

      if (scenesData && Array.isArray(scenesData.data)) {
        const sceneItems: SceneItem[] = scenesData.data.map((scene: ScenePublic, index: number) => ({
          id: scene.uid,
          name: scene.label || `Scene ${index + 1}`,
          itemCount: scene.items?.length || 0,
        }));

        console.log(`Fetched ${sceneItems.length} scenes for organization: ${activeOrgId}`);
        setScenes(sceneItems);
      } else {
        setScenes([]);
      }
    } catch (error) {
      console.error("Error fetching scenes:", error);
      setScenes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScenesForOrganization();
  }, [getActiveOrganizationId()]);

  React.useImperativeHandle(ref, () => ({
    refreshScenes: fetchScenesForOrganization,
  }));

  // Focus the input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (scene: SceneItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(scene.id);
    setEditingName(scene.name);
  };

  const cancelEditing = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditingName("");
  };

  const saveRename = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!editingId || !editingName.trim()) return;

    setIsSaving(true);
    try {
      await ScenesService.updateScene({
        sceneId: editingId,
        requestBody: { label: editingName.trim() },
      });

      // Update local state immediately
      setScenes((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, name: editingName.trim() } : s))
      );

      toast({
        title: "Nombre actualizado",
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "top-right",
      });

      setEditingId(null);
      setEditingName("");
    } catch (error) {
      console.error("Error renaming scene:", error);
      toast({
        title: "Error al renombrar",
        description: "No se pudo actualizar el nombre de la escena.",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "top-right",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Asegúrate de tener el ID de la escena actual en una variable, por ejemplo 'currentUID'
  // Si usas tokens de autenticación, recuerda incluirlos en los headers.

  const handleDeleteScene = async (sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta escena? Esta acción no se puede deshacer.")) {
        return;
    }

    setDeletingId(sceneId);

    try {

        await ScenesService.deleteScene({ sceneId });
        // Actualizamos la lista visualmente
        const newScenes = scenes.filter((s) => s.id !== sceneId);
        setScenes(newScenes);

        toast({
            title: "Escena eliminada",
            status: "success",
            duration: 2000,
            isClosable: true,
            position: "top-right",
        });

        // 3. Lógica de selección inteligente
        if (selectedId === sceneId) {
            if (newScenes.length > 0) {
                setSelectedId(newScenes[0].id);
            } else {
                setSelectedId(null);
            }
        }

    } catch (error) {
        console.error("Error deleting scene:", error);
        toast({
            title: "Error al eliminar",
            description: "No se pudo conectar con la API o hubo un error.",
            status: "error",
            duration: 3000,
            isClosable: true,
            position: "top-right",
        });
    } finally {
        setDeletingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      saveRename();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  return (
    <Card
      height="100%"
      minW="150px"
      maxW="350px"
      bg={cardBg}
      color={textColor}
      display="flex"
      flexDirection="column"
      p={0}
      borderColor={borderColor}
      borderWidth="1px"
    >
      <CardBody display="flex" flexDirection="column" overflow="hidden" px={4} py={6} height="100%">
        <Text fontSize="xl" fontWeight="bold" color={textColor} mb={4}>
          {title}
        </Text>

        <Box
          flex="1"
          overflowY="auto"
          pb={2}
          css={{
            "::-webkit-scrollbar": { width: "6px" },
            "::-webkit-scrollbar-thumb": {
              background: scrollbarThumbColor,
              borderRadius: "10px",
            },
            "::-webkit-scrollbar-thumb:hover": {
              background: scrollbarThumbHoverColor,
            },
            "::-webkit-scrollbar-track": { background: "transparent" },
            scrollBehavior: "smooth",
          }}
        >
          <Flex direction="column" gap={3} mr={2}>
            {isLoading ? (
              <Box textAlign="center" py={8} px={4} color={subTextColor}>
                <Text fontSize="sm" fontWeight="medium">
                  Loading scenes...
                </Text>
              </Box>
            ) : scenes.length === 0 ? (
              <Box textAlign="center" py={8} px={4} color={subTextColor}>
                <Icon as={FiMap} boxSize={8} mb={3} color="gray.400" />
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  No scenes found
                </Text>
                <Text fontSize="xs">
                  This organization doesn't have any scenes yet. Create your first scene to get started.
                </Text>
              </Box>
            ) : (
              scenes.map((scene) => {
                const isSelected = scene.id === selectedId;
                const isEditing = scene.id === editingId;
                const isDeleting = scene.id === deletingId;

                return (
                  <Flex
                    key={scene.id}
                    p={2}
                    bg={isSelected ? selectedBg : unselectedBg}
                    borderRadius="lg"
                    boxShadow={isSelected ? "md" : "sm"}
                    border={isSelected ? "2px solid" : "1px solid"}
                    borderColor={isSelected ? "ui.secondary" : borderColor}
                    alignItems="center"
                    cursor="pointer"
                    onClick={() => !isEditing && setSelectedId(scene.id)}
                    transition="all 0.2s"
                    _hover={{
                      bg: isSelected ? selectedBg : hoverBg,
                      transform: isEditing ? "none" : "translateY(-2px)",
                      boxShadow: isSelected ? "lg" : "md",
                    }}
                    role="group"
                  >
                    <Icon
                      as={FiMap}
                      boxSize={8}
                      mr={3}
                      ml={2}
                      color={isSelected ? "white" : "gray.500"}
                      flexShrink={0}
                    />

                    {/* Name / Edit input */}
                    <Box flex="1" minW={0}>
                      {isEditing ? (
                        <Input
                          ref={inputRef}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onClick={(e) => e.stopPropagation()}
                          size="sm"
                          variant="filled"
                          bg="white"
                          color="gray.800"
                          _focus={{ bg: "white", borderColor: "blue.400" }}
                          borderRadius="md"
                          fontWeight="bold"
                        />
                      ) : (
                        <>
                          <Text
                            fontSize="md"
                            fontWeight="bold"
                            color={isSelected ? "white" : textColor}
                            noOfLines={1}
                          >
                            {scene.name}
                          </Text>
                          <Text
                            fontSize={10}
                            color={isSelected ? "whiteAlpha.800" : subTextColor}
                            whiteSpace="nowrap"
                            overflow="hidden"
                            textOverflow="ellipsis"
                          >
                            {scene.itemCount} items
                          </Text>
                        </>
                      )}
                    </Box>

                    {/* Action buttons */}
                    {isEditing ? (
                      <Flex ml={2} gap={1} flexShrink={0} onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          aria-label="Guardar nombre"
                          icon={<Icon as={FiCheck} />}
                          size="xs"
                          colorScheme="green"
                          variant="solid"
                          isLoading={isSaving}
                          onClick={saveRename}
                        />
                        <IconButton
                          aria-label="Cancelar"
                          icon={<Icon as={FiX} />}
                          size="xs"
                          colorScheme="red"
                          variant="ghost"
                          onClick={cancelEditing}
                        />
                      </Flex>
                    ) : (
                      <Flex ml={2} gap={1} flexShrink={0}>
                        <IconButton
                          aria-label="Renombrar escena"
                          icon={<Icon as={FiEdit2} />}
                          size="xs"
                          variant="ghost"
                          color={isSelected ? "whiteAlpha.800" : "gray.400"}
                          _hover={{ color: isSelected ? "white" : "gray.600", bg: isSelected ? "whiteAlpha.200" : "gray.200" }}
                          opacity={0}
                          _groupHover={{ opacity: 1 }}
                          transition="opacity 0.15s"
                          ml={2}
                          flexShrink={0}
                          onClick={(e) => startEditing(scene, e)}
                        />
                        <IconButton
                          aria-label="Eliminar escena"
                          icon={<Icon as={FiTrash2} />}
                          size="xs"
                          variant="ghost"
                          colorScheme="red"
                          color={isSelected ? "whiteAlpha.900" : "red.400"}
                          _hover={{ color: "red.500", bg: "red.100" }}
                          opacity={0}
                          _groupHover={{ opacity: 1 }}
                          transition="opacity 0.15s"
                          isLoading={isDeleting}
                          onClick={(e) => handleDeleteScene(scene.id, e)}
                        />
                      </Flex>
                    )}
                  </Flex>
                );
              })
            )}
          </Flex>
        </Box>

        <Button
          size="sm"
          colorScheme="blue"
          leftIcon={<Icon as={FiPlus} />}
          onClick={onCreateNewPlan}
          variant="solid"
          isDisabled={!onCreateNewPlan}
          mt={4}
          width="full"
        >
          New Scene
        </Button>
      </CardBody>
    </Card>
  );
});

ScenesList.displayName = 'ScenesList';

export default ScenesList;
