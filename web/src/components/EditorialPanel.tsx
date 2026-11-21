interface EditorialPanelProps {
  image: string
  label?: string
  title: string
  text: string
}

export function EditorialPanel({ image, label, title, text }: EditorialPanelProps) {
  return (
    <article className="editorial-panel">
      <div className="editorial-panel-art">
        <img src={'/demo/' + image} alt="" loading="lazy" width="540" height="360" />
        {label && <span className="editorial-panel-label">{label}</span>}
      </div>
      <div className="editorial-panel-caption"><h3>{title}</h3><p>{text}</p></div>
    </article>
  )
}
