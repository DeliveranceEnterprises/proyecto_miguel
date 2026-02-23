import {
  Button,
  Checkbox,
  Flex,
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
  useColorModeValue,
} from "@chakra-ui/react"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import { type UserCreate, UsersService, OrganizationsService } from "../../client"
import type { ApiError } from "../../client/core/ApiError"
import useCustomToast from "../../hooks/useCustomToast"
import { emailPattern, handleError } from "../../utils"

interface AddUserProps {
  isOpen: boolean
  onClose: () => void
}

interface UserCreateForm extends UserCreate {
  confirm_password: string
}

const AddUser = ({ isOpen, onClose }: AddUserProps) => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting, isValid, isDirty },
  } = useForm<UserCreateForm>({
    mode: "onChange",
    criteriaMode: "all",
    defaultValues: {
      email: "",
      full_name: "",
      password: "",
      confirm_password: "",
      is_superuser: false,
      is_active: true,
      organization_id: null,
    },
  })

  // Fetch organizations for the dropdown
  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await OrganizationsService.readOrganizations({})
      return response.data
    },
  })

  const mutation = useMutation({
    mutationFn: (data: UserCreate) =>
      UsersService.createUser({ requestBody: data }),
    onSuccess: () => {
      showToast("Success!", "User created successfully.", "success")
      reset()
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const onSubmit: SubmitHandler<UserCreateForm> = (data) => {
    // Remove confirm_password before sending to API
    const { confirm_password, ...userData } = data
    mutation.mutate(userData)
  }

  const isFormComplete = isValid && isDirty && Object.keys(errors).length === 0

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size={{ base: "sm", md: "md" }}
        isCentered
      >
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>Add User</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {/* Basic Information */}
              <Text fontWeight="medium" color="gray.500" fontSize="sm">
                Basic Information
              </Text>
              <FormControl isRequired isInvalid={!!errors.email}>
                <FormLabel htmlFor="email">Email</FormLabel>
                <Input
                  id="email"
                  {...register("email", {
                    required: "Email is required",
                    pattern: emailPattern,
                  })}
                  placeholder="Enter email address"
                  type="email"
                />
                {errors.email && (
                  <FormErrorMessage>{errors.email.message}</FormErrorMessage>
                )}
              </FormControl>

              <FormControl isInvalid={!!errors.full_name}>
                <FormLabel htmlFor="name">Full name</FormLabel>
                <Input
                  id="name"
                  {...register("full_name")}
                  placeholder="Enter full name"
                  type="text"
                />
                {errors.full_name && (
                  <FormErrorMessage>{errors.full_name.message}</FormErrorMessage>
                )}
              </FormControl>

              <FormControl>
                <FormLabel htmlFor="organization">Organization</FormLabel>
                <Select
                  id="organization"
                  {...register("organization_id")}
                  placeholder="Select organization"
                >
                  {organizations?.map((org) => (
                    <option key={org.uid} value={org.uid}>
                      {org.name}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <Divider />

              {/* Security Settings */}
              <Text fontWeight="medium" color="gray.500" fontSize="sm">
                Security Settings
              </Text>
              <FormControl isRequired isInvalid={!!errors.password}>
                <FormLabel htmlFor="password">Password</FormLabel>
                <Input
                  id="password"
                  {...register("password", {
                    required: "Password is required",
                    minLength: {
                      value: 8,
                      message: "Password must be at least 8 characters",
                    },
                  })}
                  placeholder="Enter password"
                  type="password"
                />
                {errors.password && (
                  <FormErrorMessage>{errors.password.message}</FormErrorMessage>
                )}
              </FormControl>

              <FormControl
                isRequired
                isInvalid={!!errors.confirm_password}
              >
                <FormLabel htmlFor="confirm_password">Confirm Password</FormLabel>
                <Input
                  id="confirm_password"
                  {...register("confirm_password", {
                    required: "Please confirm your password",
                    validate: (value) =>
                      value === getValues().password ||
                      "The passwords do not match",
                  })}
                  placeholder="Confirm password"
                  type="password"
                />
                {errors.confirm_password && (
                  <FormErrorMessage>
                    {errors.confirm_password.message}
                  </FormErrorMessage>
                )}
              </FormControl>

              <Divider />

              {/* Access Control */}
              <Text fontWeight="medium" color="gray.500" fontSize="sm">
                Access Control
              </Text>
              <Flex gap={6}>
                <FormControl display="flex" alignItems="center">
                  <Checkbox
                    {...register("is_superuser")}
                    colorScheme="purple"
                    size="lg"
                  >
                    Superuser
                  </Checkbox>
                </FormControl>
                <FormControl display="flex" alignItems="center">
                  <Checkbox
                    {...register("is_active")}
                    colorScheme="green"
                    size="lg"
                    defaultChecked
                  >
                    Active
                  </Checkbox>
                </FormControl>
              </Flex>
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
              Create User
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default AddUser
