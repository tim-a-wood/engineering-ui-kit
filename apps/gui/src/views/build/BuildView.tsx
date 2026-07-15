/**
 * Consolidated Build view — Prepare Context + Task Packet + Copilot + Overlay.
 */

import { useEffect, useMemo, useState } from 'react'
import type { AppliedFiles, OverlayInspectionSummary } from '@engineering-ui-kit/core'
import type { PrepareContextResult, TaskPacketFields } from '../../bridge'
import { Dialog, PageHeader, type Status } from '../../components'
import { Icon } from '../../icons'
import {
  PACKET_SECTIONS,
  TaskPacketPreviewModal,
  draftPacketMarkdown,
  formatBytes,
} from '../workflowShared'
import { TASK_TEMPLATES, applyTemplate, defaultTemplateId, parseFeedbackEntries } from '../../taskTemplates'
import type { BuildWorkspaceState } from '../../appState'
import { BuildTaskPanel } from './BuildTaskPanel'
import { ProjectContextPanel } from './ProjectContextPanel'
import { BuildWorkspace } from './BuildWorkspace'
import type { BuildViewProps } from './buildTypes'

export function BuildView(props: BuildViewProps) {
  const persistedTemplateId = props.run.taskTemplateId && TASK_TEMPLATES.some((template) => template.id === props.run.taskTemplateId)
    ? props.run.taskTemplateId
    : undefined
  const [workspace, setWorkspace] = useState<BuildWorkspaceState>(props.initialWorkspace ?? 'handoff')
  const [status, setStatus] = useState<Status>({
    tone: 'info',
    text: persistedTemplateId === 'new-ui-from-requirements' && props.run.taskPacketFields
      ? 'From spec is prefilled from the approved UI module. Review the requirements, then generate the handoff.'
      : 'Define the work, prepare the handoff files, then apply the result zip.',
  })
  const [contextResult, setContextResult] = useState<PrepareContextResult | null>(null)
  const [contextBusy, setContextBusy] = useState(false)
  const [contextStale, setContextStale] = useState(false)
  const [packetBusy, setPacketBusy] = useState(false)
  const [packetStale, setPacketStale] = useState(false)
  const [fields, setFieldsRaw] = useState<TaskPacketFields>(() => {
    if (props.run.taskPacketFields) return { ...props.run.taskPacketFields }
    if (props.recipe) return {
      taskTitle: props.run.taskTitle ?? `Apply recipe: ${props.recipe.title}`,
      goal: props.recipe.goal,
      scope: props.recipe.scope,
      constraints: props.recipe.constraints,
      acceptanceCriteria: props.recipe.acceptanceCriteria,
      references: props.recipe.references,
    }
    const initialTemplate = TASK_TEMPLATES.find((template) => template.id === defaultTemplateId(props.preferredTemplate ?? ''))
    return initialTemplate
      ? { ...applyTemplate(initialTemplate, props.project.name), goal: '', references: '' }
      : { taskTitle: '', goal: '', scope: '', constraints: '', acceptanceCriteria: '', references: '' }
  })
  const [editing, setEditing] = useState<keyof TaskPacketFields | null>(null)
  const [draft, setDraft] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const [templateId, setTemplateIdRaw] = useState(() => persistedTemplateId ?? defaultTemplateId(props.preferredTemplate ?? ''))
  const [confirmTemplate, setConfirmTemplate] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [inspection, setInspection] = useState<OverlayInspectionSummary | null>(null)
  const [warningsAccepted, setWarningsAccepted] = useState(false)
  const [applied, setApplied] = useState<AppliedFiles | null>(null)
  const [overlayBusy, setOverlayBusy] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)

  // Mirror CreateTaskPacketWrapper: intercept buildPacket so App holds the latest packet.
  const originalBuild = props.bridge.buildPacket.bind(props.bridge)
  const bridge = useMemo(() => ({
    ...props.bridge,
    buildPacket: async (runId: string, packetFields: Parameters<typeof originalBuild>[1]) => {
      const result = await originalBuild(runId, packetFields)
      props.onPacket(result)
      return result
    },
  }), [props.bridge]) // eslint-disable-line react-hooks/exhaustive-deps

  const setTemplateId = (id: string) => {
    setTemplateIdRaw(id)
    void bridge.updateRun(props.run.id, { taskTemplateId: id }).catch(() => {
      setStatus({ tone: 'error', text: 'The selected build mode could not be saved. You can continue in this session.' })
    })
  }

  useEffect(() => {
    if (props.initialWorkspace) setWorkspace(props.initialWorkspace)
  }, [props.initialWorkspace])

  // Iteration feedback prefill (same as CreateTaskPacketView).
  useEffect(() => {
    if (!props.run.appliedFilesPath || !props.run.userReviewNotesPath || props.recipe) return
    let cancelled = false
    void (async () => {
      try {
        const notes = await bridge.getArtifactText(props.run.id, 'user-review-notes.md')
        const builtAt = props.run.taskPacketBuiltAt ? Date.parse(props.run.taskPacketBuiltAt) : 0
        const fresh = parseFeedbackEntries(notes).filter((e) => Date.parse(e.at) > builtAt)
        const template = TASK_TEMPLATES.find((t) => t.id === 'iterate-on-feedback')
        if (cancelled || fresh.length === 0 || !template) return
        setFieldsRaw({
          ...applyTemplate(template, props.project.name),
          scope: fresh.map((e) => e.text).join('\n'),
        })
        setTemplateId('iterate-on-feedback')
        setPacketStale(Boolean(props.run.taskPacketPath || props.run.taskAndStandardPackPath))
        setStatus({
          tone: 'info',
          text: `Iteration packet prefilled from ${fresh.length} saved feedback note${fresh.length === 1 ? '' : 's'} — Scope carries your feedback; the constraints hold the previous design steady. Adjust and export.`,
        })
      } catch { /* notes unreadable — keep the regular prefill */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.run.id])

  const setFields = (updater: TaskPacketFields | ((prev: TaskPacketFields) => TaskPacketFields)) => {
    setFieldsRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      const hadPacket = Boolean(props.packet || props.run.taskPacketPath || props.run.taskAndStandardPackPath)
      if (hadPacket && JSON.stringify(next) !== JSON.stringify(prev)) {
        setPacketStale(true)
      }
      return next
    })
  }

  const addReference = async (sourcePath?: string) => {
    try {
      const added = await bridge.addReferenceFile(props.run.id, sourcePath)
      if (!added) return
      setFields((current) => ({
        ...current,
        references: [current.references.trim(), `Attached file: ${added.name}`].filter(Boolean).join('\n'),
      }))
      await props.refreshRun()
      setStatus({ tone: 'success', text: `${added.name} added as the third Copilot upload file.` })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  const generateContext = async (): Promise<boolean> => {
    setContextBusy(true)
    setStatus({ tone: 'info', text: 'Building repo inventory and flatfile…' })
    try {
      const result = await bridge.prepareContext(props.run.id)
      setContextResult(result)
      setContextStale(false)
      if (props.packet || props.run.taskPacketPath || props.run.taskAndStandardPackPath) {
        setPacketStale(true)
      }
      await props.refreshRun()
      setStatus({
        tone: 'success',
        text: `Context generated: ${result.inventory.includedFileCount} files included, ${result.inventory.excludedFileCount} excluded, ${result.warnings.length} warnings.`,
      })
      return true
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
      return false
    } finally {
      setContextBusy(false)
    }
  }

  const buildPacket = async (opts?: { skipLocalContextGuard?: boolean }): Promise<boolean> => {
    setShowValidation(true)
    const emptyKeys = PACKET_SECTIONS.filter((s) => s.required && !fields[s.key].trim()).map((s) => s.title)
    const titleMissing = !fields.taskTitle.trim()
    if (titleMissing || emptyKeys.length > 0) {
      setStatus({ tone: 'error', text: `Required sections are empty: ${[...(titleMissing ? ['Task title'] : []), ...emptyKeys].join(', ')}.` })
      return false
    }
    if (!opts?.skipLocalContextGuard && !props.run.repoFlatfilePath && !contextResult) {
      setStatus({ tone: 'error', text: 'Generate context before building the task packet.' })
      return false
    }
    setPacketBusy(true)
    setStatus({ tone: 'info', text: 'Building task packet and standard pack…' })
    try {
      const packetResult = await bridge.buildPacket(props.run.id, fields)
      props.onPacket(packetResult)
      setPacketStale(false)
      props.onRecipeConsumed?.()
      await props.refreshRun()
      setStatus({
        tone: 'success',
        text: `Handoff ready: ${packetResult.uploadFiles.length} of 3 file slots used (${formatBytes(packetResult.packBytes)} of instructions).`,
      })
      return true
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
      return false
    } finally {
      setPacketBusy(false)
    }
  }

  const generate = async () => {
    const hasContext = Boolean(contextResult || props.run.repoFlatfilePath)
    if (!hasContext || contextStale) {
      const ok = await generateContext()
      if (!ok) return
      await buildPacket({ skipLocalContextGuard: true })
      return
    }
    await buildPacket()
  }

  const openPreview = async () => {
    if (props.packet || props.run.taskPacketPath) {
      try {
        setPreviewText(await bridge.getArtifactText(props.run.id, 'task-packet.md'))
      } catch {
        setPreviewText(draftPacketMarkdown(fields))
      }
    } else {
      setPreviewText(draftPacketMarkdown(fields))
    }
    setPreviewOpen(true)
  }

  const onUseTemplate = async () => {
    const template = TASK_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    const dirty = Object.values(fields).some((v) => v.trim().length > 0)
    if (dirty && !confirmTemplate) {
      setConfirmTemplate(true)
      setStatus({ tone: 'info', text: 'Applying the template will replace the current section content. Select "Replace content" to confirm.' })
      return
    }
    setFields(applyTemplate(template, props.project.name))
    setConfirmTemplate(false)
    setShowValidation(false)
    let launchNote = ''
    if (template.launchDefaults && !props.project.launchUrl) {
      try {
        await bridge.updateProject(props.project.id, {
          launchUrl: template.launchDefaults.url,
          launchCommand: template.launchDefaults.command,
        })
        await props.refreshProjects()
        launchNote = ` Launch App is pre-configured for ${template.launchDefaults.url} — after Verify builds it, open the running app from Test.`
      } catch { /* non-fatal */ }
    }
    setStatus({ tone: 'success', text: `Template applied: ${template.title}. Review the REPLACE markers and tweak before export.${launchNote}` })
  }

  const inspectOverlayPath = async (providedPath?: string) => {
    const zipPath = providedPath ?? await bridge.pickZipFile()
    if (!zipPath) return
    setOverlayBusy(true)
    setApplied(null)
    setWarningsAccepted(false)
    setInspection(null)
    setStatus({ tone: 'info', text: `Inspecting ${zipPath}…` })
    try {
      const summary = await bridge.inspectOverlay(props.run.id, zipPath)
      setInspection(summary)
      await props.refreshRun()
      setStatus(
        summary.canApply
          ? summary.warnings.length > 0
            ? { tone: 'info', text: `Inspection verdict: warning — ${summary.warnings.length} warnings require explicit acceptance.` }
            : { tone: 'success', text: 'Inspection verdict: pass.' }
          : { tone: 'error', text: `Inspection verdict: blocked — ${summary.hardBlockers.length} hard blockers. This overlay can never be applied; copy the fix prompt below to get a corrected zip from Copilot.` },
      )
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setOverlayBusy(false)
    }
  }

  const applyOverlay = async () => {
    if (!inspection) return
    setOverlayBusy(true)
    try {
      const appliedFiles = await bridge.applyOverlay(props.run.id, warningsAccepted)
      setApplied(appliedFiles)
      await props.refreshRun()
      setStatus({ tone: 'success', text: `Overlay applied: ${appliedFiles.files.length} files.` })
    } catch (error) {
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setOverlayBusy(false)
    }
  }

  const uploadFiles = props.packet?.uploadFiles ?? (props.run.taskAndStandardPackPath
    ? [
        ...(props.run.repoFlatfilePath ? [1] : []),
        1,
      ]
    : [
        ...(props.run.repoFlatfilePath ? [1] : []),
        ...(props.run.taskPacketPath ? [1] : []),
        ...(props.run.standardPackPath ? [1] : []),
      ])
  const uploadSlotCount = Array.isArray(uploadFiles) ? uploadFiles.length : 0
  const packetReady = Boolean(props.packet || props.run.taskPacketPath || props.run.taskAndStandardPackPath) && !packetStale

  const workspaceProps = {
    workspace,
    setWorkspace,
    bridge,
    project: props.project,
    run: props.run,
    refreshRun: props.refreshRun,
    packet: props.packet,
    fields,
    setFields,
    templateId,
    setTemplateId,
    onUseTemplate,
    contextResult,
    contextBusy,
    packetBusy,
    packetStale,
    contextStale,
    status,
    setStatus,
    onGenerateContext: () => { void generateContext() },
    onBuildPacket: () => { void buildPacket() },
    onGenerate: () => { void generate() },
    onPreviewPacket: openPreview,
    onAddReference: addReference,
    onNavigate: props.onNavigate,
    inspection,
    setInspection,
    warningsAccepted,
    setWarningsAccepted,
    applied,
    setApplied,
    overlayBusy,
    onPickAndInspect: () => { void inspectOverlayPath() },
    onInspectOverlayPath: inspectOverlayPath,
    onApplyOverlay: applyOverlay,
  }

  return (
    <>
      <PageHeader
        title="Build"
        icon={Icon.box(24)}
        subtitle="Define the work, send the handoff files to Copilot, then apply the result zip."
        actions={(
          <button
            type="button"
            className="page-step-link"
            disabled={!Boolean(applied || props.run.appliedFilesPath)}
            title={applied || props.run.appliedFilesPath ? 'Go to Test' : 'Apply changes before testing'}
            onClick={() => props.onNavigate('verify-review')}
          >
            Test <span aria-hidden="true">→</span>
          </button>
        )}
      />

      <div className="build-layout build-layout-workspace-first">
        <BuildWorkspace {...workspaceProps} />
      </div>

      {taskOpen && (
        <Dialog title="Task packet" wide onClose={() => setTaskOpen(false)} actions={(
          <button type="button" className="btn btn-primary" onClick={() => setTaskOpen(false)}>Done</button>
        )}>
          <BuildTaskPanel
            project={props.project}
            recipe={props.recipe}
            preferredTemplate={props.preferredTemplate}
            fields={fields}
            setFields={setFields}
            editing={editing}
            setEditing={setEditing}
            draft={draft}
            setDraft={setDraft}
            showValidation={showValidation}
            templateId={templateId}
            setTemplateId={setTemplateId}
            confirmTemplate={confirmTemplate}
            setConfirmTemplate={setConfirmTemplate}
            status={status}
            setStatus={setStatus}
            onUseTemplate={onUseTemplate}
            onNavigate={props.onNavigate}
            packetStale={packetStale}
          />
        </Dialog>
      )}
      {contextOpen && (
        <Dialog title="Project context" wide onClose={() => setContextOpen(false)} actions={(
          <button type="button" className="btn btn-primary" onClick={() => setContextOpen(false)}>Done</button>
        )}>
          <ProjectContextPanel
            bridge={bridge}
            project={props.project}
            run={props.run}
            onNavigate={props.onNavigate}
            contextResult={contextResult}
            contextBusy={contextBusy}
            onGenerateContext={generateContext}
            uploadSlotCount={uploadSlotCount}
            packetReady={packetReady}
          />
        </Dialog>
      )}

      {previewOpen && (
        <TaskPacketPreviewModal text={previewText} onClose={() => setPreviewOpen(false)} />
      )}
    </>
  )
}
