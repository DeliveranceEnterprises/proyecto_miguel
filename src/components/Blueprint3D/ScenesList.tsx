import React, { useEffect, useState } from "react";
import {
  Box,
  Flex,
  Text,
  useColorModeValue,
  Card,
  CardBody,
  Icon,
  Button,
} from "@chakra-ui/react";
import { FiMap, FiPlus } from "react-icons/fi";
import { OrganizationsService } from "../../client";
import type { ScenePublic } from "../../client/types.gen";
import { useOrganizationContext } from "../../hooks/useOrganizationContext";

interface ScenesListProps {
  title: string;
  selectedId: string | null;
  setSelectedId: (id: string) => void | Promise<void>;
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
  // Color scheme matching analytics device list and using theme colors
  const unselectedBg = useColorModeValue("gray.50", "gray.700");
  const selectedBg = useColorModeValue("ui.secondary", "ui.secondary"); // Using theme secondary color
  const hoverBg = useColorModeValue("gray.100", "gray.600");
  const cardBg = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.800", "white");
  const subTextColor = useColorModeValue("gray.600", "gray.300");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const scrollbarThumbColor = useColorModeValue("#CBD5E0", "#4A5568");
  const scrollbarThumbHoverColor = useColorModeValue("#A0AEC0", "#2D3748");

  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get the active organization context
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
          name: `Scene ${index + 1}`, // You might want to add a name field to the scene model
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

  // Expose refresh function to parent component
  React.useImperativeHandle(ref, () => ({
    refreshScenes: fetchScenesForOrganization,
  }));

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
              background: scrollbarThumbHoverColor 
            },
            "::-webkit-scrollbar-track": { background: "transparent" },
            scrollBehavior: "smooth",
          }}
        >
          <Flex direction="column" gap={3} mr={2}>
            {isLoading ? (
              <Box
                textAlign="center"
                py={8}
                px={4}
                color={subTextColor}
              >
                <Text fontSize="sm" fontWeight="medium">
                  Loading scenes...
                </Text>
              </Box>
            ) : scenes.length === 0 ? (
              <Box
                textAlign="center"
                py={8}
                px={4}
                color={subTextColor}
              >
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
                    onClick={() => setSelectedId(scene.id)}
                    transition="all 0.2s"
                    _hover={{
                      bg: isSelected ? selectedBg : hoverBg,
                      transform: "translateY(-2px)",
                      boxShadow: isSelected ? "lg" : "md",
                    }}
                  >
                    <Icon
                      as={FiMap}
                      boxSize={8}
                      mr={4}
                      ml={2}
                      color={isSelected ? "white" : "gray.500"}
                      flexShrink={0}
                    />
                    <Box>
                      <Text 
                        fontSize="md" 
                        fontWeight="bold"
                        color={isSelected ? "white" : textColor}
                      >
                        {scene.name}
                      </Text>
                      <Text
                        fontSize={10}
                        color={isSelected ? "whiteAlpha.800" : subTextColor}
                        whiteSpace="nowrap"
                        overflow="hidden"
                        textOverflow="ellipsis"
                        maxWidth="100px"
                      >
                        {scene.itemCount} items
                      </Text>
                    </Box>
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
