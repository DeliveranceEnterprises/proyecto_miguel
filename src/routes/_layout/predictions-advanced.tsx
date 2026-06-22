import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Container,
  Divider,
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
  Tooltip,
  Tr,
  useColorModeValue,
} from "@chakra-ui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  FiArrowLeft,
  FiBarChart2,
  FiCalendar,
  FiDatabase,
  FiInfo,
  FiRefreshCw,
  FiTrendingUp,
} from "react-icons/fi";
import { DevicesService, type DevicePublic } from "../../client";
import { useOrganizationContext } from "../../hooks/useOrganizationContext";
import {
  getPredictionComparisonData,
  loadLastPredictionResponse,
  type PredictedTaskRecord,
  type PredictionComparisonData,
} from "../../services/predictionService";

export const Route = createFileRoute("/_layout/predictions-advanced")({
  component: PredictionsAdvancedPage,
});

type PredictionSource = "file" | "api";
type BenchmarkMode =
  | "all_history"
  | "recent_4_weeks"
  | "same_month"
  | "same_week_of_month";

type ComparableTask = {
  id: string;
  robotUid: string;
  robotName: string;
  taskType: string;
  taskName: string;
  status: string;
  startMs: number;
  endMs: number;
  durationMinutes: number;
  dayKey: string;
  weekKey: string;
  weekdayIndex: number;
  weekdayLabel: string;
  hour: number;
  raw: PredictedTaskRecord;
};

type NormalizedTasks = {
  tasks: ComparableTask[];
  invalidCount: number;
  fallbackDurationCount: number;
  unknownRobotCount: number;
};

type Summary = {
  total: number;
  weekCount: number;
  weeklyAverage: number;
  robotCount: number;
  typeCount: number;
  totalDuration: number;
  averageDuration: number;
  rangeLabel: string;
};

type ComparisonItem = {
  label: string;
  base: number;
  predicted: number;
  delta: number;
};

type ReferenceSelection = {
  tasks: ComparableTask[];
  denominatorWeeks: number;
  usedFallback: boolean;
  detail: string;
  referenceLabel: string;
};

type PredictionWeekSlice = {
  weekKey: string;
  weekStart: number;
  weekEnd: number;
  label: string;
  tasks: ComparableTask[];
};

type WeekComparisonRow = {
  weekKey: string;
  label: string;
  dateRange: string;
  predictedTotal: number;
  referenceAverage: number;
  delta: number;
  deltaPercent: number | null;
  predictedDuration: number;
  referenceDurationAverage: number;
  referenceWeeks: number;
  usedFallback: boolean;
  referenceLabel: string;
};

type SmartStatus = "sin_ref" | "normal" | "bajo" | "alto" | "muy_bajo" | "muy_alto";
type SmartValueKind = "count" | "minutes";

type DistributionStats = {
  count: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  average: number;
  iqr: number;
  lowerFence: number;
  upperFence: number;
};

type SmartMetric = {
  label: string;
  valueKind: SmartValueKind;
  predicted: number;
  stats: DistributionStats | null;
  status: SmartStatus;
  deltaVsMedian: number | null;
  percentile: number | null;
};

type SmartDayRow = {
  label: string;
  weekdayLabel: string;
  predicted: number;
  stats: DistributionStats | null;
  status: SmartStatus;
  deltaVsMedian: number | null;
};

type SmartComparisonAnalysis = {
  totalTasks: SmartMetric;
  totalDuration: SmartMetric;
  averageTaskDuration: SmartMetric;
  dailyRows: SmartDayRow[];
  insights: string[];
  referenceWeeks: number;
};

// ─── constants ────────────────────────────────────────────────────────────────
const UNKNOWN_ROBOT = "__unknown_robot__";
const FALLBACK_DURATION_MS = 30 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) =>
  `${String(hour).padStart(2, "0")}:00`,
);

const BENCHMARK_MODE_LABELS: Record<BenchmarkMode, string> = {
  all_history: "Todo el histórico",
  recent_4_weeks: "Últimas 4 semanas",
  same_month: "Mismo mes histórico",
  same_week_of_month: "Misma semana del mes",
};

const BENCHMARK_MODE_DESCRIPTIONS: Record<BenchmarkMode, string> = {
  all_history:
    "Usa todo el histórico anterior a esa semana como referencia: media, mediana, rango normal y casos extremos.",
  recent_4_weeks:
    "Usa las 4 semanas naturales inmediatamente anteriores. Las semanas sin tareas cuentan como cero.",
  same_month:
    "Usa semanas históricas del mismo mes natural. Útil para estacionalidad mensual.",
  same_week_of_month:
    "Usa semanas históricas con la misma posición en el mes (1ª, 2ª, 3ª, 4ª o 5ª semana).",
};

const SMART_STATUS_LABELS: Record<SmartStatus, string> = {
  sin_ref: "Sin referencia",
  normal: "Normal",
  bajo: "Bajo",
  alto: "Alto",
  muy_bajo: "Muy bajo",
  muy_alto: "Muy alto",
};

const SMART_STATUS_COLOR_SCHEMES: Record<SmartStatus, string> = {
  sin_ref: "gray",
  normal: "green",
  bajo: "orange",
  alto: "purple",
  muy_bajo: "red",
  muy_alto: "red",
};

// ─── pure utility functions ───────────────────────────────────────────────────
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function getLocalDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function getLocalWeekStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.getTime();
}
function getLocalWeekKey(ms: number): string {
  return getLocalDayKey(getLocalWeekStart(ms));
}
function getMondayBasedWeekday(ms: number): number {
  const jsDay = new Date(ms).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}
function getWeekOfMonth(ms: number): number {
  return Math.ceil(new Date(ms).getDate() / 7);
}
function getRange(tasks: ComparableTask[]): { start: number; end: number } | null {
  if (!tasks.length) return null;
  return {
    start: Math.min(...tasks.map((t) => t.startMs)),
    end: Math.max(...tasks.map((t) => t.endMs)),
  };
}
function countDistinctWeeks(tasks: ComparableTask[]): number {
  return new Set(tasks.map((t) => t.weekKey)).size;
}
function countCalendarWeeksForTasks(tasks: ComparableTask[]): number {
  const r = getRange(tasks);
  if (!r) return 1;
  const startWeek = getLocalWeekStart(r.start);
  const endWeek = getLocalWeekStart(Math.max(r.start, r.end - 1));
  return Math.max(1, Math.floor((endWeek - startWeek) / WEEK_MS) + 1);
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function formatShortDayDate(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAY_LABELS[getMondayBasedWeekday(ms)]} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}
function formatWeekRange(weekStart: number): string {
  return `${formatDate(weekStart)} → ${formatDate(weekStart + WEEK_MS - 1)}`;
}
function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) return "–";
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  if (abs < 60) return `${sign}${Math.round(abs)} min`;
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return m === 0 ? `${sign}${h} h` : `${sign}${h} h ${m} min`;
}
function formatNumber(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return "–";
  if (Math.abs(v) >= 100 || Number.isInteger(v)) return v.toFixed(0);
  return v.toFixed(digits);
}
function formatDelta(v: number): string {
  if (!Number.isFinite(v)) return "–";
  return `${v > 0 ? "+" : ""}${formatNumber(v)}`;
}
function formatPercent(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "–";
  return `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
}

function formatSmartValue(kind: SmartValueKind, v: number): string {
  return kind === "minutes" ? formatDuration(v) : formatNumber(v);
}

function formatRangeValue(kind: SmartValueKind, a: number, b: number): string {
  return `${formatSmartValue(kind, a)}–${formatSmartValue(kind, b)}`;
}

function getTaskRobotName(uid: string, map: Map<string, string>): string {
  if (uid === UNKNOWN_ROBOT) return "Sin robot";
  return map.get(uid) || uid.slice(0, 8);
}

// ─── normalization ────────────────────────────────────────────────────────────
function normalizeTasks(
  tasks: PredictedTaskRecord[],
  deviceNameByUid: Map<string, string>,
): NormalizedTasks {
  let invalidCount = 0;
  let fallbackDurationCount = 0;
  let unknownRobotCount = 0;

  const normalized = tasks
    .map((task, i) => {
      const startMs = new Date(task.start_time).getTime();
      const parsedEnd = task.end_time ? new Date(task.end_time).getTime() : NaN;
      if (!Number.isFinite(startMs)) {
        invalidCount++;
        return null;
      }
      const needsFallback = !Number.isFinite(parsedEnd) || parsedEnd <= startMs;
      const endMs = needsFallback ? startMs + FALLBACK_DURATION_MS : parsedEnd;
      if (needsFallback) fallbackDurationCount++;

      const robotUid = task.device_uid || UNKNOWN_ROBOT;
      if (robotUid === UNKNOWN_ROBOT || !deviceNameByUid.has(robotUid))
        unknownRobotCount++;

      const taskType = task.type || "Task";
      const weekdayIndex = getMondayBasedWeekday(startMs);
      return {
        id:
          task.uid ||
          `${robotUid}-${taskType}-${task.start_time}-${task.end_time ?? "x"}-${i}`,
        robotUid,
        robotName: getTaskRobotName(robotUid, deviceNameByUid),
        taskType,
        taskName: task.task_name || taskType,
        status: task.status || "Scheduled",
        startMs,
        endMs,
        durationMinutes: Math.max(1, Math.round((endMs - startMs) / 60000)),
        dayKey: getLocalDayKey(startMs),
        weekKey: getLocalWeekKey(startMs),
        weekdayIndex,
        weekdayLabel: WEEKDAY_LABELS[weekdayIndex],
        hour: new Date(startMs).getHours(),
        raw: task,
      } satisfies ComparableTask;
    })
    .filter((t): t is ComparableTask => t !== null)
    .sort((a, b) => a.startMs - b.startMs);

  return { tasks: normalized, invalidCount, fallbackDurationCount, unknownRobotCount };
}

function buildSummary(tasks: ComparableTask[], denominatorWeeks?: number): Summary {
  const weekCount = Math.max(1, denominatorWeeks ?? countCalendarWeeksForTasks(tasks));
  const totalDuration = tasks.reduce((s, t) => s + t.durationMinutes, 0);
  const minStart = tasks.length ? Math.min(...tasks.map((t) => t.startMs)) : null;
  const maxEnd = tasks.length ? Math.max(...tasks.map((t) => t.endMs)) : null;
  return {
    total: tasks.length,
    weekCount,
    weeklyAverage: tasks.length / weekCount,
    robotCount: new Set(tasks.map((t) => t.robotUid)).size,
    typeCount: new Set(tasks.map((t) => t.taskType)).size,
    totalDuration,
    averageDuration: tasks.length ? totalDuration / tasks.length : 0,
    rangeLabel:
      minStart != null && maxEnd != null
        ? `${formatDate(minStart)} → ${formatDate(maxEnd)}`
        : "Sin rango",
  };
}

function averageCountBy(
  tasks: ComparableTask[],
  denominatorWeeks: number,
  getKey: (t: ComparableTask) => string,
): Map<string, number> {
  const map = new Map<string, number>();
  tasks.forEach((t) => {
    const k = getKey(t) || "Sin dato";
    map.set(k, (map.get(k) ?? 0) + 1);
  });
  map.forEach((v, k) => map.set(k, v / Math.max(1, denominatorWeeks)));
  return map;
}

function buildComparisonItems(
  baseTasks: ComparableTask[],
  predictedTasks: ComparableTask[],
  baseDenomWeeks: number,
  predictedDenomWeeks: number,
  getKey: (t: ComparableTask) => string,
  opts?: { labels?: string[]; limit?: number },
): ComparisonItem[] {
  const baseMap = averageCountBy(baseTasks, baseDenomWeeks, getKey);
  const predMap = averageCountBy(predictedTasks, predictedDenomWeeks, getKey);
  const labels =
    opts?.labels ?? Array.from(new Set([...baseMap.keys(), ...predMap.keys()]));
  return labels
    .map((label) => {
      const base = baseMap.get(label) ?? 0;
      const predicted = predMap.get(label) ?? 0;
      return { label, base, predicted, delta: predicted - base };
    })
    .sort((a, b) => Math.max(b.base, b.predicted) - Math.max(a.base, a.predicted))
    .slice(0, opts?.limit ?? labels.length);
}

function addLocalDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

function buildDailyEvolutionComparison(
  referenceTasks: ComparableTask[],
  predictedWeekTasks: ComparableTask[],
  referenceDenominatorWeeks: number,
  predictionWeekStart: number,
): ComparisonItem[] {
  const denominator = Math.max(1, referenceDenominatorWeeks);

  return WEEKDAY_LABELS.map((_, weekdayIndex) => {
    const dayStart = addLocalDays(predictionWeekStart, weekdayIndex);
    const dayEnd = addLocalDays(dayStart, 1);
    const predicted = predictedWeekTasks.filter(
      (task) => task.startMs >= dayStart && task.startMs < dayEnd,
    ).length;
    const base =
      referenceTasks.filter((task) => task.weekdayIndex === weekdayIndex).length /
      denominator;

    return {
      label: formatShortDayDate(dayStart),
      base,
      predicted,
      delta: predicted - base,
    };
  });
}

function quantile(sortedValues: number[], q: number): number {
  if (!sortedValues.length) return 0;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedValues[base + 1];
  return next === undefined
    ? sortedValues[base]
    : sortedValues[base] + rest * (next - sortedValues[base]);
}

function buildDistributionStats(values: number[]): DistributionStats | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const q1 = quantile(clean, 0.25);
  const median = quantile(clean, 0.5);
  const q3 = quantile(clean, 0.75);
  const iqr = q3 - q1;
  return {
    count: clean.length,
    min: clean[0],
    q1,
    median,
    q3,
    max: clean[clean.length - 1],
    average: clean.reduce((s, v) => s + v, 0) / clean.length,
    iqr,
    lowerFence: q1 - 1.5 * iqr,
    upperFence: q3 + 1.5 * iqr,
  };
}

function percentileRank(value: number, values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) return null;
  const belowOrEqual = clean.filter((v) => v <= value).length;
  return Math.round((belowOrEqual / clean.length) * 100);
}

function classifySmartValue(value: number, stats: DistributionStats | null): SmartStatus {
  if (!stats) return "sin_ref";

  if (stats.count < 3) {
    const tolerance = Math.max(2, Math.abs(stats.average) * 0.25);
    if (value > stats.average + tolerance) return "alto";
    if (value < stats.average - tolerance) return "bajo";
    return "normal";
  }

  if (stats.iqr === 0) {
    if (value === stats.median) return "normal";
    const extremeGap = Math.max(3, Math.abs(stats.median) * 0.5);
    if (value > stats.median + extremeGap) return "muy_alto";
    if (value < stats.median - extremeGap) return "muy_bajo";
    return value > stats.median ? "alto" : "bajo";
  }

  if (value > stats.upperFence) return "muy_alto";
  if (value < stats.lowerFence) return "muy_bajo";
  if (value > stats.q3) return "alto";
  if (value < stats.q1) return "bajo";
  return "normal";
}

function buildSmartMetric(
  label: string,
  valueKind: SmartValueKind,
  predicted: number,
  referenceValues: number[],
): SmartMetric {
  const stats = buildDistributionStats(referenceValues);
  return {
    label,
    valueKind,
    predicted,
    stats,
    status: classifySmartValue(predicted, stats),
    deltaVsMedian: stats ? predicted - stats.median : null,
    percentile: percentileRank(predicted, referenceValues),
  };
}

function getTasksInWeek(tasks: ComparableTask[], weekStart: number): ComparableTask[] {
  const weekEnd = weekStart + WEEK_MS;
  return tasks.filter((t) => t.startMs >= weekStart && t.startMs < weekEnd);
}

function getUniqueWeekStarts(tasks: ComparableTask[]): number[] {
  return Array.from(new Set(tasks.map((t) => getLocalWeekStart(t.startMs)))).sort(
    (a, b) => a - b,
  );
}

function buildReferenceWeekStarts(
  baseTasks: ComparableTask[],
  predictionWeekStart: number,
  mode: BenchmarkMode,
  selection: ReferenceSelection,
): number[] {
  if (mode === "recent_4_weeks" && !selection.usedFallback) {
    return Array.from({ length: 4 }, (_, i) => predictionWeekStart - (4 - i) * WEEK_MS);
  }

  if (mode === "all_history" || selection.usedFallback) {
    const baseBeforeWeek = baseTasks.filter((t) => t.startMs < predictionWeekStart);
    const range = getRange(baseBeforeWeek);
    if (!range) return [];
    const firstWeek = getLocalWeekStart(range.start);
    const lastWeek = predictionWeekStart - WEEK_MS;
    const weeks: number[] = [];
    for (let ws = firstWeek; ws <= lastWeek; ws += WEEK_MS) weeks.push(ws);
    return weeks;
  }

  return getUniqueWeekStarts(selection.tasks);
}

function buildSmartDailyRows(
  referenceTasks: ComparableTask[],
  predictedWeekTasks: ComparableTask[],
  referenceWeekStarts: number[],
  predictionWeekStart: number,
): SmartDayRow[] {
  return WEEKDAY_LABELS.map((weekdayLabel, weekdayIndex) => {
    const dayStart = addLocalDays(predictionWeekStart, weekdayIndex);
    const dayEnd = addLocalDays(dayStart, 1);
    const predicted = predictedWeekTasks.filter(
      (task) => task.startMs >= dayStart && task.startMs < dayEnd,
    ).length;
    const referenceValues = referenceWeekStarts.map((weekStart) => {
      const refDayStart = addLocalDays(weekStart, weekdayIndex);
      const refDayEnd = addLocalDays(refDayStart, 1);
      return referenceTasks.filter(
        (task) => task.startMs >= refDayStart && task.startMs < refDayEnd,
      ).length;
    });
    const stats = buildDistributionStats(referenceValues);
    return {
      label: formatShortDayDate(dayStart),
      weekdayLabel,
      predicted,
      stats,
      status: classifySmartValue(predicted, stats),
      deltaVsMedian: stats ? predicted - stats.median : null,
    };
  });
}

function buildSmartComparisonAnalysis(
  referenceTasks: ComparableTask[],
  predictedWeekTasks: ComparableTask[],
  referenceWeekStarts: number[],
  predictionWeekStart: number,
): SmartComparisonAnalysis {
  const weekStarts = referenceWeekStarts.length
    ? referenceWeekStarts
    : getUniqueWeekStarts(referenceTasks);

  const weeklyTaskCounts = weekStarts.map((ws) => getTasksInWeek(referenceTasks, ws).length);
  const weeklyDurations = weekStarts.map((ws) =>
    getTasksInWeek(referenceTasks, ws).reduce((s, t) => s + t.durationMinutes, 0),
  );
  const weeklyAverageDurations = weekStarts.map((ws) => {
    const weekTasks = getTasksInWeek(referenceTasks, ws);
    if (!weekTasks.length) return 0;
    return weekTasks.reduce((s, t) => s + t.durationMinutes, 0) / weekTasks.length;
  });

  const predictedDuration = predictedWeekTasks.reduce((s, t) => s + t.durationMinutes, 0);
  const predictedAverageDuration = predictedWeekTasks.length
    ? predictedDuration / predictedWeekTasks.length
    : 0;

  const totalTasks = buildSmartMetric(
    "Volumen de tareas",
    "count",
    predictedWeekTasks.length,
    weeklyTaskCounts,
  );
  const totalDuration = buildSmartMetric(
    "Carga total",
    "minutes",
    predictedDuration,
    weeklyDurations,
  );
  const averageTaskDuration = buildSmartMetric(
    "Duración media por tarea",
    "minutes",
    predictedAverageDuration,
    weeklyAverageDurations,
  );
  const dailyRows = buildSmartDailyRows(
    referenceTasks,
    predictedWeekTasks,
    weekStarts,
    predictionWeekStart,
  );

  const insights: string[] = [];
  if (!weekStarts.length) {
    insights.push("No hay semanas históricas comparables suficientes para construir una distribución.");
  } else if (weekStarts.length < 4) {
    insights.push(`La referencia usa solo ${weekStarts.length} semana(s); interpreta el semáforo con cautela.`);
  }

  if (totalTasks.stats) {
    const delta = totalTasks.predicted - totalTasks.stats.median;
    if (totalTasks.status === "normal") {
      insights.push("El volumen total cae dentro del rango habitual de semanas comparables.");
    } else {
      insights.push(
        `El volumen total está ${delta >= 0 ? "por encima" : "por debajo"} de la mediana histórica en ${formatDelta(delta)} tarea(s).`,
      );
    }
  }

  const unusualDays = dailyRows
    .filter((row) => row.status !== "normal" && row.status !== "sin_ref")
    .sort((a, b) => Math.abs(b.deltaVsMedian ?? 0) - Math.abs(a.deltaVsMedian ?? 0))
    .slice(0, 3);
  if (unusualDays.length) {
    insights.push(
      `Días que más explican la diferencia: ${unusualDays
        .map((row) => `${row.weekdayLabel} (${formatDelta(row.deltaVsMedian ?? 0)})`)
        .join(", ")}.`,
    );
  } else if (dailyRows.some((row) => row.stats)) {
    insights.push("La distribución diaria no muestra días claramente fuera de su rango habitual.");
  }

  if (totalDuration.stats && totalDuration.status !== "normal") {
    insights.push(
      `La carga en tiempo está ${totalDuration.predicted >= totalDuration.stats.median ? "por encima" : "por debajo"} de la mediana histórica en ${formatDuration(totalDuration.deltaVsMedian ?? 0)}.`,
    );
  }

  return {
    totalTasks,
    totalDuration,
    averageTaskDuration,
    dailyRows,
    insights,
    referenceWeeks: weekStarts.length,
  };
}

function buildDeltaRows(items: ComparisonItem[], limit = 12): ComparisonItem[] {
  return [...items].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, limit);
}

// ─── week slices ──────────────────────────────────────────────────────────────
function buildPredictionWeekSlices(predictedTasks: ComparableTask[]): PredictionWeekSlice[] {
  const range = getRange(predictedTasks);
  if (!range) return [];
  const firstWeekStart = getLocalWeekStart(range.start);
  const lastWeekStart = getLocalWeekStart(Math.max(range.start, range.end - 1));
  const slices: PredictionWeekSlice[] = [];
  for (let ws = firstWeekStart; ws <= lastWeekStart; ws += WEEK_MS) {
    const we = ws + WEEK_MS;
    slices.push({
      weekKey: getLocalDayKey(ws),
      weekStart: ws,
      weekEnd: we,
      label: `Semana ${slices.length + 1}`,
      tasks: predictedTasks.filter((t) => t.startMs >= ws && t.startMs < we),
    });
  }
  return slices;
}

// ─── reference selection (per-week, no overlap) ───────────────────────────────
function selectReferenceForWeek(
  baseTasks: ComparableTask[],
  predictionWeekStart: number,
  mode: BenchmarkMode,
): ReferenceSelection {
  const baseBeforeWeek = baseTasks.filter((t) => t.startMs < predictionWeekStart);

  if (!baseBeforeWeek.length) {
    return {
      tasks: [],
      denominatorWeeks: 1,
      usedFallback: false,
      detail: "No hay histórico anterior a esta semana predicha.",
      referenceLabel: "Sin histórico anterior",
    };
  }

  const allHistorySelection: ReferenceSelection = {
    tasks: baseBeforeWeek,
    denominatorWeeks: countCalendarWeeksForTasks(baseBeforeWeek),
    usedFallback: false,
    detail: BENCHMARK_MODE_DESCRIPTIONS.all_history,
    referenceLabel: BENCHMARK_MODE_LABELS.all_history,
  };

  if (mode === "all_history") return allHistorySelection;

  let filtered: ComparableTask[] = [];
  let denominatorWeeks = 1;

  if (mode === "recent_4_weeks") {
    const lb = predictionWeekStart - 4 * WEEK_MS;
    filtered = baseBeforeWeek.filter((t) => t.startMs >= lb);
    denominatorWeeks = 4;
  } else if (mode === "same_month") {
    const predMonth = new Date(predictionWeekStart).getMonth();
    filtered = baseBeforeWeek.filter(
      (t) => new Date(t.startMs).getMonth() === predMonth,
    );
    denominatorWeeks = Math.max(1, countDistinctWeeks(filtered));
  } else if (mode === "same_week_of_month") {
    const predWOM = getWeekOfMonth(predictionWeekStart);
    filtered = baseBeforeWeek.filter(
      (t) => getWeekOfMonth(getLocalWeekStart(t.startMs)) === predWOM,
    );
    denominatorWeeks = Math.max(1, countDistinctWeeks(filtered));
  }

  if (!filtered.length) {
    return {
      ...allHistorySelection,
      usedFallback: true,
      detail: `No había datos suficientes para "${BENCHMARK_MODE_LABELS[mode]}". Se usa todo el histórico anterior como respaldo.`,
      referenceLabel: `${BENCHMARK_MODE_LABELS[mode]} → respaldo histórico`,
    };
  }

  return {
    tasks: filtered,
    denominatorWeeks,
    usedFallback: false,
    detail: BENCHMARK_MODE_DESCRIPTIONS[mode],
    referenceLabel: BENCHMARK_MODE_LABELS[mode],
  };
}

// ─── FIXED: global reference uses only the first prediction week as pivot ─────
// This avoids double-counting base tasks across overlapping per-week references.
function buildGlobalReference(
  baseTasks: ComparableTask[],
  weekSlices: PredictionWeekSlice[],
  mode: BenchmarkMode,
): ReferenceSelection {
  if (!weekSlices.length) {
    return {
      tasks: baseTasks,
      denominatorWeeks: countCalendarWeeksForTasks(baseTasks),
      usedFallback: false,
      detail: BENCHMARK_MODE_DESCRIPTIONS[mode],
      referenceLabel: BENCHMARK_MODE_LABELS[mode],
    };
  }
  // Use the start of the FIRST predicted week as the pivot to avoid overlap
  const firstWeekStart = weekSlices[0].weekStart;
  return selectReferenceForWeek(baseTasks, firstWeekStart, mode);
}

function buildWeekComparisonRows(
  baseTasks: ComparableTask[],
  weekSlices: PredictionWeekSlice[],
  mode: BenchmarkMode,
): WeekComparisonRow[] {
  return weekSlices.map((slice) => {
    const ref = selectReferenceForWeek(baseTasks, slice.weekStart, mode);
    const refAvg = ref.tasks.length / Math.max(1, ref.denominatorWeeks);
    const delta = slice.tasks.length - refAvg;
    const deltaPercent = refAvg > 0 ? Math.round((delta / refAvg) * 100) : null;
    const predDur = slice.tasks.reduce((s, t) => s + t.durationMinutes, 0);
    const refDurAvg =
      ref.tasks.reduce((s, t) => s + t.durationMinutes, 0) /
      Math.max(1, ref.denominatorWeeks);

    return {
      weekKey: slice.weekKey,
      label: slice.label,
      dateRange: formatWeekRange(slice.weekStart),
      predictedTotal: slice.tasks.length,
      referenceAverage: refAvg,
      delta,
      deltaPercent,
      predictedDuration: predDur,
      referenceDurationAverage: refDurAvg,
      referenceWeeks: ref.denominatorWeeks,
      usedFallback: ref.usedFallback,
      referenceLabel: ref.referenceLabel,
    };
  });
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────
function linePath(pts: Array<{ x: number; y: number }>): string {
  if (!pts.length) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

// ─── UI components ────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card borderRadius="xl" boxShadow="sm" borderLeft="4px solid" borderLeftColor={accent ? "purple.400" : "gray.200"}>
      <CardBody>
        <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="800" letterSpacing="wider">
          {label}
        </Text>
        <Text fontSize="2xl" fontWeight="900" mt={1} color={accent ? "purple.700" : undefined}>
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

function SmartMetricCard({ metric }: { metric: SmartMetric }) {
  const stats = metric.stats;
  return (
    <Card borderRadius="xl" boxShadow="sm" borderTop="4px solid" borderTopColor={`${SMART_STATUS_COLOR_SCHEMES[metric.status]}.400`}>
      <CardBody>
        <Flex justify="space-between" align="start" gap={3} mb={2}>
          <Text fontSize="xs" color="gray.500" textTransform="uppercase" fontWeight="800" letterSpacing="wider">
            {metric.label}
          </Text>
          <Badge colorScheme={SMART_STATUS_COLOR_SCHEMES[metric.status]}>
            {SMART_STATUS_LABELS[metric.status]}
          </Badge>
        </Flex>
        <Text fontSize="2xl" fontWeight="900">
          {formatSmartValue(metric.valueKind, metric.predicted)}
        </Text>
        {stats ? (
          <Box mt={2}>
            <Text fontSize="sm" color="gray.600">
              Mediana hist.: <strong>{formatSmartValue(metric.valueKind, stats.median)}</strong>
              {metric.deltaVsMedian !== null && (
                <> · Δ mediana: <strong>{formatSmartValue(metric.valueKind, metric.deltaVsMedian)}</strong></>
              )}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              Rango normal Q1–Q3: {formatRangeValue(metric.valueKind, stats.q1, stats.q3)}
              {metric.percentile !== null ? ` · Percentil aprox. ${metric.percentile}` : ""}
            </Text>
          </Box>
        ) : (
          <Text fontSize="sm" color="gray.500" mt={2}>Sin referencia histórica suficiente.</Text>
        )}
      </CardBody>
    </Card>
  );
}

function SmartComparisonPanel({ analysis }: { analysis: SmartComparisonAnalysis }) {
  const metrics = [analysis.totalTasks, analysis.totalDuration, analysis.averageTaskDuration];

  return (
    <Card borderRadius="xl" boxShadow="sm">
      <CardBody>
        <Flex justify="space-between" align="start" gap={4} wrap="wrap" mb={4}>
          <Box>
            <Flex align="center" gap={2}>
              <FiInfo />
              <Heading size="sm">Lectura operativa de la comparación</Heading>
            </Flex>
            <Text fontSize="sm" color="gray.500" mt={1} maxW="820px">
              No usa solo promedios: compara la semana predicha contra la distribución de semanas históricas comparables.
              El rango normal es Q1–Q3; fuera de ese rango se marca como bajo/alto, y fuera de 1,5×IQR como extremo.
            </Text>
          </Box>
          <Badge colorScheme="purple" variant="outline">
            {analysis.referenceWeeks} semana(s) de referencia
          </Badge>
        </Flex>

        <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4} mb={5}>
          {metrics.map((metric) => (
            <SmartMetricCard key={metric.label} metric={metric} />
          ))}
        </Grid>

        {analysis.insights.length > 0 && (
          <Alert status="info" borderRadius="xl" mb={5}>
            <AlertIcon />
            <Box>
              <Text fontWeight="800">Qué mirar primero</Text>
              <Text fontSize="sm">{analysis.insights.join(" ")}</Text>
            </Box>
          </Alert>
        )}

        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Día</Th>
                <Th isNumeric>Predicción</Th>
                <Th isNumeric>Mediana hist.</Th>
                <Th isNumeric>Rango normal</Th>
                <Th isNumeric>Δ mediana</Th>
                <Th>Estado</Th>
              </Tr>
            </Thead>
            <Tbody>
              {analysis.dailyRows.map((row) => (
                <Tr key={row.label}>
                  <Td fontWeight="700">{row.label}</Td>
                  <Td isNumeric>{row.predicted}</Td>
                  <Td isNumeric>{row.stats ? formatNumber(row.stats.median) : "–"}</Td>
                  <Td isNumeric>{row.stats ? formatRangeValue("count", row.stats.q1, row.stats.q3) : "–"}</Td>
                  <Td isNumeric>
                    <Text
                      color={(row.deltaVsMedian ?? 0) >= 0 ? "purple.600" : "orange.600"}
                      fontWeight="700"
                    >
                      {row.deltaVsMedian !== null ? formatDelta(row.deltaVsMedian) : "–"}
                    </Text>
                  </Td>
                  <Td>
                    <Badge colorScheme={SMART_STATUS_COLOR_SCHEMES[row.status]}>
                      {SMART_STATUS_LABELS[row.status]}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </CardBody>
    </Card>
  );
}


function DualLineChart({
  title,
  data,
  description,
}: {
  title: string;
  data: ComparisonItem[];
  description: string;
}) {
  const W = 920, H = 300;
  const PL = 58, PR = 28, PT = 34, PB = 52;
  const CW = W - PL - PR, CH = H - PT - PB;
  const maxVal = Math.max(...data.flatMap((d) => [d.base, d.predicted]), 1);
  const GRIDS = 4;

  const toPoint = (v: number, i: number) => ({
    x: data.length === 1 ? PL + CW / 2 : PL + (i / Math.max(1, data.length - 1)) * CW,
    y: PT + CH - (v / maxVal) * CH,
  });
  const basePts = data.map((d, i) => toPoint(d.base, i));
  const predPts = data.map((d, i) => toPoint(d.predicted, i));

  return (
    <Card borderRadius="xl" boxShadow="sm">
      <CardBody>
        <Flex justify="space-between" align="start" gap={4} wrap="wrap" mb={3}>
          <Box>
            <Flex align="center" gap={2}>
              <FiTrendingUp />
              <Heading size="sm">{title}</Heading>
            </Flex>
            <Text fontSize="sm" color="gray.500" mt={1}>{description}</Text>
          </Box>
          <Flex gap={3} wrap="wrap">
            <Flex align="center" gap={1}>
              <Box w="16px" h="4px" bg="gray.400" borderRadius="full" />
              <Text fontSize="xs" color="gray.600">Referencia</Text>
            </Flex>
            <Flex align="center" gap={1}>
              <Box w="16px" h="4px" bg="purple.500" borderRadius="full" />
              <Text fontSize="xs" color="gray.600">Predicción</Text>
            </Flex>
          </Flex>
        </Flex>
        <Box overflowX="auto">
          <Box minW="760px">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={title}
              style={{ width: "100%", height: "auto", display: "block" }}
            >
              {Array.from({ length: GRIDS + 1 }, (_, i) => {
                const ratio = i / GRIDS;
                const y = PT + ratio * CH;
                const val = maxVal - ratio * maxVal;
                return (
                  <g key={i}>
                    <line x1={PL} x2={PL + CW} y1={y} y2={y} stroke="#E2E8F0" strokeWidth="1" />
                    <text x={PL - 12} y={y + 4} textAnchor="end" fontSize="11" fill="#718096">
                      {formatNumber(val)}
                    </text>
                  </g>
                );
              })}
              <line x1={PL} x2={PL + CW} y1={PT + CH} y2={PT + CH} stroke="#CBD5E0" strokeWidth="1.5" />
              <path d={linePath(basePts)} fill="none" stroke="#718096" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d={linePath(predPts)} fill="none" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {data.map((item, i) => {
                const bp = basePts[i], pp = predPts[i];
                return (
                  <g key={item.label}>
                    <circle cx={bp.x} cy={bp.y} r="5" fill="#718096" />
                    <circle cx={pp.x} cy={pp.y} r="5" fill="#7C3AED" />
                    <text x={bp.x} y={PT + CH + 24} textAnchor="middle" fontSize="12" fill="#4A5568" fontWeight="700">
                      {item.label}
                    </text>
                    {item.delta !== 0 && (
                      <text
                        x={bp.x}
                        y={Math.min(bp.y, pp.y) - 10}
                        textAnchor="middle"
                        fontSize="11"
                        fill={item.delta >= 0 ? "#6B46C1" : "#C05621"}
                        fontWeight="700"
                      >
                        {formatDelta(item.delta)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </Box>
        </Box>
      </CardBody>
    </Card>
  );
}

function DualBarChart({
  title,
  data,
  emptyText = "Sin datos suficientes",
  baseLabel = "Ref.",
  predLabel = "Pred.",
}: {
  title: string;
  data: ComparisonItem[];
  emptyText?: string;
  baseLabel?: string;
  predLabel?: string;
}) {
  const max = Math.max(...data.flatMap((d) => [d.base, d.predicted]), 0);
  return (
    <Card borderRadius="xl" boxShadow="sm" height="100%">
      <CardBody>
        <Flex align="center" gap={2} mb={4}>
          <FiBarChart2 />
          <Heading size="sm">{title}</Heading>
        </Flex>
        {!data.length || max === 0 ? (
          <Text fontSize="sm" color="gray.500">{emptyText}</Text>
        ) : (
          <Flex direction="column" gap={4}>
            {data.map((item) => (
              <Box key={item.label}>
                <Flex justify="space-between" gap={3} mb={1}>
                  <Text fontSize="sm" fontWeight="700" noOfLines={1}>{item.label}</Text>
                  <Text
                    fontSize="sm"
                    color={item.delta >= 0 ? "purple.600" : "orange.600"}
                    fontWeight="700"
                    flexShrink={0}
                  >
                    Δ {formatDelta(item.delta)}
                  </Text>
                </Flex>
                <Flex align="center" gap={2} mb={1}>
                  <Text fontSize="xs" color="gray.500" w="40px">{baseLabel}</Text>
                  <Box flex="1" h="9px" bg="gray.100" borderRadius="full" overflow="hidden">
                    <Box h="100%" width={`${Math.max(3, (item.base / max) * 100)}%`} bg="gray.400" borderRadius="full" />
                  </Box>
                  <Text fontSize="xs" color="gray.500" w="42px" textAlign="right">{formatNumber(item.base)}</Text>
                </Flex>
                <Flex align="center" gap={2}>
                  <Text fontSize="xs" color="gray.500" w="40px">{predLabel}</Text>
                  <Box flex="1" h="9px" bg="purple.50" borderRadius="full" overflow="hidden">
                    <Box h="100%" width={`${Math.max(3, (item.predicted / max) * 100)}%`} bg="purple.400" borderRadius="full" />
                  </Box>
                  <Text fontSize="xs" color="gray.500" w="42px" textAlign="right">{formatNumber(item.predicted)}</Text>
                </Flex>
              </Box>
            ))}
          </Flex>
        )}
      </CardBody>
    </Card>
  );
}

function DifferenceTable({
  title,
  rows,
  baseHeader = "Referencia/sem.",
  predictedHeader = "Predicción",
}: {
  title: string;
  rows: ComparisonItem[];
  baseHeader?: string;
  predictedHeader?: string;
}) {
  return (
    <Card borderRadius="xl" boxShadow="sm">
      <CardBody>
        <Flex align="center" gap={2} mb={4}>
          <FiDatabase />
          <Heading size="sm">{title}</Heading>
        </Flex>
        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Elemento</Th>
                <Th isNumeric>{baseHeader}</Th>
                <Th isNumeric>{predictedHeader}</Th>
                <Th isNumeric>Δ</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((row) => (
                <Tr key={row.label}>
                  <Td fontWeight="700">{row.label}</Td>
                  <Td isNumeric color="gray.600">{formatNumber(row.base)}</Td>
                  <Td isNumeric fontWeight="600">{formatNumber(row.predicted)}</Td>
                  <Td isNumeric>
                    <Badge colorScheme={row.delta >= 0 ? "purple" : "orange"}>
                      {formatDelta(row.delta)}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </CardBody>
    </Card>
  );
}

// ─── Week comparison table – always visible ───────────────────────────────────
function WeekComparisonTable({
  rows,
  selectedWeekKey,
  onSelectWeek,
}: {
  rows: WeekComparisonRow[];
  selectedWeekKey: string | null;
  onSelectWeek: (k: string) => void;
}) {
  return (
    <Card borderRadius="xl" boxShadow="sm">
      <CardBody>
        <Flex align="center" gap={2} mb={1}>
          <FiCalendar />
          <Heading size="sm">Semanas predichas — tabla de comparación</Heading>
        </Flex>
        <Text fontSize="sm" color="gray.500" mb={4}>
          Haz clic en una semana para filtrar todos los gráficos de abajo a esa semana concreta.
        </Text>
        {!rows.length ? (
          <Text fontSize="sm" color="gray.500">No hay semanas predichas.</Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Semana</Th>
                  <Th>Rango de fechas</Th>
                  <Th isNumeric>Ref. histórica/sem.</Th>
                  <Th isNumeric>Total predicho</Th>
                  <Th isNumeric>Diferencia</Th>
                  <Th isNumeric>Δ %</Th>
                  <Th isNumeric>Semanas ref. usadas</Th>
                  <Th isNumeric>Duración pred.</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((row) => (
                  <Tr
                    key={row.weekKey}
                    bg={row.weekKey === selectedWeekKey ? "purple.50" : undefined}
                    _hover={{ bg: row.weekKey === selectedWeekKey ? "purple.50" : "gray.50", cursor: "pointer" }}
                    onClick={() => onSelectWeek(row.weekKey)}
                  >
                    <Td>
                      <Flex align="center" gap={2}>
                        <Box
                          w="10px"
                          h="10px"
                          borderRadius="full"
                          bg={row.weekKey === selectedWeekKey ? "purple.500" : "gray.300"}
                          flexShrink={0}
                        />
                        <Text fontWeight={row.weekKey === selectedWeekKey ? "800" : "600"} color={row.weekKey === selectedWeekKey ? "purple.700" : undefined}>
                          {row.label}
                        </Text>
                      </Flex>
                    </Td>
                    <Td whiteSpace="nowrap" color="gray.600" fontSize="xs">{row.dateRange}</Td>
                    <Td isNumeric>{formatNumber(row.referenceAverage)}</Td>
                    <Td isNumeric fontWeight="700">{row.predictedTotal}</Td>
                    <Td isNumeric>
                      <Badge colorScheme={row.delta >= 0 ? "purple" : "orange"} fontWeight="700">
                        {formatDelta(row.delta)}
                      </Badge>
                    </Td>
                    <Td isNumeric>
                      <Text color={row.delta >= 0 ? "purple.600" : "orange.600"} fontWeight="700" fontSize="sm">
                        {formatPercent(row.deltaPercent)}
                      </Text>
                    </Td>
                    <Td isNumeric>
                      <Flex justify="end" align="center" gap={2}>
                        {row.usedFallback && (
                          <Tooltip label={`Sin datos para "${BENCHMARK_MODE_LABELS[row.referenceLabel as BenchmarkMode] ?? row.referenceLabel}" → usado todo el histórico`}>
                            <Badge colorScheme="orange" fontSize="xs">respaldo</Badge>
                          </Tooltip>
                        )}
                        <Text>{row.referenceWeeks}</Text>
                      </Flex>
                    </Td>
                    <Td isNumeric>{formatDuration(row.predictedDuration)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </CardBody>
    </Card>
  );
}

// Week pill tabs
function WeekTabs({
  slices,
  selectedWeekKey,
  onSelect,
}: {
  slices: PredictionWeekSlice[];
  selectedWeekKey: string | null;
  onSelect: (k: string) => void;
}) {
  if (slices.length <= 1) return null;
  return (
    <Flex gap={2} wrap="wrap" align="center">
      <Text fontSize="sm" color="gray.500" fontWeight="600" mr={1}>Semana:</Text>
      {slices.map((s) => (
        <Button
          key={s.weekKey}
          size="sm"
          variant={s.weekKey === selectedWeekKey ? "solid" : "outline"}
          colorScheme={s.weekKey === selectedWeekKey ? "purple" : "gray"}
          borderRadius="full"
          onClick={() => onSelect(s.weekKey)}
        >
          {s.label}
        </Button>
      ))}
    </Flex>
  );
}

function TaskPreviewTable({ title, tasks }: { title: string; tasks: ComparableTask[] }) {
  return (
    <Card borderRadius="xl" boxShadow="sm">
      <CardBody>
        <Flex justify="space-between" align="center" gap={3} mb={4}>
          <Heading size="sm">{title}</Heading>
          <Badge variant="outline">{tasks.length} tarea(s)</Badge>
        </Flex>
        {!tasks.length ? (
          <Text fontSize="sm" color="gray.500">No hay tareas para mostrar.</Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Inicio</Th>
                  <Th>Fin</Th>
                  <Th>Tipo</Th>
                  <Th>Robot</Th>
                  <Th isNumeric>Duración</Th>
                </Tr>
              </Thead>
              <Tbody>
                {tasks.slice(0, 12).map((t) => (
                  <Tr key={t.id}>
                    <Td whiteSpace="nowrap" fontSize="xs">{formatDateTime(t.startMs)}</Td>
                    <Td whiteSpace="nowrap" fontSize="xs">{formatDateTime(t.endMs)}</Td>
                    <Td><Badge colorScheme="purple">{t.taskType}</Badge></Td>
                    <Td>{t.robotName}</Td>
                    <Td isNumeric>{formatDuration(t.durationMinutes)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            {tasks.length > 12 && (
              <Text fontSize="xs" color="gray.400" mt={2} textAlign="center">
                Mostrando 12 de {tasks.length} tareas
              </Text>
            )}
          </Box>
        )}
      </CardBody>
    </Card>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────
function PredictionsAdvancedPage() {
  const navigate = useNavigate();
  const bgColor = useColorModeValue("ui.light", "gray.50");
  const cardBg = useColorModeValue("white", "gray.800");
  const { activeOrganizationContext } = useOrganizationContext();
  const activeOrganizationId = activeOrganizationContext?.uid ?? null;

  const cachedPrediction = useMemo(() => loadLastPredictionResponse(), []);
  const initialSource: PredictionSource =
    cachedPrediction?.data_source === "api" ? "api" : "file";

  const [dataSource, setDataSource] = useState<PredictionSource>(initialSource);
  const [benchmarkMode, setBenchmarkMode] = useState<BenchmarkMode>("same_week_of_month");
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [comparisonData, setComparisonData] = useState<PredictionComparisonData | null>(null);
  const [devices, setDevices] = useState<DevicePublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const payload = await getPredictionComparisonData(dataSource);
      setComparisonData(payload);
    } catch (err) {
      setComparisonData(null);
      setErrorMessage(
        err instanceof Error ? err.message : "No se pudo cargar la comparativa avanzada.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [dataSource]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    if (!activeOrganizationId) { setDevices([]); return; }
    let cancelled = false;
    DevicesService.getDevicesOwn({ ownerId: activeOrganizationId, skip: 0, limit: 1000 })
      .then((r) => { if (!cancelled) setDevices(r.data ?? []); })
      .catch(() => { if (!cancelled) setDevices([]); });
    return () => { cancelled = true; };
  }, [activeOrganizationId]);

  const deviceNameByUid = useMemo(() => {
    const map = new Map<string, string>();
    devices.forEach((d) => map.set(d.uid, d.name || d.uid));
    return map;
  }, [devices]);

  const normalizedBase = useMemo(
    () => normalizeTasks(comparisonData?.base ?? [], deviceNameByUid),
    [comparisonData, deviceNameByUid],
  );
  const normalizedPredicted = useMemo(
    () => normalizeTasks(comparisonData?.predicted ?? [], deviceNameByUid),
    [comparisonData, deviceNameByUid],
  );

  const baseTasks = normalizedBase.tasks;
  const predictedTasks = normalizedPredicted.tasks;

  const predictionWeekSlices = useMemo(
    () => buildPredictionWeekSlices(predictedTasks),
    [predictedTasks],
  );

  // Auto-select first week when slices change
  useEffect(() => {
    if (!predictionWeekSlices.length) { setSelectedWeekKey(null); return; }
    if (!selectedWeekKey || !predictionWeekSlices.some((s) => s.weekKey === selectedWeekKey)) {
      setSelectedWeekKey(predictionWeekSlices[0].weekKey);
    }
  }, [predictionWeekSlices, selectedWeekKey]);

  const selectedWeekSlice = useMemo(
    () => predictionWeekSlices.find((s) => s.weekKey === selectedWeekKey) ?? predictionWeekSlices[0] ?? null,
    [predictionWeekSlices, selectedWeekKey],
  );

  // Per-week reference (for selected week detail view)
  const weekReference = useMemo(
    () =>
      selectedWeekSlice
        ? selectReferenceForWeek(baseTasks, selectedWeekSlice.weekStart, benchmarkMode)
        : { tasks: [], denominatorWeeks: 1, usedFallback: false, detail: "", referenceLabel: "" },
    [baseTasks, selectedWeekSlice, benchmarkMode],
  );

  // FIXED global reference – uses first prediction week start as pivot, no overlap
  const globalReference = useMemo(
    () => buildGlobalReference(baseTasks, predictionWeekSlices, benchmarkMode),
    [baseTasks, predictionWeekSlices, benchmarkMode],
  );

  // Tasks and weeks for the detail charts → always the selected week
  const detailTasks = selectedWeekSlice ? selectedWeekSlice.tasks : predictedTasks;
  const detailRef = selectedWeekSlice ? weekReference : globalReference;
  const detailPredDenom = 1; // always one week in detail view

  const weekComparisonRows = useMemo(
    () => buildWeekComparisonRows(baseTasks, predictionWeekSlices, benchmarkMode),
    [baseTasks, predictionWeekSlices, benchmarkMode],
  );

  const fullBaseSummary = useMemo(() => buildSummary(baseTasks), [baseTasks]);
  const detailBaseSummary = useMemo(
    () => buildSummary(detailRef.tasks, detailRef.denominatorWeeks),
    [detailRef],
  );
  const detailPredSummary = useMemo(
    () => buildSummary(detailTasks, detailPredDenom),
    [detailTasks, detailPredDenom],
  );
  const globalPredSummary = useMemo(
    () => buildSummary(predictedTasks, Math.max(1, predictionWeekSlices.length)),
    [predictedTasks, predictionWeekSlices.length],
  );

  const weekdayComparison = useMemo(
    () =>
      buildComparisonItems(
        detailRef.tasks, detailTasks,
        detailRef.denominatorWeeks, detailPredDenom,
        (t) => t.weekdayLabel,
        { labels: WEEKDAY_LABELS },
      ),
    [detailRef, detailTasks, detailPredDenom],
  );
  const dailyEvolutionComparison = useMemo(
    () =>
      selectedWeekSlice
        ? buildDailyEvolutionComparison(
            detailRef.tasks,
            detailTasks,
            detailRef.denominatorWeeks,
            selectedWeekSlice.weekStart,
          )
        : [],
    [detailRef, detailTasks, selectedWeekSlice],
  );

  const referenceWeekStartsForDetail = useMemo(
    () =>
      selectedWeekSlice
        ? buildReferenceWeekStarts(
            baseTasks,
            selectedWeekSlice.weekStart,
            benchmarkMode,
            detailRef,
          )
        : [],
    [baseTasks, selectedWeekSlice, benchmarkMode, detailRef],
  );

  const smartComparisonAnalysis = useMemo(
    () =>
      selectedWeekSlice
        ? buildSmartComparisonAnalysis(
            detailRef.tasks,
            detailTasks,
            referenceWeekStartsForDetail,
            selectedWeekSlice.weekStart,
          )
        : null,
    [detailRef, detailTasks, referenceWeekStartsForDetail, selectedWeekSlice],
  );
  const typeComparison = useMemo(
    () =>
      buildComparisonItems(
        detailRef.tasks, detailTasks,
        detailRef.denominatorWeeks, detailPredDenom,
        (t) => t.taskType,
        { limit: 10 },
      ),
    [detailRef, detailTasks, detailPredDenom],
  );
  const robotComparison = useMemo(
    () =>
      buildComparisonItems(
        detailRef.tasks, detailTasks,
        detailRef.denominatorWeeks, detailPredDenom,
        (t) => t.robotName,
        { limit: 10 },
      ),
    [detailRef, detailTasks, detailPredDenom],
  );
  const hourlyComparison = useMemo(
    () =>
      buildComparisonItems(
        detailRef.tasks, detailTasks,
        detailRef.denominatorWeeks, detailPredDenom,
        (t) => HOUR_LABELS[t.hour],
        { labels: HOUR_LABELS, limit: 24 },
      ),
    [detailRef, detailTasks, detailPredDenom],
  );

  const hourlyComparisonFiltered = useMemo(
    () => hourlyComparison.filter((item) => item.base > 0 || item.predicted > 0),
    [hourlyComparison],
  );

  const strongestTypeDeltas = useMemo(() => buildDeltaRows(typeComparison, 12), [typeComparison]);
  const strongestRobotDeltas = useMemo(() => buildDeltaRows(robotComparison, 12), [robotComparison]);

  const qualityMessages = useMemo(() => {
    const msgs: string[] = [];
    const inv = normalizedBase.invalidCount + normalizedPredicted.invalidCount;
    const fb = normalizedBase.fallbackDurationCount + normalizedPredicted.fallbackDurationCount;
    const unk = normalizedBase.unknownRobotCount + normalizedPredicted.unknownRobotCount;
    if (inv) msgs.push(`${inv} tarea(s) con fecha de inicio inválida se han ignorado.`);
    if (fb) msgs.push(`${fb} tarea(s) sin fin válido; se asumió 30 minutos de duración.`);
    if (unk) msgs.push(`${unk} tarea(s) no pudieron asociarse a un robot conocido.`);
    return msgs;
  }, [normalizedBase, normalizedPredicted]);

  const selectedWeekLabel =
    selectedWeekSlice
      ? `${selectedWeekSlice.label} (${formatWeekRange(selectedWeekSlice.weekStart)})`
      : "todo el rango";

  const totalDeltaVsRef =
    globalPredSummary.weeklyAverage - (globalReference.tasks.length / Math.max(1, globalReference.denominatorWeeks));

  return (
    <Container maxW="full" bg={bgColor} minH="100vh" py={8} px={6}>
      {/* ── Header ── */}
      <Flex justify="space-between" align="start" gap={4} wrap="wrap" mb={6}>
        <Box>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<FiArrowLeft />}
            mb={3}
            onClick={() => void navigate({ to: "/predictions" })}
          >
            Volver a predicciones
          </Button>
          <Heading size="lg">Comparativa avanzada de predicciones</Heading>
          <Text color="gray.500" mt={1} maxW="640px">
            Cada semana predicha se compara contra una referencia histórica equivalente, usando medias como contexto
            y una lectura robusta con mediana, rango normal, percentil y días fuera de patrón.
          </Text>
        </Box>
        <Flex gap={3} wrap="wrap" align="center">
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1} fontWeight="600">FUENTE DE DATOS</Text>
            <Select
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value as PredictionSource)}
              bg={cardBg}
              size="sm"
              minW="200px"
            >
              <option value="file">Base fichero</option>
              <option value="api">Base API / dispositivos</option>
            </Select>
          </Box>
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1} fontWeight="600">MÉTODO DE REFERENCIA</Text>
            <Select
              value={benchmarkMode}
              onChange={(e) => setBenchmarkMode(e.target.value as BenchmarkMode)}
              bg={cardBg}
              size="sm"
              minW="240px"
            >
              <option value="same_week_of_month">Misma semana del mes</option>
              <option value="same_month">Mismo mes histórico</option>
              <option value="recent_4_weeks">Últimas 4 semanas reales</option>
              <option value="all_history">Todo el histórico</option>
            </Select>
          </Box>
          <Box pt="18px">
            <Button
              leftIcon={<FiRefreshCw />}
              onClick={() => void loadData()}
              isLoading={isLoading}
              variant="outline"
              size="sm"
            >
              Recargar
            </Button>
          </Box>
        </Flex>
      </Flex>

      {errorMessage && (
        <Alert status="error" borderRadius="xl" mb={5}>
          <AlertIcon />
          {errorMessage}
        </Alert>
      )}

      {isLoading && !comparisonData ? (
        <Flex align="center" justify="center" minH="360px" direction="column" gap={3}>
          <Spinner size="xl" color="purple.500" />
          <Text color="gray.500">Cargando comparativa avanzada…</Text>
        </Flex>
      ) : !comparisonData ? (
        <Card borderRadius="xl" boxShadow="sm" bg={cardBg}>
          <CardBody textAlign="center" py={12}>
            <Heading size="md" mb={2}>No hay datos de comparativa</Heading>
            <Text color="gray.500">Genera primero una predicción y vuelve a abrir esta página.</Text>
          </CardBody>
        </Card>
      ) : (
        <Flex direction="column" gap={6}>

          {/* ── Meta badges ── */}
          <Card borderRadius="xl" boxShadow="sm" bg={cardBg}>
            <CardBody>
              <Flex gap={3} wrap="wrap" align="center" mb={3}>
                <Badge colorScheme="purple">
                  Fuente: {comparisonData.data_source === "api" ? "API" : "Fichero"}
                </Badge>
                <Badge variant="outline">Base histórica: {baseTasks.length} tareas</Badge>
                <Badge variant="outline">Tareas predichas: {predictedTasks.length}</Badge>
                <Badge colorScheme="purple" variant="outline">
                  {predictionWeekSlices.length} semana(s) predicha(s)
                </Badge>
                {comparisonData.base_file && (
                  <Badge variant="outline" colorScheme="gray">Base: {comparisonData.base_file}</Badge>
                )}
                {comparisonData.predicted_file && (
                  <Badge variant="outline" colorScheme="gray">Pred: {comparisonData.predicted_file}</Badge>
                )}
              </Flex>
              <Flex align="center" gap={2}>
                <FiInfo size={14} color="#718096" />
                <Text fontSize="sm" color="gray.600">
                  <strong>Método activo:</strong> {BENCHMARK_MODE_LABELS[benchmarkMode]} —{" "}
                  {BENCHMARK_MODE_DESCRIPTIONS[benchmarkMode]}
                </Text>
              </Flex>
            </CardBody>
          </Card>

          {qualityMessages.length > 0 && (
            <Alert status="warning" borderRadius="xl">
              <AlertIcon />
              <Box>
                <Text fontWeight="800">Avisos de calidad de datos</Text>
                <Text fontSize="sm">{qualityMessages.join(" ")}</Text>
              </Box>
            </Alert>
          )}

          {/* ── Global KPIs ── */}
          <Box>
            <Heading size="sm" mb={3} color="gray.600" textTransform="uppercase" letterSpacing="wider">
              Resumen global del rango predicho
            </Heading>
            <Grid
              templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }}
              gap={4}
            >
              <StatCard
                label="Total tareas predichas"
                value={predictedTasks.length}
                hint={`En ${predictionWeekSlices.length} semana(s)`}
                accent
              />
              <StatCard
                label="Media semanal predicha"
                value={formatNumber(globalPredSummary.weeklyAverage)}
                hint={`Δ ${formatDelta(totalDeltaVsRef)} vs referencia global`}
                accent
              />
              <StatCard
                label="Histórico disponible"
                value={baseTasks.length}
                hint={`${fullBaseSummary.weekCount} semana(s): ${fullBaseSummary.rangeLabel}`}
              />
              <StatCard
                label="Media histórica/sem."
                value={formatNumber(globalReference.tasks.length / Math.max(1, globalReference.denominatorWeeks))}
                hint={`Método: ${BENCHMARK_MODE_LABELS[benchmarkMode]}`}
              />
            </Grid>
          </Box>

          {/* ── Multi-week overview chart ── */}

          {/* ── Week comparison table – always visible ── */}
          <WeekComparisonTable
            rows={weekComparisonRows}
            selectedWeekKey={selectedWeekKey}
            onSelectWeek={setSelectedWeekKey}
          />

          {/* ── Detail section for selected week ── */}
          <Divider />
          <Box>
            <Flex justify="space-between" align="center" gap={4} wrap="wrap" mb={4}>
              <Box>
                <Heading size="md">Detalle de {selectedWeekLabel}</Heading>
                <Text fontSize="sm" color={weekReference.usedFallback ? "orange.600" : "gray.500"} mt={1}>
                  Referencia usada:{" "}
                  <strong>{weekReference.referenceLabel || globalReference.referenceLabel}</strong>.{" "}
                  {weekReference.detail || globalReference.detail}
                </Text>
              </Box>
              <WeekTabs
                slices={predictionWeekSlices}
                selectedWeekKey={selectedWeekKey}
                onSelect={setSelectedWeekKey}
              />
            </Flex>

            {/* Detail KPIs */}
            <Grid
              templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" }}
              gap={4}
              mb={6}
            >
              <StatCard
                label="Referencia/sem. (esta sem.)"
                value={formatNumber(detailBaseSummary.weeklyAverage)}
                hint={`${detailRef.denominatorWeeks} sem. usadas: ${detailBaseSummary.rangeLabel}`}
              />
              <StatCard
                label="Total predicho esta semana"
                value={detailPredSummary.total}
                hint={detailPredSummary.rangeLabel}
                accent
              />
              <StatCard
                label="Duración media ref."
                value={formatDuration(detailBaseSummary.averageDuration)}
                hint="Por tarea de referencia"
              />
              <StatCard
                label="Duración media pred."
                value={formatDuration(detailPredSummary.averageDuration)}
                hint={`Δ ${formatDuration(detailPredSummary.averageDuration - detailBaseSummary.averageDuration)}`}
                accent
              />
            </Grid>

            {smartComparisonAnalysis && (
              <Box mb={6}>
                <SmartComparisonPanel analysis={smartComparisonAnalysis} />
              </Box>
            )}

            {/* Charts for selected week */}
            <Flex direction="column" gap={5}>
              <DualLineChart
                title="Evolución diaria de tareas"
                data={dailyEvolutionComparison}
                description={`Comparando cada día de ${selectedWeekLabel} contra la media histórica del mismo día de la semana según la referencia "${weekReference.referenceLabel || globalReference.referenceLabel}".`}
              />

              <DualLineChart
                title="Distribución por día de la semana"
                data={weekdayComparison}
                description={`Comparando ${selectedWeekLabel} contra referencia "${weekReference.referenceLabel || globalReference.referenceLabel}". Los valores de referencia son medias por semana.`}
              />

              <Grid templateColumns={{ base: "1fr", xl: "repeat(2, 1fr)" }} gap={5}>
                <DualBarChart
                  title="Por tipo de tarea"
                  data={typeComparison}
                  baseLabel="Ref."
                  predLabel="Pred."
                />
                <DualBarChart
                  title="Por robot"
                  data={robotComparison}
                  baseLabel="Ref."
                  predLabel="Pred."
                />
              </Grid>

              <DualBarChart
                title="Distribución horaria"
                data={hourlyComparisonFiltered}
                baseLabel="Ref."
                predLabel="Pred."
              />

              <Grid templateColumns={{ base: "1fr", xl: "repeat(2, 1fr)" }} gap={5}>
                <DifferenceTable
                  title="Mayores diferencias por tipo"
                  rows={strongestTypeDeltas}
                  baseHeader="Referencia/sem."
                  predictedHeader="Predicción sem."
                />
                <DifferenceTable
                  title="Mayores diferencias por robot"
                  rows={strongestRobotDeltas}
                  baseHeader="Referencia/sem."
                  predictedHeader="Predicción sem."
                />
              </Grid>

              <Grid templateColumns={{ base: "1fr", xl: "repeat(2, 1fr)" }} gap={5}>
                <TaskPreviewTable
                  title={`Muestra de referencia (${detailRef.tasks.length} tareas)`}
                  tasks={detailRef.tasks}
                />
                <TaskPreviewTable
                  title={`Muestra de predicción — ${selectedWeekLabel}`}
                  tasks={detailTasks}
                />
              </Grid>
            </Flex>
          </Box>
        </Flex>
      )}
    </Container>
  );
}