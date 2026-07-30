const titles = {
  board: 'Harbor status',
  vessels: 'Vessel plan',
  handoff: 'Shift handoff',
}

const appShell = document.querySelector('.app-shell')
const views = document.querySelectorAll('[data-view]')
const navigationButtons = document.querySelectorAll('[data-view-target]')
const title = document.querySelector('#view-title')
const modal = document.querySelector('.modal-backdrop')
const toast = document.querySelector('.toast')
const assignNote = document.querySelector('[data-assign-note]')
const assignNoteText = assignNote.querySelector('p')

function showView(viewName) {
  views.forEach((view) => view.classList.toggle('active', view.dataset.view === viewName))
  navigationButtons.forEach((button) => {
    button.classList.toggle('active', button.classList.contains('nav-item') && button.dataset.viewTarget === viewName)
  })
  title.textContent = titles[viewName]
  appShell.classList.remove('menu-open')
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

navigationButtons.forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.viewTarget))
})

document.querySelector('.mobile-menu').addEventListener('click', () => {
  appShell.classList.toggle('menu-open')
})

document.querySelectorAll('[data-open-assign]').forEach((button) => {
  button.addEventListener('click', () => {
    assignNote.classList.remove('error')
    assignNoteText.textContent = 'B2 meets the vessel length and draft limits.'
    modal.hidden = false
    modal.querySelector('input:not(:disabled)').focus()
  })
})

document.querySelector('[data-attempt-closed]').addEventListener('click', () => {
  assignNote.classList.add('error')
  assignNoteText.textContent = 'C2 is closed. Select an open berth.'
  modal.hidden = false
})

document.querySelector('[data-review-maintenance]').addEventListener('click', () => {
  document.querySelector('[data-info-dialog="maintenance"]').hidden = false
})

document.querySelector('[data-review-incidents]').addEventListener('click', () => {
  document.querySelector('[data-info-dialog="incidents"]').hidden = false
})

document.querySelectorAll('[data-close-info]').forEach((button) => {
  button.addEventListener('click', () => {
    button.closest('.modal-backdrop').hidden = true
  })
})

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => {
    modal.hidden = true
  })
})

modal.addEventListener('click', (event) => {
  if (event.target === modal) modal.hidden = true
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') modal.hidden = true
})

document.querySelector('[data-confirm-assign]').addEventListener('click', () => {
  const selectedBerth = document.querySelector('input[name="berth"]:checked').value
  const oceanRow = document.querySelector('[data-vessel="Ocean Crown"]')
  oceanRow.querySelector('.berth-chip').textContent = selectedBerth
  oceanRow.querySelector('.berth-chip').className = 'berth-chip assigned'
  oceanRow.querySelector('.state-chip').innerHTML = '<i></i>Planned'
  oceanRow.querySelector('.state-chip').className = 'state-chip planned'
  modal.hidden = true
  toast.hidden = false
  window.setTimeout(() => {
    toast.hidden = true
  }, 3600)
})

const vesselDetails = {
  'north-star': {
    avatar: 'NS',
    avatarClass: 'cargo',
    name: 'MV North Star',
    type: 'Cargo · 128 m',
    state: 'Approaching',
    stateClass: 'underway',
    arrival: '09:15',
    berth: 'B1',
    draft: '7.2 m',
    pilot: 'Lena Ortiz',
    note: 'Pilot boards at buoy four. Tug Atlas is ready.',
  },
  'ocean-crown': {
    avatar: 'OC',
    avatarClass: 'tanker',
    name: 'Ocean Crown',
    type: 'Tanker · 186 m',
    state: 'Needs berth',
    stateClass: 'waiting',
    arrival: '10:40',
    berth: 'Not assigned',
    draft: '9.8 m',
    pilot: 'Drew Chen',
    note: 'The vessel waits outside the east channel.',
  },
}

document.querySelectorAll('[data-detail]').forEach((button) => {
  button.addEventListener('click', () => {
    const detail = vesselDetails[button.dataset.detail]
    document.querySelectorAll('[data-detail]').forEach((item) => item.classList.toggle('selected', item === button))
    const detailAvatar = document.querySelector('#detail-avatar')
    detailAvatar.textContent = detail.avatar
    detailAvatar.className = `vessel-avatar ${detail.avatarClass} xlarge`
    document.querySelector('#detail-name').textContent = detail.name
    document.querySelector('#detail-type').textContent = detail.type
    const detailState = document.querySelector('#detail-state')
    detailState.innerHTML = `<i></i>${detail.state}`
    detailState.className = `state-chip ${detail.stateClass}`
    document.querySelector('#detail-arrival').textContent = detail.arrival
    document.querySelector('#detail-berth').textContent = detail.berth
    document.querySelector('#detail-draft').textContent = detail.draft
    document.querySelector('#detail-pilot').textContent = detail.pilot
    document.querySelector('#detail-note').textContent = detail.note
  })
})

const handoffCheck = document.querySelector('.check-item.pending input')
const approveButton = document.querySelector('.approve-button')
handoffCheck.addEventListener('change', () => {
  handoffCheck.closest('.check-item').classList.toggle('complete', handoffCheck.checked)
  document.querySelector('.pending-chip').textContent = handoffCheck.checked ? 'Ready' : 'Needs review'
  document.querySelector('.handoff-progress span').innerHTML = handoffCheck.checked ? '<b>5</b> of 5 ready' : '<b>4</b> of 5 ready'
  document.querySelector('.handoff-progress i').style.width = handoffCheck.checked ? '100%' : '80%'
  approveButton.disabled = !handoffCheck.checked
})

approveButton.addEventListener('click', () => {
  approveButton.textContent = 'Handoff approved'
  approveButton.disabled = true
  toast.querySelector('b').textContent = 'Handoff approved'
  toast.querySelector('small').textContent = 'The night team can start.'
  toast.hidden = false
})
