const config = JSON.parse(document.querySelector('#product-config').textContent)
const shell = document.querySelector('.app-shell')
const viewTitle = document.querySelector('[data-view-title]')
const navButtons = [...document.querySelectorAll('[data-nav-target]')]
const scenarioButtons = [...document.querySelectorAll('[data-scenario-action]')]
const results = [...document.querySelectorAll('[data-scenario-result]')]
const commandDialog = document.querySelector('[data-command-dialog]')
const commandInput = document.querySelector('[data-command-input]')
const commandItems = [...document.querySelectorAll('[data-command-item]')]
const themeToggle = document.querySelector('[data-theme-toggle]')
const helpTrigger = document.querySelector('[data-help-trigger]')
const helpPopover = document.querySelector('[data-help-popover]')
const tooltipTriggers = [...document.querySelectorAll('[data-tooltip-trigger]')]
const mobileMenu = document.querySelector('[data-mobile-menu]')
const navigationScrim = document.querySelector('[data-close-navigation]')
const productWorkspace = document.querySelector('.product-workspace')
const mobileNavigation = document.querySelector('[data-product-nav]')

function setNavigationOpen(open, returnFocus = true) {
  shell.classList.toggle('menu-open', open)
  mobileMenu?.setAttribute('aria-expanded', String(open))
  if (productWorkspace && mobileNavigation && !productWorkspace.contains(mobileNavigation)) {
    productWorkspace.inert = open
  }
  if (open) {
    document.querySelector('[data-product-nav] button, [data-product-nav] input')?.focus()
  } else if (returnFocus) {
    mobileMenu?.focus()
  }
}

function activeTheme() {
  const explicit = document.documentElement.dataset.theme
  if (explicit === 'light' || explicit === 'dark') return explicit
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function updateThemeControl() {
  if (!themeToggle) return
  const label = activeTheme() === 'dark' ? 'Use light mode' : 'Use dark mode'
  themeToggle.setAttribute('aria-label', label)
  const tooltip = themeToggle.querySelector('[role="tooltip"]')
  if (tooltip) tooltip.textContent = label
}

function setTheme(mode) {
  document.documentElement.dataset.theme = mode
  localStorage.setItem('eui-color-mode', mode)
  updateThemeControl()
}

themeToggle?.addEventListener('click', () => {
  setTheme(activeTheme() === 'dark' ? 'light' : 'dark')
})

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeControl)

function closeHelp() {
  if (!helpPopover || !helpTrigger) return
  helpPopover.hidden = true
  helpTrigger.setAttribute('aria-expanded', 'false')
}

helpTrigger?.addEventListener('click', () => {
  const willOpen = helpPopover?.hidden ?? false
  if (!helpPopover) return
  helpPopover.hidden = !willOpen
  helpTrigger.setAttribute('aria-expanded', String(willOpen))
})

document.querySelector('[data-close-help]')?.addEventListener('click', () => {
  closeHelp()
  helpTrigger?.focus()
})

tooltipTriggers.forEach((trigger) => {
  const restoreTooltip = () => trigger.classList.remove('tooltip-suppressed')
  trigger.addEventListener('blur', restoreTooltip)
  trigger.addEventListener('mouseleave', restoreTooltip)
})

function setActiveView(view) {
  const normalizedView = String(view || '').replace(/[^a-z0-9]+/gi, '').toLowerCase()
  const selected = navButtons.find((button) => button.dataset.navTarget === view)
    ?? navButtons.find((button) => {
      const normalizedTarget = String(button.dataset.navTarget || '').replace(/[^a-z0-9]+/gi, '').toLowerCase()
      return normalizedView.includes(normalizedTarget) || normalizedTarget.includes(normalizedView)
    })
    ?? navButtons[0]
  navButtons.forEach((button) => {
    const active = button === selected
    button.classList.toggle('active', active)
    if (active) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  })
  if (selected) viewTitle.textContent = selected.dataset.navTitle
  setNavigationOpen(false, false)
}

function showResult(id) {
  results.forEach((item) => item.classList.remove('is-visible'))
  const result = results.find((item) => item.dataset.scenarioResult === id)
  if (!result) return
  const sourceButton = scenarioButtons.find((button) => button.dataset.scenarioAction === id)
  const actionRegion = sourceButton?.closest('[aria-label="Product actions"]')
    ?? document.querySelector('[aria-label="Product actions"]')
  actionRegion?.append(result)
  result.classList.add('is-visible')

}

navButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveView(button.dataset.navTarget))
})

scenarioButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveView(button.dataset.target || navButtons[0]?.dataset.navTarget)
    showResult(button.dataset.scenarioAction)
  })
})

mobileMenu?.addEventListener('click', () => {
  setNavigationOpen(!shell.classList.contains('menu-open'))
})

navigationScrim?.addEventListener('click', () => setNavigationOpen(false))

function openCommands() {
  commandDialog.hidden = false
  commandInput.value = ''
  commandItems.forEach((item) => { item.hidden = false })
  commandInput.focus()
}

function closeCommands() {
  commandDialog.hidden = true
}

document.querySelectorAll('[data-open-commands]').forEach((control) => {
  control.addEventListener('click', openCommands)
})
document.querySelector('[data-close-commands]').addEventListener('click', closeCommands)

commandInput.addEventListener('input', () => {
  const query = commandInput.value.trim().toLowerCase()
  commandItems.forEach((item) => {
    item.hidden = query && !item.textContent.toLowerCase().includes(query)
  })
})

commandItems.forEach((item) => {
  item.addEventListener('click', () => {
    const action = config.scenarios.find((candidate) => candidate.actionId === item.dataset.commandItem)
    closeCommands()
    if (!action) return
    setActiveView(action.target)
    showResult(action.actionId)
  })
})

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    openCommands()
  }
  if (event.key === 'Escape') {
    closeCommands()
    closeHelp()
    const activeControl = document.activeElement?.closest?.('[data-tooltip-trigger]')
    activeControl?.classList.add('tooltip-suppressed')
    setNavigationOpen(false, false)
  }
})

commandDialog.addEventListener('click', (event) => {
  if (event.target === commandDialog) closeCommands()
})

setActiveView(navButtons[0]?.dataset.navTarget)
updateThemeControl()
