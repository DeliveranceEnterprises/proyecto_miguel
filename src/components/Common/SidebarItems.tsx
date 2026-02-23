import { Box, Flex, Icon, Text, useColorModeValue, Menu, MenuButton, MenuList, MenuItem, Button, Spinner } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { FiBriefcase, FiHome, FiSettings, FiUsers, FiCompass, FiSliders, FiChevronDown } from "react-icons/fi"
import { RiRobot2Line } from "react-icons/ri";
import { useEffect } from "react"

import type { UserPublic, OrganizationPublic } from "../../client"
import { OrganizationsService } from "../../client"
import { useOrganization } from "../../contexts/OrganizationContext"

const items = [
  { icon: FiCompass, title: "Dashboard", path: "/" },
  { icon: FiSettings, title: "Digital Twin", path: "/site" },
  { icon: FiSettings, title: "User Settings", path: "/settings" },
]

interface SidebarItemsProps {
  onClose?: () => void
}

const SidebarItems = ({ onClose }: SidebarItemsProps) => {
  const queryClient = useQueryClient()
  const textColor = useColorModeValue("ui.main", "ui.light")
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  
  // State for selected organization
  const { selectedOrganization, setSelectedOrganization, switchOrganization, isLoading: orgSwitchLoading } = useOrganization()

  // Fetch organization data
  const { data: organizationData, isLoading: orgLoading } = useQuery({
    queryKey: ["organization", currentUser?.organization_id],
    queryFn: () => 
      currentUser?.organization_id 
        ? OrganizationsService.readOrganization({ id: currentUser.organization_id })
        : null,
    enabled: !!currentUser?.organization_id,
  })

  // Fetch child organizations
  const { data: childOrganizations, isLoading: childOrgLoading } = useQuery({
    queryKey: ["childOrganizations", currentUser?.organization_id],
    queryFn: () => 
      currentUser?.organization_id 
        ? OrganizationsService.readChildOrganizations({ id: currentUser.organization_id })
        : null,
    enabled: !!currentUser?.organization_id,
  })

  // Set default selected organization when data loads
  useEffect(() => {
    if (organizationData && !selectedOrganization) {
      setSelectedOrganization(organizationData)
    }
  }, [organizationData, selectedOrganization, setSelectedOrganization])

  // Handle organization selection and switching
  const handleOrganizationSelect = async (org: OrganizationPublic) => {
    try {
      // Switch the user's profile to the selected organization
      await switchOrganization(org)
    } catch (error) {
      console.error('Error switching organization:', error)
    }
  }

  // Load selected organization from localStorage on mount
  // useEffect(() => {
  //   const savedOrg = localStorage.getItem('selectedOrganization')
  //   if (savedOrg) {
  //     try {
  //       const parsedOrg = JSON.parse(savedOrg)
  //       setSelectedOrganization(parsedOrg)
  //       queryClient.setQueryData(['selectedOrganization'], parsedOrg)
  //     } catch (error) {
  //       console.error('Error parsing saved organization:', error)
  //     }
  //   }
  // }, [queryClient])

  const finalItems = currentUser?.is_superuser
    ? [...items, { icon: FiUsers, title: "Admin", path: "/admin" }]
    : items

  const listItems = finalItems.map(({ icon, title, path }) => (
    <Flex
      as={Link}
      to={path}
      w="100%"
      p={3}
      key={title}
      activeProps={{
        style: {
          background: "ui.secondary",
          borderRadius: "12px",
          boxShadow: "sm",
          color: "ui.light",
        },
      }}
      color={textColor}
      onClick={onClose}
      borderRadius="12px"
      mb={1}
      transition="all 0.2s"
      _hover={{
        bg: "ui.main",
        transform: "translateX(4px)",
        boxShadow: "sm",
        color: "ui.dark",
      }}
      alignItems="center"
    >
      <Icon as={icon} alignSelf="center" fontSize="16px" />
      <Text ml={3} fontSize="sm" fontWeight="medium">{title}</Text>
    </Flex>
  ))

  return (
    <>
      {/* Organization Dropdown */}
      {currentUser?.organization_id && (
        <Box mb={4} px={2}>
          <Menu>
            <MenuButton
              as={Button}
              w="100%"
              variant="solid"
              bg="ui.secondary"
              color="ui.light"
              justifyContent="space-between"
              leftIcon={orgLoading || orgSwitchLoading ? <Spinner size="sm" color="ui.light" /> : <FiHome />}
              rightIcon={<Icon as={FiChevronDown} />}
              _hover={{ 
                bg: "ui.dark",
                transform: "translateY(-1px)",
                boxShadow: "lg",
              }}
              _active={{ 
                bg: "ui.darkSlate",
                transform: "translateY(0px)",
              }}
              fontSize="sm"
              fontWeight="semibold"
              h="44px"
              borderRadius="12px"
              mb={1}
              transition="all 0.2s"
              alignItems="center"
              boxShadow="md"
              border="1px solid"
              borderColor="ui.dark"
            >
              {orgLoading || orgSwitchLoading ? "Loading..." : selectedOrganization?.name || organizationData?.name || "Organization"}
            </MenuButton>
            <MenuList 
              minW="280px" 
              py={2}
              border="1px solid"
              borderColor="ui.dim"
              boxShadow="xl"
              borderRadius="12px"
              bg="ui.light"
              mt={2}
            >
              {/* Current Organization Header */}
              <MenuItem 
                icon={<FiHome />} 
                onClick={() => handleOrganizationSelect(organizationData!)}
                fontSize="sm"
                fontWeight="semibold"
                color={selectedOrganization?.uid === organizationData?.uid ? "ui.light" : "ui.dark"}
                bg={selectedOrganization?.uid === organizationData?.uid ? "ui.secondary" : "ui.main"}
                _hover={{ 
                  bg: selectedOrganization?.uid === organizationData?.uid ? "ui.secondary" : "ui.main",
                  opacity: 0.8
                }}
                px={4}
                py={3}
                borderBottom="1px solid"
                borderColor="ui.dim"
                cursor="pointer"
                isDisabled={orgSwitchLoading}
                opacity={orgSwitchLoading ? 0.6 : 1}
              >
                {organizationData?.name || "Organization"}
                {selectedOrganization?.uid === organizationData?.uid && (
                  <Text as="span" ml={2} fontSize="xs" color="ui.light">
                    (Current Context)
                  </Text>
                )}
              </MenuItem>
              
              {/* Organization Description */}
              {organizationData?.description && (
                <MenuItem 
                  isDisabled 
                  fontSize="xs" 
                  color="ui.secondary"
                  _hover={{ bg: "transparent" }}
                  cursor="default"
                  px={4}
                  py={2}
                  fontStyle="italic"
                  bg="ui.light"
                >
                  {organizationData.description}
                </MenuItem>
              )}
              
              {/* Divider before child organizations */}
              {childOrganizations && childOrganizations.data.length > 0 && (
                <Box 
                  borderTop="1px solid" 
                  borderColor="ui.dim"
                  mx={4}
                  my={2}
                />
              )}
              
              {/* Child Organizations */}
              {childOrganizations && childOrganizations.data.length > 0 && (
                <>
                  <MenuItem 
                    isDisabled 
                    fontSize="xs" 
                    color="ui.secondary" 
                    fontWeight="bold" 
                    textTransform="uppercase"
                    letterSpacing="wide"
                    px={4}
                    py={2}
                    _hover={{ bg: "transparent" }}
                    cursor="default"
                  >
                    Child Organizations
                  </MenuItem>
                  {childOrganizations.data.map((childOrg) => (
                    <MenuItem 
                      key={childOrg.uid} 
                      pl={8}
                      fontSize="sm"
                      color={selectedOrganization?.uid === childOrg.uid ? "ui.light" : "ui.dark"}
                      bg={selectedOrganization?.uid === childOrg.uid ? "ui.secondary" : "transparent"}
                      _hover={{ 
                        bg: selectedOrganization?.uid === childOrg.uid ? "ui.secondary" : "ui.main",
                        color: selectedOrganization?.uid === childOrg.uid ? "ui.light" : "ui.dark"
                      }}
                      transition="all 0.2s"
                      px={4}
                      py={2}
                      borderRadius="6px"
                      mx={2}
                      cursor="pointer"
                      onClick={() => handleOrganizationSelect(childOrg)}
                      isDisabled={orgSwitchLoading}
                      opacity={orgSwitchLoading ? 0.6 : 1}
                    >
                      {childOrg.name}
                      {selectedOrganization?.uid === childOrg.uid && (
                        <Text as="span" ml={2} fontSize="xs" color="ui.light">
                          (Current Context)
                        </Text>
                      )}
                    </MenuItem>
                  ))}
                </>
              )}
            </MenuList>
          </Menu>
        </Box>
      )}
      
      <Box>{listItems}</Box>
    </>
  )
}

export default SidebarItems
