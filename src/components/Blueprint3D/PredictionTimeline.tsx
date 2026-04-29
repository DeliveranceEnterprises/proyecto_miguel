import React, { useEffect, useMemo, useState } from "react";
import { Badge, Box, Button, Flex, Select, Text } from "@chakra-ui/react";
import { FiClock, FiX } from "react-icons/fi";
import { DevicesService, type DevicePublic } from "../../client";
import { useOrganizationContext } from "../../hooks/useOrganizationContext";
import type { PredictedTaskRecord } from "../../services/predictionService";

interface PredictionTimelineProps {
  isVisible: boolean;
  tasks: PredictedTaskRecord[];
  onClose: () => void;
}

type TimelineTask = {
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
};

const UNKNOWN_ROBOT = "__unknown_robot__";
const ALL_ROBOTS = "__all__";
const STEP_MS = 5 * 60 * 1000;
const FALLBACK_DURATION_MS = 30 * 60 * 1000;

function formatDateTime(value: number): string {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDurationMinutes(startMs: number, endMs: number): number {
  return Math.max(1, Math.round((endMs - startMs) / 60000));
}

export default function PredictionTimeline({
  isVisible,
  tasks,
  onClose,
}: PredictionTimelineProps) {
  const { activeOrganizationContext } = useOrganizationContext();
  const activeOrganizationId = activeOrganizationContext?.uid ?? null;

  const [devices, setDevices] = useState<DevicePublic[]>([]);
  const [selectedRobot, setSelectedRobot] = useState<string>(ALL_ROBOTS);
  const [cursorMs, setCursorMs] = useState<number | null>(null);

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

  const timelineTasks = useMemo<TimelineTask[]>(() => {
    return tasks
      .map((task, index) => {
        const startMs = new Date(task.start_time).getTime();
        const rawEndMs = task.end_time ? new Date(task.end_time).getTime() : NaN;

        if (!Number.isFinite(startMs)) {
          return null;
        }

        const endMs =
          Number.isFinite(rawEndMs) && rawEndMs > startMs
            ? rawEndMs
            : startMs + FALLBACK_DURATION_MS;

        const robotUid = task.device_uid || UNKNOWN_ROBOT;
        const robotName =
          deviceNameByUid.get(robotUid) ||
          (robotUid === UNKNOWN_ROBOT ? "Sin robot" : robotUid.slice(0, 8));
        const taskType = task.type || "Task";
        const taskName = task.task_name || taskType || "Predicted task";

        return {
          id:
            task.uid ||
            `${robotUid}-${taskType}-${task.start_time}-${task.end_time ?? "no-end"}-${index}`,
          robotUid,
          robotName,
          taskType,
          taskName,
          status: task.status || "Scheduled",
          startMs,
          endMs,
          durationMinutes: getDurationMinutes(startMs, endMs),
          startTime: task.start_time,
          endTime: task.end_time,
        };
      })
      .filter((task): task is TimelineTask => task !== null)
      .sort((a, b) => a.startMs - b.startMs);
  }, [tasks, deviceNameByUid]);

  const bounds = useMemo(() => {
    if (timelineTasks.length === 0) {
      return null;
    }

    const minStart = Math.min(...timelineTasks.map((task) => task.startMs));
    const maxEnd = Math.max(...timelineTasks.map((task) => task.endMs));
    const paddedMin = minStart - 15 * 60 * 1000;
    const paddedMax = maxEnd + 15 * 60 * 1000;

    return {
      min: paddedMin,
      max: paddedMax > paddedMin ? paddedMax : paddedMin + 60 * 60 * 1000,
    };
  }, [timelineTasks]);

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

  const robotOptions = useMemo(() => {
    const unique = new Map<string, string>();

    timelineTasks.forEach((task) => {
      unique.set(task.robotUid, task.robotName);
    });

    return Array.from(unique.entries())
      .map(([uid, name]) => ({ uid, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [timelineTasks]);

  const visibleTasks = useMemo(() => {
    if (selectedRobot === ALL_ROBOTS) {
      return timelineTasks;
    }

    return timelineTasks.filter((task) => task.robotUid === selectedRobot);
  }, [timelineTasks, selectedRobot]);

  const visibleRows = useMemo(() => {
    if (selectedRobot !== ALL_ROBOTS) {
      const robot = robotOptions.find((item) => item.uid === selectedRobot);
      return robot ? [robot] : [];
    }

    return robotOptions;
  }, [selectedRobot, robotOptions]);

  const activeTasks = useMemo(() => {
    if (cursorMs === null) return [];

    return visibleTasks.filter(
      (task) => task.startMs <= cursorMs && cursorMs < task.endMs
    );
  }, [visibleTasks, cursorMs]);

  if (!isVisible || timelineTasks.length === 0 || !bounds || cursorMs === null) {
    return null;
  }

  const totalMs = bounds.max - bounds.min;
  const cursorPct = ((cursorMs - bounds.min) / totalMs) * 100;

  const getLeftPct = (task: TimelineTask) =>
    ((task.startMs - bounds.min) / totalMs) * 100;

  const getWidthPct = (task: TimelineTask) =>
    Math.max(((task.endMs - task.startMs) / totalMs) * 100, 0.8);

  return (
    <Box
      position="absolute"
      left={4}
      right={4}
      bottom={4}
      zIndex={35}
      bg="rgba(10,18,35,0.96)"
      color="white"
      border="1px solid rgba(167,139,250,0.22)"
      borderRadius="14px"
      boxShadow="0 18px 45px rgba(0,0,0,0.45)"
      p={4}
      pointerEvents="auto"
      onMouseDown={(event) => event.stopPropagation()}
      onMouseUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <Flex justify="space-between" align="center" mb={3} gap={3}>
        <Box>
          <Text
            fontSize="xs"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing="0.08em"
            color="purple.200"
          >
            Línea de tiempo de predicción
          </Text>
          <Text fontSize="xs" color="whiteAlpha.700">
            {visibleTasks.length} tarea(s) visibles · cursor en {formatDateTime(cursorMs)}
          </Text>
        </Box>

        <Flex align="center" gap={2}>
          <Select
            size="sm"
            value={selectedRobot}
            onChange={(event) => setSelectedRobot(event.target.value)}
            bg="rgba(255,255,255,0.08)"
            borderColor="rgba(255,255,255,0.16)"
            color="white"
            width="220px"
          >
            <option value={ALL_ROBOTS}>Todos los robots</option>
            {robotOptions.map((robot) => (
              <option key={robot.uid} value={robot.uid}>
                {robot.name}
              </option>
            ))}
          </Select>

          <Button size="sm" variant="ghost" color="white" onClick={onClose}>
            <FiX />
          </Button>
        </Flex>
      </Flex>

      <Box mb={3}>
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={STEP_MS}
          value={cursorMs}
          onChange={(event) => setCursorMs(Number(event.target.value))}
          style={{ width: "100%" }}
        />

        <Flex justify="space-between" fontSize="10px" color="whiteAlpha.600">
          <span>{formatDateTime(bounds.min)}</span>
          <span>{formatDateTime(bounds.max)}</span>
        </Flex>
      </Box>

      <Box
        overflowX="auto"
        border="1px solid rgba(255,255,255,0.10)"
        borderRadius="10px"
        bg="rgba(255,255,255,0.04)"
        maxHeight="280px"
        overflowY="auto"
      >
        <Box minWidth="980px" position="relative" py={2}>
          <Box
            position="absolute"
            top={0}
            bottom={0}
            left={`${cursorPct}%`}
            width="2px"
            bg="purple.300"
            zIndex={5}
            boxShadow="0 0 10px rgba(216,180,254,0.9)"
          />

          {visibleRows.map((robot) => {
            const rowTasks = visibleTasks.filter(
              (task) => task.robotUid === robot.uid
            );

            return (
              <Flex
                key={robot.uid}
                align="center"
                minHeight="46px"
                borderBottom="1px solid rgba(255,255,255,0.08)"
              >
                <Box
                  flex="0 0 160px"
                  px={3}
                  fontSize="xs"
                  color="whiteAlpha.800"
                  fontWeight="600"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {robot.name}
                </Box>

                <Box flex="1" position="relative" height="34px">
                  {rowTasks.map((task) => (
                    <Box
                      key={task.id}
                      position="absolute"
                      top="5px"
                      left={`${getLeftPct(task)}%`}
                      width={`${getWidthPct(task)}%`}
                      minWidth="42px"
                      height="24px"
                      borderRadius="7px"
                      bg="linear-gradient(135deg, #7C3AED, #C084FC)"
                      px={2}
                      display="flex"
                      alignItems="center"
                      overflow="hidden"
                      title={`${task.robotName} · ${task.taskName} · ${formatDateTime(
                        task.startMs
                      )} · ${task.durationMinutes} min · ${task.status}`}
                    >
                      <Text
                        fontSize="10px"
                        fontWeight="700"
                        whiteSpace="nowrap"
                        overflow="hidden"
                        textOverflow="ellipsis"
                      >
                        {task.taskType}
                      </Text>
                    </Box>
                  ))}
                </Box>
              </Flex>
            );
          })}
        </Box>
      </Box>

      <Box mt={3}>
        <Text fontSize="xs" color="whiteAlpha.700" mb={2}>
          Tareas activas en este instante
        </Text>

        {activeTasks.length === 0 ? (
          <Text fontSize="xs" color="whiteAlpha.500">
            No hay tareas activas en el instante seleccionado.
          </Text>
        ) : (
          <Flex gap={2} wrap="wrap">
            {activeTasks.map((task) => (
              <Box
                key={task.id}
                border="1px solid rgba(255,255,255,0.14)"
                borderRadius="10px"
                px={3}
                py={2}
                bg="rgba(255,255,255,0.06)"
              >
                <Flex align="center" gap={2} mb={1}>
                  <Badge colorScheme="purple">{task.taskType}</Badge>
                  <Text fontSize="xs" fontWeight="700">
                    {task.robotName}
                  </Text>
                </Flex>

                <Flex fontSize="11px" color="whiteAlpha.700" gap={2} align="center">
                  <FiClock size={11} />
                  <span>
                    {formatTime(task.startMs)} · {task.durationMinutes} min
                  </span>
                </Flex>
              </Box>
            ))}
          </Flex>
        )}
      </Box>
    </Box>
  );
}
