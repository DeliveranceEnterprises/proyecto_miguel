import React, { useState } from 'react'
import {
  Box,
  Card,
  CardBody,
  Text,
  useColorModeValue,
  VStack,
  Icon,
  Flex,
  Tooltip,
  Button,
  Skeleton,
  Image,
  Center,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Input,
} from "@chakra-ui/react"
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query"
import { FiCopy, FiCamera, FiUpload } from "react-icons/fi"
import { HiOutlineBuildingOffice2 } from "react-icons/hi2"
import { MdLocationOn, MdDescription } from "react-icons/md"
import type { UserPublic, ApiError } from "../../client"
import { OrganizationsService } from "../../client"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError } from "../../utils"

const DEFAULT_ORG_IMAGE = "/assets/images/organizations/profile.png"
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const getImageSrc = (image: string | null | undefined): string => {
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

const OrganizationInformation = () => {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const showToast = useCustomToast()
  const borderColor = useColorModeValue("gray.200", "gray.600")
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const { data: organization, isLoading } = useQuery({
    queryKey: ["organization", currentUser?.organization_id],
    queryFn: () => 
      currentUser?.organization_id 
        ? OrganizationsService.readOrganization({ id: currentUser.organization_id })
        : null,
    enabled: !!currentUser?.organization_id,
  })

  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => {
      if (!currentUser?.organization_id) throw new Error("No organization ID")
      const formData = new FormData()
      formData.append("file", file)
      return OrganizationsService.uploadOrganizationImage({
        id: currentUser.organization_id,
        formData: { file }
      })
    },
    onSuccess: () => {
      showToast("Success!", "Organization logo updated successfully.", "success")
      queryClient.invalidateQueries({ queryKey: ["organization", currentUser?.organization_id] })
      onClose()
      setSelectedImage(null)
      setPreviewUrl(null)
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
  })

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

  const handleCopyOrgId = () => {
    if (currentUser?.organization_id) {
      navigator.clipboard.writeText(currentUser.organization_id)
      showToast("Success", "Organization ID copied to clipboard", "success")
    }
  }

  if (!currentUser?.organization_id) {
    return (
      <Card variant="outline" borderColor={borderColor}>
        <CardBody>
          <Text color="gray.500">No organization assigned</Text>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card variant="outline" borderColor={borderColor}>
      <CardBody>
        <Flex gap={6} alignItems="center">
          {/* Organization Logo Section */}
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
              <Image
                src={getImageSrc(organization?.image)}
                alt={organization?.name || "Organization logo"}
                width="100%"
                height="100%"
                objectFit="cover"
              />
            </Skeleton>
            <IconButton
              aria-label="Change organization logo"
              icon={<FiCamera />}
              position="absolute"
              bottom="2"
              right="2"
              size="sm"
              colorScheme="blue"
              onClick={handleImageClick}
            />
          </Box>

          {/* Organization Information Section */}
          <VStack spacing={6} align="stretch" flex={1}>
            {/* Organization ID Section */}
            <Flex align="center" gap={3}>
              <Icon as={HiOutlineBuildingOffice2} color="gray.500" boxSize={6} />
              <Box flex="1">
                <Text fontSize="sm" color="gray.500">
                  Organization ID
                </Text>
                <Flex align="center" gap={2}>
                  <Text fontSize="md" fontWeight="medium">
                    {currentUser.organization_id}
                  </Text>
                  <Tooltip label="Copy Organization ID" hasArrow>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyOrgId}
                      leftIcon={<Icon as={FiCopy} />}
                    >
                      Copy
                    </Button>
                  </Tooltip>
                </Flex>
              </Box>
            </Flex>

            {/* Organization Name Section */}
            <Flex align="center" gap={3}>
              <Icon as={HiOutlineBuildingOffice2} color="gray.500" boxSize={6} />
              <Box flex="1">
                <Text fontSize="sm" color="gray.500">
                  Organization Name
                </Text>
                <Skeleton isLoaded={!isLoading}>
                  <Text fontSize="md" fontWeight="medium">
                    {organization?.name || "Loading..."}
                  </Text>
                </Skeleton>
              </Box>
            </Flex>

            {/* Description Section */}
            {organization?.description && (
              <Flex align="center" gap={3}>
                <Icon as={MdDescription} color="gray.500" boxSize={6} />
                <Box flex="1">
                  <Text fontSize="sm" color="gray.500">
                    Description
                  </Text>
                  <Skeleton isLoaded={!isLoading}>
                    <Text fontSize="md">
                      {organization.description}
                    </Text>
                  </Skeleton>
                </Box>
              </Flex>
            )}

            {/* Address Section */}
            {organization?.address && (
              <Flex align="center" gap={3}>
                <Icon as={MdLocationOn} color="gray.500" boxSize={6} />
                <Box flex="1">
                  <Text fontSize="sm" color="gray.500">
                    Address
                  </Text>
                  <Skeleton isLoaded={!isLoading}>
                    <Text fontSize="md">
                      {organization.address}
                    </Text>
                  </Skeleton>
                </Box>
              </Flex>
            )}
          </VStack>
        </Flex>

        {/* Image Upload Modal */}
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Update Organization Logo</ModalHeader>
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

export default OrganizationInformation 