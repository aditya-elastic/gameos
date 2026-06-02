import { NextResponse } from "next/server";
import { recordUnityAdvancedPlaytest } from "@/lib/studio";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;
    const report = (await request.json()) as Record<string, unknown>;
    const workspace = recordUnityAdvancedPlaytest(projectId, report);
    return NextResponse.json({ project: workspace });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to record the Unity advanced playtest.",
        details: [error instanceof Error ? error.message : "Unknown error"]
      },
      { status: 400 }
    );
  }
}
