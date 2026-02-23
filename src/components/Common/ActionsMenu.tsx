import {
  Button,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  useDisclosure,
  Portal,
} from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"
import { FiEdit, FiTrash } from "react-icons/fi"

import type { UserPublic, OrganizationPublic } from "../../client"
import EditUser from "../Admin/EditUser"
import EditOrganization from "../Admin/EditOrganization"
import Delete from "./DeleteAlert"

type ActionValue = (ItemPublic | UserPublic | { id: string }) | OrganizationPublic

interface ActionsMenuProps {
  type: string
  value: ActionValue
  disabled?: boolean
  onEditStart?: () => void
  onEditEnd?: () => void
}

const ActionsMenu = ({ type, value, disabled, onEditStart, onEditEnd }: ActionsMenuProps) => {
  const editModal = useDisclosure()
  const deleteModal = useDisclosure()

  const renderEditComponent = () => {
    switch (type) {
      case "User":
        return (
          <EditUser
            user={value as UserPublic}
            isOpen={editModal.isOpen}
            onClose={() => {
              editModal.onClose()
              onEditEnd?.()
            }}
          />
        )
      case "Organization":
        return (
          <EditOrganization
            organization={value as OrganizationPublic}
            isOpen={editModal.isOpen}
            onClose={() => {
              editModal.onClose()
              onEditEnd?.()
            }}
          />
        )
      default:
        return null
    }
  }

  const getId = () => {
    if (type === "Organization") {
      return (value as OrganizationPublic).uid
    }
    return (value as { id: string }).id
  }

  const handleEditClick = () => {
    onEditStart?.()
    editModal.onOpen()
  }

  return (
    <>
      <Menu>
        <MenuButton
          isDisabled={disabled}
          as={Button}
          rightIcon={<BsThreeDotsVertical />}
          variant="unstyled"
        />
        <Portal>
          <MenuList>
            <MenuItem
              onClick={handleEditClick}
              icon={<FiEdit fontSize="16px" />}
            >
              Edit {type}
            </MenuItem>
            <MenuItem
              onClick={deleteModal.onOpen}
              icon={<FiTrash fontSize="16px" />}
              color="ui.danger"
            >
              Delete {type}
            </MenuItem>
          </MenuList>
        </Portal>
        {renderEditComponent()}
        <Delete
          type={type}
          id={getId()}
          isOpen={deleteModal.isOpen}
          onClose={deleteModal.onClose}
        />
      </Menu>
    </>
  )
}

export default ActionsMenu
