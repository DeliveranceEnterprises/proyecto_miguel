import {
  Box,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Image,
} from "@chakra-ui/react"
import { Link } from "@tanstack/react-router"
import { FaUserAstronaut } from "react-icons/fa"
import { FiLogOut, FiUser } from "react-icons/fi"
import { useQueryClient } from "@tanstack/react-query"
import type { UserPublic } from "../../client"

import useAuth from "../../hooks/useAuth"

const getBackendImagePath = (image: string): string => {
  // If the image path starts with /images, it needs to be prefixed with /static
  if (image.startsWith('/images/')) {
    return `/static${image}`;
  }
  return image;
};

const UserMenu = () => {
  const { logout } = useAuth()
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])

  const handleLogout = async () => {
    logout()
  }

  // Only get the image path if the user has an image that starts with /images/ or /static/
  const userImage = currentUser?.image && 
    (currentUser.image.startsWith('/images/') || currentUser.image.startsWith('/static/')) ? 
    getBackendImagePath(currentUser.image) : null;

  return (
    <>
      {/* Desktop */}
      <Box
        display={{ base: "none", md: "block" }}
        position="fixed"
        top={4}
        right={4}
      >
        <Menu>
          <MenuButton
            as={IconButton}
            aria-label="Options"
            bg="ui.secondary"
            isRound
            data-testid="user-menu"
            width="40px"
            height="40px"
            padding={0}
            overflow="hidden"
            icon={
              userImage ? (
                <Image
                  src={userImage}
                  alt={currentUser?.full_name || "User"}
                  width="100%"
                  height="100%"
                  objectFit="cover"
                />
              ) : (
                <FaUserAstronaut color="white" fontSize="18px" />
              )
            }
          />
          <MenuList>
            <MenuItem icon={<FiUser fontSize="18px" />} as={Link} to="settings">
              My profile
            </MenuItem>
            <MenuItem
              icon={<FiLogOut fontSize="18px" />}
              onClick={handleLogout}
              color="ui.danger"
              fontWeight="bold"
            >
              Log out
            </MenuItem>
          </MenuList>
        </Menu>
      </Box>
    </>
  )
}

export default UserMenu
