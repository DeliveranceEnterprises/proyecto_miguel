import { OpenAPI } from "../client";

const LAST_PREDICTION_RESPONSE_KEY = "last_prediction_response";

export interface PredictedTaskWaypoint {
  timestamp: string;
  coordinates_x: number;
  coordinates_y: number;
  level?: number | null;
  label?: string | null;
}

export interface PredictedTaskRecord {
  uid: string | null;
  device_uid: string | null;
  task_name: string | null;
  type: string;
  status: string | null;
  start_time: string;
  end_time: string | null;
  mileage?: number;
  misc?: string | null;
  waypoints?: PredictedTaskWaypoint[];
  week_offset?: number;
}

export interface PredictWeekResponse {
  ok: boolean;
  weeks_ahead: number;
  generated_count: number;
  predicted_file: string;
  combined_file: string;
  data_source?: "file" | "api";
  model?: string;
  data: PredictedTaskRecord[];
}

export function saveLastPredictionResponse(response: PredictWeekResponse): void {
  try {
    localStorage.setItem(
      LAST_PREDICTION_RESPONSE_KEY,
      JSON.stringify({
        ...response,
        saved_at: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.warn("No se pudo guardar la última predicción en localStorage", error);
  }
}

export function loadLastPredictionResponse(): (PredictWeekResponse & { saved_at?: string }) | null {
  try {
    const raw = localStorage.getItem(LAST_PREDICTION_RESPONSE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data)) return null;

    return parsed;
  } catch (error) {
    console.warn("No se pudo leer la última predicción desde localStorage", error);
    return null;
  }
}

export async function predictWeeks(
  weeksAhead: number,
  dataSource: "file" | "api" = "file"
): Promise<PredictWeekResponse> {
  const token = localStorage.getItem("access_token");
  const base = OpenAPI.BASE ?? "";

  const response = await fetch(`${base}/api/v1/prediction/predict_week`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      weeks_ahead: weeksAhead,
      data_source: dataSource,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.detail ?? "Error al generar la predicción");
  }

  saveLastPredictionResponse(payload);
  return payload;
}

export async function getPredictedTasks(): Promise<PredictedTaskRecord[]> {
  const token = localStorage.getItem("access_token");
  const base = OpenAPI.BASE ?? "";

  const response = await fetch(`${base}/api/v1/prediction/predicted_tasks`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const payload = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(payload?.detail ?? "Error al cargar las tareas predichas");
  }

  return Array.isArray(payload) ? payload : [];
}
