import {
  Box,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerOverlay,
  Flex,
  IconButton,
  Image,
  Text,
  Divider,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { FiLogOut, FiMenu } from "react-icons/fi"

import Logo from "/assets/images/deliverance-wlogo.svg"
import type { UserPublic } from "../../client"
import useAuth from "../../hooks/useAuth"
import SidebarItems from "./SidebarItems"

const Sidebar = () => {
  const queryClient = useQueryClient()
  const bgColor = useColorModeValue("ui.light", "ui.dark")
  const textColor = useColorModeValue("ui.dark", "ui.light")
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { logout } = useAuth()

  const handleLogout = async () => {
    logout()
  }

  return (
    <>
      {/* Mobile */}
      <IconButton
        onClick={onOpen}
        display={{ base: "flex", md: "none" }}
        aria-label="Open Menu"
        position="absolute"
        fontSize="20px"
        m={4}
        icon={<FiMenu />}
      />
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent maxW="280px" bg={secBgColor}>
          <DrawerCloseButton 
            color={textColor}
            _hover={{ bg: useColorModeValue("gray.100", "gray.700") }}
            borderRadius="full"
            size="lg"
          />
          <DrawerBody py={6} px={4}>
            <Flex flexDir="column" justify="space-between" h="full">
              <Box>
                <Image src={Logo} alt="logo" p={4} mb={2} />
                <Box p={3} mb={4}>
                  <Divider borderColor={useColorModeValue("gray.300", "gray.600")} />
                </Box>
                <SidebarItems onClose={onClose} />
                <Box p={3} mt={4}>
                  <Divider borderColor={useColorModeValue("gray.300", "gray.600")} mb={4} />
                </Box>
                <Flex
                  as="button"
                  onClick={handleLogout}
                  p={3}
                  color="ui.danger"
                  fontWeight="semibold"
                  alignItems="center"
                  borderRadius="12px"
                  _hover={{ 
                    bg: useColorModeValue("red.50", "red.900"),
                    transform: "translateY(-1px)"
                  }}
                  transition="all 0.2s"
                >
                  <FiLogOut />
                  <Text ml={3}>Log out</Text>
                </Flex>
              </Box>
              {currentUser?.email && (
                <Box
                  p={3}
                  bg={useColorModeValue("red.50", "red.800")}
                  borderRadius="12px"
                  border="1px solid"
                  borderColor={useColorModeValue("red.200", "red.600")}
                  mt={4}
                >
                  <Text color={textColor} noOfLines={2} fontSize="xs" fontWeight="medium" textAlign="center" opacity={0.8}>
                    Platform version : 0.0.0
                  </Text>
                </Box>
              )}
            </Flex>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Desktop */}
      <Box
        bg={bgColor}
        p={4}
        h="100vh"
        position="sticky"
        top="0"
        display={{ base: "none", md: "flex" }}
        zIndex={1}
      >
        <Flex
          flexDir="column"
          justify="space-between"
          bg={secBgColor}
          p={4}
          borderRadius="16px"
          h="calc(100vh - 32px)"
          border="1px solid"
          borderColor={useColorModeValue("gray.200", "gray.700")}
        >
          <Box>
            <Image src={Logo} alt="Logo" w="280px" maxW="2xs" p={3} mb={2} />
            <Box p={3} mb={4}>
              <Divider borderColor={useColorModeValue("gray.300", "gray.600")} />
            </Box>
            <SidebarItems />
          </Box>
          {currentUser?.email && (
            <Box
              p={3}
              bg={useColorModeValue("gray.50", "gray.800")}
              borderRadius="12px"
              border="1px solid"
              borderColor={useColorModeValue("gray.200", "gray.600")}
            >
              <Text
                color={textColor}
                noOfLines={2}
                fontSize="xs"
                fontWeight="medium"
                textAlign="center"
                opacity={0.8}
              >
                Platform version : 0.0.0
              </Text>
            </Box>
          )}
        </Flex>
      </Box>
    </>
  )
}

export default Sidebar
