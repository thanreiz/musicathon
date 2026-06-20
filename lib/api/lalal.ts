/**
 * LALAL.AI API v1 client — server-side only.
 *
 * Flow:
 *   1. Upload audio binary  → receives a `source_id`
 *   2. Start a stem-separator split (stem: "vocals") → receives a `task_id`
 *   3. Poll `/check/` with the task_id → eventually returns download URLs
 *
 * We want the "back" track labelled "no_vocals" (the instrumental).
 *
 * API docs: https://www.lalal.ai/api/v1/docs/
 * OpenAPI spec: https://www.lalal.ai/api/v1/openapi.json
 */

const LALAL_BASE = "https://www.lalal.ai/api/v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UploadAndSplitResult = {
  taskId: string;
  sourceId: string;
};

export type SeparationStatus =
  | { status: "processing"; progress: number }
  | { status: "complete"; instrumentalUrl: string }
  | { status: "error"; error: string };

// Raw response shapes (only fields we use) ----------------------------------

type LalalUploadResponse = {
  id: string;
  name: string;
  size: number;
  duration: number;
  expires: number;
};

type LalalSplitResponse = {
  task_id: string;
};

type LalalCheckResponse = {
  result: Record<string, LalalCheckResult>;
};

type LalalCheckResult =
  | LalalProgressResult
  | LalalSuccessResult
  | LalalErrorResult
  | LalalServerErrorResult
  | LalalCancelledResult;

type LalalProgressResult = {
  status: "progress";
  progress: number;
};

type LalalSuccessResult = {
  status: "success";
  result: {
    tracks: Array<{
      type: "stem" | "back";
      label: string;
      url: string;
    }>;
    duration: number;
  };
};

type LalalErrorResult = {
  status: "error";
  error: { detail: string; code?: string | null };
};

type LalalServerErrorResult = {
  status: "server_error";
  error: string;
};

type LalalCancelledResult = {
  status: "cancelled";
};

// Possible error‐response body from LALAL.AI
type LalalApiError = {
  detail?: string;
  code?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.LALAL_API_KEY;

  if (!key) {
    throw new Error("LALAL_API_KEY is not configured.");
  }

  return key;
}

/**
 * Thin wrapper around `fetch` that attaches auth and returns parsed JSON.
 * Throws on non-2xx HTTP status.
 */
async function lalalFetch<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const url = `${LALAL_BASE}${path}`;
  const apiKey = getApiKey();

  const response = await fetch(url, {
    ...init,
    headers: {
      "X-License-Key": apiKey,
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    let detail = `LALAL.AI ${path} returned ${response.status}`;

    try {
      const body = (await response.json()) as LalalApiError;
      if (body.detail) {
        detail = typeof body.detail === "string"
          ? body.detail
          : JSON.stringify(body.detail);
      }
    } catch {
      // body wasn't JSON — keep the generic message
    }

    throw new Error(detail);
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Uploads an audio file to LALAL.AI, then immediately starts a
 * stem-separator split to isolate vocals (which also produces the
 * instrumental "no_vocals" backing track).
 *
 * Returns both the `taskId` (for polling) and `sourceId` (for cleanup).
 */
export async function uploadAndSplit(
  fileBuffer: Buffer,
  filename: string,
): Promise<UploadAndSplitResult> {
  // Step 1: Upload --------------------------------------------------------
  const uploadResult = await lalalFetch<LalalUploadResponse>("/upload/", {
    method: "POST",
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(fileBuffer),
  });

  const sourceId = uploadResult.id;

  // Step 2: Start split ---------------------------------------------------
  const splitResult = await lalalFetch<LalalSplitResponse>(
    "/split/stem_separator/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_id: sourceId,
        presets: {
          stem: "vocals",
          // Let the API auto-select the best splitter model
        },
      }),
    },
  );

  return {
    taskId: splitResult.task_id,
    sourceId,
  };
}

/**
 * Checks the processing status of a LALAL.AI split task.
 *
 * On success, extracts the instrumental ("no_vocals" / "back" type) track URL.
 * Normalises all statuses into a simple discriminated union.
 */
export async function checkTaskStatus(
  taskId: string,
): Promise<SeparationStatus> {
  const data = await lalalFetch<LalalCheckResponse>("/check/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_ids: [taskId] }),
  });

  const entry = data.result[taskId];

  if (!entry) {
    return { status: "error", error: "Task not found." };
  }

  switch (entry.status) {
    case "progress":
      return { status: "processing", progress: entry.progress };

    case "success": {
      // Find the instrumental track — type "back", label "no_vocals"
      const instrumental = entry.result.tracks.find(
        (t) => t.type === "back",
      );

      if (!instrumental?.url) {
        return {
          status: "error",
          error: "Processing succeeded but no instrumental track was returned.",
        };
      }

      return { status: "complete", instrumentalUrl: instrumental.url };
    }

    case "error":
      return {
        status: "error",
        error: entry.error?.detail ?? "Processing failed.",
      };

    case "server_error":
      return {
        status: "error",
        error:
          typeof entry.error === "string"
            ? entry.error
            : "A server error occurred during processing.",
      };

    case "cancelled":
      return { status: "error", error: "Processing was cancelled." };

    default:
      return { status: "error", error: "Unknown task status." };
  }
}
