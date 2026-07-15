import { Ajv2020 } from 'ajv/dist/2020.js'
import type { ErrorObject, ValidateFunction } from 'ajv'
import addFormatsPlugin from 'ajv-formats'

// ajv-formats' bundled declaration for its default export resolves, under
// this repository's `moduleResolution: NodeNext`, to a shape TypeScript
// cannot always prove is callable when combined with a named import from
// `ajv/dist/2020.js` in the same program. Re-typing the import locally
// sidesteps that resolution quirk without weakening our own module's types.
type AddFormatsFn = (ajv: Ajv2020) => Ajv2020
const addFormats = addFormatsPlugin as unknown as AddFormatsFn

export interface ValidationIssue {
  readonly path: string
  readonly message: string
}

export interface ValidationResult<T> {
  readonly valid: boolean
  readonly value?: T
  readonly errors?: ReadonlyArray<ValidationIssue>
}

/** Injected validator interface used by {@link dispatch} to validate operation input/output. */
export interface Validator<T = unknown> {
  validate(value: unknown): ValidationResult<T>
}

/** Creates a shared Ajv 2020-12 instance with formats registered, matching the repository convention. */
export function createAjv2020(): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  return ajv
}

function toIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  if (!errors) return []
  return errors.map((error) => ({
    path: error.instancePath.length > 0 ? error.instancePath : '/',
    message: error.message ?? 'invalid value',
  }))
}

/** AJV-backed {@link Validator} for a single JSON Schema (2020-12). */
export class AjvValidator<T = unknown> implements Validator<T> {
  private readonly validateFn: ValidateFunction

  constructor(schema: object, ajv: Ajv2020 = createAjv2020()) {
    this.validateFn = ajv.compile(schema)
  }

  validate(value: unknown): ValidationResult<T> {
    const valid = this.validateFn(value)
    if (valid) {
      return { valid: true, value: value as T }
    }
    return { valid: false, errors: toIssues(this.validateFn.errors) }
  }
}
