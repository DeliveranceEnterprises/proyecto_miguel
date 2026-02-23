import React from "react"
import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  VStack,
  Divider,
  Text,
  Textarea,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import { type OrganizationUpdate, type OrganizationPublic, OrganizationsService } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"

interface EditOrganizationProps {
  organization: OrganizationPublic
  isOpen: boolean
  onClose: () => void
}

const EditOrganization = ({ organization, isOpen, onClose }: EditOrganizationProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid, isDirty },
  } = useForm<OrganizationUpdate>({
    mode: "onChange",
    criteriaMode: "all",
    defaultValues: {
      description: organization.description || "",
      address: organization.address || "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: OrganizationUpdate) =>
      OrganizationsService.updateOrganization({
        id: organization.uid,
        requestBody: {
          ...data,
          // Ensure name and parent_id remain unchanged
          name: organization.name,
          parent_id: organization.parent_id,
        },
      }),
    onSuccess: () => {
      showToast("Success!", "Organization updated successfully.", "success")
      reset()
      onClose()
    },
    onError: (err: ApiError) => {
      showToast(
        "Error",
        err.message || "Failed to update organization",
        "error"
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
    },
  })

  const onSubmit: SubmitHandler<OrganizationUpdate> = (data) => {
    mutation.mutate(data)
  }

  const isFormComplete = isValid && isDirty && Object.keys(errors).length === 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "sm", md: "md" }}
      isCentered
    >
      <ModalOverlay />
      <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
        <ModalHeader>Edit Organization</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Basic Information */}
            <Text fontWeight="medium" color="gray.500" fontSize="sm">
              Basic Information
            </Text>
            <FormControl>
              <FormLabel htmlFor="name">Organization Name</FormLabel>
              <Input
                id="name"
                value={organization.name}
                isReadOnly
                bg="gray.50"
                _dark={{ bg: "gray.700" }}
              />
            </FormControl>

            <FormControl isInvalid={!!errors.description}>
              <FormLabel htmlFor="description">Description</FormLabel>
              <Textarea
                id="description"
                {...register("description", {
                  maxLength: {
                    value: 255,
                    message: "Description must not exceed 255 characters",
                  },
                })}
                placeholder="Enter organization description"
                rows={3}
              />
              {errors.description && (
                <FormErrorMessage>{errors.description.message}</FormErrorMessage>
              )}
            </FormControl>

            <Divider />

            {/* Location Information */}
            <Text fontWeight="medium" color="gray.500" fontSize="sm">
              Location Information
            </Text>
            <FormControl isRequired isInvalid={!!errors.address}>
              <FormLabel htmlFor="address">Address</FormLabel>
              <Input
                id="address"
                {...register("address", {
                  required: "Address is required",
                  maxLength: {
                    value: 255,
                    message: "Address must not exceed 255 characters",
                  },
                })}
                placeholder="Enter organization address"
              />
              {errors.address && (
                <FormErrorMessage>{errors.address.message}</FormErrorMessage>
              )}
            </FormControl>

            <Divider />

            {/* Hierarchy Information */}
            <Text fontWeight="medium" color="gray.500" fontSize="sm">
              Organization Hierarchy
            </Text>
            <FormControl>
              <FormLabel htmlFor="parent_id">Parent Organization</FormLabel>
              <Input
                id="parent_id"
                value={organization.parent_id || "No parent organization"}
                isReadOnly
                bg="gray.50"
                _dark={{ bg: "gray.700" }}
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button
            type="submit"
            isLoading={isSubmitting}
            variant={isFormComplete ? "solid" : "outline"}
            colorScheme={isFormComplete ? "green" : "gray"}
            _hover={{
              bg: isFormComplete ? "green.500" : undefined,
            }}
          >
            Save Changes
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditOrganization 