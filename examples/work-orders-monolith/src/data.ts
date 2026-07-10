/**
 * Seed data + localStorage persistence for the PlantOps work-order monolith.
 * Deliberately simple: one storage key, whole-state save on every mutation.
 */

export type OrderStatus = 'open' | 'in-progress' | 'blocked' | 'done'
export type OrderPriority = 'low' | 'medium' | 'high' | 'critical'

export type WorkOrder = {
  id: string
  title: string
  assetId: string
  status: OrderStatus
  priority: OrderPriority
  assignee: string
  dueDate: string // yyyy-mm-dd
  createdAt: string
  description: string
}

export type Asset = {
  id: string
  name: string
  kind: 'pump' | 'motor' | 'conveyor' | 'sensor' | 'hvac'
  location: string
  health: 'ok' | 'degraded' | 'down'
}

export type Settings = {
  siteName: string
  emailAlerts: boolean
  dailyDigest: boolean
  retentionDays: number
}

export type AppState = {
  orders: WorkOrder[]
  assets: Asset[]
  settings: Settings
}

const KEY = 'plantops-state-v1'

const day = (offset: number): string => {
  const d = new Date(Date.now() + offset * 864e5)
  return d.toISOString().slice(0, 10)
}

export const SEED: AppState = {
  assets: [
    { id: 'AST-101', name: 'Feed pump P-12', kind: 'pump', location: 'Hall A', health: 'degraded' },
    { id: 'AST-102', name: 'Main drive motor M-3', kind: 'motor', location: 'Hall A', health: 'ok' },
    { id: 'AST-103', name: 'Packaging conveyor C-7', kind: 'conveyor', location: 'Hall B', health: 'ok' },
    { id: 'AST-104', name: 'Vibration sensor grid VS-2', kind: 'sensor', location: 'Hall A', health: 'down' },
    { id: 'AST-105', name: 'Roof HVAC unit H-1', kind: 'hvac', location: 'Roof', health: 'ok' },
    { id: 'AST-106', name: 'Transfer pump P-19', kind: 'pump', location: 'Hall B', health: 'ok' },
    { id: 'AST-107', name: 'Cooling loop sensor VS-9', kind: 'sensor', location: 'Hall B', health: 'degraded' },
    { id: 'AST-108', name: 'Dock conveyor C-2', kind: 'conveyor', location: 'Dock', health: 'ok' },
  ],
  orders: [
    { id: 'WO-1041', title: 'Replace worn impeller on feed pump', assetId: 'AST-101', status: 'in-progress', priority: 'high', assignee: 'D. Okafor', dueDate: day(1), createdAt: day(-6), description: 'Cavitation noise reported on night shift. Impeller kit in stock (bin 14-C).' },
    { id: 'WO-1042', title: 'Vibration sensor grid offline', assetId: 'AST-104', status: 'blocked', priority: 'critical', assignee: 'S. Lindqvist', dueDate: day(-1), createdAt: day(-4), description: 'Gateway unreachable. Waiting on network segment change (IT-2291).' },
    { id: 'WO-1043', title: 'Quarterly lubrication — main drive', assetId: 'AST-102', status: 'open', priority: 'medium', assignee: 'D. Okafor', dueDate: day(4), createdAt: day(-3), description: 'Standard PM per schedule LUB-Q. Use grease spec G-220.' },
    { id: 'WO-1044', title: 'Belt tracking drift on packaging line', assetId: 'AST-103', status: 'open', priority: 'high', assignee: 'M. Reyes', dueDate: day(2), createdAt: day(-2), description: 'Belt drifting left ~8mm at speed. Check tensioner and lagging wear.' },
    { id: 'WO-1045', title: 'HVAC filter change — roof unit', assetId: 'AST-105', status: 'done', priority: 'low', assignee: 'M. Reyes', dueDate: day(-3), createdAt: day(-9), description: 'Completed. Filters logged in consumables ledger.' },
    { id: 'WO-1046', title: 'Cooling loop sensor drift investigation', assetId: 'AST-107', status: 'in-progress', priority: 'medium', assignee: 'S. Lindqvist', dueDate: day(3), createdAt: day(-1), description: 'Readings drift +0.4°C/day against reference. Recalibrate and trend for 48h.' },
    { id: 'WO-1047', title: 'Dock conveyor emergency stop test', assetId: 'AST-108', status: 'open', priority: 'medium', assignee: 'Unassigned', dueDate: day(6), createdAt: day(-1), description: 'Monthly safety test per SOP-E14. Record stop distance.' },
    { id: 'WO-1048', title: 'Transfer pump seal inspection', assetId: 'AST-106', status: 'done', priority: 'medium', assignee: 'D. Okafor', dueDate: day(-5), createdAt: day(-12), description: 'Seal faces within tolerance. Next inspection in 90 days.' },
    { id: 'WO-1049', title: 'Spare parts audit — Hall A pumps', assetId: 'AST-101', status: 'open', priority: 'low', assignee: 'M. Reyes', dueDate: day(9), createdAt: day(0), description: 'Reconcile bin counts against CMMS export.' },
    { id: 'WO-1050', title: 'Motor thermal imaging survey', assetId: 'AST-102', status: 'done', priority: 'high', assignee: 'S. Lindqvist', dueDate: day(-8), createdAt: day(-15), description: 'No hotspots found. Report filed under TI-2026-06.' },
  ],
  settings: { siteName: 'Northfield Plant 2', emailAlerts: true, dailyDigest: false, retentionDays: 365 },
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as AppState
  } catch {
    /* fall through to seed */
  }
  return structuredClone(SEED)
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function nextOrderId(orders: WorkOrder[]): string {
  const max = orders.reduce((m, o) => Math.max(m, Number(o.id.replace('WO-', '')) || 0), 1000)
  return `WO-${max + 1}`
}
