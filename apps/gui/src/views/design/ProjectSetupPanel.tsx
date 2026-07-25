/**
 * §4, §17.3, §20.2, §25.3 — project setup panel, `project` mode only.
 *
 * Second-review P1 finding: "the GUI routes configured projects through the
 * bridge, but nothing configures the repository adapter or project roles."
 * This panel is the fix: it shows and configures the project's real
 * repository root (`adapter:configureProjectRepository` /
 * `adapter:getProjectRepository` — shipped, see `designIpc.ts`), shows the
 * real session principal (`adapter:getPrincipal`), and grants the full §4
 * authority list to that principal (`adapter:configureProjectRoles`). The
 * latter two operation names are reserved in `ADAPTER_OPERATIONS`
 * (`apps/desktop/src/capabilities/designBridge.ts`) but not implemented in
 * `designIpc.ts` as of this packet — every read/action below degrades to an
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
}

export function ProjectSetupPanel(props: ProjectSetupPanelProps) {
  const { store } = props
  const state = useDesignState(store)
  const [repositoryRootInput, setRepositoryRootInput] = useState('')

  useEffect(() => {
    void store.loadProjectSetup()
    // Reload once per mounted panel instance (e.g. every time the user opens
    // the Setup tab) — never on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store])

  function submitRepositoryRoot(event: FormEvent) {
    event.preventDefault()
    const value = repositoryRootInput.trim()
    if (!value) return
    void store.configureRepositoryRoot(value)
  }

  const { repositoryConfig, principal, rolesGrant } = state

  return (
    <section className="design-project-setup" aria-label="Project setup">
      <h2>Project setup</h2>
      <p className="secondary-text">
        Configure this project&apos;s real repository and grant this session&apos;s design authorities here. An approval or build action that fails because
        nothing is configured yet links back to this panel.
      </p>

      <div className="design-project-setup-section">
        <h3>Repository root</h3>
        {repositoryConfig.status === 'loading' && (
          <p role="status" className="secondary-text">
            Loading…
          </p>
        )}
        {repositoryConfig.status === 'configured' && (
          <p data-testid="design-repository-root-configured">
            Configured repository: <code>{repositoryConfig.repositoryRoot}</code>
          </p>
        )}
        {repositoryConfig.status === 'not-configured' && (
          <p className="secondary-text" role="status" data-testid="design-repository-root-not-configured">
            {repositoryConfig.message}
          </p>
        )}
        {repositoryConfig.status === 'error' && (
          <p role="alert" className="design-project-error">
            {repositoryConfig.message}
          </p>
        )}

        <form className="design-project-setup-form" onSubmit={submitRepositoryRoot}>
          <label htmlFor="design-repository-root-input">Configure repository root</label>
          <div className="field-row">
            <input
              id="design-repository-root-input"
              type="text"
              value={repositoryRootInput}
              onChange={(event) => setRepositoryRootInput(event.target.value)}
              placeholder="/absolute/path/to/repository"
            />
            <button type="submit" className="btn btn-primary" disabled={!repositoryRootInput.trim()}>
              Configure repository root
            </button>
          </div>
        </form>
      </div>

      <div className="design-project-setup-section">
        <h3>Session principal</h3>
        {principal.status === 'loading' && (
          <p role="status" className="secondary-text">
            Loading…
          </p>
        )}
        {principal.status === 'ready' && (
          <p>
            Signed in as <strong>{principal.principal}</strong>.
          </p>
        )}
        {principal.status === 'unavailable' && (
          <p className="secondary-text" role="status">
            {principal.message}
          </p>
        )}
        {principal.status === 'error' && (
          <p role="alert" className="design-project-error">
            {principal.message}
          </p>
        )}
      </div>

      <div className="design-project-setup-section">
        <h3>Design authorities</h3>
        <p className="secondary-text">
          Grants every §4 design authority ({ALL_DESIGN_AUTHORITIES.join(', ')}) to this session&apos;s user for this project — an approval such as
          &quot;Approve module design&quot; is rejected with &quot;no project role is configured for actor …&quot; until this has been done at least once.
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => void store.grantDesignAuthoritiesToSessionUser()}>
          Grant design authorities to this session user
        </button>
        {rolesGrant.status === 'loading' && (
          <p role="status" className="secondary-text">
            Granting…
          </p>
        )}
        {rolesGrant.status === 'granted' && (
          <p role="status" data-testid="design-roles-granted">
            Granted {rolesGrant.authorities.length} authorit{rolesGrant.authorities.length === 1 ? 'y' : 'ies'} to {rolesGrant.principal}.
          </p>
        )}
        {rolesGrant.status === 'unavailable' && (
          <p className="secondary-text" role="status">
            {rolesGrant.message}
          </p>
        )}
        {rolesGrant.status === 'error' && (
          <p role="alert" className="design-project-error">
            {rolesGrant.message}
          </p>
        )}
      </div>
    </section>
  )
}
