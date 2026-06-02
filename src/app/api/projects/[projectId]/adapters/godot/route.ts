import { NextResponse } from "next/server";
import { generateGodotAdapter } from "@/lib/studio";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { projectId } = await context.params;
    const workspace = generateGodotAdapter(projectId);
    return NextResponse.json({ project: workspace });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to generate the Godot adapter.",
        details: [error instanceof Error ? error.message : "Unknown error"]
      },
      { status: 400 }
    );
  }
}
