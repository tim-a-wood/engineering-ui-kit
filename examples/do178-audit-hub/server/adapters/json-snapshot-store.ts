import { access, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  EvidenceSnapshot,
  OverlayEnvelope,
  WorkspaceConfiguration,
  WorkspaceState,
} from '../domain/model.js'
import type { SnapshotStorePort } from '../ports/outbound.js'
import { atomicWriteJson, readJson } from '../lib/files.js'

const EMPTY_STATE: WorkspaceState = { configurations: [] }

export class JsonSnapshotStore implements SnapshotStorePort {
  constructor(readonly dataDirectory: string) {}

  private statePath(): string {
    return join(this.dataDirectory, 'workspace-state.json')
  }

  private configurationPath(workspaceId: string): string {
    return join(this.dataDirectory, 'workspaces', workspaceId, 'configuration.json')
  }

  private snapshotPath(workspaceId: string, snapshotId: string): string {
    return join(this.dataDirectory, 'workspaces', workspaceId, 'snapshots', `${snapshotId}.json`)
  }

  private currentPath(workspaceId: string): string {
    return join(this.dataDirectory, 'workspaces', workspaceId, 'current-snapshot.json')
  }

  private overlayPath(workspaceId: string): string {
    return join(this.dataDirectory, 'workspaces', workspaceId, 'overlay.json')
  }

  async loadWorkspaceState(): Promise<WorkspaceState> {
    return (await readJson<WorkspaceState>(this.statePath())) ?? EMPTY_STATE
  }

  async saveWorkspaceState(state: WorkspaceState): Promise<void> {
    await atomicWriteJson(this.statePath(), state)
  }

  async saveWorkspaceConfiguration(configuration: WorkspaceConfiguration): Promise<void> {
    await atomicWriteJson(this.configurationPath(configuration.id), configuration)
    const state = await this.loadWorkspaceState()
    const configurations = [
      ...state.configurations.filter((candidate) => candidate.id !== configuration.id),
      configuration,
    ].sort((a, b) => a.name.localeCompare(b.name))
    await this.saveWorkspaceState({
      ...state,
      configurations,
      ...(configuration.kind === 'real' ? { lastRealWorkspaceId: configuration.id } : {}),
    })
  }

  async getWorkspaceConfiguration(workspaceId: string): Promise<WorkspaceConfiguration | undefined> {
    return readJson<WorkspaceConfiguration>(this.configurationPath(workspaceId))
  }

  async listWorkspaceConfigurations(): Promise<WorkspaceConfiguration[]> {
    const state = await this.loadWorkspaceState()
    const configurations: WorkspaceConfiguration[] = []
    for (const entry of state.configurations) {
      configurations.push((await this.getWorkspaceConfiguration(entry.id)) ?? entry)
    }
    return configurations
  }

  async publish(snapshot: EvidenceSnapshot): Promise<EvidenceSnapshot> {
    const destination = this.snapshotPath(snapshot.workspace.id, snapshot.snapshotId)
    try {
      await access(destination)
      const existing = await readJson<EvidenceSnapshot>(destination)
      if (existing?.contentHash !== snapshot.contentHash) {
        throw new Error(`immutable snapshot collision: ${snapshot.snapshotId}`)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      await atomicWriteJson(destination, snapshot)
    }
    await atomicWriteJson(this.currentPath(snapshot.workspace.id), {
      snapshotId: snapshot.snapshotId,
      contentHash: snapshot.contentHash,
      publishedAt: snapshot.publishedAt,
    })
    const state = await this.loadWorkspaceState()
    await this.saveWorkspaceState({
      ...state,
      selectedWorkspaceId: snapshot.workspace.id,
      selectedSnapshotId: snapshot.snapshotId,
    })
    return snapshot
  }

  async getSnapshot(workspaceId: string, snapshotId?: string): Promise<EvidenceSnapshot | undefined> {
    let resolved = snapshotId
    if (!resolved) {
      const current = await readJson<{ snapshotId: string }>(this.currentPath(workspaceId))
      resolved = current?.snapshotId
    }
    if (!resolved) return undefined
    return readJson<EvidenceSnapshot>(this.snapshotPath(workspaceId, resolved))
  }

  async listSnapshots(workspaceId: string): Promise<EvidenceSnapshot[]> {
    const directory = join(this.dataDirectory, 'workspaces', workspaceId, 'snapshots')
    try {
      const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort()
      const snapshots = await Promise.all(names.map((name) => readJson<EvidenceSnapshot>(join(directory, name))))
      return snapshots.filter((snapshot): snapshot is EvidenceSnapshot => Boolean(snapshot))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  async getOverlay(workspaceId: string): Promise<OverlayEnvelope> {
    return (await readJson<OverlayEnvelope>(this.overlayPath(workspaceId))) ?? {
      workspaceId,
      revision: 0,
      updatedAt: new Date(0).toISOString(),
      findings: {},
      reviews: [],
      packages: [],
      preferences: {},
      activity: [],
    }
  }

  async saveOverlay(
    workspaceId: string,
    overlay: OverlayEnvelope,
    expectedRevision?: number,
  ): Promise<OverlayEnvelope> {
    const current = await this.getOverlay(workspaceId)
    if (expectedRevision !== undefined && expectedRevision !== current.revision) {
      throw new Error(`stale overlay revision: expected ${expectedRevision}, current ${current.revision}`)
    }
    const saved: OverlayEnvelope = {
      ...overlay,
      workspaceId,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    }
    await atomicWriteJson(this.overlayPath(workspaceId), saved)
    return saved
  }

  async resetOverlay(workspaceId: string): Promise<OverlayEnvelope> {
    const current = await this.getOverlay(workspaceId)
    const reset: OverlayEnvelope = {
      workspaceId,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
      findings: {},
      reviews: [],
      packages: [],
      preferences: {},
      activity: [
        {
          at: new Date().toISOString(),
          kind: 'sample-reset',
          message: 'Reset sample overlay to bundled state.',
        },
      ],
    }
    await atomicWriteJson(this.overlayPath(workspaceId), reset)
    return reset
  }

  async ensureDirectory(): Promise<void> {
    await mkdir(this.dataDirectory, { recursive: true })
  }
}
