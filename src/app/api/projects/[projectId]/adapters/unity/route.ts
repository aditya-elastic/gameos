import { NextResponse } from "next/server";
import { generateUnityAdapter } from "@/lib/studio";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;
    const workspace = generateUnityAdapter(projectId);
    return NextResponse.json({ project: workspace });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to generate the Unity adapter.",
        details: [error instanceof Error ? error.message : "Unknown error"]
      },
      { status: 400 }
    );
  }
}
