import { NextResponse } from "next/server";
import { regenerateAgent } from "@/lib/studio";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    projectId: string;
    role: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { projectId, role } = await context.params;
    const workspace = regenerateAgent(projectId, role);
    return NextResponse.json({ project: workspace });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to regenerate this agent.",
        details: [error instanceof Error ? error.message : "Unknown error"]
      },
      { status: 400 }
    );
  }
}
