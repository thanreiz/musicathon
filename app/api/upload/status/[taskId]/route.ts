import { checkTaskStatus } from "@/lib/api/lalal";

type StatusRouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function GET(_request: Request, context: StatusRouteContext) {
  const { taskId } = await context.params;

  if (!taskId) {
    return Response.json(
      { status: "error", error: "Task ID is required." },
      { status: 400 },
    );
  }

  try {
    const status = await checkTaskStatus(taskId);
    return Response.json(status, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[/api/upload/status] Error:", error);

    return Response.json(
      {
        status: "error" as const,
        error: "Could not check processing status. Please try again.",
      },
      { status: 502 },
    );
  }
}
