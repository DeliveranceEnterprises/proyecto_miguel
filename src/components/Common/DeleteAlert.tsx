import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
  useDisclosure,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useForm } from "react-hook-form"

import { UsersService, OrganizationsService, DevicesService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"

interface DeleteProps {
  type: string
  id: string
  isOpen: boolean
  onClose: () => void
}

const Delete = ({ type, id, isOpen, onClose }: DeleteProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const cancelRef = React.useRef<HTMLButtonElement | null>(null)
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm()

  const deleteEntity = async (id: string) => {
    switch (type) {
      case "User":
        await UsersService.deleteUser({ userId: id })
        break
      case "Organization":
        await OrganizationsService.deleteOrganization({ id: id })
        break
      case "Device":
        // For devices, we disable them instead of deleting
        // Note: We need the device UID to update it
        // This will be handled by the parent component passing the device object
        throw new Error("Device disabling should be handled by ActionButton component")
      case "Item":
        // Note: Item deletion is not available without ItemsService
        throw new Error("Item deletion is not available")
      default:
        throw new Error(`Unexpected type: ${type}`)
    }
  }

  const mutation = useMutation({
    mutationFn: deleteEntity,
    onSuccess: () => {
      showToast(
        "Success",
        `The ${type.toLowerCase()} was removed successfully.`,
        "success",
      )
      onClose()
    },
    onError: (error) => {
      showToast(
        "An error occurred.",
        error instanceof Error ? error.message : `An error occurred while removing the ${type.toLowerCase()}.`,
        "error",
      )
    },
    onSettled: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: [type.toLowerCase() + "s"],
      })
    },
  })

  const onSubmit = async () => {
    mutation.mutate(id)
  }

  return (
    <>
      <AlertDialog
        isOpen={isOpen}
        onClose={onClose}
        leastDestructiveRef={cancelRef}
        size={{ base: "sm", md: "md" }}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent as="form" onSubmit={handleSubmit(onSubmit)}>
            <AlertDialogHeader>
              {type === "Device" ? "Disable Device" : `Delete ${type}`}
            </AlertDialogHeader>

            <AlertDialogBody>
              {type === "Device" 
                ? "Are you sure you want to disable this device? It will no longer be visible in your dashboard and analytics."
                : `Are you sure you want to delete this ${type.toLowerCase()}? This action cannot be undone.`
              }
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorScheme={type === "Device" ? "orange" : "red"}
                ml={3}
                type="submit"
                isLoading={isSubmitting}
                loadingText={type === "Device" ? "Disabling..." : "Deleting..."}
              >
                {type === "Device" ? "Disable" : "Delete"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  )
}

export default Delete
