import React, { useCallback, useState } from "react";
import {
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

interface PredictionPanelProps {
  isVisible: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

interface PredictWeekResponse {
  ok: boolean;
  weeks_ahead: number;
  generated_count: number;
  predicted_file: string;
  combined_file: string;
  data: Array<{
    task_name: string;
    type: string;
    start_time: string;
    end_time: string;
    week_offset: number;
  }>;
}

export default function PredictionPanel({
  isVisible,
  isOpen,
  onToggle,
}: PredictionPanelProps) {
  const [weeks, setWeeks] = useState<number>(1);
  const [isPredicting, setIsPredicting] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const handlePredict = useCallback(async () => {
    if (isPredicting) return;

    setIsPredicting(true);
    setLastMessage(null);

    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch("/api/v1/prediction/predict_week", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          weeks_ahead: weeks,
        }),
      });

      const payload: Partial<PredictWeekResponse> & { detail?: string } =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.detail ?? "Error al generar la predicción");
      }

      setLastMessage(
        `Generadas ${payload.generated_count ?? 0} tareas para ${
          payload.weeks_ahead ?? weeks
        } semana(s). Guardado en ${
          payload.combined_file ?? "predicted_database.json"
        }.`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Error al conectar con la API.";
      setLastMessage(message);
    } finally {
      setIsPredicting(false);
    }
  }, [isPredicting, weeks]);

  if (!isVisible) return null;

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
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  textTransform="uppercase"
                  letterSpacing="0.08em"
                  color="rgba(192, 132, 252, 0.95)"
                >
                  Predicción
                </Text>
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
              bg="linear-gradient(135deg, #8B5CF6, #C084FC)"
              boxShadow="0 0 10px rgba(192,132,252,0.45)"
            >
              <Text fontSize="10px" fontWeight="800" color="white">
                AI
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
              _hover={{ opacity: isPredicting ? 1 : 0.9, transform: isPredicting ? "none" : "translateY(-1px)" }}
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
                <span>Predecir</span>
              </span>
            </Button>

            <Text
              mt={3}
              minHeight="1rem"
              fontSize="xs"
              color={
                lastMessage?.toLowerCase().includes("error")
                  ? "red.300"
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