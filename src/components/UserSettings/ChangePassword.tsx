import {
  Box,
  Button,
  Container,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  VStack,
  Icon,
  useColorModeValue,
  Text,
} from "@chakra-ui/react"
import { useMutation } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"
import { FiLock } from "react-icons/fi"

import { type ApiError, type UpdatePassword, UsersService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import { confirmPasswordRules, handleError, passwordRules } from "../../utils"

interface UpdatePasswordForm extends UpdatePassword {
  confirm_password: string
}

const ChangePassword = () => {
  const color = useColorModeValue("inherit", "ui.light")
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const showToast = useCustomToast()
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordForm>({
    mode: "onBlur",
    criteriaMode: "all",
  })

  const mutation = useMutation({
    mutationFn: (data: UpdatePassword) =>
      UsersService.updatePasswordMe({ requestBody: data }),
    onSuccess: () => {
      showToast("Success!", "Password updated successfully.", "success")
      reset()
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
  })

  const onSubmit: SubmitHandler<UpdatePasswordForm> = async (data) => {
    mutation.mutate(data)
  }

  return (
    <Container maxW="full" p={0}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="sm" mb={4}>
            Change Password
          </Heading>
          <Box
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="lg"
            p={6}
          >
            <Text mb={4} color="gray.500">
              Choose a strong password to protect your account.
            </Text>
            <Box
              as="form"
              onSubmit={handleSubmit(onSubmit)}
            >
              <VStack spacing={4} align="stretch">
                <FormControl isRequired isInvalid={!!errors.current_password}>
                  <FormLabel color={color} htmlFor="current_password" display="flex" alignItems="center">
                    <Icon as={FiLock} mr={2} />
                    Current Password
                  </FormLabel>
                  <Input
                    id="current_password"
                    {...register("current_password")}
                    placeholder="Enter your current password"
                    type="password"
                    variant="filled"
                  />
                  {errors.current_password && (
                    <FormErrorMessage>
                      {errors.current_password.message}
                    </FormErrorMessage>
                  )}
                </FormControl>

                <FormControl isRequired isInvalid={!!errors.new_password}>
                  <FormLabel color={color} htmlFor="password" display="flex" alignItems="center">
                    <Icon as={FiLock} mr={2} />
                    New Password
                  </FormLabel>
                  <Input
                    id="password"
                    {...register("new_password", passwordRules())}
                    placeholder="Enter your new password"
                    type="password"
                    variant="filled"
                  />
                  {errors.new_password && (
                    <FormErrorMessage>{errors.new_password.message}</FormErrorMessage>
                  )}
                </FormControl>

                <FormControl isRequired isInvalid={!!errors.confirm_password}>
                  <FormLabel color={color} htmlFor="confirm_password" display="flex" alignItems="center">
                    <Icon as={FiLock} mr={2} />
                    Confirm New Password
                  </FormLabel>
                  <Input
                    id="confirm_password"
                    {...register("confirm_password", confirmPasswordRules(getValues))}
                    placeholder="Confirm your new password"
                    type="password"
                    variant="filled"
                  />
                  {errors.confirm_password && (
                    <FormErrorMessage>
                      {errors.confirm_password.message}
                    </FormErrorMessage>
                  )}
                </FormControl>

                <Button
                  variant="primary"
                  type="submit"
                  isLoading={isSubmitting}
                  mt={2}
                >
                  Update Password
                </Button>
              </VStack>
            </Box>
          </Box>
        </Box>
      </VStack>
    </Container>
  )
}

export default ChangePassword
