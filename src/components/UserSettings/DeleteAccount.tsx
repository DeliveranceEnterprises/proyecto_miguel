import {
  Button,
  Container,
  Heading,
  Text,
  useDisclosure,
  VStack,
  Box,
  Icon,
  useColorModeValue,
} from "@chakra-ui/react"
import { FiAlertTriangle } from "react-icons/fi"

import DeleteConfirmation from "./DeleteConfirmation"

const DeleteAccount = () => {
  const confirmationModal = useDisclosure()
  const borderColor = useColorModeValue("gray.200", "gray.600")

  return (
    <Container maxW="full" p={0}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="sm" mb={4}>
            Delete Account
          </Heading>
          <Box
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="lg"
            p={6}
            bg={useColorModeValue("red.50", "rgba(229, 62, 62, 0.1)")}
          >
            <Box display="flex" alignItems="center" mb={4}>
              <Icon as={FiAlertTriangle} color="red.500" boxSize={5} mr={2} />
              <Text color="red.500" fontWeight="medium">
                Danger Zone
              </Text>
            </Box>
            <Text mb={4}>
              Once you delete your account, there is no going back. This action is permanent and will:
            </Text>
            <VStack align="stretch" spacing={2} pl={4} mb={4}>
              <Text>• Delete all your personal information</Text>
              <Text>• Remove all your data and settings</Text>
              <Text>• Cancel any active subscriptions</Text>
            </VStack>
            <Button
              variant="danger"
              leftIcon={<FiAlertTriangle />}
              onClick={confirmationModal.onOpen}
              size="lg"
              width={{ base: "full", md: "auto" }}
            >
              Delete Account
            </Button>
          </Box>
        </Box>
      </VStack>
      <DeleteConfirmation
        isOpen={confirmationModal.isOpen}
        onClose={confirmationModal.onClose}
      />
    </Container>
  )
}

export default DeleteAccount
