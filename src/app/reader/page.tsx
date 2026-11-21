import { WorkspaceShell } from "@/components/WorkspaceShell";

export default async function ReaderRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ storyId?: string }>;
}) {
  const params = await searchParams;
  return (
    <WorkspaceShell initialScreen="reader" initialStoryId={params.storyId} />
  );
}
