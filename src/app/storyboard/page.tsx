import { WorkspaceShell } from "@/components/WorkspaceShell";

export default async function StoryboardRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ storyId?: string }>;
}) {
  const params = await searchParams;
  return (
    <WorkspaceShell
      initialScreen="storyboard"
      initialStoryId={params.storyId}
    />
  );
}
