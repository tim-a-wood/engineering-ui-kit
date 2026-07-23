export type PreviewProbe = {
  url: string
  reachable: boolean
  latencyMs?: number
}

export type PreviewCheck = {
  id: 'launch-url' | 'package-json' | 'dependencies' | 'launch-command' | 'package-scripts' | 'server-probe'
  label: string
  status: 'pass' | 'warning' | 'fail'
  detail: string
}

export type PreviewRepair = {
  id: 'use-detected-url' | 'configure-launch-command' | 'install-dependencies'
  label: string
  description: string
  action: 'update-project' | 'install-dependencies'
  projectPatch?: {
    launchUrl?: string
    launchCommand?: string
  }
}

export type PreviewPreflightInput = {
  projectId: string
  repoPath: string
  launchUrl?: string
  launchCommand?: string
  packageJsonExists: boolean
  dependenciesInstalled: boolean
  detectedPackageManager: 'npm' | 'pnpm' | 'yarn' | 'unknown'
  packageScripts: Record<string, string>
  probes: PreviewProbe[]
}

export type PreviewPreflightResult = {
  schemaVersion: '1.0'
  projectId: string
  status: 'ready' | 'repairable' | 'blocked'
  summary: string
  configuredUrl?: string
  detectedUrl?: string
  detectedPackageManager: PreviewPreflightInput['detectedPackageManager']
  packageScripts: Record<string, string>
  checks: PreviewCheck[]
  repairs: PreviewRepair[]
  probes: PreviewProbe[]
}

function commandScriptNames(command: string): string[] {
  const names = new Set<string>()
  for (const match of command.matchAll(/\bnpm\s+run\s+([a-z0-9:_-]+)/gi)) names.add(match[1]!)
  if (/\bnpm\s+start\b/i.test(command)) names.add('start')
  for (const match of command.matchAll(/\bpnpm\s+(?:run\s+)?([a-z0-9:_-]+)/gi)) {
    if (!['install', 'exec', 'dlx'].includes(match[1]!.toLowerCase())) names.add(match[1]!)
  }
  for (const match of command.matchAll(/\byarn\s+(?:run\s+)?([a-z0-9:_-]+)/gi)) {
    if (!['install', 'exec', 'dlx'].includes(match[1]!.toLowerCase())) names.add(match[1]!)
  }
  return [...names]
}

function commandForScript(
  manager: PreviewPreflightInput['detectedPackageManager'],
  script: string,
): string {
  if (manager === 'yarn') return `yarn ${script}`
  if (manager === 'pnpm') return `pnpm ${script}`
  return script === 'start' ? 'npm start' : `npm run ${script}`
}

function suggestedLaunchCommand(input: PreviewPreflightInput): string | undefined {
  if (input.packageScripts.start) return commandForScript(input.detectedPackageManager, 'start')
  if (input.packageScripts.dev) return commandForScript(input.detectedPackageManager, 'dev')
  if (input.packageScripts.preview) {
    const preview = commandForScript(input.detectedPackageManager, 'preview')
    return input.packageScripts.build
      ? `${commandForScript(input.detectedPackageManager, 'build')} && ${preview}`
      : preview
  }
  return undefined
}

/** Pure preview diagnosis. The desktop adapter supplies filesystem facts and port probes. */
export function analyzePreviewPreflight(input: PreviewPreflightInput): PreviewPreflightResult {
  const checks: PreviewCheck[] = []
  const repairs: PreviewRepair[] = []
  const configuredProbe = input.launchUrl
    ? input.probes.find((probe) => probe.url === input.launchUrl)
    : undefined
  const detectedProbe = input.probes.find((probe) => probe.reachable && probe.url !== input.launchUrl)

  checks.push({
    id: 'launch-url',
    label: 'Launch URL',
    status: input.launchUrl ? 'pass' : 'fail',
    detail: input.launchUrl ?? 'No launch URL is configured.',
  })
  checks.push({
    id: 'package-json',
    label: 'Package manifest',
    status: input.packageJsonExists ? 'pass' : 'fail',
    detail: input.packageJsonExists ? 'package.json found.' : 'package.json is missing from the project root.',
  })
  checks.push({
    id: 'dependencies',
    label: 'Dependencies',
    status: !input.packageJsonExists ? 'warning' : input.dependenciesInstalled ? 'pass' : 'fail',
    detail: !input.packageJsonExists
      ? 'Dependency state cannot be determined without package.json.'
      : input.dependenciesInstalled
        ? 'node_modules is present.'
        : 'Dependencies are not installed.',
  })
  checks.push({
    id: 'launch-command',
    label: 'Launch command',
    status: input.launchCommand ? 'pass' : 'fail',
    detail: input.launchCommand ?? 'No launch command is configured.',
  })

  const requestedScripts = input.launchCommand ? commandScriptNames(input.launchCommand) : []
  const missingScripts = requestedScripts.filter((script) => !input.packageScripts[script])
  checks.push({
    id: 'package-scripts',
    label: 'Package scripts',
    status: missingScripts.length ? 'fail' : requestedScripts.length ? 'pass' : 'warning',
    detail: missingScripts.length
      ? `Launch command references missing script${missingScripts.length === 1 ? '' : 's'}: ${missingScripts.join(', ')}.`
      : requestedScripts.length
        ? `Required script${requestedScripts.length === 1 ? '' : 's'} found: ${requestedScripts.join(', ')}.`
        : 'The launch command does not reference a package script.',
  })
  checks.push({
    id: 'server-probe',
    label: 'Server probe',
    status: configuredProbe?.reachable ? 'pass' : detectedProbe ? 'warning' : 'fail',
    detail: configuredProbe?.reachable
      ? `${input.launchUrl} is reachable.`
      : detectedProbe
        ? `The app responded at ${detectedProbe.url}, not the configured URL.`
        : `No app responded at ${input.probes.length} checked local URL${input.probes.length === 1 ? '' : 's'}.`,
  })

  if (detectedProbe) {
    repairs.push({
      id: 'use-detected-url',
      label: 'Use detected URL',
      description: `Update this project to ${detectedProbe.url}.`,
      action: 'update-project',
      projectPatch: { launchUrl: detectedProbe.url },
    })
  }
  const suggestedCommand = suggestedLaunchCommand(input)
  if ((!input.launchCommand || missingScripts.length > 0) && suggestedCommand) {
    repairs.push({
      id: 'configure-launch-command',
      label: 'Use compatible launch command',
      description: `Configure \`${suggestedCommand}\` from the detected package scripts.`,
      action: 'update-project',
      projectPatch: { launchCommand: suggestedCommand },
    })
  }
  if (input.packageJsonExists && !input.dependenciesInstalled) {
    repairs.push({
      id: 'install-dependencies',
      label: 'Install dependencies',
      description: `Install with the detected ${input.detectedPackageManager === 'unknown' ? 'package manager' : input.detectedPackageManager}.`,
      action: 'install-dependencies',
    })
  }

  const reachable = Boolean(configuredProbe?.reachable)
  const startable = Boolean(
    input.launchUrl
    && input.packageJsonExists
    && input.dependenciesInstalled
    && input.launchCommand
    && missingScripts.length === 0,
  )
  const status: PreviewPreflightResult['status'] =
    reachable ? 'ready'
      : detectedProbe ? 'repairable'
        : startable ? 'ready'
      : repairs.length > 0 ? 'repairable'
        : 'blocked'
  return {
    schemaVersion: '1.0',
    projectId: input.projectId,
    status,
    summary:
      reachable ? 'The configured preview is already reachable.'
        : startable ? 'Preview configuration is valid and ready to start.'
          : status === 'repairable' ? 'Preview setup needs a mechanical repair before launch.'
            : 'Preview setup is blocked and needs project configuration.',
    ...(input.launchUrl ? { configuredUrl: input.launchUrl } : {}),
    ...(detectedProbe ? { detectedUrl: detectedProbe.url } : {}),
    detectedPackageManager: input.detectedPackageManager,
    packageScripts: input.packageScripts,
    checks,
    repairs,
    probes: input.probes,
  }
}
