import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Container,
  Flex,
  Grid,
  Heading,
  Select,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from "@chakra-ui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  FiArrowLeft,
  FiCalendar,
  FiClock,
  FiRefreshCw,
  FiTrendingUp,
} from "react-icons/fi";
import { DevicesService, type DevicePublic } from "../../client";
import { useOrganizationContext } from "../../hooks/useOrganizationContext";
import {
  getPredictedTasks,
  loadLastPredictionResponse,
  type PredictedTaskRecord,
} from "../../services/predictionService";

export const Route = createFileRoute("/_layout/predictions")({
  component: PredictionsPage,
});

type NormalizedPredictionTask = {
  id: string;
  robotUid: string;
  robotName: string;
  taskType: string;
  taskName: string;
  status: string;
  startMs: number;
  endMs: number;
  durationMinutes: number;
  startTime: string;
  endTime: string | null;
  dayKey: string;
  dayLabel: string;
  hour: number;
  mileage: number;
  weekOffset: number | null;
  waypointCount: number;
  raw: PredictedTaskRecord;
};

type ChartItem = {
  label: string;
  value: number;
  hint?: string;
};

const UNKNOWN_ROBOT = "__unknown_robot__";
const ALL_VALUE = "__all__";
const FALLBACK_DURATION_MS = 30 * 60 * 1000;
const STEP_MS = 5 * 60 * 1000;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function getLocalDayKey(value: number): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getLocalDayStart(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getLocalDayEnd(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date.getTime();
}

function formatDateTime(value: number): string {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: number): string {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(value: number): string {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function countBy<T>(items: T[], getKey: (item: T) => string): ChartItem[] {
  const map = new Map<string, number>();

  items.forEach((item) => {
    const key = getKey(item) || "Sin dato";
    map.set(key, (map.get(key) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function sumBy<T>(items: T[], getValue: (item: T) => number): number {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function normalizeTasks(
  tasks: PredictedTaskRecord[],
  deviceNameByUid: Map<string, string>
): NormalizedPredictionTask[] {
  return tasks
    .map((task, index) => {
      const startMs = new Date(task.start_time).getTime();
      const parsedEndMs = task.end_time ? new Date(task.end_time).getTime() : NaN;

      if (!Number.isFinite(startMs)) {
        return null;
      }

      const endMs =
        Number.isFinite(parsedEndMs) && parsedEndMs > startMs
          ? parsedEndMs
          : startMs + FALLBACK_DURATION_MS;
      const robotUid = task.device_uid || UNKNOWN_ROBOT;
      const taskType = task.type || "Task";
      const dayKey = getLocalDayKey(startMs);
      const date = new Date(startMs);

      return {
        id:
          task.uid ||
          `${robotUid}-${taskType}-${task.start_time}-${task.end_time ?? "no-end"}-${index}`,
        robotUid,
        robotName:
          deviceNameByUid.get(robotUid) ||
          (robotUid === UNKNOWN_ROBOT ? "Sin robot" : robotUid.slice(0, 8)),
        taskType,
        taskName: task.task_name || taskType,
        status: task.status || "Scheduled",
        startMs,
        endMs,
        durationMinutes: Math.max(1, Math.round((endMs - startMs) / 60000)),
        startTime: task.start_time,
        endTime: task.end_time,
        dayKey,
        dayLabel: formatShortDate(startMs),
        hour: date.getHours(),
        mileage: Number(task.mileage ?? 0),
        weekOffset: typeof task.week_offset === "number" ? task.week_offset : null,
        waypointCount: Array.isArray(task.waypoints) ? task.waypoints.length : 0,
        raw: task,
      };
    })
    .filter((task): task is NormalizedPredictionTask => task !== null)
    .sort((a, b) => a.startMs - b.startMs);
}

function buildBounds(tasks: NormalizedPredictionTask[]) {
  if (tasks.length === 0) return null;

  const min = Math.min(...tasks.map((task) => task.startMs));
  const max = Math.max(...tasks.map((task) => task.endMs));

  return {
    min,
    max: max > min ? max : min + 60 * 60 * 1000,
  };
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card borderRadius="xl" boxShadow="sm">
      <CardBody>
        <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="700">
          {label}
        </Text>
        <Text fontSize="2xl" fontWeight="800" mt={1}>
          {value}
        </Text>
        {hint && (
          <Text fontSize="sm" color="gray.500" mt={1}>
            {hint}
          </Text>
        )}
      </CardBody>
    </Card>
  );
}

function HorizontalBarChart({
  title,
  data,
  emptyText = "Sin datos suficientes",
}: {
  title: string;
  data: ChartItem[];
  emptyText?: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 0);

  return (
    <Card borderRadius="xl" boxShadow="sm" height="100%">
      <CardBody>
        <Flex align="center" gap={2} mb={4}>
          <FiTrendingUp />
          <Heading size="sm">{title}</Heading>
        </Flex>

        {data.length === 0 || max === 0 ? (
          <Text fontSize="sm" color="gray.500">
            {emptyText}
          </Text>
        ) : (
          <Flex direction="column" gap={3}>
            {data.slice(0, 10).map((item) => {
              const width = `${Math.max(4, (item.value / max) * 100)}%`;

              return (
                <Box key={item.label}>
                  <Flex justify="space-between" gap={3} mb={1}>
                    <Text fontSize="sm" fontWeight="600" noOfLines={1}>
                      {item.label}
                    </Text>
                    <Text fontSize="sm" color="gray.500" flexShrink={0}>
                      {item.value}
                    </Text>
                  </Flex>
                  <Box h="10px" bg="gray.100" borderRadius="full" overflow="hidden">
                    <Box
                      h="100%"
                      width={width}
                      bg="purple.400"
                      borderRadius="full"
                    />
                  </Box>
                  {item.hint && (
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      {item.hint}
                    </Text>
                  )}
                </Box>
              );
            })}
          </Flex>
        )}
      </CardBody>
    </Card>
  );
}

function buildSmoothSvgPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const path = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const previous = points[i - 1] ?? current;
    const afterNext = points[i + 2] ?? next;

    const cp1x = current.x + (next.x - previous.x) / 6;
    const cp1y = current.y + (next.y - previous.y) / 6;
    const cp2x = next.x - (afterNext.x - current.x) / 6;
    const cp2y = next.y - (afterNext.y - current.y) / 6;

    path.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`);
  }

  return path.join(" ");
}

function DailyTaskLineChart({
  title,
  data,
}: {
  title: string;
  data: ChartItem[];
}) {
  const width = 920;
  const height = 300;
  const paddingLeft = 56;
  const paddingRight = 28;
  const paddingTop = 34;
  const paddingBottom = 58;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...data.map((item) => item.value), 0);
  const yMax = Math.max(maxValue, 1);
  const gridLines = 4;

  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? paddingLeft + chartWidth / 2
        : paddingLeft + (index / (data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (item.value / yMax) * chartHeight;

    return {
      x,
      y,
      label: item.label,
      value: item.value,
    };
  });

  const linePath = buildSmoothSvgPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
      : "";

  return (
    <Card borderRadius="xl" boxShadow="sm">
      <CardBody>
        <Flex justify="space-between" align="start" gap={4} wrap="wrap" mb={4}>
          <Box>
            <Flex align="center" gap={2}>
              <FiTrendingUp />
              <Heading size="sm">{title}</Heading>
            </Flex>
            <Text fontSize="sm" color="gray.500" mt={1}>
              Curva diaria basada en el número de tareas predichas por día. Se actualiza con los filtros activos.
            </Text>
          </Box>
          <Badge colorScheme="purple" px={3} py={1} borderRadius="full">
            Máximo: {maxValue} tarea(s)
          </Badge>
        </Flex>

        {data.length === 0 ? (
          <Text fontSize="sm" color="gray.500">
            No hay datos para construir la curva diaria.
          </Text>
        ) : (
          <Box overflowX="auto">
            <Box minW="760px">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label={title}
                style={{ width: "100%", height: "auto", display: "block" }}
              >
                {Array.from({ length: gridLines + 1 }, (_, index) => {
                  const ratio = index / gridLines;
                  const y = paddingTop + ratio * chartHeight;
                  const value = Math.round(yMax - ratio * yMax);

                  return (
                    <g key={`grid-${index}`}>
                      <line
                        x1={paddingLeft}
                        x2={paddingLeft + chartWidth}
                        y1={y}
                        y2={y}
                        stroke="#E2E8F0"
                        strokeWidth="1"
                      />
                      <text
                        x={paddingLeft - 14}
                        y={y + 4}
                        textAnchor="end"
                        fontSize="11"
                        fill="#718096"
                      >
                        {value}
                      </text>
                    </g>
                  );
                })}

                <line
                  x1={paddingLeft}
                  x2={paddingLeft + chartWidth}
                  y1={paddingTop + chartHeight}
                  y2={paddingTop + chartHeight}
                  stroke="#CBD5E0"
                  strokeWidth="1.5"
                />

                {areaPath && (
                  <path
                    d={areaPath}
                    fill="rgba(124, 58, 237, 0.12)"
                    stroke="none"
                  />
                )}

                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#7C3AED"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {points.map((point, index) => (
                  <g key={`${point.label}-${index}`}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill="#FFFFFF"
                      stroke="#7C3AED"
                      strokeWidth="3"
                    >
                      <title>{`${point.label}: ${point.value} tarea(s)`}</title>
                    </circle>
                    <text
                      x={point.x}
                      y={point.y - 12}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="700"
                      fill="#44337A"
                    >
                      {point.value}
                    </text>
                    <text
                      x={point.x}
                      y={paddingTop + chartHeight + 24}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#4A5568"
                    >
                      {point.label}
                    </text>
                  </g>
                ))}
              </svg>
            </Box>
          </Box>
        )}
      </CardBody>
    </Card>
  );
}

function HourlyChart({ tasks }: { tasks: NormalizedPredictionTask[] }) {
  const hourlyData = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, hour) => ({
      label: `${pad2(hour)}:00`,
      value: 0,
    }));

    tasks.forEach((task) => {
      counts[task.hour].value += 1;
    });

    return counts;
  }, [tasks]);

  const max = Math.max(...hourlyData.map((item) => item.value), 1);

  return (
    <Card borderRadius="xl" boxShadow="sm">
      <CardBody>
        <Flex align="center" gap={2} mb={4}>
          <FiClock />
          <Heading size="sm">Distribución por hora de inicio</Heading>
        </Flex>

        <Flex align="end" gap={1} height="160px" overflowX="auto" pb={2}>
          {hourlyData.map((item) => {
            const height = `${Math.max(2, (item.value / max) * 100)}%`;

            return (
              <Flex
                key={item.label}
                direction="column"
                align="center"
                justify="end"
                minW="30px"
                height="100%"
                gap={1}
              >
                <Text fontSize="10px" color="gray.500">
                  {item.value || ""}
                </Text>
                <Box
                  width="18px"
                  height={height}
                  bg={item.value > 0 ? "purple.400" : "gray.200"}
                  borderRadius="6px 6px 0 0"
                />
                <Text fontSize="9px" color="gray.500" transform="rotate(-45deg)" mt={2}>
                  {item.label.replace(":00", "")}
                </Text>
              </Flex>
            );
          })}
        </Flex>
      </CardBody>
    </Card>
  );
}

function MomentExplorer({ tasks }: { tasks: NormalizedPredictionTask[] }) {
  const bounds = useMemo(() => buildBounds(tasks), [tasks]);
  const [cursorMs, setCursorMs] = useState<number | null>(null);

  useEffect(() => {
    if (!bounds) {
      setCursorMs(null);
      return;
    }

    setCursorMs((current) => {
      if (current !== null && current >= bounds.min && current <= bounds.max) {
        return current;
      }

      return bounds.min;
    });
  }, [bounds]);

  const activeTasks = useMemo(() => {
    if (cursorMs === null) return [];

    return tasks.filter((task) => task.startMs <= cursorMs && cursorMs < task.endMs);
  }, [tasks, cursorMs]);

  if (!bounds || cursorMs === null) {
    return (
      <Card borderRadius="xl" boxShadow="sm">
        <CardBody>
          <Heading size="sm" mb={2}>
            Explorador temporal
          </Heading>
          <Text fontSize="sm" color="gray.500">
            No hay tareas para explorar con los filtros actuales.
          </Text>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card borderRadius="xl" boxShadow="sm">
      <CardBody>
        <Flex justify="space-between" align="start" gap={4} mb={4} wrap="wrap">
          <Box>
            <Heading size="sm">Explorador temporal</Heading>
            <Text fontSize="sm" color="gray.500" mt={1}>
              Mueve el cursor para ver qué tareas están activas en cada instante.
            </Text>
          </Box>
          <Badge colorScheme="purple" px={3} py={1} borderRadius="full">
            {formatDateTime(cursorMs)}
          </Badge>
        </Flex>

        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={STEP_MS}
          value={cursorMs}
          onChange={(event) => setCursorMs(Number(event.target.value))}
          style={{ width: "100%" }}
        />

        <Flex justify="space-between" fontSize="xs" color="gray.500" mt={1}>
          <span>{formatDateTime(bounds.min)}</span>
          <span>{formatDateTime(bounds.max)}</span>
        </Flex>

        <Box mt={4}>
          <Text fontSize="sm" fontWeight="700" mb={2}>
            Tareas activas en este instante
          </Text>

          {activeTasks.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              No hay tareas activas en el instante seleccionado.
            </Text>
          ) : (
            <Flex gap={2} wrap="wrap">
              {activeTasks.map((task) => (
                <Box
                  key={task.id}
                  borderWidth="1px"
                  borderRadius="lg"
                  px={3}
                  py={2}
                  bg="purple.50"
                  borderColor="purple.100"
                >
                  <Flex align="center" gap={2} mb={1}>
                    <Badge colorScheme="purple">{task.taskType}</Badge>
                    <Text fontSize="sm" fontWeight="700">
                      {task.robotName}
                    </Text>
                  </Flex>
                  <Text fontSize="xs" color="gray.600">
                    {formatTime(task.startMs)} - {formatTime(task.endMs)} · {formatDuration(task.durationMinutes)}
                  </Text>
                </Box>
              ))}
            </Flex>
          )}
        </Box>
      </CardBody>
    </Card>
  );
}

function WeekTimeline({ tasks }: { tasks: NormalizedPredictionTask[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, NormalizedPredictionTask[]>();

    tasks.forEach((task) => {
      const current = map.get(task.dayKey) ?? [];
      current.push(task);
      map.set(task.dayKey, current);
    });

    return Array.from(map.entries())
      .map(([dayKey, dayTasks]) => ({
        dayKey,
        label: formatDate(dayTasks[0].startMs),
        startMs: getLocalDayStart(dayTasks[0].startMs),
        endMs: getLocalDayEnd(dayTasks[0].startMs),
        tasks: dayTasks.sort((a, b) => a.startMs - b.startMs),
      }))
      .sort((a, b) => a.startMs - b.startMs);
  }, [tasks]);

  if (groups.length === 0) {
    return (
      <Card borderRadius="xl" boxShadow="sm">
        <CardBody>
          <Heading size="sm" mb={2}>
            Línea de tiempo semanal
          </Heading>
          <Text fontSize="sm" color="gray.500">
            No hay tareas para mostrar.
          </Text>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card borderRadius="xl" boxShadow="sm">
      <CardBody>
        <Flex align="center" gap={2} mb={4}>
          <FiCalendar />
          <Heading size="sm">Línea de tiempo semanal</Heading>
        </Flex>

        <Flex direction="column" gap={5}>
          {groups.map((group) => (
            <Box key={group.dayKey}>
              <Flex justify="space-between" align="center" mb={2}>
                <Text fontWeight="800">{group.label}</Text>
                <Badge>{group.tasks.length} tarea(s)</Badge>
              </Flex>

              <Box
                borderWidth="1px"
                borderRadius="lg"
                bg="gray.50"
                overflow="hidden"
                minW="760px"
              >
                <Flex px={3} py={2} color="gray.500" fontSize="10px" borderBottomWidth="1px">
                  {[0, 4, 8, 12, 16, 20, 24].map((hour) => (
                    <Box key={hour} flex="1">
                      {pad2(hour)}:00
                    </Box>
                  ))}
                </Flex>

                <Box position="relative" minHeight={`${Math.max(46, group.tasks.length * 36)}px`}>
                  {group.tasks.map((task, index) => {
                    const dayLength = group.endMs - group.startMs;
                    const left = ((task.startMs - group.startMs) / dayLength) * 100;
                    const width = Math.max(((task.endMs - task.startMs) / dayLength) * 100, 1.2);

                    return (
                      <Box
                        key={task.id}
                        position="absolute"
                        top={`${8 + index * 34}px`}
                        left={`${left}%`}
                        width={`${width}%`}
                        minW="90px"
                        maxW="280px"
                        px={2}
                        py={1}
                        borderRadius="md"
                        bg="purple.400"
                        color="white"
                        title={`${task.robotName} · ${task.taskType} · ${formatDateTime(task.startMs)} · ${formatDuration(task.durationMinutes)}`}
                      >
                        <Text fontSize="11px" fontWeight="800" noOfLines={1}>
                          {task.taskType}
                        </Text>
                        <Text fontSize="10px" noOfLines={1} opacity={0.9}>
                          {formatTime(task.startMs)} · {task.robotName}
                        </Text>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          ))}
        </Flex>
      </CardBody>
    </Card>
  );
}

function getSafeReturnPath(value: string | null): string {
  if (!value || typeof window === "undefined") return "/site";

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "/site";

    return `${url.pathname}${url.search}${url.hash}` || "/site";
  } catch {
    return "/site";
  }
}

function navigateToPath(
  navigate: ReturnType<typeof useNavigate>,
  path: string
) {
  const url = new URL(path, window.location.origin);
  const search = Object.fromEntries(url.searchParams.entries());

  void navigate({
    to: url.pathname as any,
    search: Object.keys(search).length > 0 ? (search as any) : undefined,
    hash: url.hash ? url.hash.slice(1) : undefined,
    replace: true,
  } as any);
}

function PredictionsPage() {
  const navigate = useNavigate();

  const handleBackToPreviousPage = useCallback(() => {
    let returnPath: string | null = null;

    try {
      returnPath = sessionStorage.getItem("predictions:return-path");
      sessionStorage.removeItem("predictions:return-path");
      sessionStorage.removeItem("predictions:opened-from-app");
    } catch (storageError) {
      console.warn("Could not read the predictions return path:", storageError);
    }

    navigateToPath(navigate, getSafeReturnPath(returnPath));
  }, [navigate]);
  const bgColor = useColorModeValue("ui.light", "gray.50");
  const cardBg = useColorModeValue("white", "gray.800");
  const { activeOrganizationContext } = useOrganizationContext();
  const activeOrganizationId = activeOrganizationContext?.uid ?? null;

  const [rawTasks, setRawTasks] = useState<PredictedTaskRecord[]>([]);
  const [devices, setDevices] = useState<DevicePublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRobot, setSelectedRobot] = useState(ALL_VALUE);
  const [selectedType, setSelectedType] = useState(ALL_VALUE);
  const [selectedDay, setSelectedDay] = useState(ALL_VALUE);

  const cachedPrediction = useMemo(() => loadLastPredictionResponse(), []);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const tasks = await getPredictedTasks();
      setRawTasks(tasks);
    } catch (error) {
      const fallbackTasks = cachedPrediction?.data ?? [];
      setRawTasks(fallbackTasks);
      setErrorMessage(
        error instanceof Error
          ? `${error.message}. Mostrando la última predicción guardada en el navegador, si existe.`
          : "No se pudieron cargar las predicciones."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeOrganizationId) {
      setDevices([]);
      return;
    }

    let cancelled = false;

    DevicesService.getDevicesOwn({ ownerId: activeOrganizationId, skip: 0, limit: 1000 })
      .then((response) => {
        if (!cancelled) {
          setDevices(response.data ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDevices([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId]);

  const deviceNameByUid = useMemo(() => {
    const map = new Map<string, string>();

    devices.forEach((device) => {
      map.set(device.uid, device.name || device.uid);
    });

    return map;
  }, [devices]);

  const tasks = useMemo(
    () => normalizeTasks(rawTasks, deviceNameByUid),
    [rawTasks, deviceNameByUid]
  );

  const robotOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((task) => map.set(task.robotUid, task.robotName));
    return Array.from(map.entries())
      .map(([uid, name]) => ({ uid, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const typeOptions = useMemo(
    () => Array.from(new Set(tasks.map((task) => task.taskType))).sort(),
    [tasks]
  );

  const dayOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; startMs: number }>();
    tasks.forEach((task) => {
      if (!map.has(task.dayKey)) {
        map.set(task.dayKey, {
          key: task.dayKey,
          label: formatDate(task.startMs),
          startMs: getLocalDayStart(task.startMs),
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.startMs - b.startMs);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const robotMatches = selectedRobot === ALL_VALUE || task.robotUid === selectedRobot;
      const typeMatches = selectedType === ALL_VALUE || task.taskType === selectedType;
      const dayMatches = selectedDay === ALL_VALUE || task.dayKey === selectedDay;

      return robotMatches && typeMatches && dayMatches;
    });
  }, [tasks, selectedRobot, selectedType, selectedDay]);

  const stats = useMemo(() => {
    const source = filteredTasks;
    const allBounds = buildBounds(source);
    const robotCount = new Set(source.map((task) => task.robotUid)).size;
    const typeCount = new Set(source.map((task) => task.taskType)).size;
    const dayCount = new Set(source.map((task) => task.dayKey)).size;
    const totalDuration = sumBy(source, (task) => task.durationMinutes);
    const avgDuration = source.length > 0 ? Math.round(totalDuration / source.length) : 0;
    const totalMileage = sumBy(source, (task) => task.mileage);
    const totalWaypoints = sumBy(source, (task) => task.waypointCount);

    return {
      total: source.length,
      robotCount,
      typeCount,
      dayCount,
      totalDuration,
      avgDuration,
      totalMileage,
      totalWaypoints,
      rangeLabel: allBounds
        ? `${formatDateTime(allBounds.min)} → ${formatDateTime(allBounds.max)}`
        : "Sin rango",
    };
  }, [filteredTasks]);

  const tasksByDay = useMemo(() => {
    const grouped = countBy(filteredTasks, (task) => task.dayLabel);
    const startByLabel = new Map(filteredTasks.map((task) => [task.dayLabel, getLocalDayStart(task.startMs)]));
    return grouped.sort(
      (a, b) => (startByLabel.get(a.label) ?? 0) - (startByLabel.get(b.label) ?? 0)
    );
  }, [filteredTasks]);

  const tasksByRobot = useMemo(
    () => countBy(filteredTasks, (task) => task.robotName),
    [filteredTasks]
  );

  const tasksByType = useMemo(
    () => countBy(filteredTasks, (task) => task.taskType),
    [filteredTasks]
  );

  const durationByRobot = useMemo(() => {
    const map = new Map<string, number>();
    filteredTasks.forEach((task) => {
      map.set(task.robotName, (map.get(task.robotName) ?? 0) + task.durationMinutes);
    });

    return Array.from(map.entries())
      .map(([label, value]) => ({
        label,
        value,
        hint: `${formatDuration(value)} de trabajo estimado`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTasks]);

  const topRobot = tasksByRobot[0];
  const topType = tasksByType[0];
  const busiestDay = tasksByDay.reduce<ChartItem | null>(
    (best, item) => (!best || item.value > best.value ? item : best),
    null
  );

  return (
    <Container maxW="full" bg={bgColor} minH="100vh" py={8} px={6}>
      <Flex justify="space-between" align="center" gap={4} wrap="wrap" mb={6}>
        <Box>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<FiArrowLeft />}
            mb={3}
            onClick={handleBackToPreviousPage}
          >
            Volver al site
          </Button>
          <Heading size="lg">Predicciones</Heading>
          <Text color="gray.500" mt={1}>
            Resumen, gráficas, línea de tiempo y tabla completa de las tareas predichas.
          </Text>
        </Box>

        <Button
          leftIcon={<FiRefreshCw />}
          onClick={() => void loadData()}
          isLoading={isLoading}
          colorScheme="purple"
        >
          Recargar
        </Button>
      </Flex>

      {cachedPrediction && (
        <Card borderRadius="xl" boxShadow="sm" bg={cardBg} mb={5}>
          <CardBody>
            <Flex gap={3} wrap="wrap" align="center">
              <Badge colorScheme="green">Última predicción</Badge>
              <Text fontSize="sm" color="gray.600">
                {cachedPrediction.generated_count ?? cachedPrediction.data?.length ?? 0} tarea(s)
                {cachedPrediction.weeks_ahead
                  ? ` · ${cachedPrediction.weeks_ahead} semana(s)`
                  : ""}
                {cachedPrediction.data_source ? ` · fuente: ${cachedPrediction.data_source}` : ""}
                {cachedPrediction.saved_at
                  ? ` · guardada: ${formatDateTime(new Date(cachedPrediction.saved_at).getTime())}`
                  : ""}
              </Text>
              {cachedPrediction.predicted_file && (
                <Badge variant="outline">{cachedPrediction.predicted_file}</Badge>
              )}
              {cachedPrediction.combined_file && (
                <Badge variant="outline">{cachedPrediction.combined_file}</Badge>
              )}
            </Flex>
          </CardBody>
        </Card>
      )}

      {errorMessage && (
        <Card borderRadius="xl" boxShadow="sm" bg="orange.50" borderColor="orange.200" borderWidth="1px" mb={5}>
          <CardBody>
            <Text fontSize="sm" color="orange.800">
              {errorMessage}
            </Text>
          </CardBody>
        </Card>
      )}

      {isLoading ? (
        <Flex align="center" justify="center" minH="360px" direction="column" gap={3}>
          <Spinner size="xl" color="purple.400" />
          <Text color="gray.500">Cargando predicciones...</Text>
        </Flex>
      ) : tasks.length === 0 ? (
        <Card borderRadius="xl" boxShadow="sm" bg={cardBg}>
          <CardBody>
            <Heading size="md" mb={2}>
              No hay predicciones todavía
            </Heading>
            <Text color="gray.500" mb={4}>
              Genera una predicción desde Real Mode y después vuelve a esta pantalla.
            </Text>
            <Button colorScheme="purple" onClick={handleBackToPreviousPage}>
              Ir a predecir
            </Button>
          </CardBody>
        </Card>
      ) : (
        <Flex direction="column" gap={5}>
          <Grid templateColumns={{ base: "1fr", md: "repeat(4, 1fr)" }} gap={4}>
            <StatCard label="Tareas" value={stats.total} hint="según filtros activos" />
            <StatCard label="Robots" value={stats.robotCount} hint="robots con tareas" />
            <StatCard label="Días" value={stats.dayCount} hint="días con actividad" />
            <StatCard label="Duración media" value={formatDuration(stats.avgDuration)} hint="por tarea" />
          </Grid>

          <Card borderRadius="xl" boxShadow="sm" bg={cardBg}>
            <CardBody>
              <Flex justify="space-between" gap={4} wrap="wrap" align="end">
                <Box minW={{ base: "100%", md: "220px" }}>
                  <Text fontSize="xs" fontWeight="700" color="gray.500" mb={1}>
                    Robot
                  </Text>
                  <Select value={selectedRobot} onChange={(event) => setSelectedRobot(event.target.value)}>
                    <option value={ALL_VALUE}>Todos los robots</option>
                    {robotOptions.map((robot) => (
                      <option key={robot.uid} value={robot.uid}>
                        {robot.name}
                      </option>
                    ))}
                  </Select>
                </Box>

                <Box minW={{ base: "100%", md: "220px" }}>
                  <Text fontSize="xs" fontWeight="700" color="gray.500" mb={1}>
                    Tipo de tarea
                  </Text>
                  <Select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
                    <option value={ALL_VALUE}>Todos los tipos</option>
                    {typeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </Box>

                <Box minW={{ base: "100%", md: "260px" }}>
                  <Text fontSize="xs" fontWeight="700" color="gray.500" mb={1}>
                    Día
                  </Text>
                  <Select value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)}>
                    <option value={ALL_VALUE}>Todos los días</option>
                    {dayOptions.map((day) => (
                      <option key={day.key} value={day.key}>
                        {day.label}
                      </option>
                    ))}
                  </Select>
                </Box>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedRobot(ALL_VALUE);
                    setSelectedType(ALL_VALUE);
                    setSelectedDay(ALL_VALUE);
                  }}
                >
                  Limpiar filtros
                </Button>
              </Flex>

              <Box mt={4} color="gray.500" fontSize="sm">
                <Text>
                  Rango temporal: <strong>{stats.rangeLabel}</strong>
                </Text>
                <Text>
                  Duración total estimada: <strong>{formatDuration(stats.totalDuration)}</strong>
                  {stats.totalMileage > 0 ? ` · mileage total: ${stats.totalMileage.toFixed(2)}` : ""}
                  {stats.totalWaypoints > 0 ? ` · waypoints: ${stats.totalWaypoints}` : ""}
                </Text>
                <Text>
                  Robot más usado: <strong>{topRobot?.label ?? "Sin dato"}</strong>
                  {topRobot ? ` (${topRobot.value} tarea(s))` : ""} · Tipo más frecuente:{" "}
                  <strong>{topType?.label ?? "Sin dato"}</strong>
                  {topType ? ` (${topType.value})` : ""} · Día con más carga:{" "}
                  <strong>{busiestDay?.label ?? "Sin dato"}</strong>
                  {busiestDay ? ` (${busiestDay.value})` : ""}
                </Text>
              </Box>
            </CardBody>
          </Card>

          <DailyTaskLineChart title="Evolución diaria de tareas" data={tasksByDay} />

          <Grid templateColumns={{ base: "1fr", xl: "repeat(2, 1fr)" }} gap={5}>
            <HorizontalBarChart title="Tareas por día" data={tasksByDay} />
            <HorizontalBarChart title="Tareas por robot" data={tasksByRobot} />
            <HorizontalBarChart title="Tareas por tipo" data={tasksByType} />
            <HorizontalBarChart title="Carga estimada por robot" data={durationByRobot} />
          </Grid>

          <HourlyChart tasks={filteredTasks} />
          <MomentExplorer tasks={filteredTasks} />

          <Box overflowX="auto">
            <WeekTimeline tasks={filteredTasks} />
          </Box>

          <Card borderRadius="xl" boxShadow="sm" bg={cardBg}>
            <CardBody>
              <Heading size="sm" mb={4}>
                Tabla completa de tareas predichas
              </Heading>

              <Box overflowX="auto">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Inicio</Th>
                      <Th>Fin</Th>
                      <Th>Duración</Th>
                      <Th>Robot</Th>
                      <Th>Tipo</Th>
                      <Th>Estado</Th>
                      <Th>Semana</Th>
                      <Th>Waypoints</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredTasks.map((task) => (
                      <Tr key={task.id}>
                        <Td whiteSpace="nowrap">{formatDateTime(task.startMs)}</Td>
                        <Td whiteSpace="nowrap">{formatDateTime(task.endMs)}</Td>
                        <Td>{formatDuration(task.durationMinutes)}</Td>
                        <Td>{task.robotName}</Td>
                        <Td>
                          <Badge colorScheme="purple">{task.taskType}</Badge>
                        </Td>
                        <Td>{task.status}</Td>
                        <Td>{task.weekOffset ?? "-"}</Td>
                        <Td>{task.waypointCount}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </CardBody>
          </Card>
        </Flex>
      )}
    </Container>
  );
}
