/**
 * §4, §17.3, §20.2, §25.3: project setup panel, `project` mode only.
 *
 * Second-review P1 finding: "the GUI routes configured projects through the
 * bridge, but nothing configures the repository adapter or project roles."
 * This panel is the fix: it shows and configures the project's real
 * repository root (`adapter:configureProjectRepository` /
 * `adapter:getProjectRepository`: shipped, see `designIpc.ts`), shows the
 * real session principal (`adapter:getPrincipal`), and grants the full §4
 * authority list to that principal (`adapter:configureProjectRoles`). The
 * latter two operation names are reserved in `ADAPTER_OPERATIONS`
 * (`apps/desktop/src/capabilities/designBridge.ts`) but not implemented in
 * `designIpc.ts` as of this packet: every read/action below degrades to an
 * honest "requires a newer desktop build" message on the adapter's
 * `EUC16-UNKNOWN-OPERATION` response instead of failing silently or
 * pretending to succeed (see `designState.ts` `readPrincipal` /
 * `grantDesignAuthoritiesToSessionUser`, and `designBridgeClient.ts` for the
 * exact anticipated wire shapes).
 */

import { useEffect, useState, type FormEvent } from 'react'
import { ALL_DESIGN_AUTHORITIES, useDesignState, type DesignStore } from './designState'

export type ProjectSetupPanelProps = {
  store: DesignStore
  suggestedRepositoryRoot?: string
}

export function ProjectSetupPanel(props: ProjectSetupPanelProps) {
  const { store } = props
  const state = useDesignState(store)
  const [repositoryRootInput, setRepositoryRootInput] = useState(props.suggestedRepositoryRoot ?? '')

  useEffect(() => {
    void store.loadProjectSetup()
    // Reload once per mounted panel instance (e.g. every time the user opens
    // the Setup tab): never on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store])

  function submitRepositoryRoot(event: FormEvent) {
    event.preventDefault()
    const value = repositoryRootInput.trim()
    if (!value) return
    void store.configureRepositoryRoot(value)
  }

  const { repositoryConfig, principal, rolesGrant } = state
  const repositoryReady = repositoryConfig.status === 'configured'
  const principalReady = principal.status === 'ready'
  const rolesReady = rolesGrant.status === 'granted'
  const busy = repositoryConfig.status === 'loading' || principal.status === 'loading' || rolesGrant.status === 'loading'

  async function completeSetup() {
    if (!repositoryReady && repositoryRootInput.trim()) {
      const configured = await store.configureRepositoryRoot(repositoryRootInput.trim())
      if (!configured.ok) return
    }
    if (!rolesReady) await store.grantDesignAuthoritiesToSessionUser()
  }

  return (
    <section className="design-project-setup" aria-label="Project setup">
      <header>
        <div>
          <p className="overline">Project readiness</p>
          <h2>{repositoryReady && principalReady && rolesReady ? 'Setup complete' : 'Complete project setup'}</h2>
          <p className="secondary-text">Confirm the repository and your review authority before you approve design work.</p>
        </div>
        <span className={repositoryReady && principalReady && rolesReady ? 'ready' : 'pending'}>
          {[repositoryReady, principalReady, rolesReady].filter(Boolean).length} of 3 ready
        </span>
      </header>

      <div className="design-project-readiness">
        <div
          className={repositoryReady ? 'ready' : 'pending'}
          data-testid={repositoryReady ? 'design-repository-root-configured' : 'design-repository-root-not-configured'}
        >
          <span>{repositoryReady ? '✓' : '1'}</span>
          <b>Repository</b>
          <small>{repositoryReady ? repositoryConfig.repositoryRoot : repositoryConfig.status === 'not-configured' ? repositoryConfig.message : 'Needs a local path'}</small>
        </div>
        <div className={principalReady ? 'ready' : 'pending'}><span>{principalReady ? '✓' : '2'}</span><b>Session user</b><small>{principalReady ? principal.principal : principal.status === 'error' ? principal.message : 'Checking identity'}</small></div>
        <div className={rolesReady ? 'ready' : 'pending'} data-testid={rolesReady ? 'design-roles-granted' : undefined}><span>{rolesReady ? '✓' : '3'}</span><b>Review authority</b><small>{rolesReady ? `${rolesGrant.authorities.length} authorities granted to ${rolesGrant.principal}` : 'Needs confirmation'}</small></div>
      </div>

      {!repositoryReady && (
        <form className="design-project-setup-form" onSubmit={submitRepositoryRoot}>
          <label htmlFor="design-repository-root-input">Repository root</label>
          <input
            id="design-repository-root-input"
            type="text"
            value={repositoryRootInput}
            onChange={(event) => setRepositoryRootInput(event.target.value)}
            placeholder="/absolute/path/to/repository"
          />
        </form>
      )}

      {!(repositoryReady && principalReady && rolesReady) && (
        <button type="button" className="btn btn-primary" disabled={busy || (!repositoryReady && !repositoryRootInput.trim())} onClick={() => void completeSetup()}>
          {busy ? 'Checking setup…' : 'Complete setup'}
        </button>
      )}

      {[repositoryConfig, principal, rolesGrant].some((item) => item.status === 'error') && (
        <div role="alert" className="design-project-error">
          {'message' in repositoryConfig && repositoryConfig.status === 'error' ? <p>{repositoryConfig.message}</p> : null}
          {'message' in principal && principal.status === 'error' ? <p>{principal.message}</p> : null}
          {'message' in rolesGrant && rolesGrant.status === 'error' ? <p>{rolesGrant.message}</p> : null}
        </div>
      )}

      {[principal, rolesGrant].some((item) => item.status === 'unavailable') && (
        <div role="status" className="design-project-notice">
          {'message' in principal && principal.status === 'unavailable' ? <p>{principal.message}</p> : null}
          {'message' in rolesGrant && rolesGrant.status === 'unavailable' ? <p>{rolesGrant.message}</p> : null}
        </div>
      )}

      <details>
        <summary>Authority details</summary>
        <p>{ALL_DESIGN_AUTHORITIES.join(', ')}</p>
      </details>
    </section>
  )
}
