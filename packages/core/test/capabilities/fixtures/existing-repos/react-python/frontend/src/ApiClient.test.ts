import { describe, expect, it } from 'vitest'
import { fetchDashboard } from './ApiClient.js'

describe('fetchDashboard', () => {
  it('is a function', () => {
    expect(typeof fetchDashboard).toBe('function')
  })
})
