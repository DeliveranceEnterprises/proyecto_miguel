import { OpenAPI } from "../client";

export interface PredictWeekResponse {
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

export async function predictWeeks(weeksAhead: number): Promise<PredictWeekResponse> {
  const token = localStorage.getItem("access_token");
  const base = OpenAPI.BASE ?? "";

  const response = await fetch(`${base}/api/v1/prediction/predict_week`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ weeks_ahead: weeksAhead }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.detail ?? "Error al generar la predicción");
  }

  return payload;
}