import { useEffect, useMemo, useState } from 'react'
import type { ScenarioEvidenceArtifact } from '@engineering-ui-kit/core/design-browser'
import { Dialog } from '../../components'
import type { DesignStore, EvidenceArtifactLoadResult } from './designState'

type AvailableArtifact = ScenarioEvidenceArtifact & { status: 'available'; ref: string }

function isAvailable(artifact: ScenarioEvidenceArtifact): artifact is AvailableArtifact {
  return artifact.status === 'available' && typeof artifact.ref === 'string'
}

function contentUrl(result: Extract<EvidenceArtifactLoadResult, { ok: true }>): string {
  if (!result.mediaType.startsWith('image/')) return ''
  return `data:${result.mediaType};base64,${result.content}`
}

function readableBytes(value: number | undefined): string {
  if (value === undefined) return 'Unknown size'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function artifactLabel(artifact: ScenarioEvidenceArtifact): string {
  if (artifact.kind === 'screenshot') return 'Original screenshot'
  if (artifact.kind === 'structured') return 'Structured result'
  return 'Execution log'
}

function verifyLoaded(
  artifact: AvailableArtifact,
  loaded: EvidenceArtifactLoadResult,
): EvidenceArtifactLoadResult {
  if (!loaded.ok) return loaded
  if (artifact.sha256 && artifact.sha256 !== loaded.sha256) {
    return { ok: false, message: `Integrity check failed. Expected ${artifact.sha256}, received ${loaded.sha256}.` }
  }
  if (artifact.bytes !== undefined && artifact.bytes !== loaded.bytes) {
    return { ok: false, message: `Integrity check failed. Expected ${artifact.bytes} bytes, received ${loaded.bytes}.` }
  }
  return loaded
}

function ScreenshotThumbnail(props: {
  store: DesignStore
  artifact: AvailableArtifact
  onOpen: (loaded?: EvidenceArtifactLoadResult) => void
}) {
  const [loaded, setLoaded] = useState<EvidenceArtifactLoadResult>()

  useEffect(() => {
    let active = true
    void props.store.loadEvidenceArtifact(props.artifact.ref).then((result) => {
      if (active) setLoaded(verifyLoaded(props.artifact, result))
    })
    return () => { active = false }
  }, [props.artifact.ref, props.artifact.sha256, props.store])

  return (
    <button
      type="button"
      className="design-evidence-thumbnail"
      onClick={() => props.onOpen(loaded)}
      aria-label={`Open ${artifactLabel(props.artifact)} at full resolution`}
    >
      {!loaded ? (
        <span className="design-evidence-thumbnail-loading">Loading preview…</span>
      ) : loaded.ok ? (
        <img src={contentUrl(loaded)} alt="" />
      ) : (
        <span className="design-evidence-integrity-failure">{loaded.message}</span>
      )}
      <span>Open full resolution</span>
    </button>
  )
}

export function EvidenceArtifactViewer(props: {
  store: DesignStore
  artifacts: ScenarioEvidenceArtifact[]
  initialArtifactRef?: string
  onArtifactSelected?: (ref?: string) => void
}) {
  const [selected, setSelected] = useState<AvailableArtifact>()
  const [loaded, setLoaded] = useState<EvidenceArtifactLoadResult>()
  const [loading, setLoading] = useState(false)

  const structuredText = useMemo(() => {
    if (!loaded?.ok || loaded.mediaType !== 'application/json') return loaded?.ok ? loaded.content : ''
    try {
      return JSON.stringify(JSON.parse(loaded.content), null, 2)
    } catch {
      return loaded.content
    }
  }, [loaded])

  function openArtifact(artifact: AvailableArtifact, alreadyLoaded?: EvidenceArtifactLoadResult) {
    setSelected(artifact)
    props.onArtifactSelected?.(artifact.ref)
    setLoaded(alreadyLoaded)
    if (alreadyLoaded) return
    setLoading(true)
    void props.store.loadEvidenceArtifact(artifact.ref)
      .then((result) => setLoaded(verifyLoaded(artifact, result)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const artifact = props.artifacts.find((candidate): candidate is AvailableArtifact =>
      isAvailable(candidate) && candidate.ref === props.initialArtifactRef,
    )
    if (artifact && selected?.ref !== artifact.ref) openArtifact(artifact)
    // `openArtifact` deliberately stays local: this effect is keyed by the
    // routed reference and stable artifact list, not every load-state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.artifacts, props.initialArtifactRef])

  return (
    <>
      <ul className="design-evidence-artifacts" aria-label="Step artifacts">
        {props.artifacts.map((artifact) => (
          <li key={artifact.artifactId} data-status={artifact.status}>
            <div className="design-evidence-artifact-heading">
              <b>{artifactLabel(artifact)}</b>
              <span>{artifact.role}</span>
            </div>
            {isAvailable(artifact) ? (
              <>
                {artifact.kind === 'screenshot' ? (
                  <ScreenshotThumbnail store={props.store} artifact={artifact} onOpen={(result) => openArtifact(artifact, result)} />
                ) : (
                  <button type="button" className="btn btn-secondary btn-compact" onClick={() => openArtifact(artifact)}>
                    Open {artifact.kind === 'structured' ? 'structured evidence' : 'artifact'}
                  </button>
                )}
                <small>{readableBytes(artifact.bytes)} · SHA-256 <code>{artifact.sha256?.slice(0, 12)}…</code></small>
              </>
            ) : artifact.status === 'notApplicable' ? (
              <p className="secondary-text">Not applicable: {artifact.notApplicableReason}</p>
            ) : (
              <p className="design-evidence-integrity-failure" role="alert">
                Missing original artifact. {artifact.failure}
              </p>
            )}
          </li>
        ))}
      </ul>

      {selected && (
        <Dialog
          title={artifactLabel(selected)}
          wide
          onClose={() => {
            setSelected(undefined)
            setLoaded(undefined)
            props.onArtifactSelected?.(undefined)
          }}
          actions={(
            <>
              {loaded?.ok && (
                <a
                  className="btn btn-secondary"
                  download={loaded.fileName}
                  href={loaded.mediaType.startsWith('image/')
                    ? contentUrl(loaded)
                    : `data:${loaded.mediaType};charset=utf-8,${encodeURIComponent(loaded.content)}`}
                >
                  Download original
                </a>
              )}
              <button type="button" className="btn btn-primary" onClick={() => {
                setSelected(undefined)
                setLoaded(undefined)
                props.onArtifactSelected?.(undefined)
              }}>
                Done
              </button>
            </>
          )}
        >
          <div className="design-evidence-artifact-modal">
            {loading || !loaded ? (
              <p role="status">Opening and verifying artifact…</p>
            ) : !loaded.ok ? (
              <div className="design-evidence-integrity-failure" role="alert">
                <h3>Artifact integrity failure</h3>
                <p>{loaded.message}</p>
              </div>
            ) : loaded.mediaType.startsWith('image/') ? (
              <figure>
                <img src={contentUrl(loaded)} alt={`${artifactLabel(selected)} for the selected scenario step`} />
                <figcaption>
                  Original resolution{selected.width && selected.height ? ` · ${selected.width} × ${selected.height}` : ''} · {readableBytes(loaded.bytes)}
                </figcaption>
              </figure>
            ) : (
              <pre className="design-evidence-structured" tabIndex={0}>{structuredText}</pre>
            )}
            {loaded?.ok && (
              <dl className="design-definition-grid">
                <dt>Reference</dt><dd><code>{selected.ref}</code></dd>
                <dt>SHA-256</dt><dd><code>{loaded.sha256}</code></dd>
                <dt>Media type</dt><dd>{loaded.mediaType}</dd>
                <dt>Captured</dt><dd>{selected.capturedAt}</dd>
              </dl>
            )}
          </div>
        </Dialog>
      )}
    </>
  )
}
