import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono';
import React, { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import {
  AIRCRAFT_VARIANTS,
  CASE_STATUSES,
  FLAP_SETTINGS,
  OPERATIONS,
  RUNWAY_CONDITIONS,
  VARIANT_WEIGHT_LIMITS,
  type AppSnapshot,
  type CalculationReview,
  type CaseInputs,
  type CaseStatus,
  type PerformanceCase,
  type Runway,
  type SweepRequest
} from './shared/contracts';
import './styles.css';

export class ApiRequestError extends Error {
  fieldErrors?: Record<string, string>;

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiRequestError';
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    }
  });

  if (!response.ok) {
    let payload: { error?: string; fieldErrors?: Record<string, string> } = {};
    try {
      payload = await response.json();
    } catch {
      // Preserve the HTTP status fallback below.
    }
    throw new ApiRequestError(payload.error ?? `Request failed (${response.status})`, payload.fieldErrors);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getSnapshot: () => request<AppSnapshot>('/api/snapshot'),
  calculate: (inputs: CaseInputs) =>
    request<CalculationReview>('/api/calculate', { method: 'POST', body: JSON.stringify(inputs) }),
  createCase: (review: CalculationReview) =>
    request<PerformanceCase>('/api/cases', { method: 'POST', body: JSON.stringify(review) }),
  updateCase: (id: string, review: CalculationReview) =>
    request<PerformanceCase>(`/api/cases/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(review)
    }),
  createSweep: (sweep: SweepRequest) =>
    request<PerformanceCase[]>('/api/sweeps', { method: 'POST', body: JSON.stringify(sweep) }),
  createRunway: (runway: Omit<Runway, 'updatedAt'>) =>
    request<Runway>('/api/runways', { method: 'POST', body: JSON.stringify(runway) }),
  updateRunway: (originalId: string, runway: Omit<Runway, 'updatedAt'>) =>
    request<Runway>(`/api/runways/${encodeURIComponent(originalId)}`, {
      method: 'PUT',
      body: JSON.stringify(runway)
    })
};

export const formatInteger = (value: number) => Math.round(value).toLocaleString('en-US');
export const formatSignedInteger = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(Math.round(value)).toLocaleString('en-US')}`;
export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));

export const statusLabel = (status: CaseStatus) => {
  if (status === 'within-limits') return 'Within limits';
  if (status === 'out-of-limits') return 'Out of limits';
  return 'Caution';
};

export const statusRank: Record<CaseStatus, number> = {
  'out-of-limits': 0,
  caution: 1,
  'within-limits': 2
};

export type FieldErrors = Record<string, string>;

const whole = (value: number) => Number.isInteger(value);

export function validateCaseInputs(inputs: CaseInputs, runways: Runway[], existingLabels: string[] = []): FieldErrors {
  const errors: FieldErrors = {};
  const label = inputs.label.trim();
  if (!label) errors.label = 'Case label is required.';
  else if (label.length > 80) errors.label = 'Case label must be 80 characters or fewer.';
  else if (existingLabels.some((value) => value.toLowerCase() === label.toLowerCase())) {
    errors.label = 'Case label must be unique.';
  }
  if (!OPERATIONS.includes(inputs.operation)) errors.operation = 'Choose takeoff or landing.';
  if (!AIRCRAFT_VARIANTS.includes(inputs.variant)) errors.variant = 'Choose an aircraft variant.';
  if (!runways.some((runway) => runway.id === inputs.runwayId)) errors.runwayId = 'Choose a runway from the library.';
  if (!whole(inputs.runwayLengthFt) || inputs.runwayLengthFt < 1_000 || inputs.runwayLengthFt > 20_000) {
    errors.runwayLengthFt = 'Runway length must be a whole number from 1,000 to 20,000 ft.';
  }
  if (inputs.pressureAltitudeFt < -1_000 || inputs.pressureAltitudeFt > 14_000) {
    errors.pressureAltitudeFt = 'Pressure altitude must be from −1,000 to 14,000 ft.';
  }
  if (inputs.oatC < -40 || inputs.oatC > 55) errors.oatC = 'Temperature must be from −40 to 55 °C.';
  const limits = VARIANT_WEIGHT_LIMITS[inputs.variant];
  if (!whole(inputs.weightLb) || inputs.weightLb < 30_000 || inputs.weightLb > 90_000) {
    errors.weightLb = 'Weight must be a whole number from 30,000 to 90,000 lb.';
  } else if (limits && (inputs.weightLb < limits.min || inputs.weightLb > limits.max)) {
    errors.weightLb = `${inputs.variant} weight must be from ${limits.min.toLocaleString()} to ${limits.max.toLocaleString()} lb.`;
  }
  if (inputs.windKt < -30 || inputs.windKt > 50) errors.windKt = 'Wind component must be from −30 to +50 kt.';
  if (!RUNWAY_CONDITIONS.includes(inputs.runwayCondition)) errors.runwayCondition = 'Choose dry or wet.';
  if (!FLAP_SETTINGS.includes(inputs.flapSetting)) errors.flapSetting = 'Choose flap 10, 15, or 20.';
  return errors;
}

export function validateSweep(request: SweepRequest): FieldErrors {
  const errors: FieldErrors = {};
  const { startWeightLb, endWeightLb, stepWeightLb } = request;
  if (!whole(startWeightLb)) errors.startWeightLb = 'Start weight must be a whole number.';
  if (!whole(endWeightLb)) errors.endWeightLb = 'End weight must be a whole number.';
  if (!whole(stepWeightLb) || stepWeightLb <= 0) errors.stepWeightLb = 'Step must be a positive whole number.';
  if (endWeightLb < startWeightLb) errors.endWeightLb = 'End weight must not be below start weight.';
  const count = getSweepCount(startWeightLb, endWeightLb, stepWeightLb);
  if (count > 25) errors.stepWeightLb = 'Sweep must contain 25 cases or fewer.';
  if (count < 1) errors.stepWeightLb = 'Sweep must contain at least one case.';
  const limits = VARIANT_WEIGHT_LIMITS[request.baseInputs.variant];
  if (startWeightLb < limits.min || endWeightLb > limits.max) {
    errors.startWeightLb = `Sweep weights must stay within ${request.baseInputs.variant} limits (${limits.min.toLocaleString()}–${limits.max.toLocaleString()} lb).`;
  }
  return errors;
}

export function getSweepCount(start: number, end: number, step: number): number {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step <= 0 || end < start) return 0;
  return Math.floor((end - start) / step) + 1;
}

export function validateRunway(runway: Omit<Runway, 'updatedAt'>, runways: Runway[], originalId?: string): FieldErrors {
  const errors: FieldErrors = {};
  const id = runway.id.trim();
  if (!id) errors.id = 'Runway id is required.';
  else if (runways.some((item) => item.id !== originalId && item.id.toLowerCase() === id.toLowerCase())) {
    errors.id = 'Runway id must be unique.';
  }
  if (!whole(runway.lengthFt) || runway.lengthFt < 1_000 || runway.lengthFt > 20_000) {
    errors.lengthFt = 'Length must be a whole number from 1,000 to 20,000 ft.';
  }
  if (!whole(runway.elevationFt) || runway.elevationFt < -1_500 || runway.elevationFt > 15_000) {
    errors.elevationFt = 'Elevation must be a whole number from −1,500 to 15,000 ft.';
  }
  return errors;
}

interface Props {
  cases: PerformanceCase[];
  selectedCaseId: string | null;
  onSelectCase: (id: string) => void;
}

interface Point {
  item: PerformanceCase;
  x: number;
  y: number;
}

const WIDTH = 760;
const HEIGHT = 420;
const MARGIN = { top: 28, right: 28, bottom: 58, left: 76 };

function niceBounds(values: number[], step: number, paddingSteps = 1) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    min: Math.floor(min / step) * step - step * paddingSteps,
    max: Math.ceil(max / step) * step + step * paddingSteps
  };
}

function ticks(min: number, max: number, step: number) {
  const result: number[] = [];
  for (let value = min; value <= max; value += step) result.push(value);
  return result;
}

function PerformanceChart({ cases, selectedCaseId, onSelectCase }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const sorted = useMemo(() => [...cases].sort((a, b) => a.inputs.weightLb - b.inputs.weightLb), [cases]);
  const activeId = hoveredId ?? selectedCaseId ?? sorted[0]?.id ?? null;
  const active = sorted.find((item) => item.id === activeId) ?? null;

  if (sorted.length === 0) {
    return <div className="remote-state">No cases match the current filters.</div>;
  }

  const weightBounds = niceBounds(sorted.map((item) => item.inputs.weightLb), 10_000, 0);
  const runwayBounds = niceBounds(sorted.map((item) => item.outputs.requiredRunwayFt), 1_000, 1);
  const xScale = (value: number) =>
    MARGIN.left + ((value - weightBounds.min) / Math.max(1, weightBounds.max - weightBounds.min)) * (WIDTH - MARGIN.left - MARGIN.right);
  const yScale = (value: number) =>
    HEIGHT - MARGIN.bottom - ((value - runwayBounds.min) / Math.max(1, runwayBounds.max - runwayBounds.min)) * (HEIGHT - MARGIN.top - MARGIN.bottom);

  const points: Point[] = sorted.map((item) => ({ item, x: xScale(item.inputs.weightLb), y: yScale(item.outputs.requiredRunwayFt) }));
  const families = new Map<string, Point[]>();
  for (const point of points) {
    if (!point.item.sweepFamilyId) continue;
    const list = families.get(point.item.sweepFamilyId) ?? [];
    list.push(point);
    families.set(point.item.sweepFamilyId, list);
  }

  const xTicks = ticks(weightBounds.min, weightBounds.max, 10_000);
  const yTicks = ticks(runwayBounds.min, runwayBounds.max, 1_000);
  const activePoint = points.find((point) => point.item.id === activeId);

  return (
    <div className="chart-wrap">
      <div className="chart-legend" aria-label="Chart legend">
        <span><i className="legend-line" />Sweep family</span>
        <span><i className="legend-point" />Standalone case</span>
        <span><i className="legend-warning" />Caution</span>
        <span><i className="legend-danger" />Out of limits</span>
      </div>
      <svg
        className="performance-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby="chart-title chart-desc"
        onMouseLeave={() => setHoveredId(null)}
      >
        <title id="chart-title">Required runway by aircraft weight</title>
        <desc id="chart-desc">Sweep families are connected in ascending weight order. Standalone cases are points. Focus a point and use arrow keys to inspect adjacent values.</desc>
        {yTicks.map((tick) => {
          const y = yScale(tick);
          return (
            <g key={`y-${tick}`}>
              <line className="chart-grid" x1={MARGIN.left} y1={y} x2={WIDTH - MARGIN.right} y2={y} />
              <text className="chart-tick" x={MARGIN.left - 12} y={y + 4} textAnchor="end">{formatInteger(tick)}</text>
            </g>
          );
        })}
        {xTicks.map((tick) => {
          const x = xScale(tick);
          return (
            <g key={`x-${tick}`}>
              <line className="chart-grid" x1={x} y1={MARGIN.top} x2={x} y2={HEIGHT - MARGIN.bottom} />
              <text className="chart-tick" x={x} y={HEIGHT - MARGIN.bottom + 24} textAnchor="middle">{formatInteger(tick)}</text>
            </g>
          );
        })}
        <line className="chart-axis" x1={MARGIN.left} y1={HEIGHT - MARGIN.bottom} x2={WIDTH - MARGIN.right} y2={HEIGHT - MARGIN.bottom} />
        <line className="chart-axis" x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={HEIGHT - MARGIN.bottom} />
        <text className="chart-axis-title" x={(MARGIN.left + WIDTH - MARGIN.right) / 2} y={HEIGHT - 12} textAnchor="middle">Aircraft weight (lb)</text>
        <text className="chart-axis-title" transform={`translate(20 ${(MARGIN.top + HEIGHT - MARGIN.bottom) / 2}) rotate(-90)`} textAnchor="middle">Required runway (ft)</text>

        {[...families.entries()].map(([familyId, familyPoints], familyIndex) => (
          <polyline
            key={familyId}
            className={familyIndex % 2 === 0 ? 'chart-series-primary' : 'chart-series-secondary'}
            points={familyPoints.sort((a, b) => a.item.inputs.weightLb - b.item.inputs.weightLb).map((point) => `${point.x},${point.y}`).join(' ')}
          />
        ))}

        {activePoint && (
          <g aria-hidden="true">
            <line className="chart-crosshair" x1={MARGIN.left} y1={activePoint.y} x2={WIDTH - MARGIN.right} y2={activePoint.y} />
            <line className="chart-crosshair" x1={activePoint.x} y1={MARGIN.top} x2={activePoint.x} y2={HEIGHT - MARGIN.bottom} />
            <circle className="chart-active-halo" cx={activePoint.x} cy={activePoint.y} r={12} />
          </g>
        )}

        {points.map((point, index) => {
          const statusClass = point.item.outputs.status === 'out-of-limits'
            ? ' chart-point-danger'
            : point.item.outputs.status === 'caution'
              ? ' chart-point-warning'
              : '';
          return (
            <circle
              key={point.item.id}
              className={`chart-point${statusClass}`}
              cx={point.x}
              cy={point.y}
              r={point.item.sweepFamilyId ? 5 : 6}
              tabIndex={0}
              role="button"
              aria-label={`${point.item.inputs.label}, ${formatInteger(point.item.inputs.weightLb)} pounds, ${formatInteger(point.item.outputs.requiredRunwayFt)} feet required runway, ${statusLabel(point.item.outputs.status)}`}
              onMouseEnter={() => setHoveredId(point.item.id)}
              onFocus={() => onSelectCase(point.item.id)}
              onClick={() => onSelectCase(point.item.id)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                event.preventDefault();
                const nextIndex = event.key === 'ArrowRight'
                  ? Math.min(points.length - 1, index + 1)
                  : Math.max(0, index - 1);
                onSelectCase(points[nextIndex].item.id);
                const circles = event.currentTarget.ownerSVGElement?.querySelectorAll<SVGCircleElement>('.chart-point');
                circles?.[nextIndex]?.focus();
              }}
            />
          );
        })}
      </svg>
      <div className="chart-readout" aria-live="polite">
        {active ? (
          <>
            <strong>{active.inputs.label}</strong>
            <span>{formatInteger(active.inputs.weightLb)} lb</span>
            <span>{formatInteger(active.outputs.requiredRunwayFt)} ft required</span>
            <span>{statusLabel(active.outputs.status)}</span>
          </>
        ) : 'Focus or point to a case for exact values.'}
      </div>
    </div>
  );
}

type Page = 'dashboard' | 'calculator' | 'cases' | 'runways';
type LoadState = 'loading' | 'ready' | 'error';

const NAV_ITEMS: { id: Page; label: string; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Fleet review' },
  { id: 'calculator', label: 'Calculator', description: 'Plan a case' },
  { id: 'cases', label: 'Saved cases', description: 'Registry & chart' },
  { id: 'runways', label: 'Runway library', description: 'Managed records' }
];

const EMPTY_INPUTS: CaseInputs = {
  label: '',
  operation: 'takeoff',
  variant: 'GL-500',
  runwayId: '',
  runwayLengthFt: 6_000,
  pressureAltitudeFt: 0,
  oatC: 15,
  weightLb: 60_000,
  windKt: 0,
  runwayCondition: 'dry',
  flapSetting: 15,
  notes: ''
};

function LimitationBanner() {
  return (
    <div className="limitation-banner" role="note">
      <strong>Planning-grade only.</strong>
      <span>No approved AFM/OEM data is used. Results must not be presented as approved aircraft performance.</span>
    </div>
  );
}

function StatusBadge({ status }: { status: CaseStatus }) {
  return <span className={`status-badge status-${status}`}>{statusLabel(status)}</span>;
}

function RemoteState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="remote-state" role="status">
      <strong>{title}</strong>
      <span>{children}</span>
      {action}
    </div>
  );
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

function ErrorSummary({ errors }: { errors: FieldErrors }) {
  const values = Object.values(errors);
  if (values.length === 0) return null;
  return (
    <div className="validation-summary" role="alert" tabIndex={-1}>
      <strong>Review the highlighted fields</strong>
      <ul>{values.map((error) => <li key={error}>{error}</li>)}</ul>
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className={`field${error ? ' field-error' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span id={`${htmlFor}-error`} className="field-message error-text">{error}</span> : hint ? <span className="field-message">{hint}</span> : null}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((item) => !item.hasAttribute('disabled'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      restoreRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="button secondary" type="button" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DashboardPage({ cases, onEdit }: { cases: PerformanceCase[]; onEdit: (item: PerformanceCase) => void }) {
  const sorted = useMemo(() => [...cases].sort((a, b) => {
    const rank = statusRank[a.outputs.status] - statusRank[b.outputs.status];
    return rank !== 0 ? rank : a.outputs.runwayMarginFt - b.outputs.runwayMarginFt;
  }), [cases]);
  const outCount = cases.filter((item) => item.outputs.status === 'out-of-limits').length;
  const cautionCount = cases.filter((item) => item.outputs.status === 'caution').length;
  const thinnest = [...cases].sort((a, b) => a.outputs.runwayMarginFt - b.outputs.runwayMarginFt)[0];
  const weightLimited = cases.filter((item) => item.outputs.limitingFactor === 'Maximum allowable weight').length;

  return (
    <>
      <PageHeader eyebrow="Fleet overview" title="Performance review dashboard" description="Review limiting cases before a charter quote or airfield study proceeds." />
      <LimitationBanner />
      <section className="instrument-strip" aria-label="Fleet status instruments">
        <div><span>Out of limits</span><strong>{outCount}</strong><small>{outCount ? 'Action required' : 'No active cases'}</small></div>
        <div><span>Caution</span><strong>{cautionCount}</strong><small>Needs engineering review</small></div>
        <div><span>Minimum margin</span><strong>{thinnest ? `${formatSignedInteger(thinnest.outputs.runwayMarginFt)} ft` : '—'}</strong><small>{thinnest?.inputs.label ?? 'No saved cases'}</small></div>
        <div><span>Weight limited</span><strong>{weightLimited}</strong><small>Fleet cases</small></div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div><span className="eyebrow">Priority queue</span><h2>Cases requiring review</h2></div>
          <span className="panel-meta">Worst status, then thinnest margin</span>
        </div>
        {sorted.length === 0 ? (
          <RemoteState title="No saved cases">Create and save a reviewed calculation to populate the fleet dashboard.</RemoteState>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Priority</th><th>Case</th><th>Aircraft / operation</th><th>Runway</th><th className="numeric">Required</th><th className="numeric">Margin</th><th>Status</th><th>Limiting factor</th><th>Action</th></tr></thead>
              <tbody>{sorted.slice(0, 10).map((item, index) => (
                <tr key={item.id}>
                  <td className="mono">P{String(index + 1).padStart(2, '0')}</td>
                  <td><strong>{item.inputs.label}</strong><small>{formatDateTime(item.updatedAt)}</small></td>
                  <td>{item.inputs.variant} / {item.inputs.operation}</td>
                  <td className="mono">{item.inputs.runwayId}</td>
                  <td className="numeric">{formatInteger(item.outputs.requiredRunwayFt)} ft</td>
                  <td className="numeric">{formatSignedInteger(item.outputs.runwayMarginFt)} ft</td>
                  <td><StatusBadge status={item.outputs.status} /></td>
                  <td>{item.outputs.limitingFactor}</td>
                  <td><button className="table-action" type="button" onClick={() => onEdit(item)}>Open case</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

interface CalculatorProps {
  runways: Runway[];
  cases: PerformanceCase[];
  editingCase: PerformanceCase | null;
  online: boolean;
  onSaved: (item: PerformanceCase) => void;
  onSweepSaved: (items: PerformanceCase[]) => void;
  onCancelEdit: () => void;
}

function CalculatorPage({ runways, cases, editingCase, online, onSaved, onSweepSaved, onCancelEdit }: CalculatorProps) {
  const [inputs, setInputs] = useState<CaseInputs>(EMPTY_INPUTS);
  const [review, setReview] = useState<CalculationReview | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sweepOpen, setSweepOpen] = useState(false);

  useEffect(() => {
    if (editingCase) {
      setInputs(editingCase.inputs);
      setReview(null);
      setErrors({});
      return;
    }
    const firstRunway = runways[0];
    setInputs((current) => current.runwayId || !firstRunway ? current : {
      ...current,
      runwayId: firstRunway.id,
      runwayLengthFt: firstRunway.lengthFt,
      pressureAltitudeFt: firstRunway.elevationFt
    });
  }, [editingCase, runways]);

  const setValue = <K extends keyof CaseInputs>(key: K, value: CaseInputs[K]) => {
    setInputs((current) => ({ ...current, [key]: value }));
    setReview(null);
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const reviewCalculation = async (event: FormEvent) => {
    event.preventDefault();
    setRequestError('');
    if (!online) {
      setRequestError('Offline — calculator submissions are read-only and are not queued. Reconnect to review a calculation.');
      return;
    }
    const existingLabels = cases.filter((item) => item.id !== editingCase?.id).map((item) => item.inputs.label);
    const nextErrors = validateCaseInputs(inputs, runways, existingLabels);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try {
      setReview(await api.calculate({ ...inputs, label: inputs.label.trim() }));
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors ?? {});
        setRequestError(error.message);
      } else setRequestError('The calculation service could not be reached.');
    } finally {
      setBusy(false);
    }
  };

  const saveCase = async () => {
    if (!review || !online) return;
    setBusy(true);
    setRequestError('');
    try {
      const saved = editingCase ? await api.updateCase(editingCase.id, review) : await api.createCase(review);
      onSaved(saved);
      setReview(null);
      setErrors({});
      if (!editingCase) {
        const runway = runways.find((item) => item.id === inputs.runwayId) ?? runways[0];
        setInputs({ ...EMPTY_INPUTS, runwayId: runway?.id ?? '', runwayLengthFt: runway?.lengthFt ?? 6_000, pressureAltitudeFt: runway?.elevationFt ?? 0 });
      }
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors ?? {});
        setRequestError(error.message);
      } else setRequestError('The case could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const selectRunway = (id: string) => {
    const runway = runways.find((item) => item.id === id);
    setInputs((current) => runway ? { ...current, runwayId: id, runwayLengthFt: runway.lengthFt, pressureAltitudeFt: runway.elevationFt } : { ...current, runwayId: id });
    setReview(null);
  };

  return (
    <>
      <PageHeader
        eyebrow={editingCase ? 'Edit saved case' : 'Planning workflow'}
        title={editingCase ? editingCase.inputs.label : 'Case calculator'}
        description="Validate operating inputs, review the planning result, then save explicitly."
        actions={editingCase && <button className="button secondary" type="button" onClick={onCancelEdit}>Cancel edit</button>}
      />
      <LimitationBanner />
      <ol className="step-indicator" aria-label="Calculation workflow">
        <li className={!review ? 'active' : 'complete'}><span>1</span><div><strong>Inputs</strong><small>Validated configuration</small></div></li>
        <li className={review ? 'active' : ''}><span>2</span><div><strong>Review calculation</strong><small>Unsaved outputs</small></div></li>
        <li><span>3</span><div><strong>Save case</strong><small>Explicit persistence</small></div></li>
      </ol>
      {requestError && <div className="alert danger" role="alert">{requestError}</div>}
      <ErrorSummary errors={errors} />
      <div className="calculator-grid">
        <form className="panel calculator-form" onSubmit={reviewCalculation} noValidate>
          <div className="panel-header"><div><span className="eyebrow">Step 1</span><h2>Operating inputs</h2></div><span className="panel-meta">All fields revalidated by API</span></div>
          <div className="form-grid">
            <Field label="Case label" htmlFor="label" error={errors.label} hint="Unique across saved cases; 80 characters maximum.">
              <input id="label" value={inputs.label} maxLength={80} onChange={(event) => setValue('label', event.target.value)} aria-invalid={Boolean(errors.label)} aria-describedby={errors.label ? 'label-error' : undefined} />
            </Field>
            <Field label="Operation" htmlFor="operation" error={errors.operation}>
              <select id="operation" value={inputs.operation} onChange={(event) => setValue('operation', event.target.value as CaseInputs['operation'])}>
                {OPERATIONS.map((value) => <option key={value} value={value}>{value === 'takeoff' ? 'Takeoff' : 'Landing'}</option>)}
              </select>
            </Field>
            <Field label="Aircraft variant" htmlFor="variant" error={errors.variant}>
              <select id="variant" value={inputs.variant} onChange={(event) => {
                const variant = event.target.value as CaseInputs['variant'];
                const limits = VARIANT_WEIGHT_LIMITS[variant];
                setInputs((current) => ({ ...current, variant, weightLb: Math.min(Math.max(current.weightLb, limits.min), limits.max) }));
                setReview(null);
              }}>
                {AIRCRAFT_VARIANTS.map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Runway" htmlFor="runwayId" error={errors.runwayId}>
              <select id="runwayId" value={inputs.runwayId} onChange={(event) => selectRunway(event.target.value)}>
                <option value="">Select runway</option>
                {runways.map((runway) => <option key={runway.id} value={runway.id}>{runway.id} — {formatInteger(runway.lengthFt)} ft</option>)}
              </select>
            </Field>
            <Field label="Runway length (ft)" htmlFor="runwayLengthFt" error={errors.runwayLengthFt} hint="Library value is editable for planning studies.">
              <input id="runwayLengthFt" type="number" min="1000" max="20000" step="1" value={inputs.runwayLengthFt} onChange={(event) => setValue('runwayLengthFt', Number(event.target.value))} />
            </Field>
            <Field label="Pressure altitude (ft)" htmlFor="pressureAltitudeFt" error={errors.pressureAltitudeFt}>
              <input id="pressureAltitudeFt" type="number" min="-1000" max="14000" value={inputs.pressureAltitudeFt} onChange={(event) => setValue('pressureAltitudeFt', Number(event.target.value))} />
            </Field>
            <Field label="Outside air temperature (°C)" htmlFor="oatC" error={errors.oatC}>
              <input id="oatC" type="number" min="-40" max="55" value={inputs.oatC} onChange={(event) => setValue('oatC', Number(event.target.value))} />
            </Field>
            <Field label="Aircraft weight (lb)" htmlFor="weightLb" error={errors.weightLb} hint={`${formatInteger(VARIANT_WEIGHT_LIMITS[inputs.variant].min)}–${formatInteger(VARIANT_WEIGHT_LIMITS[inputs.variant].max)} lb for ${inputs.variant}.`}>
              <input id="weightLb" type="number" min={VARIANT_WEIGHT_LIMITS[inputs.variant].min} max={VARIANT_WEIGHT_LIMITS[inputs.variant].max} step="1" value={inputs.weightLb} onChange={(event) => setValue('weightLb', Number(event.target.value))} />
            </Field>
            <Field label="Wind component (kt)" htmlFor="windKt" error={errors.windKt} hint="Headwind positive; tailwind negative.">
              <input id="windKt" type="number" min="-30" max="50" value={inputs.windKt} onChange={(event) => setValue('windKt', Number(event.target.value))} />
            </Field>
            <Field label="Runway condition" htmlFor="runwayCondition" error={errors.runwayCondition}>
              <select id="runwayCondition" value={inputs.runwayCondition} onChange={(event) => setValue('runwayCondition', event.target.value as CaseInputs['runwayCondition'])}>
                {RUNWAY_CONDITIONS.map((value) => <option key={value} value={value}>{value === 'dry' ? 'Dry' : 'Wet'}</option>)}
              </select>
            </Field>
            <Field label="Flap setting" htmlFor="flapSetting" error={errors.flapSetting}>
              <select id="flapSetting" value={inputs.flapSetting} onChange={(event) => setValue('flapSetting', Number(event.target.value) as CaseInputs['flapSetting'])}>
                {FLAP_SETTINGS.map((value) => <option key={value} value={value}>Flap {value}</option>)}
              </select>
            </Field>
            <Field label="Notes" htmlFor="notes" hint="Optional review context.">
              <textarea id="notes" rows={3} value={inputs.notes} onChange={(event) => setValue('notes', event.target.value)} />
            </Field>
          </div>
          <div className="form-actions">
            <button className="button primary" type="submit" disabled={busy || !online}>{busy ? 'Calculating…' : 'Review calculation'}</button>
            <button className="button secondary" type="button" disabled={!online} onClick={() => setSweepOpen(true)}>Create weight sweep</button>
            {!online && <span className="disabled-explanation">Reconnect to calculate or save.</span>}
          </div>
        </form>

        <section className={`panel review-panel${review ? ' ready' : ''}`}>
          <div className="panel-header"><div><span className="eyebrow">Step 2</span><h2>Calculation review</h2></div>{review && <StatusBadge status={review.outputs.status} />}</div>
          {!review ? (
            <RemoteState title="No reviewed calculation">Complete the inputs and choose “Review calculation.” Outputs appear here without being saved.</RemoteState>
          ) : (
            <>
              <div className="result-summary">
                <div><span>Required runway</span><strong>{formatInteger(review.outputs.requiredRunwayFt)} ft</strong></div>
                <div><span>Runway margin</span><strong>{formatSignedInteger(review.outputs.runwayMarginFt)} ft</strong></div>
                <div><span>Climb gradient</span><strong>{review.outputs.climbGradientPct.toFixed(2)} %</strong></div>
                <div><span>Max allowable weight</span><strong>{formatInteger(review.outputs.maxAllowableWeightLb)} lb</strong></div>
              </div>
              <dl className="result-list">
                <div><dt>Takeoff distance required</dt><dd>{formatInteger(review.outputs.takeoffDistanceFt)} ft</dd></div>
                <div><dt>Accelerate-stop distance</dt><dd>{formatInteger(review.outputs.accelerateStopDistanceFt)} ft</dd></div>
                <div><dt>Landing distance</dt><dd>{formatInteger(review.outputs.landingDistanceFt)} ft</dd></div>
                <div><dt>Approach speed</dt><dd>{formatInteger(review.outputs.approachSpeedKt)} kt</dd></div>
                <div><dt>Limiting factor</dt><dd>{review.outputs.limitingFactor}</dd></div>
              </dl>
              <div className="basis-box"><strong>Calculation basis</strong><p>{review.outputs.calculationBasis}</p></div>
              <div className="review-notice">This review is not saved. Confirm the inputs and status before persisting the case.</div>
              <div className="form-actions">
                <button className="button primary" type="button" onClick={saveCase} disabled={busy || !online}>{busy ? 'Saving…' : editingCase ? 'Save reviewed changes' : 'Save case'}</button>
                <button className="button secondary" type="button" onClick={() => setReview(null)}>Return to inputs</button>
              </div>
            </>
          )}
        </section>
      </div>
      {sweepOpen && <SweepDialog inputs={inputs} runways={runways} cases={cases} online={online} onClose={() => setSweepOpen(false)} onSaved={(items) => { onSweepSaved(items); setSweepOpen(false); }} />}
    </>
  );
}

function SweepDialog({ inputs, runways, cases, online, onClose, onSaved }: { inputs: CaseInputs; runways: Runway[]; cases: PerformanceCase[]; online: boolean; onClose: () => void; onSaved: (items: PerformanceCase[]) => void }) {
  const limits = VARIANT_WEIGHT_LIMITS[inputs.variant];
  const [request, setRequest] = useState<SweepRequest>({ baseInputs: inputs, startWeightLb: limits.min, endWeightLb: limits.max, stepWeightLb: 5_000 });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState('');
  const [busy, setBusy] = useState(false);
  const count = getSweepCount(request.startWeightLb, request.endWeightLb, request.stepWeightLb);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const inputErrors = validateCaseInputs(request.baseInputs, runways, []);
    const sweepErrors = validateSweep(request);
    const nextErrors = { ...inputErrors, ...sweepErrors };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !online) {
      if (!online) setRequestError('Offline — sweep generation is read-only and is not queued.');
      return;
    }
    setBusy(true);
    try {
      onSaved(await api.createSweep(request));
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors ?? {});
        setRequestError(error.message);
      } else setRequestError('The sweep could not be generated.');
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Create weight sweep" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <p className="modal-intro">Generate first-class saved cases by varying weight only. The base label becomes the sweep family name.</p>
        {requestError && <div className="alert danger" role="alert">{requestError}</div>}
        <ErrorSummary errors={errors} />
        <div className="form-grid three-column">
          <Field label="Family label" htmlFor="sweep-label" error={errors.label}>
            <input id="sweep-label" maxLength={80} value={request.baseInputs.label} onChange={(event) => setRequest((current) => ({ ...current, baseInputs: { ...current.baseInputs, label: event.target.value } }))} />
          </Field>
          <Field label="Start weight (lb)" htmlFor="startWeightLb" error={errors.startWeightLb}>
            <input id="startWeightLb" type="number" value={request.startWeightLb} onChange={(event) => setRequest((current) => ({ ...current, startWeightLb: Number(event.target.value) }))} />
          </Field>
          <Field label="End weight (lb)" htmlFor="endWeightLb" error={errors.endWeightLb}>
            <input id="endWeightLb" type="number" value={request.endWeightLb} onChange={(event) => setRequest((current) => ({ ...current, endWeightLb: Number(event.target.value) }))} />
          </Field>
          <Field label="Step (lb)" htmlFor="stepWeightLb" error={errors.stepWeightLb}>
            <input id="stepWeightLb" type="number" min="1" value={request.stepWeightLb} onChange={(event) => setRequest((current) => ({ ...current, stepWeightLb: Number(event.target.value) }))} />
          </Field>
          <div className="sweep-count"><span>Cases to generate</span><strong>{count}</strong><small>Maximum 25</small></div>
        </div>
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="button primary" type="submit" disabled={busy || !online || count < 1 || count > 25}>{busy ? 'Generating…' : `Generate ${count} cases`}</button>
        </div>
      </form>
    </Modal>
  );
}

function SavedCasesPage({ cases, onEdit }: { cases: PerformanceCase[]; onEdit: (item: PerformanceCase) => void }) {
  const [view, setView] = useState<'table' | 'chart'>('table');
  const [query, setQuery] = useState('');
  const [variant, setVariant] = useState('all');
  const [operation, setOperation] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<'updated' | 'margin'>('updated');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const filtered = useMemo(() => cases.filter((item) => {
    const haystack = `${item.inputs.label} ${item.inputs.runwayId}`.toLowerCase();
    return haystack.includes(query.toLowerCase())
      && (variant === 'all' || item.inputs.variant === variant)
      && (operation === 'all' || item.inputs.operation === operation)
      && (status === 'all' || item.outputs.status === status);
  }).sort((a, b) => sort === 'margin' ? a.outputs.runwayMarginFt - b.outputs.runwayMarginFt : Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [cases, query, variant, operation, status, sort]);

  useEffect(() => {
    if (!selectedCaseId || !filtered.some((item) => item.id === selectedCaseId)) setSelectedCaseId(filtered[0]?.id ?? null);
  }, [filtered, selectedCaseId]);

  return (
    <>
      <PageHeader eyebrow="Case registry" title="Saved performance cases" description="Filter the full record set, compare margins, and inspect weight-to-runway trends." />
      <LimitationBanner />
      <section className="panel filter-panel" aria-label="Case filters">
        <div className="filter-grid">
          <Field label="Search label or runway" htmlFor="case-search"><input id="case-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></Field>
          <Field label="Aircraft variant" htmlFor="case-variant"><select id="case-variant" value={variant} onChange={(event) => setVariant(event.target.value)}><option value="all">All variants</option>{AIRCRAFT_VARIANTS.map((value) => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Operation" htmlFor="case-operation"><select id="case-operation" value={operation} onChange={(event) => setOperation(event.target.value)}><option value="all">All operations</option>{OPERATIONS.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
          <Field label="Status" htmlFor="case-status"><select id="case-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{CASE_STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></Field>
          <Field label="Sort" htmlFor="case-sort"><select id="case-sort" value={sort} onChange={(event) => setSort(event.target.value as 'updated' | 'margin')}><option value="updated">Updated time</option><option value="margin">Runway margin</option></select></Field>
          <div className="segmented" role="group" aria-label="Saved case view">
            <button type="button" className={view === 'table' ? 'active' : ''} aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
            <button type="button" className={view === 'chart' ? 'active' : ''} aria-pressed={view === 'chart'} onClick={() => setView('chart')}>XY chart</button>
          </div>
        </div>
        <div className="filter-summary">Showing <strong>{filtered.length}</strong> of {cases.length} saved cases</div>
      </section>
      {view === 'table' ? (
        <section className="panel">
          <div className="panel-header"><div><span className="eyebrow">Registry view</span><h2>Case table</h2></div><span className="panel-meta">Numerics in planning units</span></div>
          <CaseTable cases={filtered} onEdit={onEdit} />
        </section>
      ) : (
        <section className="chart-table-layout">
          <div className="panel chart-panel">
            <div className="panel-header"><div><span className="eyebrow">XY chart</span><h2>Required runway vs aircraft weight</h2></div><span className="panel-meta">x: lb · y: ft</span></div>
            <PerformanceChart cases={filtered} selectedCaseId={selectedCaseId} onSelectCase={setSelectedCaseId} />
          </div>
          <div className="panel companion-table">
            <div className="panel-header"><div><span className="eyebrow">Text alternative</span><h2>Synced values</h2></div><span className="panel-meta">{filtered.length} records</span></div>
            {filtered.length === 0 ? <RemoteState title="No matching cases">Adjust the registry filters to restore chart data.</RemoteState> : (
              <ol className="synced-list">
                {[...filtered].sort((a, b) => a.inputs.weightLb - b.inputs.weightLb).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={selectedCaseId === item.id ? 'synced-row selected' : 'synced-row'}
                      onClick={() => setSelectedCaseId(item.id)}
                    >
                      <span className="synced-top">
                        <span className="synced-label" title={item.inputs.label}>{item.inputs.label}</span>
                        <span className={'synced-status synced-' + item.outputs.status}>{statusLabel(item.outputs.status)}</span>
                      </span>
                      <span className="synced-values">{formatInteger(item.inputs.weightLb)} lb → {formatInteger(item.outputs.requiredRunwayFt)} ft required</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}
    </>
  );
}

function CaseTable({ cases, onEdit }: { cases: PerformanceCase[]; onEdit: (item: PerformanceCase) => void }) {
  if (cases.length === 0) return <RemoteState title="No matching cases">Adjust filters or save a reviewed calculation.</RemoteState>;
  return (
    <div className="table-scroll"><table className="registry-table"><thead><tr><th>Case</th><th className="numeric">Weight</th><th className="numeric">PA / OAT</th><th className="numeric">Required</th><th className="numeric">Margin</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody>{cases.map((item) => (
      <tr key={item.id}>
        <td className="case-cell">
          <strong title={item.inputs.label}>{item.inputs.label}</strong>
          <small>{item.inputs.variant} · {item.inputs.operation} · flap {item.inputs.flapSetting} · {item.inputs.runwayId}</small>
        </td>
        <td className="numeric">{formatInteger(item.inputs.weightLb)} lb</td>
        <td className="numeric">{formatSignedInteger(item.inputs.pressureAltitudeFt)} ft / {formatSignedInteger(item.inputs.oatC)} °C</td>
        <td className="numeric">{formatInteger(item.outputs.requiredRunwayFt)} ft</td>
        <td className="numeric">{formatSignedInteger(item.outputs.runwayMarginFt)} ft</td>
        <td><StatusBadge status={item.outputs.status} /></td>
        <td className="nowrap">{formatDateTime(item.updatedAt)}</td>
        <td><button className="table-action" type="button" onClick={() => onEdit(item)}>Edit</button></td>
      </tr>
    ))}</tbody></table></div>
  );
}

function RunwayPage({ runways, online, onChanged }: { runways: Runway[]; online: boolean; onChanged: (runway: Runway, originalId: string | null) => void }) {
  const [editing, setEditing] = useState<Runway | null | undefined>(undefined);
  return (
    <>
      <PageHeader eyebrow="Managed reference data" title="Runway library" description="Maintain the local runway records used to prefill planning cases." actions={<button className="button primary" type="button" disabled={!online} onClick={() => setEditing(null)}>Add runway</button>} />
      {!online && <div className="alert info">Offline — runway data is last-synced and read-only.</div>}
      <section className="panel">
        <div className="panel-header"><div><span className="eyebrow">Local dataset</span><h2>Runway records</h2></div><span className="panel-meta">{runways.length} managed runways</span></div>
        {runways.length === 0 ? <RemoteState title="No runway records">Reconnect and add a runway before creating a case.</RemoteState> : (
          <div className="table-scroll"><table><thead><tr><th>Runway id</th><th className="numeric">Length</th><th className="numeric">Elevation</th><th>Notes</th><th>Updated</th><th>Action</th></tr></thead><tbody>{runways.map((runway) => (
            <tr key={runway.id}><td className="mono"><strong>{runway.id}</strong></td><td className="numeric">{formatInteger(runway.lengthFt)} ft</td><td className="numeric">{formatSignedInteger(runway.elevationFt)} ft</td><td>{runway.notes || '—'}</td><td className="nowrap">{formatDateTime(runway.updatedAt)}</td><td><button className="table-action" type="button" disabled={!online} onClick={() => setEditing(runway)}>Edit</button></td></tr>
          ))}</tbody></table></div>
        )}
      </section>
      {editing !== undefined && <RunwayDialog runway={editing} runways={runways} onClose={() => setEditing(undefined)} onSaved={(saved) => { onChanged(saved, editing?.id ?? null); setEditing(undefined); }} />}
    </>
  );
}

function RunwayDialog({ runway, runways, onClose, onSaved }: { runway: Runway | null; runways: Runway[]; onClose: () => void; onSaved: (runway: Runway) => void }) {
  const [draft, setDraft] = useState<Omit<Runway, 'updatedAt'>>(runway ? { id: runway.id, lengthFt: runway.lengthFt, elevationFt: runway.elevationFt, notes: runway.notes } : { id: '', lengthFt: 5_000, elevationFt: 0, notes: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateRunway(draft, runways, runway?.id);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try {
      const saved = runway ? await api.updateRunway(runway.id, draft) : await api.createRunway(draft);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors ?? {});
        setRequestError(error.message);
      } else setRequestError('The runway record could not be saved.');
    } finally { setBusy(false); }
  };
  return (
    <Modal title={runway ? `Edit ${runway.id}` : 'Add runway'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {requestError && <div className="alert danger" role="alert">{requestError}</div>}
        <ErrorSummary errors={errors} />
        <div className="form-grid two-column">
          <Field label="Runway id" htmlFor="runway-edit-id" error={errors.id} hint="Example: KSVN RWY 10"><input id="runway-edit-id" value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} /></Field>
          <Field label="Length (ft)" htmlFor="runway-edit-length" error={errors.lengthFt}><input id="runway-edit-length" type="number" min="1000" max="20000" step="1" value={draft.lengthFt} onChange={(event) => setDraft((current) => ({ ...current, lengthFt: Number(event.target.value) }))} /></Field>
          <Field label="Elevation (ft)" htmlFor="runway-edit-elevation" error={errors.elevationFt}><input id="runway-edit-elevation" type="number" step="1" value={draft.elevationFt} onChange={(event) => setDraft((current) => ({ ...current, elevationFt: Number(event.target.value) }))} /></Field>
          <Field label="Notes" htmlFor="runway-edit-notes"><textarea id="runway-edit-notes" rows={4} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></Field>
        </div>
        <div className="modal-actions"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save runway'}</button></div>
      </form>
    </Modal>
  );
}

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [snapshot, setSnapshot] = useState<AppSnapshot>({ cases: [], runways: [] });
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [editingCase, setEditingCase] = useState<PerformanceCase | null>(null);
  const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);

  const load = async () => {
    setLoadState('loading');
    setLoadError('');
    try {
      setSnapshot(await api.getSnapshot());
      setLoadState('ready');
    } catch (error) {
      setLoadState('error');
      setLoadError(error instanceof Error ? error.message : 'The local data service could not be reached.');
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const connected = () => { setOnline(true); void load(); };
    const disconnected = () => setOnline(false);
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected); };
  }, []);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let mounted = true;
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      if (!mounted) return;
      if (registration.waiting) setUpdateWorker(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) setUpdateWorker(worker);
        });
      });
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const editCase = (item: PerformanceCase) => {
    setEditingCase(item);
    setPage('calculator');
  };
  const mergeCase = (item: PerformanceCase) => {
    setSnapshot((current) => ({ ...current, cases: [...current.cases.filter((existing) => existing.id !== item.id), item] }));
    setEditingCase(null);
    setPage('cases');
  };
  const mergeRunway = (runway: Runway, originalId: string | null) => setSnapshot((current) => ({ ...current, runways: [...current.runways.filter((item) => item.id !== runway.id && item.id !== originalId), runway].sort((a, b) => a.id.localeCompare(b.id)) }));

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">AC</span><div><strong>AeroCalc</strong><small>Performance workbench</small></div></div>
        <nav aria-label="Primary navigation"><ul>{NAV_ITEMS.map((item) => (
          <li key={item.id}><button type="button" className={page === item.id ? 'active' : ''} aria-current={page === item.id ? 'page' : undefined} onClick={() => { setPage(item.id); if (item.id !== 'calculator') setEditingCase(null); }}><strong>{item.label}</strong><span>{item.description}</span></button></li>
        ))}</ul></nav>
        <div className="sidebar-meta"><span>Local deployment</span><strong className={online ? 'online' : 'offline'}>{online ? 'API connected' : 'Offline read-only'}</strong><small>Port 4180 · JSON persistence</small></div>
      </aside>
      <div className="content-shell">
        <header className="topbar"><div><span className="topbar-label">Operations engineering</span><span className="topbar-divider" /> <span className="mono">planning/demo environment</span></div><div className="connection-state"><span className={online ? 'dot online' : 'dot offline'} />{online ? 'Connected' : 'Offline'}</div></header>
        {!online && <div className="offline-banner" role="status"><strong>Offline — showing last-synced data (read-only).</strong><span>Mutating actions are disabled and submissions are not queued.</span></div>}
        {updateWorker && <div className="update-banner" role="status"><span>Update available.</span><button type="button" onClick={() => { navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true }); updateWorker.postMessage({ type: 'SKIP_WAITING' }); }}>Reload</button></div>}
        <main id="main-content" tabIndex={-1}>
          {loadState === 'loading' ? <RemoteState title="Loading local records">Reading the case registry and runway library.</RemoteState> : loadState === 'error' ? <RemoteState title="Data unavailable" action={<button className="button primary" type="button" onClick={() => void load()}>Retry</button>}>{loadError}</RemoteState> : (
            <>
              {page === 'dashboard' && <DashboardPage cases={snapshot.cases} onEdit={editCase} />}
              {page === 'calculator' && <CalculatorPage runways={snapshot.runways} cases={snapshot.cases} editingCase={editingCase} online={online} onSaved={mergeCase} onSweepSaved={(items) => { setSnapshot((current) => ({ ...current, cases: [...current.cases, ...items] })); setPage('cases'); }} onCancelEdit={() => setEditingCase(null)} />}
              {page === 'cases' && <SavedCasesPage cases={snapshot.cases} onEdit={editCase} />}
              {page === 'runways' && <RunwayPage runways={snapshot.runways} online={online} onChanged={mergeRunway} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
