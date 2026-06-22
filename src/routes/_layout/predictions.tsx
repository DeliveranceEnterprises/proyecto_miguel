import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  FiSliders,
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

// ─── Types ────────────────────────────────────────────────────────────────────

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
  /** Chakra color token. Example: purple.400. */
  color?: string;
};

type RobotChartItem = ChartItem & {
  robotUid: string;
  robotName: string;
};

type RobotChartSegment = {
  robotUid: string;
  robotName: string;
  value: number;
  color: string;
};

type StackedChartItem = {
  label: string;
  value: number;
  hint?: string;
  segments: RobotChartSegment[];
};

/** Chart item enriched with dayKey and per-robot counts. */
type DailyRobotChartItem = {
  label: string;
  dayKey: string;
  value: number;
  robotValues: RobotChartSegment[];
};

type DateFilterMode = "all" | "week" | "days";
type DailyChartMode = "combined" | "separate";

type WeekOption = {
  key: string;
  label: string;
  startMs: number;
  endMs: number;
  taskCount: number;
};

// ─── Robot colour palette ─────────────────────────────────────────────────────

type RobotColor = {
  colorScheme: string;
  bg: string;
};

const ROBOT_COLOR_PALETTE: RobotColor[] = [
  { colorScheme: "purple", bg: "purple.400" },
  { colorScheme: "blue",   bg: "blue.400"   },
  { colorScheme: "teal",   bg: "teal.400"   },
  { colorScheme: "green",  bg: "green.500"  },
  { colorScheme: "orange", bg: "orange.400" },
  { colorScheme: "pink",   bg: "pink.400"   },
  { colorScheme: "red",    bg: "red.400"    },
  { colorScheme: "cyan",   bg: "cyan.500"   },
];

function buildRobotColorMap(tasks: NormalizedPredictionTask[]): Map<string, RobotColor> {
  // UIDs ordenados para que el color sea estable independientemente del orden de llegada
  const uids = Array.from(new Set(tasks.map((t) => t.robotUid))).sort();
  const map = new Map<string, RobotColor>();
  if (uids.length === 0) return map;
  if (uids.length === 1) {
    // Un solo robot → siempre morado
    map.set(uids[0], ROBOT_COLOR_PALETTE[0]);
    return map;
  }
  uids.forEach((uid, index) => {
    map.set(uid, ROBOT_COLOR_PALETTE[index % ROBOT_COLOR_PALETTE.length]);
  });
  return map;
}

function getRobotColorBg(
  robotColorMap: Map<string, RobotColor>,
  robotUid: string,
): string {
  return robotColorMap.get(robotUid)?.bg ?? "purple.400";
}

function chakraTokenToCssVar(colorToken: string): string {
  const [name, shade] = colorToken.split(".");
  return name && shade ? `var(--chakra-colors-${name}-${shade})` : colorToken;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNKNOWN_ROBOT = "__unknown_robot__";
const ALL_VALUE = "__all__";
const FALLBACK_DURATION_MS = 30 * 60 * 1000;
const STEP_MS = 5 * 60 * 1000;
const MIN_TIMELINE_BAR_WIDTH_PX = 2;
const TIMELINE_LABEL_MIN_WIDTH_PCT = 4;
/** Duration (ms) the day highlight persists after clicking a chart point. */
const HIGHLIGHT_DURATION_MS = 2_500;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

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

function getLocalWeekStart(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  return date.getTime();
}

function getLocalWeekEnd(value: number): number {
  const date = new Date(getLocalWeekStart(value));
  date.setDate(date.getDate() + 7);
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

function formatDistanceMeters(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(2)} m`;
}

function formatWaypoint(
  waypoint: NonNullable<PredictedTaskRecord["waypoints"]>[number] | undefined,
): string {
  if (!waypoint) return "-";
  const x = Number(waypoint.coordinates_x);
  const y = Number(waypoint.coordinates_y);
  const position =
    Number.isFinite(x) && Number.isFinite(y)
      ? `x ${x.toFixed(2)}, y ${y.toFixed(2)}`
      : "sin coordenadas";
  const label = waypoint.label ? `${waypoint.label} · ` : "";
  const level = waypoint.level != null ? ` · planta ${waypoint.level}` : "";
  return `${label}${position}${level}`;
}

function handlePredictionTaskKeyDown(
  event: React.KeyboardEvent<HTMLDivElement>,
  onSelect: () => void,
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  onSelect();
}

function sumBy<T>(items: T[], getValue: (item: T) => number): number {
  return items.reduce((total, item) => total + getValue(item), 0);
}

function normalizeTasks(
  tasks: PredictedTaskRecord[],
  deviceNameByUid: Map<string, string>,
): NormalizedPredictionTask[] {
  return tasks
    .map((task, index) => {
      const startMs = new Date(task.start_time).getTime();
      const parsedEndMs = task.end_time
        ? new Date(task.end_time).getTime()
        : NaN;
      if (!Number.isFinite(startMs)) return null;

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
        weekOffset:
          typeof task.week_offset === "number" ? task.week_offset : null,
        waypointCount: Array.isArray(task.waypoints)
          ? task.waypoints.length
          : 0,
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
  return { min, max: max > min ? max : min + 60 * 60 * 1000 };
}

// ─── Small presentational components ─────────────────────────────────────────

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
        <Text
          fontSize="xs"
          color="gray.500"
          textTransform="uppercase"
          fontWeight="700"
        >
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

function PredictionTaskDetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Box borderWidth="1px" borderRadius="lg" px={3} py={2} bg="white">
      <Text
        fontSize="10px"
        color="gray.500"
        textTransform="uppercase"
        letterSpacing="0.06em"
        mb={1}
      >
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="700" noOfLines={2}>
        {value}
      </Text>
    </Box>
  );
}

function PredictionTaskDetails({
  task,
  onClose,
  mt = 4,
}: {
  task: NormalizedPredictionTask;
  onClose: () => void;
  mt?: number | string;
}) {
  const firstWaypoint = task.raw.waypoints?.[0];
  const lastWaypoint = task.raw.waypoints?.[task.raw.waypoints.length - 1];

  return (
    <Box
      mt={mt}
      borderWidth="1px"
      borderColor="purple.200"
      borderRadius="xl"
      bg="purple.50"
      p={4}
    >
      <Flex justify="space-between" align="start" gap={3} mb={3}>
        <Box minW={0}>
          <Text
            fontSize="xs"
            fontWeight="800"
            color="purple.600"
            textTransform="uppercase"
            letterSpacing="0.08em"
          >
            Detalle de tarea seleccionada
          </Text>
          <Heading size="sm" noOfLines={1}>
            {task.taskName}
          </Heading>
        </Box>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </Flex>

      <Flex gap={2} wrap="wrap" mb={3}>
        <Badge colorScheme="purple">{task.taskType}</Badge>
        <Badge colorScheme="blue">{task.status}</Badge>
        <Badge colorScheme="gray">{task.robotName}</Badge>
      </Flex>

      <Grid templateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap={3}>
        <PredictionTaskDetailItem
          label="Inicio"
          value={formatDateTime(task.startMs)}
        />
        <PredictionTaskDetailItem
          label="Fin"
          value={formatDateTime(task.endMs)}
        />
        <PredictionTaskDetailItem
          label="Duración"
          value={formatDuration(task.durationMinutes)}
        />
        <PredictionTaskDetailItem label="Robot" value={task.robotName} />
        <PredictionTaskDetailItem label="Robot UID" value={task.robotUid} />
        <PredictionTaskDetailItem label="Estado" value={task.status} />
        <PredictionTaskDetailItem
          label="Semana"
          value={task.weekOffset ?? "-"}
        />
        <PredictionTaskDetailItem
          label="Distancia"
          value={formatDistanceMeters(task.mileage)}
        />
        <PredictionTaskDetailItem
          label="Waypoints"
          value={task.waypointCount}
        />
        <PredictionTaskDetailItem
          label="Primer waypoint"
          value={formatWaypoint(firstWaypoint)}
        />
        <PredictionTaskDetailItem
          label="Último waypoint"
          value={formatWaypoint(lastWaypoint)}
        />
        <PredictionTaskDetailItem label="ID tarea" value={task.id} />
        {task.raw.misc && (
          <PredictionTaskDetailItem label="Notas" value={task.raw.misc} />
        )}
      </Grid>
    </Box>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

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
                  <Box
                    h="10px"
                    bg="gray.100"
                    borderRadius="full"
                    overflow="hidden"
                  >
                    <Box
                      h="100%"
                      width={width}
                      bg={item.color ?? "purple.400"}
                      borderRadius="full"
                      title={item.hint ?? `${item.label}: ${item.value}`}
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


function StackedHorizontalBarChart({
  title,
  data,
  emptyText = "Sin datos suficientes",
}: {
  title: string;
  data: StackedChartItem[];
  emptyText?: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 0);
  const legendSegments = Array.from(
    data.reduce((map, item) => {
      item.segments.forEach((segment) => {
        if (!map.has(segment.robotUid)) map.set(segment.robotUid, segment);
      });
      return map;
    }, new Map<string, RobotChartSegment>()),
  ).map(([, segment]) => segment);

  return (
    <Card borderRadius="xl" boxShadow="sm" height="100%">
      <CardBody>
        <Flex align="center" gap={2} mb={4}>
          <FiSliders />
          <Heading size="sm">{title}</Heading>
        </Flex>

        {data.length === 0 || max === 0 ? (
          <Text fontSize="sm" color="gray.500">
            {emptyText}
          </Text>
        ) : (
          <Flex direction="column" gap={4}>
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
                  <Box h="14px" bg="gray.100" borderRadius="full" overflow="hidden">
                    <Flex h="100%" width={width} borderRadius="full" overflow="hidden">
                      {item.segments.map((segment) => {
                        const segmentWidth = `${(segment.value / item.value) * 100}%`;
                        return (
                          <Box
                            key={segment.robotUid}
                            h="100%"
                            width={segmentWidth}
                            bg={segment.color}
                            title={`${segment.robotName}: ${segment.value}`}
                          />
                        );
                      })}
                    </Flex>
                  </Box>
                  {item.hint && (
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      {item.hint}
                    </Text>
                  )}
                </Box>
              );
            })}

            <Flex gap={3} wrap="wrap" pt={1}>
              {legendSegments.map((segment) => (
                <Flex key={segment.robotUid} align="center" gap={1.5}>
                  <Box w="10px" h="10px" borderRadius="full" bg={segment.color} />
                  <Text fontSize="xs" color="gray.500">
                    {segment.robotName}
                  </Text>
                </Flex>
              ))}
            </Flex>
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


/**
 * Multi-series daily line chart.
 * One coloured line per robot, using the same colour map as the timeline.
 * Each day column is clickable and navigates to the matching timeline day.
 */
function DailyRobotLineChart({
  title,
  data,
  onDayClick,
}: {
  title: string;
  data: DailyRobotChartItem[];
  onDayClick?: (dayKey: string) => void;
}) {
  const [hoveredDayKey, setHoveredDayKey] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<DailyChartMode>("separate");

  const paddingLeft = 56;
  const paddingRight = 28;
  const paddingTop = 34;
  const paddingBottom = 64;
  const height = 310;
  const width = 920;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...data.map((item) => item.value), 0);
  const yMax = Math.max(maxValue, 1);
  const gridLines = 4;

  const robots = Array.from(
    data.reduce((map, item) => {
      item.robotValues.forEach((segment) => {
        if (!map.has(segment.robotUid)) map.set(segment.robotUid, segment);
      });
      return map;
    }, new Map<string, RobotChartSegment>()),
  )
    .map(([, segment]) => segment)
    .sort((a, b) => a.robotName.localeCompare(b.robotName));

  const maxLabels = Math.floor(chartWidth / 44);
  const labelStep = data.length <= maxLabels ? 1 : Math.ceil(data.length / maxLabels);

  const dayX = (index: number) =>
    data.length === 1
      ? paddingLeft + chartWidth / 2
      : paddingLeft + (index / (data.length - 1)) * chartWidth;

  const valueY = (value: number) =>
    paddingTop + chartHeight - (value / yMax) * chartHeight;

  const series = robots.map((robot) => {
    const points = data.map((item, index) => {
      const value = item.robotValues.find(
        (segment) => segment.robotUid === robot.robotUid,
      )?.value ?? 0;
      return {
        x: dayX(index),
        y: valueY(value),
        value,
        label: item.label,
        dayKey: item.dayKey,
      };
    });
    return {
      ...robot,
      points,
      path: buildSmoothSvgPath(points),
    };
  });

  const combinedColor = "purple.400";
  const combinedCssColor = chakraTokenToCssVar(combinedColor);
  const combinedPoints = data.map((item, index) => ({
    x: dayX(index),
    y: valueY(item.value),
    value: item.value,
    label: item.label,
    dayKey: item.dayKey,
    breakdown: item.robotValues
      .map((segment) => `${segment.robotName}: ${segment.value}`)
      .join(" · "),
  }));
  const combinedPath = buildSmoothSvgPath(combinedPoints);
  const combinedAreaPath = combinedPoints.length > 0
    ? `${combinedPath} L ${combinedPoints[combinedPoints.length - 1].x} ${paddingTop + chartHeight} L ${combinedPoints[0].x} ${paddingTop + chartHeight} Z`
    : "";

  const isInteractive = Boolean(onDayClick);
  const isCombinedMode = chartMode === "combined";

  return (
    <Card borderRadius="xl" boxShadow="sm">
      <CardBody>
        <Flex justify="space-between" align="start" gap={4} wrap="wrap" mb={4}>
          <Box minW={0}>
            <Flex align="center" gap={2}>
              <FiTrendingUp />
              <Heading size="sm">{title}</Heading>
            </Flex>
            <Text fontSize="sm" color="gray.500" mt={1}>
              {isCombinedMode
                ? "Vista unida: una única curva suma todas las tareas del día."
                : "Vista separada: una línea por robot con los colores de la línea de tiempo."}
              {isInteractive && (
                <Box as="span" color="purple.500" fontWeight="600">
                  {" "}Haz clic en un día para verlo en la línea de tiempo.
                </Box>
              )}
            </Text>
          </Box>
          <Flex align="end" gap={3} wrap="wrap">
            <Box minW="210px">
              <Text
                fontSize="xs"
                fontWeight="700"
                color="gray.500"
                mb={1}
                textTransform="uppercase"
              >
                Vista
              </Text>
              <Select
                size="sm"
                value={chartMode}
                onChange={(e) => setChartMode(e.target.value as DailyChartMode)}
              >
                <option value="combined">Unidas por día</option>
                <option value="separate">Separadas por robot</option>
              </Select>
            </Box>
            <Badge colorScheme="purple" px={3} py={1} borderRadius="full">
              Máximo total: {maxValue} tarea(s)
            </Badge>
          </Flex>
        </Flex>

        {data.length === 0 ? (
          <Text fontSize="sm" color="gray.500">
            No hay datos para construir la curva diaria.
          </Text>
        ) : (
          <Box overflow="hidden" maxW="100%">
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

              {isCombinedMode ? (
                <g>
                  {combinedAreaPath && (
                    <path
                      d={combinedAreaPath}
                      fill={combinedCssColor}
                      opacity="0.12"
                    />
                  )}
                  <path
                    d={combinedPath}
                    fill="none"
                    stroke={combinedCssColor}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {combinedPoints.map((point) => {
                    if (point.value === 0) return null;
                    const isHovered = hoveredDayKey === point.dayKey;
                    return (
                      <circle
                        key={`combined-${point.dayKey}`}
                        cx={point.x}
                        cy={point.y}
                        r={isHovered ? 6 : 4.5}
                        fill="#FFFFFF"
                        stroke={combinedCssColor}
                        strokeWidth={isHovered ? 3 : 2}
                      >
                        <title>
                          {`${point.label} · Total: ${point.value} tarea(s)${
                            point.breakdown ? ` · ${point.breakdown}` : ""
                          }`}
                        </title>
                      </circle>
                    );
                  })}
                </g>
              ) : (
                series.map((robot) => {
                  const cssColor = chakraTokenToCssVar(robot.color);
                  return (
                    <g key={robot.robotUid}>
                      <path
                        d={robot.path}
                        fill="none"
                        stroke={cssColor}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {robot.points.map((point) => {
                        if (point.value === 0) return null;
                        const isHovered = hoveredDayKey === point.dayKey;
                        return (
                          <circle
                            key={`${robot.robotUid}-${point.dayKey}`}
                            cx={point.x}
                            cy={point.y}
                            r={isHovered ? 5.5 : 4}
                            fill="#FFFFFF"
                            stroke={cssColor}
                            strokeWidth={isHovered ? 3 : 2}
                          >
                            <title>
                              {`${point.label} · ${robot.robotName}: ${point.value} tarea(s)`}
                            </title>
                          </circle>
                        );
                      })}
                    </g>
                  );
                })
              )}

              {data.map((item, index) => {
                const x = dayX(index);
                const isHovered = hoveredDayKey === item.dayKey;
                const showLabel = index % labelStep === 0 || index === data.length - 1;
                return (
                  <g
                    key={item.dayKey}
                    style={{ cursor: isInteractive ? "pointer" : "default", outline: "none" }}
                    onClick={() => isInteractive && onDayClick?.(item.dayKey)}
                    onMouseEnter={() => setHoveredDayKey(item.dayKey)}
                    onMouseLeave={() => setHoveredDayKey(null)}
                    role={isInteractive ? "button" : undefined}
                    aria-label={isInteractive ? `Ir al día ${item.label}` : undefined}
                    tabIndex={isInteractive ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (isInteractive && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onDayClick?.(item.dayKey);
                      }
                    }}
                  >
                    <rect
                      x={x - 18}
                      y={paddingTop}
                      width="36"
                      height={chartHeight}
                      fill={isHovered ? "rgba(124, 58, 237, 0.06)" : "transparent"}
                    />
                    {isHovered && (
                      <text
                        x={x}
                        y={paddingTop - 12}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill="#44337A"
                      >
                        {item.value} total
                      </text>
                    )}
                    {showLabel && (
                      <text
                        x={x}
                        y={paddingTop + chartHeight + 10}
                        textAnchor="end"
                        fontSize="11"
                        fill={isHovered ? "#553C9A" : "#718096"}
                        fontWeight={isHovered ? "700" : "400"}
                        transform={`rotate(-40, ${x}, ${paddingTop + chartHeight + 10})`}
                      >
                        {item.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            <Flex gap={3} wrap="wrap" mt={3}>
              {isCombinedMode ? (
                <Flex align="center" gap={1.5}>
                  <Box w="10px" h="10px" borderRadius="full" bg={combinedColor} />
                  <Text fontSize="xs" color="gray.500">
                    Total diario
                  </Text>
                </Flex>
              ) : (
                robots.map((robot) => (
                  <Flex key={robot.robotUid} align="center" gap={1.5}>
                    <Box w="10px" h="10px" borderRadius="full" bg={robot.color} />
                    <Text fontSize="xs" color="gray.500">
                      {robot.robotName}
                    </Text>
                  </Flex>
                ))
              )}
            </Flex>
          </Box>
        )}
      </CardBody>
    </Card>
  );
}



function HourlyStackedChart({
  tasks,
  robotColorMap,
}: {
  tasks: NormalizedPredictionTask[];
  robotColorMap: Map<string, RobotColor>;
}) {
  const hourlyData = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, hour) => ({
      label: `${pad2(hour)}:00`,
      value: 0,
      segmentsByRobot: new Map<string, RobotChartSegment>(),
    }));

    tasks.forEach((task) => {
      const item = counts[task.hour];
      item.value += 1;
      const current = item.segmentsByRobot.get(task.robotUid) ?? {
        robotUid: task.robotUid,
        robotName: task.robotName,
        value: 0,
        color: getRobotColorBg(robotColorMap, task.robotUid),
      };
      current.value += 1;
      item.segmentsByRobot.set(task.robotUid, current);
    });

    return counts.map((item) => ({
      label: item.label,
      value: item.value,
      segments: Array.from(item.segmentsByRobot.values()).sort(
        (a, b) => b.value - a.value || a.robotName.localeCompare(b.robotName),
      ),
    }));
  }, [tasks, robotColorMap]);

  const max = Math.max(...hourlyData.map((item) => item.value), 1);

  return (
    <Card borderRadius="xl" boxShadow="sm" height="100%">
      <CardBody>
        <Flex align="center" gap={2} mb={4}>
          <FiClock />
          <Heading size="sm">Distribución por hora de inicio</Heading>
        </Flex>

        <Flex align="end" gap="2px" height="170px" pb={6} width="100%">
          {hourlyData.map((item) => {
            const barHeight = `${Math.max(2, (item.value / max) * 100)}%`;
            const breakdown = item.segments
              .map((segment) => `${segment.robotName}: ${segment.value}`)
              .join(" · ");
            return (
              <Flex
                key={item.label}
                direction="column"
                align="center"
                justify="end"
                flex="1"
                height="100%"
                gap={1}
                position="relative"
              >
                {item.value > 0 && (
                  <Text
                    fontSize="10px"
                    color="gray.500"
                    position="absolute"
                    bottom={`calc(${barHeight} + 2px)`}
                  >
                    {item.value}
                  </Text>
                )}
                <Box
                  width="100%"
                  height={barHeight}
                  bg={item.value > 0 ? "transparent" : "gray.100"}
                  borderRadius="3px 3px 0 0"
                  overflow="hidden"
                  display="flex"
                  flexDirection="column-reverse"
                  title={breakdown || `${item.label}: 0`}
                >
                  {item.segments.map((segment) => (
                    <Box
                      key={segment.robotUid}
                      width="100%"
                      height={`${(segment.value / item.value) * 100}%`}
                      bg={segment.color}
                    />
                  ))}
                </Box>
                <Text
                  fontSize="9px"
                  color="gray.400"
                  position="absolute"
                  bottom="-20px"
                  transform="rotate(-45deg)"
                  transformOrigin="top center"
                  whiteSpace="nowrap"
                >
                  {item.label.replace(":00", "h")}
                </Text>
              </Flex>
            );
          })}
        </Flex>
      </CardBody>
    </Card>
  );
}

// ─── Toggle button ─────────────────────────────────────────────────────────────

function ToggleContentButton({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={onToggle}>
      {isOpen ? "Ocultar contenido" : "Mostrar contenido"}
    </Button>
  );
}

// ─── Weekly Timeline ───────────────────────────────────────────────────────────

/**
 * Weekly timeline component.
 *
 * Each day group renders with a stable DOM id (`timeline-day-<dayKey>`) so
 * the parent can programmatically scroll to any day using
 * `document.getElementById(...)`.
 *
 * @param highlightedDayKey - dayKey that should flash a highlight ring (driven
 *   by the parent after the user clicks a chart point).
 * @param isExpanded / onToggleExpanded - state is lifted to the parent so that
 *   the parent can force-expand the section before scrolling.
 */
function WeekTimeline({
  tasks,
  highlightedDayKey,
  isExpanded,
  onToggleExpanded,
  robotColorMap,  
}: {
  tasks: NormalizedPredictionTask[];
  highlightedDayKey: string | null;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  robotColorMap: Map<string, RobotColor>;
}) {
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

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return tasks.find((task) => task.id === selectedTaskId) ?? null;
  }, [tasks, selectedTaskId]);

  useEffect(() => {
    if (!selectedTaskId) return;
    const stillVisible = tasks.some((task) => task.id === selectedTaskId);
    if (!stillVisible) setSelectedTaskId(null);
  }, [selectedTaskId, tasks]);

  if (groups.length === 0) {
    return (
      <Card borderRadius="xl" boxShadow="sm">
        <CardBody>
          <Flex
            justify="space-between"
            align="center"
            gap={3}
            mb={isExpanded ? 2 : 0}
          >
            <Flex align="center" gap={2}>
              <FiCalendar />
              <Heading size="sm">Línea de tiempo semanal</Heading>
            </Flex>
            <ToggleContentButton
              isOpen={isExpanded}
              onToggle={onToggleExpanded}
            />
          </Flex>
          {isExpanded && (
            <Text fontSize="sm" color="gray.500">
              No hay tareas para mostrar.
            </Text>
          )}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card borderRadius="xl" boxShadow="sm">
      <CardBody>
        <Flex
          justify="space-between"
          align="center"
          gap={3}
          mb={isExpanded ? 4 : 0}
        >
          <Flex align="center" gap={2}>
            <FiCalendar />
            <Heading size="sm">Línea de tiempo semanal</Heading>
          </Flex>
          <ToggleContentButton
            isOpen={isExpanded}
            onToggle={onToggleExpanded}
          />
        </Flex>

        {isExpanded && (
          <Flex direction="column" gap={5}>
            {groups.map((group) => {
              const isHighlighted = highlightedDayKey === group.dayKey;

              return (
                <Box
                  key={group.dayKey}
                  id={`timeline-day-${group.dayKey}`}
                  borderRadius="xl"
                  borderLeftWidth={isHighlighted ? "3px" : "0px"}
                  borderLeftColor="purple.300"
                  bg={isHighlighted ? "purple.50" : "transparent"}
                  pl={isHighlighted ? 3 : 0}
                  pt={isHighlighted ? 2 : 0}
                  pb={isHighlighted ? 2 : 0}
                  style={{
                    transition: "background 0.4s ease, padding 0.2s ease, border-left-width 0.2s ease",
                  }}
                >
                  {selectedTask?.dayKey === group.dayKey && (
                    <PredictionTaskDetails
                      task={selectedTask}
                      onClose={() => setSelectedTaskId(null)}
                      mt={0}
                    />
                  )}

                  <Flex
                    justify="space-between"
                    align="center"
                    mt={selectedTask?.dayKey === group.dayKey ? 3 : 0}
                    mb={2}
                  >
                    <Flex align="center" gap={2}>
                      <Text fontWeight="800">{group.label}</Text>
                      {isHighlighted && (
                        <Badge colorScheme="purple" variant="solid" fontSize="10px">
                          desde gráfico
                        </Badge>
                      )}
                    </Flex>
                    <Badge>{group.tasks.length} tarea(s)</Badge>
                  </Flex>

                  <Box
                    borderWidth="1px"
                    borderRadius="lg"
                    bg="gray.50"
                    overflowX="auto"
                    minW="760px"
                  >
                    <Flex
                      px={3}
                      py={2}
                      color="gray.500"
                      fontSize="10px"
                      borderBottomWidth="1px"
                    >
                      {[0, 4, 8, 12, 16, 20, 24].map((hour) => (
                        <Box key={hour} flex="1">
                          {pad2(hour)}:00
                        </Box>
                      ))}
                    </Flex>

                    <Box
                      position="relative"
                      minHeight={`${Math.max(46, group.tasks.length * 36)}px`}
                    >
                      {group.tasks.map((task, index) => {
                        const dayLength = group.endMs - group.startMs;
                        const visibleStartMs = Math.max(
                          task.startMs,
                          group.startMs,
                        );
                        const visibleEndMs = Math.min(
                          task.endMs,
                          group.endMs,
                        );
                        const left =
                          ((visibleStartMs - group.startMs) / dayLength) * 100;
                        const barWidth = Math.max(
                          ((visibleEndMs - visibleStartMs) / dayLength) * 100,
                          0,
                        );
                        const showLabel =
                          barWidth >= TIMELINE_LABEL_MIN_WIDTH_PCT;

                        return (
                          <Box
                            key={task.id}
                            position="absolute"
                            top={`${8 + index * 34}px`}
                            left={`${left}%`}
                            width={`${barWidth}%`}
                            minW={
                              barWidth > 0
                                ? `${MIN_TIMELINE_BAR_WIDTH_PX}px`
                                : undefined
                            }
                            px={showLabel ? 2 : 0}
                            py={1}
                            borderRadius="md"
                            color="white"
                            overflow="hidden"
                            cursor="pointer"
                            bg={robotColorMap.get(task.robotUid)?.bg ?? "purple.400"} 
                            outline={
                              selectedTaskId === task.id
                                ? "2px solid var(--chakra-colors-purple-700)"
                                : "1px solid rgba(255,255,255,0.35)"
                            }
                            outlineOffset="0"
                            boxShadow={
                              selectedTaskId === task.id
                                ? "0 0 0 3px rgba(128,90,213,0.20)"
                                : undefined
                            }
                            role="button"
                            tabIndex={0}
                            aria-label={`Mostrar detalle de ${task.taskName}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedTaskId(task.id);
                            }}
                            onKeyDown={(event) =>
                              handlePredictionTaskKeyDown(event, () =>
                                setSelectedTaskId(task.id),
                              )
                            }
                            title={`${task.robotName} · ${task.taskName} · ${formatDateTime(task.startMs)} · ${formatDuration(task.durationMinutes)}`}
                          >
                            {showLabel && (
                              <>
                                <Text
                                  fontSize="11px"
                                  fontWeight="800"
                                  noOfLines={1}
                                >
                                  {task.taskType}
                                </Text>
                                <Text
                                  fontSize="10px"
                                  noOfLines={1}
                                  opacity={0.9}
                                >
                                  {formatTime(task.startMs)} · {task.robotName}
                                </Text>
                              </>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Flex>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Navigation helpers ───────────────────────────────────────────────────────

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
  path: string,
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

// ─── Page ─────────────────────────────────────────────────────────────────────

function PredictionsPage() {
  const navigate = useNavigate();
  const bgColor = useColorModeValue("ui.light", "gray.50");
  const cardBg = useColorModeValue("white", "gray.800");
  const { activeOrganizationContext } = useOrganizationContext();
  const activeOrganizationId = activeOrganizationContext?.uid ?? null;

  // ── Data state ──
  const [rawTasks, setRawTasks] = useState<PredictedTaskRecord[]>([]);
  const [devices, setDevices] = useState<DevicePublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Filter state ──
  const [selectedRobot, setSelectedRobot] = useState(ALL_VALUE);
  const [selectedType, setSelectedType] = useState(ALL_VALUE);
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("all");
  const [selectedWeek, setSelectedWeek] = useState(ALL_VALUE);
  const [selectedDayKeys, setSelectedDayKeys] = useState<string[]>([]);

  // ── UI state ──
  const [isPredictedTasksTableVisible, setIsPredictedTasksTableVisible] =
    useState(true);

  /**
   * WeekTimeline expanded state lifted here so the chart-click handler can
   * force-expand the section before scrolling to the target day.
   */
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(true);

  /**
   * The dayKey currently highlighted in the timeline (driven by chart clicks).
   * `null` means no highlight is active.
   */
  const [highlightedDayKey, setHighlightedDayKey] = useState<string | null>(
    null,
  );
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // ── Cached prediction ──
  const cachedPrediction = useMemo(() => loadLastPredictionResponse(), []);

  // ── Load data ──
  const loadData = useCallback(async () => {
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
          : "No se pudieron cargar las predicciones.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [cachedPrediction]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Cleanup highlight timeout on unmount
  useEffect(
    () => () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    },
    [],
  );

  // ── Devices ──
  useEffect(() => {
    if (!activeOrganizationId) {
      setDevices([]);
      return;
    }
    let cancelled = false;
    DevicesService.getDevicesOwn({
      ownerId: activeOrganizationId,
      skip: 0,
      limit: 1000,
    })
      .then((response) => {
        if (!cancelled) setDevices(response.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setDevices([]);
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
    [rawTasks, deviceNameByUid],
  );

  const robotColorMap = useMemo(() => buildRobotColorMap(tasks), [tasks]);


  // ── Filter options ──
  const robotOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((task) => map.set(task.robotUid, task.robotName));
    return Array.from(map.entries())
      .map(([uid, name]) => ({ uid, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const typeOptions = useMemo(
    () => Array.from(new Set(tasks.map((task) => task.taskType))).sort(),
    [tasks],
  );

  const dayOptions = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; startMs: number }
    >();
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

  const weekOptions = useMemo<WeekOption[]>(() => {
    const map = new Map<
      string,
      {
        startMs: number;
        endMs: number;
        taskCount: number;
        weekOffsets: Set<number>;
      }
    >();
    tasks.forEach((task) => {
      const startMs = getLocalWeekStart(task.startMs);
      const key = getLocalDayKey(startMs);
      const current = map.get(key) ?? {
        startMs,
        endMs: getLocalWeekEnd(task.startMs),
        taskCount: 0,
        weekOffsets: new Set<number>(),
      };
      current.taskCount += 1;
      if (typeof task.weekOffset === "number") {
        current.weekOffsets.add(task.weekOffset);
      }
      map.set(key, current);
    });

    return Array.from(map.entries())
      .map(([key, value]) => {
        const weekOffsets = Array.from(value.weekOffsets).sort(
          (a, b) => a - b,
        );
        const weekLabel =
          weekOffsets.length === 1
            ? `Semana ${weekOffsets[0]}`
            : `Semana de ${formatShortDate(value.startMs)}`;
        return {
          key,
          startMs: value.startMs,
          endMs: value.endMs,
          taskCount: value.taskCount,
          label: `${weekLabel} · ${formatShortDate(value.startMs)} - ${formatShortDate(value.endMs - 1)}`,
        };
      })
      .sort((a, b) => a.startMs - b.startMs);
  }, [tasks]);

  // Sync selected week / days when filtered tasks change
  useEffect(() => {
    if (selectedWeek === ALL_VALUE) return;
    const weekStillExists = weekOptions.some(
      (week) => week.key === selectedWeek,
    );
    if (!weekStillExists) setSelectedWeek(ALL_VALUE);
  }, [selectedWeek, weekOptions]);

  useEffect(() => {
    if (selectedDayKeys.length === 0) return;
    const availableDayKeys = new Set(dayOptions.map((day) => day.key));
    const visible = selectedDayKeys.filter((k) => availableDayKeys.has(k));
    if (visible.length !== selectedDayKeys.length) setSelectedDayKeys(visible);
  }, [dayOptions, selectedDayKeys]);

  const handleDateFilterModeChange = useCallback((mode: DateFilterMode) => {
    setDateFilterMode(mode);
    if (mode === "all") {
      setSelectedWeek(ALL_VALUE);
      setSelectedDayKeys([]);
    } else if (mode === "week") {
      setSelectedDayKeys([]);
    } else {
      setSelectedWeek(ALL_VALUE);
    }
  }, []);

  const toggleSelectedDay = useCallback((dayKey: string) => {
    setSelectedDayKeys((current) =>
      current.includes(dayKey)
        ? current.filter((k) => k !== dayKey)
        : [...current, dayKey],
    );
  }, []);

  // ── Filtered tasks ──
  const filteredTasks = useMemo(() => {
    const selectedWeekOption =
      selectedWeek === ALL_VALUE
        ? null
        : weekOptions.find((week) => week.key === selectedWeek) ?? null;

    return tasks.filter((task) => {
      const robotMatches =
        selectedRobot === ALL_VALUE || task.robotUid === selectedRobot;
      const typeMatches =
        selectedType === ALL_VALUE || task.taskType === selectedType;

      const dateMatches = (() => {
        if (dateFilterMode === "week") {
          if (!selectedWeekOption) return true;
          return (
            task.startMs >= selectedWeekOption.startMs &&
            task.startMs < selectedWeekOption.endMs
          );
        }
        if (dateFilterMode === "days") {
          if (selectedDayKeys.length === 0) return true;
          return selectedDayKeys.includes(task.dayKey);
        }
        return true;
      })();

      return robotMatches && typeMatches && dateMatches;
    });
  }, [
    tasks,
    selectedRobot,
    selectedType,
    dateFilterMode,
    selectedWeek,
    weekOptions,
    selectedDayKeys,
  ]);

  // ── Derived chart data ──
  const stats = useMemo(() => {
    const allBounds = buildBounds(filteredTasks);
    const robotCount = new Set(filteredTasks.map((t) => t.robotUid)).size;
    const typeCount = new Set(filteredTasks.map((t) => t.taskType)).size;
    const dayCount = new Set(filteredTasks.map((t) => t.dayKey)).size;
    const totalDuration = sumBy(filteredTasks, (t) => t.durationMinutes);
    const avgDuration =
      filteredTasks.length > 0
        ? Math.round(totalDuration / filteredTasks.length)
        : 0;
    const totalMileage = sumBy(filteredTasks, (t) => t.mileage);
    const totalWaypoints = sumBy(filteredTasks, (t) => t.waypointCount);

    return {
      total: filteredTasks.length,
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

  /**
   * tasksByDay keeps the total per day and the robot contribution inside that day.
   * This lets the daily chart render one line per robot while preserving the
   * existing click-to-timeline behaviour.
   */
  const tasksByDay = useMemo((): DailyRobotChartItem[] => {
    const dayMap = new Map<
      string,
      {
        label: string;
        dayKey: string;
        startMs: number;
        value: number;
        robots: Map<string, RobotChartSegment>;
      }
    >();

    filteredTasks.forEach((task) => {
      const day = dayMap.get(task.dayKey) ?? {
        label: task.dayLabel,
        dayKey: task.dayKey,
        startMs: getLocalDayStart(task.startMs),
        value: 0,
        robots: new Map<string, RobotChartSegment>(),
      };

      day.value += 1;
      const robot = day.robots.get(task.robotUid) ?? {
        robotUid: task.robotUid,
        robotName: task.robotName,
        value: 0,
        color: getRobotColorBg(robotColorMap, task.robotUid),
      };
      robot.value += 1;
      day.robots.set(task.robotUid, robot);
      dayMap.set(task.dayKey, day);
    });

    return Array.from(dayMap.values())
      .sort((a, b) => a.startMs - b.startMs)
      .map((day) => ({
        label: day.label,
        dayKey: day.dayKey,
        value: day.value,
        robotValues: Array.from(day.robots.values()).sort(
          (a, b) => b.value - a.value || a.robotName.localeCompare(b.robotName),
        ),
      }));
  }, [filteredTasks, robotColorMap]);

  const tasksByRobot = useMemo((): RobotChartItem[] => {
    const map = new Map<string, RobotChartItem>();
    filteredTasks.forEach((task) => {
      const current: RobotChartItem = map.get(task.robotUid) ?? {
        label: task.robotName,
        robotUid: task.robotUid,
        robotName: task.robotName,
        value: 0,
        color: getRobotColorBg(robotColorMap, task.robotUid),
      };
      current.value += 1;
      map.set(task.robotUid, current);
    });
    return Array.from(map.values()).sort(
      (a, b) => b.value - a.value || a.robotName.localeCompare(b.robotName),
    );
  }, [filteredTasks, robotColorMap]);

  const tasksByType = useMemo((): StackedChartItem[] => {
    const map = new Map<
      string,
      {
        label: string;
        value: number;
        robots: Map<string, RobotChartSegment>;
      }
    >();

    filteredTasks.forEach((task) => {
      const current = map.get(task.taskType) ?? {
        label: task.taskType,
        value: 0,
        robots: new Map<string, RobotChartSegment>(),
      };
      current.value += 1;
      const robot = current.robots.get(task.robotUid) ?? {
        robotUid: task.robotUid,
        robotName: task.robotName,
        value: 0,
        color: getRobotColorBg(robotColorMap, task.robotUid),
      };
      robot.value += 1;
      current.robots.set(task.robotUid, robot);
      map.set(task.taskType, current);
    });

    return Array.from(map.values())
      .map((item) => ({
        label: item.label,
        value: item.value,
        segments: Array.from(item.robots.values()).sort(
          (a, b) => b.value - a.value || a.robotName.localeCompare(b.robotName),
        ),
      }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }, [filteredTasks, robotColorMap]);

  const durationByRobot = useMemo((): RobotChartItem[] => {
    const map = new Map<string, RobotChartItem>();
    filteredTasks.forEach((task) => {
      const current: RobotChartItem = map.get(task.robotUid) ?? {
        label: task.robotName,
        robotUid: task.robotUid,
        robotName: task.robotName,
        value: 0,
        color: getRobotColorBg(robotColorMap, task.robotUid),
      };
      current.value += task.durationMinutes;
      current.hint = `${formatDuration(current.value)} de trabajo estimado`;
      map.set(task.robotUid, current);
    });
    return Array.from(map.values()).sort(
      (a, b) => b.value - a.value || a.robotName.localeCompare(b.robotName),
    );
  }, [filteredTasks, robotColorMap]);

  const topRobot = tasksByRobot[0];
  const topType = tasksByType[0];
  const busiestDay = tasksByDay.reduce<DailyRobotChartItem | null>(
    (best, item) => (!best || item.value > best.value ? item : best),
    null,
  );

  // ── Chart → Timeline navigation ──────────────────────────────────────────────

  const handleChartDayClick = useCallback(
    (dayKey: string) => {
      // 1. Clear any existing highlight timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }

      // 2. Make sure the timeline section is expanded
      if (!isTimelineExpanded) {
        setIsTimelineExpanded(true);
      }

      // 3. Activate highlight immediately
      setHighlightedDayKey(dayKey);

      // 4. Scroll after a short tick so the DOM has time to expand if needed
      setTimeout(() => {
        const el = document.getElementById(`timeline-day-${dayKey}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 80);

      // 5. Clear highlight after defined duration
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedDayKey(null);
      }, HIGHLIGHT_DURATION_MS);
    },
    [isTimelineExpanded],
  );

  // ── Back navigation ──
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

  // ── Render ──
  return (
    <Container
      maxW="100%"
      w="100%"
      minW={0}
      overflowX="hidden"
      bg={bgColor}
      minH="100vh"
      py={8}
      px={{ base: 3, md: 6 }}
    >
      {/* Header */}
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
            Resumen, gráficas, línea de tiempo y tabla completa de las tareas
            predichas.
          </Text>
        </Box>

        <Button
          leftIcon={<FiSliders />}
          onClick={() => void navigate({ to: "/predictions-advanced" })}
          colorScheme="purple"
        >
          Avanzado
        </Button>
      </Flex>

      {/* Cached prediction banner */}
      {cachedPrediction && (
        <Card borderRadius="xl" boxShadow="sm" bg={cardBg} mb={5}>
          <CardBody>
            <Flex gap={3} wrap="wrap" align="center">
              <Badge colorScheme="green">Última predicción</Badge>
              <Text fontSize="sm" color="gray.600">
                {cachedPrediction.generated_count ??
                  cachedPrediction.data?.length ??
                  0}{" "}
                tarea(s)
                {cachedPrediction.weeks_ahead
                  ? ` · ${cachedPrediction.weeks_ahead} semana(s)`
                  : ""}
                {cachedPrediction.data_source
                  ? ` · fuente: ${cachedPrediction.data_source}`
                  : ""}
                {cachedPrediction.saved_at
                  ? ` · guardada: ${formatDateTime(new Date(cachedPrediction.saved_at).getTime())}`
                  : ""}
              </Text>
              {cachedPrediction.predicted_file && (
                <Badge variant="outline">
                  {cachedPrediction.predicted_file}
                </Badge>
              )}
              {cachedPrediction.combined_file && (
                <Badge variant="outline">
                  {cachedPrediction.combined_file}
                </Badge>
              )}
            </Flex>
          </CardBody>
        </Card>
      )}

      {/* Error banner */}
      {errorMessage && (
        <Card
          borderRadius="xl"
          boxShadow="sm"
          bg="orange.50"
          borderColor="orange.200"
          borderWidth="1px"
          mb={5}
        >
          <CardBody>
            <Text fontSize="sm" color="orange.800">
              {errorMessage}
            </Text>
          </CardBody>
        </Card>
      )}

      {/* Loading / empty / content */}
      {isLoading ? (
        <Flex
          align="center"
          justify="center"
          minH="360px"
          direction="column"
          gap={3}
        >
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
              Genera una predicción desde Real Mode y después vuelve a esta
              pantalla.
            </Text>
            <Button colorScheme="purple" onClick={handleBackToPreviousPage}>
              Ir a predecir
            </Button>
          </CardBody>
        </Card>
      ) : (
        <Flex direction="column" gap={5}>
          {/* Stats */}
          <Grid
            templateColumns={{ base: "1fr", md: "repeat(4, 1fr)" }}
            gap={4}
          >
            <StatCard
              label="Tareas"
              value={stats.total}
              hint="según filtros activos"
            />
            <StatCard
              label="Robots"
              value={stats.robotCount}
              hint="robots con tareas"
            />
            <StatCard
              label="Días"
              value={stats.dayCount}
              hint="días con actividad"
            />
            <StatCard
              label="Duración media"
              value={formatDuration(stats.avgDuration)}
              hint="por tarea"
            />
          </Grid>

          {/* Filters */}
          <Card borderRadius="xl" boxShadow="sm" bg={cardBg}>
            <CardBody>
              <Flex justify="space-between" gap={4} wrap="wrap" align="end">
                <Box minW={{ base: "100%", md: "220px" }}>
                  <Text
                    fontSize="xs"
                    fontWeight="700"
                    color="gray.500"
                    mb={1}
                  >
                    Robot
                  </Text>
                  <Select
                    value={selectedRobot}
                    onChange={(e) => setSelectedRobot(e.target.value)}
                  >
                    <option value={ALL_VALUE}>Todos los robots</option>
                    {robotOptions.map((robot) => (
                      <option key={robot.uid} value={robot.uid}>
                        {robot.name}
                      </option>
                    ))}
                  </Select>
                </Box>

                <Box minW={{ base: "100%", md: "220px" }}>
                  <Text
                    fontSize="xs"
                    fontWeight="700"
                    color="gray.500"
                    mb={1}
                  >
                    Tipo de tarea
                  </Text>
                  <Select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                  >
                    <option value={ALL_VALUE}>Todos los tipos</option>
                    {typeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </Box>

                <Box minW={{ base: "100%", md: "220px" }}>
                  <Text
                    fontSize="xs"
                    fontWeight="700"
                    color="gray.500"
                    mb={1}
                  >
                    Filtro temporal
                  </Text>
                  <Select
                    value={dateFilterMode}
                    onChange={(e) =>
                      handleDateFilterModeChange(
                        e.target.value as DateFilterMode,
                      )
                    }
                  >
                    <option value="all">Todo el rango</option>
                    <option value="week">Una semana</option>
                    <option value="days">Varios días</option>
                  </Select>
                </Box>

                {dateFilterMode === "week" && (
                  <Box minW={{ base: "100%", md: "300px" }}>
                    <Text
                      fontSize="xs"
                      fontWeight="700"
                      color="gray.500"
                      mb={1}
                    >
                      Semana
                    </Text>
                    <Select
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value)}
                    >
                      <option value={ALL_VALUE}>Todas las semanas</option>
                      {weekOptions.map((week) => (
                        <option key={week.key} value={week.key}>
                          {week.label} · {week.taskCount} tarea(s)
                        </option>
                      ))}
                    </Select>
                  </Box>
                )}

                {dateFilterMode === "days" && (
                  <Box minW={{ base: "100%", md: "420px" }} flex="1">
                    <Flex
                      justify="space-between"
                      align="center"
                      gap={3}
                      mb={1}
                    >
                      <Text
                        fontSize="xs"
                        fontWeight="700"
                        color="gray.500"
                      >
                        Días seleccionados
                      </Text>
                      {selectedDayKeys.length > 0 && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setSelectedDayKeys([])}
                        >
                          Limpiar días
                        </Button>
                      )}
                    </Flex>
                    <Flex gap={2} wrap="wrap">
                      {dayOptions.map((day) => {
                        const isSelected = selectedDayKeys.includes(day.key);
                        return (
                          <Button
                            key={day.key}
                            size="sm"
                            variant={isSelected ? "solid" : "outline"}
                            colorScheme={isSelected ? "purple" : undefined}
                            onClick={() => toggleSelectedDay(day.key)}
                          >
                            {day.label}
                          </Button>
                        );
                      })}
                    </Flex>
                    {selectedDayKeys.length === 0 && (
                      <Text fontSize="xs" color="gray.500" mt={2}>
                        Selecciona uno o varios días; si no seleccionas ninguno,
                        se mantiene todo el rango visible.
                      </Text>
                    )}
                  </Box>
                )}

                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedRobot(ALL_VALUE);
                    setSelectedType(ALL_VALUE);
                    setDateFilterMode("all");
                    setSelectedWeek(ALL_VALUE);
                    setSelectedDayKeys([]);
                  }}
                >
                  Limpiar filtros
                </Button>
              </Flex>

              <Box mt={4} color="gray.500" fontSize="sm">
                <Text>
                  Rango temporal:{" "}
                  <strong>{stats.rangeLabel}</strong>
                </Text>
                <Text>
                  Duración total estimada:{" "}
                  <strong>{formatDuration(stats.totalDuration)}</strong>
                  {stats.totalMileage > 0
                    ? ` · mileage total: ${stats.totalMileage.toFixed(2)}`
                    : ""}
                  {stats.totalWaypoints > 0
                    ? ` · waypoints: ${stats.totalWaypoints}`
                    : ""}
                </Text>
                <Text>
                  Robot más usado:{" "}
                  <strong>{topRobot?.label ?? "Sin dato"}</strong>
                  {topRobot ? ` (${topRobot.value} tarea(s))` : ""} · Tipo más
                  frecuente:{" "}
                  <strong>{topType?.label ?? "Sin dato"}</strong>
                  {topType ? ` (${topType.value})` : ""} · Día con más carga:{" "}
                  <strong>{busiestDay?.label ?? "Sin dato"}</strong>
                  {busiestDay ? ` (${busiestDay.value})` : ""}
                </Text>
              </Box>
            </CardBody>
          </Card>

          {/* Daily multi-line chart — one coloured series per robot */}
          <DailyRobotLineChart
            title="Evolución diaria de tareas por robot"
            data={tasksByDay}
            onDayClick={handleChartDayClick}
          />

          {/* Bar charts */}
          <Grid
            templateColumns={{ base: "1fr", xl: "repeat(2, 1fr)" }}
            gap={5}
          >
            <HorizontalBarChart
              title="Tareas por robot"
              data={tasksByRobot}
            />

            <StackedHorizontalBarChart
              title="Tareas por tipo y robot"
              data={tasksByType}
            />

            <HorizontalBarChart
              title="Carga estimada por robot"
              data={durationByRobot}
            />

            <HourlyStackedChart
              tasks={filteredTasks}
              robotColorMap={robotColorMap}
            />
          </Grid>


          {/* Timeline — expanded state and highlight are driven from above */}
          <Box overflowX="auto">
            <WeekTimeline
              tasks={filteredTasks}
              highlightedDayKey={highlightedDayKey}
              isExpanded={isTimelineExpanded}
              onToggleExpanded={() =>
                setIsTimelineExpanded((v) => !v)
              }
              robotColorMap={robotColorMap} 
            />
          </Box>

          {/* Full task table */}
          <Card borderRadius="xl" boxShadow="sm" bg={cardBg}>
            <CardBody>
              <Flex
                justify="space-between"
                align="center"
                gap={3}
                mb={isPredictedTasksTableVisible ? 4 : 0}
              >
                <Heading size="sm">
                  Tabla completa de tareas predichas
                </Heading>
                <ToggleContentButton
                  isOpen={isPredictedTasksTableVisible}
                  onToggle={() =>
                    setIsPredictedTasksTableVisible((v) => !v)
                  }
                />
              </Flex>

              {isPredictedTasksTableVisible && (
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
                          <Td whiteSpace="nowrap">
                            {formatDateTime(task.startMs)}
                          </Td>
                          <Td whiteSpace="nowrap">
                            {formatDateTime(task.endMs)}
                          </Td>
                          <Td>{formatDuration(task.durationMinutes)}</Td>
                          <Td>{task.robotName}</Td>
                          <Td>
                            <Badge colorScheme={robotColorMap.get(task.robotUid)?.colorScheme ?? "purple"}>
                              {task.taskType}
                            </Badge>
                          </Td>
                          <Td>{task.status}</Td>
                          <Td>{task.weekOffset ?? "-"}</Td>
                          <Td>{task.waypointCount}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              )}
            </CardBody>
          </Card>
        </Flex>
      )}
    </Container>
  );
}