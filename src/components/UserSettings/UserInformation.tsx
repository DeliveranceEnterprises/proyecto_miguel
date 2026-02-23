import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  FormControl,
  FormErrorMessage,
  Input,
  Text,
  useColorModeValue,
  VStack,
  Icon,
  Image,
  Center,
  IconButton,
  Input as ChakraInput,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Skeleton,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useRef } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"
import { FiUser, FiMail, FiCamera, FiUpload } from "react-icons/fi"

import {
  type ApiError,
  type UserPublic,
  type UserUpdateMe,
  UsersService,
} from "../../client"
import useAuth from "../../hooks/useAuth"
import useCustomToast from "../../hooks/useCustomToast"
import { emailPattern, handleError } from "../../utils"

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_USER_IMAGE = "/assets/images/users/profile.png"

const getImageSrc = (image: string | null | undefined): string => {
  if (!image) return DEFAULT_USER_IMAGE;
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

const UserInformation = () => {
  const queryClient = useQueryClient()
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const showToast = useCustomToast()
  const [editMode, setEditMode] = useState(false)
  const { user: currentUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { isSubmitting, errors, isDirty },
  } = useForm<UserPublic>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      full_name: currentUser?.full_name,
      email: currentUser?.email,
    },
  })

  const toggleEditMode = () => {
    setEditMode(!editMode)
  }

  const mutation = useMutation({
    mutationFn: (data: UserUpdateMe) =>
      UsersService.updateUserMe({ requestBody: data }),
    onSuccess: () => {
      showToast("Success!", "User updated successfully.", "success")
      toggleEditMode()
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries()
    },
  })

  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => {
      setIsLoading(true)
      const formData = new FormData()
      formData.append("file", file)
      return UsersService.uploadImage({ formData: { file } })
    },
    onSuccess: () => {
      showToast("Success!", "Profile picture updated successfully.", "success")
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
      onClose()
      setSelectedImage(null)
      setPreviewUrl(null)
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      setIsLoading(false)
    },
  })

  const onSubmit: SubmitHandler<UserUpdateMe> = async (data) => {
    mutation.mutate(data)
  }

  const onCancel = () => {
    reset()
    toggleEditMode()
  }

  const handleImageClick = () => {
    onOpen()
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showToast(
        "Error",
        "Please select a valid image file (JPEG, PNG, or GIF)",
        "error"
      )
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      showToast(
        "Error",
        "File size must be less than 5MB",
        "error"
      )
      return
    }

    setSelectedImage(file)
    const previewUrl = URL.createObjectURL(file)
    setPreviewUrl(previewUrl)
  }

  const handleUpload = async () => {
    if (!selectedImage) return
    uploadImageMutation.mutate(selectedImage)
  }

  return (
    <Card variant="outline" borderColor={borderColor}>
      <CardBody>
        <Box as="form" onSubmit={handleSubmit(onSubmit)}>
          <Flex direction={{ base: "column", md: "row" }} gap={8} align="center">
            {/* Profile Picture Section */}
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
              cursor="pointer"
              onClick={handleImageClick}
              _hover={{
                "&::after": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "blackAlpha.300",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                },
              }}
            >
              <Skeleton isLoaded={!isLoading}>
                {currentUser?.image ? (
                  <Image
                    src={getImageSrc(currentUser.image)}
                    alt={currentUser?.full_name || "Profile picture"}
                    width="100%"
                    height="100%"
                    objectFit="cover"
                  />
                ) : (
                  <Image
                    src={DEFAULT_USER_IMAGE}
                    alt="Default profile picture"
                    width="100%"
                    height="100%"
                    objectFit="cover"
                  />
                )}
              </Skeleton>
              <IconButton
                aria-label="Change profile picture"
                icon={<FiCamera />}
                position="absolute"
                bottom="2"
                right="2"
                size="sm"
                colorScheme="blue"
                onClick={handleImageClick}
              />
            </Box>

            {/* User Information Section */}
            <VStack spacing={6} align="stretch" flex="1">
              {/* Full Name Section */}
              <Flex align="center" gap={3}>
                <Icon as={FiUser} color="gray.500" boxSize={6} />
                <Box flex="1">
                  <FormControl>
                    <Text fontSize="sm" color="gray.500" mb={1}>
                      Full Name
                    </Text>
                    {editMode ? (
                      <Input
                        {...register("full_name", { maxLength: 30 })}
                        type="text"
                        size="md"
                        variant="filled"
                        placeholder="Enter your full name"
                      />
                    ) : (
                      <Text fontSize="md" fontWeight="medium">
                        {currentUser?.full_name || "N/A"}
                      </Text>
                    )}
                  </FormControl>
                </Box>
              </Flex>

              {/* Email Section */}
              <Flex align="center" gap={3}>
                <Icon as={FiMail} color="gray.500" boxSize={6} />
                <Box flex="1">
                  <FormControl isInvalid={!!errors.email}>
                    <Text fontSize="sm" color="gray.500" mb={1}>
                      Email
                    </Text>
                    {editMode ? (
                      <Input
                        {...register("email", {
                          required: "Email is required",
                          pattern: emailPattern,
                        })}
                        type="email"
                        size="md"
                        variant="filled"
                        placeholder="Enter your email"
                      />
                    ) : (
                      <Text fontSize="md" fontWeight="medium">
                        {currentUser?.email}
                      </Text>
                    )}
                    {errors.email && (
                      <FormErrorMessage>{errors.email.message}</FormErrorMessage>
                    )}
                  </FormControl>
                </Box>
              </Flex>

              {/* Action Buttons */}
              <Flex gap={3}>
                <Button
                  onClick={editMode ? handleSubmit(onSubmit) : toggleEditMode}
                  type="button"
                  isLoading={isSubmitting}
                  isDisabled={editMode ? !isDirty || !getValues("email") : false}
                >
                  {editMode ? "Save" : "Edit"}
                </Button>
                {editMode && (
                  <Button onClick={onCancel} isDisabled={isSubmitting}>
                    Cancel
                  </Button>
                )}
              </Flex>
            </VStack>
          </Flex>
        </Box>

        {/* Image Upload Modal */}
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Update Profile Picture</ModalHeader>
            <ModalBody>
              <VStack spacing={4}>
                <Box
                  width="100%"
                  height="200px"
                  borderRadius="lg"
                  overflow="hidden"
                  bg="gray.100"
                  position="relative"
                >
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt="Preview"
                      width="100%"
                      height="100%"
                      objectFit="cover"
                    />
                  ) : (
                    <Center height="100%">
                      <VStack spacing={2}>
                        <Icon as={FiUpload} boxSize={8} color="gray.400" />
                        <Text color="gray.500">Click to select an image</Text>
                      </VStack>
                    </Center>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    position="absolute"
                    top={0}
                    left={0}
                    width="100%"
                    height="100%"
                    opacity={0}
                    cursor="pointer"
                  />
                </Box>
                <Text fontSize="sm" color="gray.500">
                  Supported formats: JPEG, PNG, GIF (max 5MB)
                </Text>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleUpload}
                isLoading={uploadImageMutation.status === "pending"}
                isDisabled={!selectedImage}
              >
                Upload
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </CardBody>
    </Card>
  )
}

export default UserInformation
