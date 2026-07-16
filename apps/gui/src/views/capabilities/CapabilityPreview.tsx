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
  | { status: 'ready'; url: string; preloadUrl: string }
  | { status: 'error'; message: string }

type PreviewWebview = HTMLWebViewElement & {
  getWebContentsId?: () => number
  getURL?: () => string
  reload?: () => void
}

/** Target application preview. Selection executes inside the Electron guest. */
export const CapabilityPreview = forwardRef<CapabilityPreviewHandle, Props>(
  function CapabilityPreview({ bridge, projectId, project }, ref) {
    const [state, setState] = useState<PreviewState>({ status: 'idle' })
    const webviewRef = useRef<HTMLWebViewElement | null>(null)
    const guestReadyRef = useRef(false)
    const guestListenersRef = useRef<{
      node: HTMLWebViewElement
      ready: EventListener
      loading: EventListener
    } | null>(null)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)
    const isElectron = typeof window !== 'undefined' && window.euikMode === 'electron'
    const setupRequired = state.status === 'error' && /project setup required|dependencies are not installed/i.test(state.message)

    const setWebviewRef = useCallback((node: HTMLWebViewElement | null) => {
      const previous = guestListenersRef.current
      if (previous) {
        previous.node.removeEventListener('dom-ready', previous.ready)
        previous.node.removeEventListener('did-start-loading', previous.loading)
        guestListenersRef.current = null
      }
      webviewRef.current = node
      guestReadyRef.current = false
      if (!node) return
      const loading: EventListener = () => {
        guestReadyRef.current = false
      }
      const ready: EventListener = () => {
        guestReadyRef.current = true
      }
      guestListenersRef.current = { node, ready, loading }
      node.addEventListener('did-start-loading', loading)
      node.addEventListener('dom-ready', ready)
    }, [])

    const waitForGuestReady = useCallback(async () => {
      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        const guest = webviewRef.current as PreviewWebview | null
        // `dom-ready` can fire between custom-element connection and React's
        // ref callback on slower Windows runners. A live guest identity at the
        // requested URL is authoritative when that one-shot event was missed.
        if ((guest?.getWebContentsId?.() ?? 0) > 0 && guest?.getURL?.()) {
          guestReadyRef.current = true
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error('The target-app Preview is still loading. Reload it, then try selecting an element again.')
    }, [])

    const start = async () => {
      if (!projectId) return
      setState({ status: 'starting' })
      try {
        const [launched, preloadUrl] = await Promise.all([
          bridge.launchApp(projectId, { open: false }),
          bridge.getPreviewPreloadUrl(),
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
        const guestId = guest?.getWebContentsId?.()
        if (!guestId) {
          throw new Error('The target-app Preview guest is unavailable.')
        }
        return bridge.pickPreviewElement(guestId)
      },
    }), [bridge, isElectron, state, waitForGuestReady])

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
              <webview preload={state.preloadUrl} ref={setWebviewRef} className="app-preview-frame" src={state.url} />
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
