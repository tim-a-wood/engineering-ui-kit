import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Project, SelectionEvidence } from '@engineering-ui-kit/core'
import type { EuikBridge } from '../../bridge'

export type CapabilityPreviewHandle = {
  pickElement(): Promise<SelectionEvidence | null>
}

type Props = {
  bridge: EuikBridge
  projectId: string
  project?: Project
}

type PreviewState =
  | { status: 'idle' | 'starting' | 'installing' }
  | { status: 'ready'; url: string; preloadUrl?: string }
  | { status: 'error'; message: string }

type PreviewWebview = HTMLWebViewElement & {
  getWebContentsId?: () => number
  getURL?: () => string
  send?: (channel: string, ...args: unknown[]) => void
  reload?: () => void
}

type PreviewIpcMessage = Event & { channel?: string; args?: unknown[] }

const PREVIEW_PICK_START = 'euik-preview-picker:start'
const PREVIEW_PICK_CANCEL = 'euik-preview-picker:cancel'
const PREVIEW_PICK_RESULT = 'euik-preview-picker:result'
const PREVIEW_PICK_PROBE = 'euik-preview-picker:probe'
const PREVIEW_PICK_READY = 'euik-preview-picker:ready'

/** Target application preview. Selection executes inside the Electron guest. */
export const CapabilityPreview = forwardRef<CapabilityPreviewHandle, Props>(
  function CapabilityPreview({ bridge, projectId, project }, ref) {
    const [state, setState] = useState<PreviewState>({ status: 'idle' })
    const webviewRef = useRef<HTMLWebViewElement | null>(null)
    const guestReadyRef = useRef(false)
    const pickerPreloadReadyRef = useRef(false)
    const pendingPickRef = useRef<{
      resolve: (value: SelectionEvidence | null) => void
      reject: (cause: Error) => void
      timer: ReturnType<typeof setTimeout>
    } | null>(null)
    const settlePendingPick = useCallback((value: SelectionEvidence | null, cause?: Error) => {
      const pending = pendingPickRef.current
      if (!pending) return
      pendingPickRef.current = null
      clearTimeout(pending.timer)
      if (cause) pending.reject(cause)
      else pending.resolve(value)
    }, [])
    const guestListenersRef = useRef<{
      node: HTMLWebViewElement
      ready: EventListener
      loading: EventListener
      message: EventListener
    } | null>(null)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)
    const isElectron = typeof window !== 'undefined' && window.euikMode === 'electron'
    const setupRequired = state.status === 'error' && /project setup required|dependencies are not installed/i.test(state.message)

    const setWebviewRef = useCallback((node: HTMLWebViewElement | null) => {
      const previous = guestListenersRef.current
      if (previous) {
        ;(previous.node as PreviewWebview).send?.(PREVIEW_PICK_CANCEL)
        previous.node.removeEventListener('dom-ready', previous.ready)
        previous.node.removeEventListener('did-start-loading', previous.loading)
        previous.node.removeEventListener('ipc-message', previous.message)
        guestListenersRef.current = null
      }
      settlePendingPick(null)
      webviewRef.current = node
      guestReadyRef.current = false
      pickerPreloadReadyRef.current = false
      if (!node) return
      const loading: EventListener = () => {
        guestReadyRef.current = false
        pickerPreloadReadyRef.current = false
        settlePendingPick(null)
      }
      const ready: EventListener = () => {
        guestReadyRef.current = true
        ;(node as PreviewWebview).send?.(PREVIEW_PICK_PROBE)
      }
      const message: EventListener = (rawEvent) => {
        const event = rawEvent as PreviewIpcMessage
        if (event.channel === PREVIEW_PICK_READY) {
          pickerPreloadReadyRef.current = true
          return
        }
        if (event.channel !== PREVIEW_PICK_RESULT) return
        const value = event.args?.[0]
        if (value === null || value === undefined) {
          settlePendingPick(null)
          return
        }
        if (
          typeof value !== 'object'
          || typeof (value as Partial<SelectionEvidence>).selector !== 'string'
          || typeof (value as Partial<SelectionEvidence>).elementTag !== 'string'
        ) {
          settlePendingPick(null, new Error('The target-app Preview returned invalid selection evidence.'))
          return
        }
        settlePendingPick(value as SelectionEvidence)
      }
      guestListenersRef.current = { node, ready, loading, message }
      node.addEventListener('did-start-loading', loading)
      node.addEventListener('dom-ready', ready)
      node.addEventListener('ipc-message', message)
    }, [settlePendingPick])

    const waitForGuestReady = useCallback(async () => {
      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        const guest = webviewRef.current as PreviewWebview | null
        // `dom-ready` can fire between custom-element connection and React's
        // ref callback on slower Windows runners. A live guest identity at the
        // requested URL is authoritative when that one-shot event was missed.
        if ((guest?.getWebContentsId?.() ?? 0) > 0 && guest?.getURL?.()) {
          guestReadyRef.current = true
          guest.send?.(PREVIEW_PICK_PROBE)
          if (pickerPreloadReadyRef.current) return
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error('The target-app Preview picker did not load. Reload the Preview, then try selecting an element again.')
    }, [])

    const start = async () => {
      if (!projectId) return
      setState({ status: 'starting' })
      try {
        const [launched, preloadUrl] = await Promise.all([
          bridge.launchApp(projectId, { open: false }),
          isElectron ? bridge.getPreviewPreloadUrl() : Promise.resolve(undefined),
        ])
        setState({ status: 'ready', url: launched.url, preloadUrl })
      } catch (cause) {
        setState({
          status: 'error',
          message: cause instanceof Error ? cause.message : String(cause),
        })
      }
    }

    const installAndRetry = async () => {
      if (!projectId) return
      setState({ status: 'installing' })
      try {
        const run = await bridge.createRun(projectId)
        const result = await bridge.installDependencies(run.id)
        if (result.status !== 'passed') {
          setState({
            status: 'error',
            message: `Dependency installation failed${result.exitCode === null ? '' : ` (exit ${result.exitCode})`}. Review the package-manager output, then retry setup.`,
          })
          return
        }
        await start()
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
        await waitForGuestReady()
        const guest = webviewRef.current as PreviewWebview | null
        if (!guest?.getWebContentsId?.() || !guest.send) {
          throw new Error('The target-app Preview guest is unavailable.')
        }
        settlePendingPick(null)
        return new Promise<SelectionEvidence | null>((resolve, reject) => {
          const timer = setTimeout(() => {
            guest.send?.(PREVIEW_PICK_CANCEL)
            settlePendingPick(null, new Error('Element selection timed out; try again.'))
          }, 5 * 60 * 1000)
          pendingPickRef.current = { resolve, reject, timer }
          try {
            guest.send?.(PREVIEW_PICK_START)
          } catch (cause) {
            settlePendingPick(null, cause instanceof Error ? cause : new Error(String(cause)))
          }
        })
      },
    }), [isElectron, settlePendingPick, state, waitForGuestReady])

    const reload = () => {
      if (isElectron) {
        ;(webviewRef.current as PreviewWebview | null)?.reload?.()
      } else if (iframeRef.current && state.status === 'ready') {
        iframeRef.current.src = state.url
      }
    }

    return (
      <div className="app-preview capability-app-preview" aria-label="Target application Preview">
        <div className="app-preview-shell">
          <div className="hstack between app-preview-chrome">
            <span className="overline">Target application Preview{project?.name ? ` · ${project.name}` : ''}</span>
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
              <webview ref={setWebviewRef} className="app-preview-frame" src={state.url} preload={state.preloadUrl} />
            ) : (
              <iframe ref={iframeRef} className="app-preview-frame" src={state.url} title="Target application Preview" />
            )
          ) : (
            <div
              className="app-preview-frame app-preview-placeholder"
              role={state.status === 'error' ? 'alert' : 'status'}
            >
              <div className="placeholder-preview-copy">
                <strong>
                  {state.status === 'starting'
                    ? 'Starting target application…'
                    : state.status === 'installing'
                      ? 'Setting up this project…'
                      : setupRequired
                        ? 'Project setup required'
                        : 'Preview unavailable'}
                </strong>
                {state.status === 'error' ? <p>{state.message}</p> : null}
                {state.status === 'installing' ? <p>Installing dependencies with the project’s package manager. This can take a few minutes.</p> : null}
                {state.status !== 'starting' && state.status !== 'installing' ? (
                  <div className="cap-preview-recovery-actions" role="group" aria-label="Preview recovery actions">
                    {setupRequired ? (
                      <button type="button" className="btn btn-primary btn-compact" onClick={() => void installAndRetry()}>
                        Install dependencies and retry
                      </button>
                    ) : null}
                    <button type="button" className="btn btn-secondary btn-compact" onClick={() => void start()}>
                      {setupRequired ? 'Retry Preview' : 'Start Preview'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  },
)
