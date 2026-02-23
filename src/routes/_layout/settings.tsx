import {
  Container,
  Heading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Box,
  useColorModeValue,
} from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import type { UserPublic } from "../../client"
import Appearance from "../../components/UserSettings/Appearance"
import ChangePassword from "../../components/UserSettings/ChangePassword"
import DeleteAccount from "../../components/UserSettings/DeleteAccount"
import UserInformation from "../../components/UserSettings/UserInformation"
import OrganizationInformation from "../../components/UserSettings/OrganizationInformation"

const tabsConfig = [
  { title: "My profile", component: UserInformation },
  { title: "Organization", component: OrganizationInformation },
  { title: "Password", component: ChangePassword },
  { title: "Appearance", component: Appearance },
  { title: "Danger zone", component: DeleteAccount },
]

export const Route = createFileRoute("/_layout/settings")({
  component: UserSettings,
})

function UserSettings() {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const finalTabs = currentUser?.is_superuser
    ? tabsConfig.slice(0, 8)
    : tabsConfig
  const bgColor = useColorModeValue("ui.light", "ui.dark")

  return (
    <Container maxW="full" bg={bgColor} minH="100vh">
      <Box pt={12} px={4}>
        <Heading size="lg" textAlign={{ base: "center", md: "left" }} mb={8}>
          User Settings
        </Heading>
        <Box
          bg={useColorModeValue("white", "gray.800")}
          borderRadius="lg"
          p={6}
          boxShadow="sm"
        >
          <Tabs variant="enclosed">
            <TabList>
              {finalTabs.map((tab, index) => (
                <Tab key={index}>{tab.title}</Tab>
              ))}
            </TabList>
            <TabPanels>
              {finalTabs.map((tab, index) => (
                <TabPanel key={index}>
                  <tab.component />
                </TabPanel>
              ))}
            </TabPanels>
          </Tabs>
        </Box>
      </Box>
    </Container>
  )
}
