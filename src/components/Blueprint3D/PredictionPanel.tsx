import React, { useCallback, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { useNavigate } from "@tanstack/react-router";
import { FiBarChart2, FiCheckCircle } from "react-icons/fi";
import {
  loadLastPredictionResponse,
  predictWeeks,
  type PredictWeekResponse,
} from "../../services/predictionService";

const SITE_NAVIGATION_STATE_KEY = "site:navigation-state";

type PredictionReturnState = {
  selectedScene?: string | null;
  previousSimulationScene?: string | null;
  isRealMode?: boolean;
  openRealPanel?: "robots" | "prediction" | null;
};

interface PredictionPanelProps {
  isVisible: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onPredictionComplete?: (response: PredictWeekResponse) => void;
  returnState?: PredictionReturnState;
}

type PredictionStatus = "idle" | "running" | "success" | "error";

function getInitialPredictionPanelState(): {
  status: PredictionStatus;
  generatedCount: number | null;
  finishedAt: Date | null;
  message: string | null;
} {
  const lastPrediction = loadLastPredictionResponse();

  if (!lastPrediction) {
    return {
      status: "idle",
      generatedCount: null,
      finishedAt: null,
      message: null,
    };
  }

  const generatedCount =
    lastPrediction.generated_count ?? lastPrediction.data?.length ?? 0;
  const savedAt = lastPrediction.saved_at
    ? new Date(lastPrediction.saved_at)
    : null;
  const finishedAt = savedAt && !Number.isNaN(savedAt.getTime()) ? savedAt : null;

  return {
    status: "success",
    generatedCount,
    finishedAt,
    message: `Última predicción disponible. Se generaron ${generatedCount} tarea(s).`,
  };
}

function formatFinishedAt(value: Date | null): string {
  if (!value) return "";

  return value.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function PredictionPanel({
  isVisible,
  isOpen,
  onToggle,
  onPredictionComplete,
  returnState,
}: PredictionPanelProps) {
  const navigate = useNavigate();
  const [initialPredictionPanelState] = useState(getInitialPredictionPanelState);
  const [weeks, setWeeks] = useState<number>(1);
  const [isPredicting, setIsPredicting] = useState(false);

 const [lastMessage, setLastMessage] = useState<string | null>(
    initialPredictionPanelState.message
  );
  const [predictionStatus, setPredictionStatus] = useState<PredictionStatus>(
   initialPredictionPanelState.status
  );
  const [lastGeneratedCount, setLastGeneratedCount] = useState<number | null>(
    initialPredictionPanelState.generatedCount
  );
  const [lastFinishedAt, setLastFinishedAt] = useState<Date | null>(
    initialPredictionPanelState.finishedAt
  );

  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const handlePredict = useCallback(async () => {
    if (isPredicting) return;

    setIsPredicting(true);
    setPredictionStatus("running");
    setLastMessage("Generando predicción...");
    setLastGeneratedCount(null);
    setLastFinishedAt(null);

    try {
      const payload = await predictWeeks(weeks, "file");
      const generatedCount = payload.generated_count ?? payload.data?.length ?? 0;
      const finishedAt = new Date();

      setPredictionStatus("success");
      setLastGeneratedCount(generatedCount);
      setLastFinishedAt(finishedAt);
      setLastMessage(
        `Predicción completada. Se han generado ${generatedCount} tarea(s) para ${
          payload.weeks_ahead ?? weeks
        } semana(s).`
      );

      onPredictionComplete?.(payload);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Error al conectar con la API.";

      setPredictionStatus("error");
      setLastMessage(message);
    } finally {
      setIsPredicting(false);
    }
  }, [isPredicting, weeks, onPredictionComplete]);

  const handleViewPredictions = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      try {
        sessionStorage.setItem(
          "predictions:return-path",
          `${window.location.pathname}${window.location.search}${window.location.hash}`
        );
        sessionStorage.setItem("predictions:opened-from-app", "true");
        sessionStorage.setItem(
          SITE_NAVIGATION_STATE_KEY,
          JSON.stringify({
            selectedScene: returnState?.selectedScene ?? null,
            previousSimulationScene: returnState?.previousSimulationScene ?? null,
            isRealMode: returnState?.isRealMode ?? false,
            openRealPanel: returnState?.openRealPanel ?? null,
          })
        );
      } catch (storageError) {
        console.warn("Could not store the predictions return path:", storageError);
      }

      void navigate({ to: "/predictions" });
    },
    [navigate, returnState]
  );

  if (!isVisible) return null;

  const hasCompletedPrediction = predictionStatus === "success";

  return (
    <div
      style={{
        width: isOpen ? 280 : 48,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s ease",
        pointerEvents: "auto",
      }}
      onMouseDown={stopPropagation}
      onMouseUp={stopPropagation}
      onClick={stopPropagation}
    >
      <div
        style={{
          background: "rgba(10,18,35,0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(167, 139, 250, 0.18)",
          borderRadius: isOpen ? "12px 12px 0 0" : 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        <Flex
          align="center"
          justify={isOpen ? "space-between" : "center"}
          px={isOpen ? 4 : 2}
          py={3}
          cursor="pointer"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isOpen ? (
            <>
              <Box>
                <Flex align="center" gap={2}>
                  <Text
                    fontSize="xs"
                    fontWeight="700"
                    textTransform="uppercase"
                    letterSpacing="0.08em"
                    color="rgba(192, 132, 252, 0.95)"
                  >
                    Predicción
                  </Text>
                  {hasCompletedPrediction && (
                    <Badge colorScheme="green" variant="subtle" fontSize="9px">
                      Hecho
                    </Badge>
                  )}
                </Flex>
                <Text fontSize="11px" color="rgba(148,163,184,0.8)" mt={1}>
                  Generar próximas semanas desde la API
                </Text>
              </Box>

              <Text fontSize="lg" color="whiteAlpha.900" userSelect="none">
                －
              </Text>
            </>
          ) : (
            <Box
              width="28px"
              height="28px"
              borderRadius="8px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg={
                hasCompletedPrediction
                  ? "linear-gradient(135deg, #16A34A, #86EFAC)"
                  : "linear-gradient(135deg, #8B5CF6, #C084FC)"
              }
              boxShadow="0 0 10px rgba(192,132,252,0.45)"
            >
              <Text fontSize="10px" fontWeight="800" color="white">
                {hasCompletedPrediction ? "OK" : "AI"}
              </Text>
            </Box>
          )}
        </Flex>

        {isOpen && (
          <div
            style={{
              background: "rgba(10,18,35,0.8)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderTop: "1px solid rgba(167, 139, 250, 0.12)",
              padding: 14,
            }}
            onMouseDown={stopPropagation}
            onMouseUp={stopPropagation}
            onClick={stopPropagation}
          >
            <Box mb={3}>
              <label
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "rgba(148,163,184,0.7)",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Número de semanas
              </label>

              <NumberInput
                size="sm"
                min={1}
                max={52}
                value={weeks}
                onChange={(_valueAsString: string, valueAsNumber: number) =>
                  setWeeks(
                    Number.isNaN(valueAsNumber)
                      ? 1
                      : Math.min(52, Math.max(1, valueAsNumber))
                  )
                }
                bg="rgba(255,255,255,0.05)"
                color="white"
                borderColor="rgba(255,255,255,0.1)"
                borderRadius="md"
              >
                <NumberInputField
                  _hover={{ borderColor: "rgba(167, 139, 250, 0.5)" }}
                  _focus={{
                    borderColor: "#8B5CF6",
                    boxShadow: "0 0 0 1px #8B5CF6",
                  }}
                />
                <NumberInputStepper borderColor="rgba(255,255,255,0.1)">
                  <NumberIncrementStepper
                    color="white"
                    _active={{ bg: "rgba(255,255,255,0.1)" }}
                  />
                  <NumberDecrementStepper
                    color="white"
                    _active={{ bg: "rgba(255,255,255,0.1)" }}
                  />
                </NumberInputStepper>
              </NumberInput>
            </Box>

            <Button
              size="sm"
              width="full"
              bg="linear-gradient(135deg, #8B5CF6, #C084FC)"
              color="white"
              _hover={{
                opacity: isPredicting ? 1 : 0.9,
                transform: isPredicting ? "none" : "translateY(-1px)",
              }}
              _active={{ transform: "none" }}
              onClick={(e) => {
                e.stopPropagation();
                void handlePredict();
              }}
              isDisabled={isPredicting}
              translate="no"
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  minHeight: 20,
                }}
              >
                <Spinner
                  size="sm"
                  speed="0.65s"
                  emptyColor="whiteAlpha.300"
                  color="white"
                  style={{
                    opacity: isPredicting ? 1 : 0,
                    transition: "opacity 0.2s ease",
                  }}
                />
                <span>{hasCompletedPrediction ? "Volver a predecir" : "Predecir"}</span>
              </span>
            </Button>

            {hasCompletedPrediction && (
              <Box
                mt={3}
                p={3}
                borderRadius="10px"
                bg="rgba(22, 163, 74, 0.13)"
                border="1px solid rgba(134, 239, 172, 0.25)"
              >
                <Flex align="center" gap={2} color="green.200" mb={1}>
                  <FiCheckCircle />
                  <Text fontSize="xs" fontWeight="700">
                    Predicción terminada
                  </Text>
                </Flex>

                <Text fontSize="11px" color="whiteAlpha.800" mb={3}>
                  {lastGeneratedCount ?? 0} tarea(s) generadas
                  {lastFinishedAt ? ` · ${formatFinishedAt(lastFinishedAt)}` : ""}
                </Text>

                <Button
                  size="sm"
                  width="full"
                  variant="outline"
                  color="white"
                  borderColor="rgba(134, 239, 172, 0.45)"
                  leftIcon={<FiBarChart2 />}
                  _hover={{ bg: "rgba(134, 239, 172, 0.12)" }}
                  onClick={handleViewPredictions}
                >
                  Ver predicciones
                </Button>
              </Box>
            )}

            <Text
              mt={3}
              minHeight="1rem"
              fontSize="xs"
              color={
                predictionStatus === "error"
                  ? "red.300"
                  : predictionStatus === "success"
                    ? "green.200"
                    : "whiteAlpha.800"
              }
            >
              {lastMessage ?? ""}
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}
