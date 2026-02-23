import { Box, Container, Text, useColorModeValue } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import useAuth from "../../hooks/useAuth"
import { useOrganizationContext } from "../../hooks/useOrganizationContext"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
})

function Dashboard() {
  const { user: currentUser } = useAuth()
  const { activeOrganizationContext } = useOrganizationContext()
  const bgColor = useColorModeValue("ui.light", "ui.dark")
  
  return (
    <>
      <Container bg={bgColor} maxW="full">
        {!activeOrganizationContext && (
          <Box
            bg={useColorModeValue("yellow.50", "yellow.900")}
            border="1px solid"
            borderColor={useColorModeValue("yellow.200", "yellow.700")}
            borderRadius="md"
            p={3}
            m={4}
          >
            <Text fontSize="sm" color={useColorModeValue("yellow.700", "yellow.200")} fontWeight="medium">
              ⚠️ Please select an organization from the sidebar to view dashboard data
            </Text>
          </Box>
        )}

        {/* Centered Welcome Text Box */}
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          textAlign="center"
          border="2px solid"
          borderColor={useColorModeValue("gray.300", "gray.600")}
          borderRadius="lg"
          p={8}
          m={4}
          minH="300px"
          w="auto"
        >
          <Text fontSize="3xl" fontWeight="bold" mb={4}>
            Hi, {currentUser?.full_name || currentUser?.email}
          </Text>
          <Text fontSize="lg" color="gray.500" mb={4}>
            Welcome back, nice to see you again!
          </Text>
          {activeOrganizationContext && (
            <Text fontSize="xl" color="ui.secondary" mt={2} fontWeight="medium">
              Viewing: {activeOrganizationContext.name}
            </Text>
          )}
          {!activeOrganizationContext && (
            <Text fontSize="md" color="gray.400" mt={1}>
              Please select an organization to view dashboard data
            </Text>
          )}
        </Box>

        {/* Organization Context Note */}
        {activeOrganizationContext && (
          <Box
            bg={useColorModeValue("gray.50", "gray.700")}
            border="1px solid"
            borderColor={useColorModeValue("gray.200", "gray.600")}
            borderRadius="md"
            p={3}
            m={4}
          >
            <Text fontSize="sm" color={useColorModeValue("gray.600", "gray.300")}>
              📊 Welcome to the dashboard for organization: <strong>{activeOrganizationContext.name}</strong>
            </Text>
            <Text fontSize="xs" color={useColorModeValue("gray.500", "gray.400")} mt={1}>
              Use the navigation menu to access admin, settings, and other features.
            </Text>
          </Box>
        )}
      </Container>
    </>
  )
}
