import {
  Badge,
  Box,
  Container,
  Flex,
  Heading,
  SkeletonText,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  useColorModeValue,
  Text,
  Tooltip,
  Image,
  Grid,
  GridItem,
  Center,
  Skeleton,
} from "@chakra-ui/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { z } from "zod"
import React from "react"

import { type UserPublic, UsersService, OrganizationsService } from "../../client"
import AddUser from "../../components/Admin/AddUser"
import AddOrganization from "../../components/Admin/AddOrganization"
import ActionsMenu from "../../components/Common/ActionsMenu"
import Navbar from "../../components/Common/Navbar"
import { PaginationFooter } from "../../components/Common/PaginationFooter.tsx"

const tabsConfig = [
  { title: "Users", component: UsersTable },
  { title: "Organizations", component: OrganizationTable },
]


const usersSearchSchema = z.object({
  page: z.number().catch(1),
})

export const Route = createFileRoute("/_layout/admin")({
  component: Admin,
  validateSearch: (search) => usersSearchSchema.parse(search),
})

const PER_PAGE = 5

const DEFAULT_PROFILE_IMAGE = "/assets/images/users/profile.png"

const getImageSrc = (image: string | null | undefined): string => {
  if (!image) return DEFAULT_PROFILE_IMAGE;
  // If the image path starts with /static, it's from the backend
  if (image.startsWith('/static/')) {
    return image;
  }
  // If the image path starts with /images, it's from the backend but needs to be prefixed
  if (image.startsWith('/images/')) {
    return `/static${image}`;
  }
  // Otherwise, it's a local asset
  return image;
};

function getUsersQueryOptions({ page }: { page: number }) {
  return {
    queryFn: () =>
      UsersService.readUsers({ skip: (page - 1) * PER_PAGE, limit: PER_PAGE }),
    queryKey: ["users", { page }],
  }
}

function UsersTable() {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const setPage = (page: number) =>
    navigate({ search: (prev: {[key: string]: string}) => ({ ...prev, page }) })
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const selectedBg = useColorModeValue("teal.400", "teal.500")
  const hoverBg = useColorModeValue("gray.50", "gray.700")
  const textColor = useColorModeValue("gray.800", "white")
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  const {
    data: users,
    isPending,
    isPlaceholderData,
  } = useQuery({
    ...getUsersQueryOptions({ page }),
    placeholderData: (prevData) => prevData,
  })

  // Fetch organizations data for users with organization_id
  const organizationIds = users?.data
    .map((user) => user.organization_id)
    .filter((id): id is string => id !== null)

  const { data: organizations } = useQuery({
    queryKey: ["organizations", organizationIds],
    queryFn: async () => {
      if (!organizationIds?.length) return {}
      const orgs = await Promise.all(
        organizationIds.map((id) =>
          OrganizationsService.readOrganization({ id }).catch(() => null)
        )
      )
      return Object.fromEntries(
        orgs
          .filter((org): org is NonNullable<typeof org> => org !== null)
          .map((org) => [org.uid, org])
      )
    },
    enabled: !!organizationIds?.length,
  })

  const hasNextPage = !isPlaceholderData && users?.data.length === PER_PAGE
  const hasPreviousPage = page > 1

  useEffect(() => {
    if (hasNextPage) {
      queryClient.prefetchQuery(getUsersQueryOptions({ page: page + 1 }))
    }
  }, [page, queryClient, hasNextPage])

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Navbar type={"User"} addModalAs={AddUser} />
        <Box>
          <PaginationFooter
            onChangePage={setPage}
            page={page}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
          />
        </Box>
      </Flex>
      <Box
        borderWidth="1px"
        borderColor={borderColor}
        borderRadius="lg"
        overflow="hidden"
      >
        <TableContainer>
          <Table size={{ base: "sm", md: "md" }} variant="simple">
            <Thead bg={useColorModeValue("gray.50", "gray.800")}>
              <Tr>
                <Th width="5%">Avatar</Th>
                <Th width="15%">Full name</Th>
                <Th width="20%">Email</Th>
                <Th width="20%">Organization</Th>
                <Th width="10%">Role</Th>
                <Th width="10%">Status</Th>
                <Th width="10%">Actions</Th>
              </Tr>
            </Thead>
            {isPending ? (
              <Tbody>
                <Tr>
                  {new Array(7).fill(null).map((_, index) => (
                    <Td key={index}>
                      <SkeletonText noOfLines={1} paddingBlock="16px" />
                    </Td>
                  ))}
                </Tr>
              </Tbody>
            ) : (
              <Tbody>
                {users?.data.map((user) => {
                  const isSelected = user.id === selectedUser;
                  return (
                    <React.Fragment key={user.id}>
                      <Tr
                        bg={isSelected ? selectedBg : "transparent"}
                        color={isSelected ? "white" : textColor}
                        cursor="pointer"
                        onClick={() => setSelectedUser(isSelected ? null : user.id)}
                        _hover={{ 
                          bg: isSelected ? selectedBg : hoverBg,
                          transform: "translateY(-2px)",
                          transition: "all 0.2s",
                          boxShadow: isSelected ? "dark-lg" : "md",
                        }}
                      >
                        <Td>
                          <Box
                            width="40px"
                            height="40px"
                            borderRadius="full"
                            overflow="hidden"
                            bg="gray.200"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            {user.image ? (
                              <Image
                                src={getImageSrc(user.image)}
                                alt={user.full_name || "User"}
                                width="100%"
                                height="100%"
                                objectFit="cover"
                              />
                            ) : (
                              <Center height="100%">
                                <Text fontSize="lg" color="gray.500">
                                  {user.full_name?.charAt(0) || "U"}
                                </Text>
                              </Center>
                            )}
                          </Box>
                        </Td>
                        <Td>
                          <Tooltip label={user.full_name || "N/A"} hasArrow>
                            <Text
                              fontWeight="medium"
                              isTruncated
                              color={isSelected ? "white" : textColor}
                            >
                              {user.full_name || "N/A"}
                              {currentUser?.id === user.id && (
                                <Badge ml="1" colorScheme={isSelected ? "blue" : "teal"}>
                                  You
                                </Badge>
                              )}
                            </Text>
                          </Tooltip>
                        </Td>
                        <Td>
                          <Tooltip label={user.email} hasArrow>
                            <Text
                              isTruncated
                              color={isSelected ? "white" : textColor}
                            >
                              {user.email}
                            </Text>
                          </Tooltip>
                        </Td>
                        <Td>
                          {user.organization_id ? (
                            <Tooltip label={organizations?.[user.organization_id]?.name} hasArrow>
                              <Text
                                isTruncated
                                color={isSelected ? "white" : textColor}
                              >
                                {organizations?.[user.organization_id]?.name || "Loading..."}
                              </Text>
                            </Tooltip>
                          ) : (
                            <Text color={isSelected ? "whiteAlpha.700" : "ui.dim"}>
                              No organization
                            </Text>
                          )}
                        </Td>
                        <Td>
                          <Badge
                            colorScheme={user.is_superuser ? "purple" : "blue"}
                            variant={isSelected ? "solid" : "subtle"}
                          >
                            {user.is_superuser ? "Superuser" : "User"}
                          </Badge>
                        </Td>
                        <Td>
                          <Flex gap={2}>
                            <Box
                              w="2"
                              h="2"
                              borderRadius="50%"
                              bg={user.is_active ? "ui.success" : "ui.danger"}
                              alignSelf="center"
                            />
                            <Text
                              fontSize="sm"
                              color={isSelected ? "white" : textColor}
                            >
                              {user.is_active ? "Active" : "Inactive"}
                            </Text>
                          </Flex>
                        </Td>
                        <Td>
                          <ActionsMenu
                            type="User"
                            value={user}
                            disabled={currentUser?.id === user.id}
                          />
                        </Td>
                      </Tr>
                      {isSelected && (
                        <Tr>
                          <Td colSpan={7} p={0}>
                            <Box
                              bg={useColorModeValue("gray.50", "gray.700")}
                              p={6}
                              borderBottomRadius="lg"
                              boxShadow="lg"
                              transform="translateY(-1px)"
                            >
                              <Flex gap={8}>
                                {/* Left side: Large avatar */}
                                <Box
                                  width="150px"
                                  height="150px"
                                  flexShrink={0}
                                  borderRadius="lg"
                                  overflow="hidden"
                                  bg="gray.200"
                                  border="1px solid"
                                  borderColor={useColorModeValue("gray.200", "gray.600")}
                                  position="relative"
                                >
                                  <Skeleton isLoaded={!isPending}>
                                    {user.image ? (
                                      <Image
                                        src={getImageSrc(user.image)}
                                        alt={user.full_name || "Profile picture"}
                                        width="100%"
                                        height="100%"
                                        objectFit="cover"
                                      />
                                    ) : (
                                      <Image
                                        src={DEFAULT_PROFILE_IMAGE}
                                        alt="Default profile picture"
                                        width="100%"
                                        height="100%"
                                        objectFit="cover"
                                      />
                                    )}
                                  </Skeleton>
                                </Box>

                                {/* Right side: Detailed information */}
                                <Box flex="1">
                                  <Heading size="md" mb={4}>
                                    {user.full_name || "N/A"}
                                    {currentUser?.id === user.id && (
                                      <Badge ml="2" colorScheme="teal">
                                        Current User
                                      </Badge>
                                    )}
                                  </Heading>
                                  <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                                    <GridItem>
                                      <Text fontWeight="bold" color={useColorModeValue("gray.600", "gray.300")}>
                                        Email
                                      </Text>
                                      <Text>{user.email}</Text>
                                    </GridItem>
                                    <GridItem>
                                      <Text fontWeight="bold" color={useColorModeValue("gray.600", "gray.300")}>
                                        Organization
                                      </Text>
                                      <Text>
                                        {user.organization_id
                                          ? organizations?.[user.organization_id]?.name || "Loading..."
                                          : "No organization"}
                                      </Text>
                                    </GridItem>
                                    <GridItem>
                                      <Text fontWeight="bold" color={useColorModeValue("gray.600", "gray.300")}>
                                        Role
                                      </Text>
                                      <Badge
                                        colorScheme={user.is_superuser ? "purple" : "blue"}
                                        variant="subtle"
                                      >
                                        {user.is_superuser ? "Superuser" : "User"}
                                      </Badge>
                                    </GridItem>
                                    <GridItem>
                                      <Text fontWeight="bold" color={useColorModeValue("gray.600", "gray.300")}>
                                        Status
                                      </Text>
                                      <Flex gap={2} mt={1}>
                                        <Box
                                          w="2"
                                          h="2"
                                          borderRadius="50%"
                                          bg={user.is_active ? "ui.success" : "ui.danger"}
                                          alignSelf="center"
                                        />
                                        <Text fontSize="sm">
                                          {user.is_active ? "Active" : "Inactive"}
                                        </Text>
                                      </Flex>
                                    </GridItem>
                                    <GridItem>
                                      <Text fontWeight="bold" color={useColorModeValue("gray.600", "gray.300")}>
                                        User ID
                                      </Text>
                                      <Text fontSize="sm" fontFamily="monospace">
                                        {user.id}
                                      </Text>
                                    </GridItem>
                                  </Grid>
                                </Box>
                              </Flex>
                            </Box>
                          </Td>
                        </Tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </Tbody>
            )}
          </Table>
        </TableContainer>
      </Box>
    </Box>
  )
}

const DEFAULT_ORG_IMAGE = "/assets/images/organizations/profile.png"

const getOrgImageSrc = (image: string | null | undefined): string => {
  if (!image) return DEFAULT_ORG_IMAGE;
  // If the image path starts with /static, it's from the backend
  if (image.startsWith('/static/')) {
    return image;
  }
  // If the image path starts with /images, it's from the backend but needs to be prefixed
  if (image.startsWith('/images/')) {
    return `/static${image}`;
  }
  // Otherwise, it's a local asset
  return image;
};

function OrganizationTable() {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const setPage = (page: number) =>
    navigate({ search: (prev: {[key: string]: string}) => ({ ...prev, page }) })
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const selectedBg = useColorModeValue("teal.400", "teal.500")
  const hoverBg = useColorModeValue("gray.50", "gray.700")
  const textColor = useColorModeValue("gray.800", "white")
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null)
  const levelColors = ["blue", "purple", "green", "orange", "red"]

  const {
    data: organizations,
    isPending,
    isPlaceholderData,
  } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await OrganizationsService.readOrganizations({})
      return response.data
    },
  })

  // Build organization hierarchy
  const rootOrganization = organizations?.find(org => org.uid === currentUser?.organization_id)
  const renderedOrgs = new Set<string>()

  const getChildOrganizations = (parentId: string) => {
    return organizations?.filter(org => 
      org.parent_id === parentId && !renderedOrgs.has(org.uid)
    ) || []
  }

  type OrganizationPublic = NonNullable<typeof organizations>[number]

  const renderOrganizationRow = (org: OrganizationPublic, level: number = 0): JSX.Element => {
    renderedOrgs.add(org.uid)
    const childOrgs = getChildOrganizations(org.uid)
    const colorIndex = level % levelColors.length
    const isSelected = org.uid === selectedOrg;
    const bgColor = useColorModeValue(`${levelColors[colorIndex]}.50`, `${levelColors[colorIndex]}.900`)

    return (
      <React.Fragment key={org.uid}>
        <Tr
          bg={isSelected ? selectedBg : (level === 0 ? "transparent" : bgColor)}
          color={isSelected ? "white" : textColor}
          cursor="pointer"
          onClick={() => setSelectedOrg(isSelected ? null : org.uid)}
          _hover={{ 
            bg: isSelected ? selectedBg : hoverBg,
            transform: "translateY(-2px)",
            transition: "all 0.2s",
            boxShadow: isSelected ? "dark-lg" : "md",
          }}
        >
          <Td>
            <Flex align="center" gap={3}>
              {level > 0 && (
                <>
                  <Box w={`${(level - 1) * 24}px`} />
                  <Box w="24px" position="relative">
                    <Box
                      position="absolute"
                      left="0"
                      top="0"
                      bottom="0"
                      width="2px"
                      bg={isSelected ? "white" : `${levelColors[colorIndex]}.400`}
                    />
                    <Box
                      position="absolute"
                      left="0"
                      top="50%"
                      width="16px"
                      height="2px"
                      bg={isSelected ? "white" : `${levelColors[colorIndex]}.400`}
                    />
                  </Box>
                </>
              )}
              <Box
                width="40px"
                height="40px"
                borderRadius="full"
                overflow="hidden"
                bg="gray.200"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                {org.image ? (
                  <Image
                    src={getOrgImageSrc(org.image)}
                    alt={org.name}
                    width="100%"
                    height="100%"
                    objectFit="cover"
                  />
                ) : (
                  <Center height="100%">
                    <Text fontSize="lg" color="gray.500">
                      {org.name?.charAt(0) || "O"}
                    </Text>
                  </Center>
                )}
              </Box>
              <Box flex="1">
                <Tooltip 
                  label={`${org.name}${org.uid === currentUser?.organization_id ? ' (Current Organization)' : ''}`}
                  hasArrow
                  placement="top-start"
                >
                  <Text 
                    isTruncated 
                    maxWidth="300px" 
                    fontWeight={level === 0 ? "bold" : "normal"}
                    color={isSelected ? "white" : textColor}
                  >
                    {org.name}
                    {org.uid === currentUser?.organization_id && (
                      <Badge ml="2" colorScheme={isSelected ? "blue" : "teal"}>
                        Current
                      </Badge>
                    )}
                  </Text>
                </Tooltip>
              </Box>
            </Flex>
          </Td>
          <Td>
            <Tooltip 
              label={org.description || "No description provided"} 
              hasArrow
              placement="top"
            >
              <Text 
                isTruncated 
                maxWidth="200px" 
                color={isSelected ? "white" : (org.description ? textColor : "gray.500")}
              >
                {org.description || "No description"}
              </Text>
            </Tooltip>
          </Td>
          <Td>
            <Tooltip 
              label={org.address || "No address provided"} 
              hasArrow
              placement="top"
            >
              <Text 
                isTruncated 
                maxWidth="200px" 
                color={isSelected ? "white" : (org.address ? textColor : "gray.500")}
              >
                {org.address || "No address"}
              </Text>
            </Tooltip>
          </Td>
          <Td>
            <Badge
              colorScheme={levelColors[colorIndex]}
              variant={isSelected ? "solid" : "subtle"}
            >
              Level {level + 1}
            </Badge>
          </Td>
          <Td>
            <ActionsMenu
              type="Organization"
              value={{
                id: org.uid,
                title: org.name,
                owner_id: org.parent_id || "",
                ...org
              }}
              disabled={org.uid === currentUser?.organization_id}
            />
          </Td>
        </Tr>
        {isSelected && (
          <Tr>
            <Td colSpan={5} p={0}>
              <Box
                bg={useColorModeValue("gray.50", "gray.700")}
                p={6}
                borderBottomRadius="lg"
                boxShadow="lg"
                transform="translateY(-1px)"
              >
                <Flex gap={8}>
                  {/* Left side: Large logo */}
                  <Box
                    width="150px"
                    height="150px"
                    flexShrink={0}
                    borderRadius="lg"
                    overflow="hidden"
                    bg="gray.200"
                    border="1px solid"
                    borderColor={useColorModeValue("gray.200", "gray.600")}
                    position="relative"
                  >
                    <Skeleton isLoaded={!isPending}>
                      {org.image ? (
                        <Image
                          src={getOrgImageSrc(org.image)}
                          alt={org.name || "Organization logo"}
                          width="100%"
                          height="100%"
                          objectFit="cover"
                        />
                      ) : (
                        <Image
                          src={DEFAULT_ORG_IMAGE}
                          alt="Default organization logo"
                          width="100%"
                          height="100%"
                          objectFit="cover"
                        />
                      )}
                    </Skeleton>
                  </Box>

                  {/* Right side: Detailed information */}
                  <Box flex="1">
                    <Heading size="md" mb={4}>
                      {org.name}
                      {org.uid === currentUser?.organization_id && (
                        <Badge ml="2" colorScheme="teal">
                          Current Organization
                        </Badge>
                      )}
                    </Heading>
                    <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                      <GridItem>
                        <Text fontWeight="bold" color={useColorModeValue("gray.600", "gray.300")}>
                          Description
                        </Text>
                        <Text>{org.description || "No description provided"}</Text>
                      </GridItem>
                      <GridItem>
                        <Text fontWeight="bold" color={useColorModeValue("gray.600", "gray.300")}>
                          Address
                        </Text>
                        <Text>{org.address || "No address provided"}</Text>
                      </GridItem>
                      <GridItem>
                        <Text fontWeight="bold" color={useColorModeValue("gray.600", "gray.300")}>
                          Hierarchy Level
                        </Text>
                        <Badge colorScheme={levelColors[colorIndex]}>
                          Level {level + 1}
                        </Badge>
                      </GridItem>
                      <GridItem>
                        <Text fontWeight="bold" color={useColorModeValue("gray.600", "gray.300")}>
                          Parent Organization
                        </Text>
                        <Text>
                          {org.parent_id
                            ? organizations?.find(o => o.uid === org.parent_id)?.name || "Unknown"
                            : "Root Organization"}
                        </Text>
                      </GridItem>
                      <GridItem>
                        <Text fontWeight="bold" color={useColorModeValue("gray.600", "gray.300")}>
                          Organization ID
                        </Text>
                        <Text fontSize="sm" fontFamily="monospace">
                          {org.uid}
                        </Text>
                      </GridItem>
                    </Grid>
                  </Box>
                </Flex>
              </Box>
            </Td>
          </Tr>
        )}
        {childOrgs.map(childOrg => renderOrganizationRow(childOrg, level + 1))}
      </React.Fragment>
    )
  }

  if (!rootOrganization && !isPending) {
    return (
      <Box textAlign="center" py={10}>
        <Text color="gray.500">No organizations found or you don't have access to view them.</Text>
      </Box>
    )
  }

  return (
    <Box>
      <Box mb={6}>
        <Navbar type="Organization" addModalAs={AddOrganization} />
      </Box>
      <Box
        borderWidth="1px"
        borderColor={borderColor}
        borderRadius="lg"
        overflow="hidden"
      >
        <TableContainer>
          <Table size={{ base: "sm", md: "md" }} variant="simple">
            <Thead bg={useColorModeValue("gray.50", "gray.800")}>
              <Tr>
                <Th width="35%">Organization</Th>
                <Th width="25%">Description</Th>
                <Th width="20%">Address</Th>
                <Th width="10%">Level</Th>
                <Th width="10%">Actions</Th>
              </Tr>
            </Thead>
            {isPending ? (
              <Tbody>
                <Tr>
                  {new Array(5).fill(null).map((_, index) => (
                    <Td key={index}>
                      <SkeletonText noOfLines={1} paddingBlock="16px" />
                    </Td>
                  ))}
                </Tr>
              </Tbody>
            ) : (
              <Tbody>
                {rootOrganization && renderOrganizationRow(rootOrganization)}
              </Tbody>
            )}
          </Table>
        </TableContainer>
      </Box>
    </Box>
  )
}

function Admin() {
  const finalTabs = tabsConfig.slice(0, 2)
  const bgColor = useColorModeValue("ui.light", "ui.dark")

  return (
    <Container maxW="full" bg={bgColor} minH="100vh">
      <Box pt={12} px={4}>
        <Heading size="lg" textAlign={{ base: "center", md: "left" }} mb={8}>
          Admin Panel
        </Heading>
        <Box
          bg={useColorModeValue("white", "gray.800")}
          borderRadius="lg"
          p={6}
          boxShadow="sm"
        >
          <Tabs variant="enclosed">
            <TabList>
              {finalTabs.map((tab, index) => (
                <Tab key={index}>{tab.title}</Tab>
              ))}
            </TabList>
            <TabPanels>
              {finalTabs.map((tab, index) => (
                <TabPanel key={index} px={0}>
                  <tab.component />
                </TabPanel>
              ))}
            </TabPanels>
          </Tabs>
        </Box>
      </Box>
    </Container>
  )
}
