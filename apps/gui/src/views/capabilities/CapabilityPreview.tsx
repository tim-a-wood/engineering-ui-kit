import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { SelectionEvidence } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../bridge'
import { PREVIEW_BINDING_PICKER_JS } from './previewSelection'

export type CapabilityPreviewHandle = {
  pickElement(): Promise<SelectionEvidence | null>
}

type Props = {
  bridge: EuikBridge
  projectId: string
}

type PreviewState =
  | { status: 'idle' | 'starting' }
  | { status: 'ready'; url: string }
  | { status: 'error'; message: string }

/** Target application preview. Selection executes inside the Electron guest. */
export const CapabilityPreview = forwardRef<CapabilityPreviewHandle, Props>(
  function CapabilityPreview({ bridge, projectId }, ref) {
    const [state, setState] = useState<PreviewState>({ status: 'idle' })
    const webviewRef = useRef<HTMLWebViewElement | null>(null)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)
    const isElectron = typeof window !== 'undefined' && window.euikMode === 'electron'

    const start = async () => {
      if (!projectId) return
      setState({ status: 'starting' })
      try {
        const launched = await bridge.launchApp(projectId, { open: false })
        setState({ status: 'ready', url: launched.url })
      } catch (cause) {
        setState({
          status: 'error',
          message: cause instanceof Error ? cause.message : String(cause),
        })
      }
    }

    useEffect(() => {
      setState({ status: 'idle' })
      if (projectId) void start()
      // `bridge` is stable for the application lifetime; project changes own
      // preview restarts.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId])

    useImperativeHandle(ref, () => ({
      async pickElement() {
        if (!isElectron) {
          throw new Error('Preview element selection requires the packaged desktop app.')
        }
        if (state.status !== 'ready') {
          throw new Error('The target-app Preview is not ready.')
        }
        const guest = webviewRef.current as unknown as {
          executeJavaScript?: (code: string) => Promise<unknown>
        } | null
        if (!guest?.executeJavaScript) {
          throw new Error('The target-app Preview guest is unavailable.')
        }
        return (await guest.executeJavaScript(PREVIEW_BINDING_PICKER_JS)) as SelectionEvidence | null
      },
    }), [isElectron, state])

    const reload = () => {
      if (isElectron) {
        ;(webviewRef.current as unknown as { reload?: () => void } | null)?.reload?.()
      } else if (iframeRef.current && state.status === 'ready') {
        iframeRef.current.src = state.url
      }
    }

    return (
      <div className="app-preview capability-app-preview" aria-label="Target application Preview">
        <div className="app-preview-shell">
          <div className="hstack between app-preview-chrome">
            <span className="overline">Target application Preview</span>
            {state.status === 'ready' ? (
              <span className="hstack">
                <span className="mono app-preview-url">{state.url}</span>
                <button type="button" className="btn btn-secondary btn-compact" onClick={reload}>
                  Reload
                </button>
              </span>
            ) : null}
          </div>
          {state.status === 'ready' ? (
            isElectron ? (
              <webview ref={webviewRef} className="app-preview-frame" src={state.url} />
            ) : (
              <iframe ref={iframeRef} className="app-preview-frame" src={state.url} title="Target application Preview" />
            )
          ) : (
            <div
              className="app-preview-frame app-preview-placeholder"
              role={state.status === 'error' ? 'alert' : 'status'}
            >
              <div className="placeholder-preview-copy">
                <strong>{state.status === 'starting' ? 'Starting target application…' : 'Preview unavailable'}</strong>
                {state.status === 'error' ? <p>{state.message}</p> : null}
                {state.status !== 'starting' ? (
                  <button type="button" className="btn btn-secondary btn-compact" onClick={() => void start()}>
                    Start Preview
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  },
)
