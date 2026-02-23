import {
  Badge,
  Box,
  Container,
  Heading,
  Radio,
  RadioGroup,
  Stack,
  useColorMode,
  VStack,
  Icon,
  useColorModeValue,
  Text,
} from "@chakra-ui/react"
import { FiSun, FiMoon } from "react-icons/fi"

const Appearance = () => {
  const { colorMode, toggleColorMode } = useColorMode()
  const borderColor = useColorModeValue("gray.200", "gray.600")

  return (
    <Container maxW="full" p={0}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="sm" mb={4}>
            Appearance
          </Heading>
          <Box
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="lg"
            p={6}
          >
            <Text mb={4} color="gray.500">
              Choose how Deliverance Dashboard looks to you. Select a theme preference below.
            </Text>
            <RadioGroup onChange={toggleColorMode} value={colorMode}>
              <Stack spacing={4}>
                <Radio
                  value="light"
                  colorScheme="teal"
                  size="lg"
                  display="flex"
                  alignItems="center"
                >
                  <Box display="flex" alignItems="center">
                    <Icon as={FiSun} mr={3} />
                    <Box>
                      <Text fontWeight="medium">Light Mode</Text>
                      <Text fontSize="sm" color="gray.500">
                        Classic light theme
                      </Text>
                    </Box>
                    {colorMode === "light" && (
                      <Badge ml={3} colorScheme="teal">
                        Active
                      </Badge>
                    )}
                  </Box>
                </Radio>
                <Radio
                  value="dark"
                  colorScheme="teal"
                  size="lg"
                  display="flex"
                  alignItems="center"
                >
                  <Box display="flex" alignItems="center">
                    <Icon as={FiMoon} mr={3} />
                    <Box>
                      <Text fontWeight="medium">Dark Mode</Text>
                      <Text fontSize="sm" color="gray.500">
                        Easier on the eyes
                      </Text>
                    </Box>
                    {colorMode === "dark" && (
                      <Badge ml={3} colorScheme="teal">
                        Active
                      </Badge>
                    )}
                  </Box>
                </Radio>
              </Stack>
            </RadioGroup>
          </Box>
        </Box>
      </VStack>
    </Container>
  )
}

export default Appearance
