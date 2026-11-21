import { redirect } from "next/navigation";

// Storyboard editor removed from the product; old links land in the reader.
export default async function StoryboardRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ storyId?: string }>;
}) {
  const { storyId } = await searchParams;
  redirect(storyId ? `/reader?storyId=${encodeURIComponent(storyId)}` : "/reader");
}
