import { NextResponse } from "next/server";
import { createStudioProject, getStudioDashboard } from "@/lib/studio";
import { createProjectInputSchema } from "@/lib/intake";
import { ZodError } from "zod";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ projects: getStudioDashboard() });
  } catch (error) {
    return NextResponse.json(formatApiError(error, "Unable to load Game OS projects."), { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const input = createProjectInputSchema.parse(body);
    const workspace = createStudioProject(input);

    return NextResponse.json({ project: workspace }, { status: 201 });
  } catch (error) {
    const status = error instanceof ZodError ? 400 : 500;
    return NextResponse.json(formatApiError(error, "Unable to create this studio room."), { status });
  }
}

function formatApiError(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    return {
      error: fallback,
      details: error.issues.map((issue) => issue.message)
    };
  }

  if (error instanceof Error) {
    return {
      error: fallback,
      details: [error.message]
    };
  }

  return {
    error: fallback
  };
}
