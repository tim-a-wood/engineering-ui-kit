# Build capability parity checklist

Maps every interactive control from the four legacy full-page views to its location in the consolidated Build view.

## PrepareContextView → Project context / Handoff

| Legacy control / capability | New location | Status |
| --- | --- | --- |
| Repository name + path | `ProjectContextPanel` repo row | Preserved |
| Change project | `ProjectContextPanel` / `BuildTaskPanel` Change → `projects` | Preserved |
| What to include (4 categories) | `ContextPrivacyDialog` | Preserved |
| Output format flat file + JSON | `OutputUploadDialog` | Preserved |
| Excluded categories Show/Hide | `ContextPrivacyDialog` | Preserved |
| Warnings after generation | `ContextPrivacyDialog` | Preserved |
| Company-policy info banner | `ContextPrivacyDialog` | Preserved |
| Context result stats + path | `ContextPrivacyDialog` + Handoff readiness row | Preserved |
| Generate / Regenerate Context | `ContextPrivacyDialog` + `HandoffWorkspace` | Preserved |
| Continue to Task Packet | Handoff primary CTA → build packet (same view) | Preserved (in-view) |
| Before evidence (`EvidenceSection` phase=before) | `BeforeEvidenceDialog` | Preserved |
| Advanced options toggle | Exclusion Show/Hide in privacy dialog | Preserved |
| Guide link prepare-context | Build uses `workflow-overview` guide | Preserved (broader topic) |

## CreateTaskPacketView → BuildTaskPanel / Handoff

| Legacy control / capability | New location | Status |
| --- | --- | --- |
| Project association + Change | `BuildTaskPanel` project chip | Preserved |
| Recipe badge | `BuildTaskPanel` | Preserved |
| Template select | `BuildTaskPanel` | Preserved |
| Use template / Replace content / Keep current | `BuildTaskPanel` | Preserved |
| Launch-default seeding from template | `BuildView.onUseTemplate` | Preserved |
| Task title field | `BuildTaskPanel` (always visible) | Preserved |
| Goal / Scope / Constraints / Acceptance / References | Goal always visible; others progressive disclosure | Preserved |
| Edit / Save / Cancel per section | `BuildTaskPanel` | Preserved |
| Validation summary + field errors | `BuildTaskPanel` | Preserved |
| Feedback iteration prefill | `BuildView` useEffect (same bridge logic) | Preserved |
| Preview Task Packet modal | `HandoffWorkspace` Preview → `TaskPacketPreviewModal` | Preserved |
| Export / Rebuild Task Packet | `HandoffWorkspace` Prepare/Regenerate packet | Preserved |
| Continue → Run in Copilot | Handoff Open in Copilot / Copilot tab | Preserved (in-view) |
| Packet stale after field edit | `BuildView` local `packetStale` | Preserved (new explicit flag) |

## RunInCopilotView → CopilotWorkspace (+ Handoff actions)

| Legacy control / capability | New location | Status |
| --- | --- | --- |
| Upload file list + slot count | `CopilotWorkspace` | Preserved |
| Replace files | Copilot → Handoff tab | Preserved |
| Drag upload chip | `CopilotWorkspace` | Preserved |
| Copy Files | Copilot + Handoff mini-actions | Preserved |
| Show Files in Folder | Copilot + Handoff mini-actions | Preserved |
| Open Copilot (copies prompt) | Copilot + Handoff | Preserved |
| Recommended prompt display | `CopilotWorkspace` | Preserved |
| Copy Recommended Prompt | Copilot + Handoff | Preserved |
| Expected-output info banner | `CopilotWorkspace` | Preserved |
| I have the overlay — Continue | Switches to Overlay tab | Preserved (in-view) |

## ApplyZipOverlayView → OverlayWorkspace

| Legacy control / capability | New location | Status |
| --- | --- | --- |
| Select ui-overlay.zip / Select different zip | `OverlayWorkspace` | Preserved |
| Selecting new zip clears inspection + applied | `BuildView.pickAndInspect` | Preserved |
| Inspection verdict badges | `OverlayWorkspace` | Preserved |
| Entry table (path/action/size) | `OverlayWorkspace` | Preserved |
| Hard blockers + Copy Fix Prompt | `OverlayWorkspace` | Preserved |
| Reopen Copilot link | Overlay → Copilot tab | Preserved |
| Warning acceptance checkbox | `OverlayWorkspace` | Preserved |
| Zip contents tree | `OverlayWorkspace` | Preserved |
| Apply Overlay (gated by canApply) | `OverlayWorkspace` | Preserved |
| Blocked overlay never applyable | Same `canApply` logic | Preserved |
| Applied files list | `OverlayWorkspace` | Preserved |
| Continue to Verify & Review | **Continue to Test** → `verify-review` | Renamed |

## N/A / not invented

| Capability | Note |
| --- | --- |
| Visual reference file picker | No picker existed in Prepare Context / Create Task Packet. Documented in `OutputUploadDialog` as N/A. Do not invent. |
| Drag-drop zip onto Overlay | Legacy used picker only (`pickZipFile`). Picker retained; no new drag-drop invented. |

## VerifyReviewView (minimal edits only)

| Change | Location |
| --- | --- |
| Page title → Test | `VerifyReviewView` PageHeader |
| Stepper activeView stays `verify-review` | Unchanged (displays as Test via WORKFLOW_STEPS) |
| Back / onBack → `apply-zip-overlay` | Unchanged (App resolves to Build/Overlay) |
| New Task Packet → `create-task-packet` | Unchanged (App resolves to Build/Handoff) |
| All other Verify body | Unchanged |
