import { NextResponse } from "next/server";
import { readArtifactContent, toProjectRelativeArtifactPath } from "@/lib/artifacts";
import { getArtifact } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    projectId: string;
    artifactId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { projectId, artifactId } = await context.params;
    const artifact = getArtifact(projectId, artifactId);

    if (!artifact) {
      return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
    }

    return NextResponse.json({
      artifact: {
        ...artifact,
        relativePath: toProjectRelativeArtifactPath(artifact.path, projectId),
        content: readArtifactContent(artifact.path)
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to open this artifact.",
        details: [error instanceof Error ? error.message : "Unknown error"]
      },
      { status: 500 }
    );
  }
}
