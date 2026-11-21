export function ChapterTag({ n, inverted }: { n: string; inverted?: boolean }) {
  return (
    <span className={`mono inline-block self-start px-2 py-1 uppercase ${inverted ? 'bg-paper text-ink' : 'bg-ink text-paper'}`}>CH.{n}</span>
  )
}
