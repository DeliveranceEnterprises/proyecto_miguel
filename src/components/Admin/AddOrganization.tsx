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
  Select,
  VStack,
  Divider,
  Text,
  Textarea,
} from "@chakra-ui/react"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import { type OrganizationCreate, OrganizationsService, type UserPublic } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"

interface AddOrganizationProps {
  isOpen: boolean
  onClose: () => void
}

const AddOrganization = ({ isOpen, onClose }: AddOrganizationProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid, isDirty },
  } = useForm<OrganizationCreate>({
    mode: "onChange",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      description: "",
      address: "",
      parent_id: currentUser?.organization_id || null,
    },
  })

  // Fetch organizations for parent organization dropdown
  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await OrganizationsService.readOrganizations({})
      return response.data
    },
  })

  const mutation = useMutation({
    mutationFn: (data: OrganizationCreate) =>
      OrganizationsService.createOrganization({ requestBody: data }),
    onSuccess: () => {
      showToast("Success!", "Organization created successfully.", "success")
      reset()
      onClose()
    },
    onError: (err: ApiError) => {
      showToast(
        "Error",
        err.message || "Failed to create organization",
        "error"
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] })
    },
  })

  const onSubmit: SubmitHandler<OrganizationCreate> = (data) => {
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
        <ModalHeader>Add Organization</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Basic Information */}
            <Text fontWeight="medium" color="gray.500" fontSize="sm">
              Basic Information
            </Text>
            <FormControl isRequired isInvalid={!!errors.name}>
              <FormLabel htmlFor="name">Organization Name</FormLabel>
              <Input
                id="name"
                {...register("name", {
                  required: "Organization name is required",
                  minLength: {
                    value: 1,
                    message: "Name must not be empty",
                  },
                  maxLength: {
                    value: 255,
                    message: "Name must not exceed 255 characters",
                  },
                })}
                placeholder="Enter organization name"
              />
              {errors.name && (
                <FormErrorMessage>{errors.name.message}</FormErrorMessage>
              )}
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
            <FormControl isRequired isInvalid={!!errors.parent_id}>
              <FormLabel htmlFor="parent_id">Parent Organization</FormLabel>
              <Select
                id="parent_id"
                {...register("parent_id", {
                  required: "Parent organization is required",
                })}
                placeholder="Select parent organization"
                defaultValue={currentUser?.organization_id || ""}
              >
                {organizations?.map((org) => (
                  <option key={org.uid} value={org.uid}>
                    {org.name}
                  </option>
                ))}
              </Select>
              {errors.parent_id && (
                <FormErrorMessage>{errors.parent_id.message}</FormErrorMessage>
              )}
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
            Create Organization
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default AddOrganization 