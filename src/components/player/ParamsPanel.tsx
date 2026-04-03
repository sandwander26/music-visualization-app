import { type ChangeEvent } from 'react'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { usePresetsStore, type ParamSchema, type ParamValue } from '../../presets/presetsStore'
import { PARAM_SCHEMAS } from '../../presets/paramSchemas'

interface ParamsPanelProps {
  visualizerId: string
  visualizerName: string
  onBack: () => void
}

export default function ParamsPanel({ visualizerId, visualizerName, onBack }: ParamsPanelProps) {
  const currentParams = usePresetsStore((s) => s.currentParams)
  const setParam = usePresetsStore((s) => s.setParam)
  const resetParams = usePresetsStore((s) => s.resetParams)

  const schema = (PARAM_SCHEMAS[visualizerId] ?? []) as ParamSchema[]
  const values = currentParams[visualizerId] ?? {}
  const hasSchema = schema.length > 0

  return (
    <>
      <div className="flex items-center" style={{ gap: 10 }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="hov-icon-btn t-color-border"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px 6px 8px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-soft)',
            color: 'var(--fg-soft)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <ArrowLeft size={13} />
          Назад
        </button>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--fg-mute)',
            }}
          >
            Параметры
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--fg)',
              marginTop: 2,
            }}
          >
            {visualizerName}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }} />

      {!hasSchema ? (
        <div
          style={{
            padding: '32px 8px',
            textAlign: 'center',
            color: 'var(--fg-mute)',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          У этого визуализатора нет настроек
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {schema.map((p) => (
              <ParamControl
                key={p.id}
                schema={p}
                value={values[p.id] ?? p.default}
                onChange={(v) => setParam(visualizerId, p.id, v)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => resetParams(visualizerId)}
            className="hov-icon-btn t-color-border"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--fg-soft)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              alignSelf: 'flex-start',
            }}
          >
            <RotateCcw size={12} />
            Сбросить
          </button>
        </>
      )}
    </>
  )
}

interface ParamControlProps {
  schema: ParamSchema
  value: ParamValue
  onChange: (v: ParamValue) => void
}

function ParamControl({ schema, value, onChange }: ParamControlProps) {
  if (schema.type === 'toggle') {
    const checked = Boolean(value)
    return (
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--fg-soft)',
          gap: 12,
        }}
      >
        <span>{schema.label}</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        />
      </label>
    )
  }

  if (schema.type === 'color') {
    const v = typeof value === 'string' ? value : '#ffffff'
    return (
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--fg-soft)',
          gap: 12,
        }}
      >
        <span>{schema.label}</span>
        <input
          type="color"
          value={v}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          style={{
            width: 36,
            height: 24,
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'transparent',
            cursor: 'pointer',
            padding: 0,
          }}
        />
      </label>
    )
  }

  const numeric = typeof value === 'number' ? value : Number(schema.default)
  const min = schema.min ?? 0
  const max = schema.max ?? 1
  const step = schema.step ?? 0.01
  const display = step >= 1 ? numeric.toFixed(0) : numeric.toFixed(2)

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--fg-soft)',
        }}
      >
        <span>{schema.label}</span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: 'var(--fg-mute)',
          }}
        >
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numeric}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--fg)' }}
      />
    </label>
  )
}
