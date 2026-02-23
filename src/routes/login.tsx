import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import {
  Button,
  Container,
  FormControl,
  FormErrorMessage,
  Icon,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  Link,
  Text,
  useBoolean,
  VStack,
  Box,
  Heading,
  useColorModeValue,
  HStack,
  Divider,
  Flex,
} from "@chakra-ui/react";
import {
  Link as RouterLink,
  createFileRoute,
  redirect,
} from "@tanstack/react-router";
import { type SubmitHandler, useForm } from "react-hook-form";

import Logo from "/assets/images/deliverance-logo.svg";
import type { Body_login_login_access_token as AccessToken } from "../client";
import useAuth, { isLoggedIn } from "../hooks/useAuth";
import { emailPattern } from "../utils";

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      });
    }
  },
});

function Login() {
  const [show, setShow] = useBoolean();
  const { loginMutation, error, resetError } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccessToken>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit: SubmitHandler<AccessToken> = async (data) => {
    if (isSubmitting) return;

    resetError();

    try {
      await loginMutation.mutateAsync(data);
    } catch {
      // error is handled by useAuth hook
    }
  };

  return (
    <Flex
      minH="100vh"
      align="center"
      justify="center"
      bgGradient="linear(to-r, #546B70, #8BA5AB)"
      p={4}
    >
      <Box
        bg={useColorModeValue("white", "gray.800")}
        p={8}
        borderRadius="lg"
        boxShadow="xl"
        w={{ base: "90%", sm: "500px" }}
      >
        <VStack spacing={6} align="center">
          <Image src={Logo} alt="Deliverance Enterprises logo" maxW="350px" />
          <Heading as="h2" size="md" color={useColorModeValue("gray.700", "white")}>
            Sign in
          </Heading>
          <form onSubmit={handleSubmit(onSubmit)} style={{ width: "100%" }}>
            <VStack spacing={4}>
              <FormControl id="username" isInvalid={!!errors.username || !!error}>
                <Input
                  id="username"
                  {...register("username", {
                    required: "Username is required",
                    pattern: emailPattern,
                  })}
                  placeholder="Email"
                  type="email"
                  required
                />
                {errors.username && (
                  <FormErrorMessage>{errors.username.message}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl id="password" isInvalid={!!error}>
                <InputGroup>
                  <Input
                    {...register("password", {
                      required: "Password is required",
                    })}
                    type={show ? "text" : "password"}
                    placeholder="Password"
                    required
                  />
                  <InputRightElement color="gray.500" _hover={{ cursor: "pointer" }}>
                    <Icon
                      as={show ? ViewOffIcon : ViewIcon}
                      onClick={setShow.toggle}
                      aria-label={show ? "Hide password" : "Show password"}
                    />
                  </InputRightElement>
                </InputGroup>
                {error && <FormErrorMessage>{error}</FormErrorMessage>}
              </FormControl>
              <HStack w="full" justify="space-between">
                <Link as={RouterLink} to="/recover-password" color="blue.500">
                  Forgot password?
                </Link>
              </HStack>
              <Button w="full" colorScheme="blue" type="submit" isLoading={isSubmitting}>
                Log In
              </Button>
            </VStack>
          </form>
          <Divider />
          <Text>
            Don't have an account? {" "}
            <Link as={RouterLink} to="/signup" color="blue.500">
              Sign up
            </Link>
          </Text>
        </VStack>
      </Box>
    </Flex>
  );
}

export default Login;