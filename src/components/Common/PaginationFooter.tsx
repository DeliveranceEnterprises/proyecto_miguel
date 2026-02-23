import { Button, Flex, Box, Text, useColorModeValue } from "@chakra-ui/react"

type PaginationFooterProps = {
  hasNextPage?: boolean
  hasPreviousPage?: boolean
  onChangePage: (newPage: number) => void
  page: number
  totalPages?: number
}

export function PaginationFooter({
  hasNextPage,
  hasPreviousPage,
  onChangePage,
  page,
  totalPages = 1,
}: PaginationFooterProps) {
  return (
    <Flex
      gap={4}
      alignItems="center"
      direction="row"
      justifyContent="flex-end"
    >
      <Button
        onClick={() => onChangePage(page - 1)}
        isDisabled={!hasPreviousPage || page <= 1}
        size="sm"
        colorScheme="blue"
        variant="outline"
      >
        Previous
      </Button>
      
      <Box
        bg={useColorModeValue("gray.100", "gray.700")}
        px={3}
        py={1}
        borderRadius="md"
        border="1px solid"
        borderColor={useColorModeValue("gray.200", "gray.600")}
      >
        <Text fontSize="sm" fontWeight="medium" color={useColorModeValue("gray.700", "gray.300")}>
          {page} / {totalPages}
        </Text>
      </Box>
      
      <Button 
        isDisabled={!hasNextPage} 
        onClick={() => onChangePage(page + 1)}
        size="sm"
        colorScheme="blue"
        variant="outline"
      >
        Next
      </Button>
    </Flex>
  )
}
