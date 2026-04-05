import { useMemo, useState } from 'react'
import { getStaticPreviewUrl } from '../../gallery/staticPreviews'
import { useUserVizStore, isUserVizId } from '../../userViz/userVizStore'

interface PreviewImageProps {
  vizId: string
  name?: string
}

function hashHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) % 360
  }
  return h
}

function GradientFallback({ vizId, name }: { vizId: string; name?: string }) {
  const hue = hashHue(vizId)
  const bg = `linear-gradient(135deg, hsl(${hue}, 28%, 22%), hsl(${(hue + 70) % 360}, 30%, 10%))`
  const label = (name ?? vizId).trim()
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: 'min(80px, 18vw)',
          fontWeight: 400,
          fontStyle: 'italic',
          letterSpacing: '-0.04em',
          color: 'rgba(255,255,255,0.78)',
          textAlign: 'center',
          padding: '0 16px',
          lineHeight: 1,
          maxWidth: '90%',
          textShadow: '0 2px 16px rgba(0,0,0,0.4)',
        }}
      >
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </div>
    </div>
  )
}

export default function PreviewImage({ vizId, name }: PreviewImageProps) {
  const userViz = useUserVizStore((s) =>
    isUserVizId(vizId) ? s.visualizers.find((v) => v.id === vizId) : undefined,
  )
  const [errored, setErrored] = useState(false)

  const url = useMemo(() => {
    if (isUserVizId(vizId)) return userViz?.previewUrl ?? null
    return getStaticPreviewUrl(vizId)
  }, [vizId, userViz?.previewUrl])

  if (!url || errored) {
    return <GradientFallback vizId={vizId} name={name} />
  }

  return (
    <img
      src={url}
      onError={() => setErrored(true)}
      alt=""
      draggable={false}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        userSelect: 'none',
      }}
    />
  )
}
