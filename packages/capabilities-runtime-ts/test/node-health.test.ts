import { describe, expect, it } from 'vitest'
import { MapConfigurationReader } from '../src/configuration.js'
import { createEventLoopHealthCheck, createReadinessCheck } from '../src/node/health.js'

describe('health vs readiness', () => {
  it('the event-loop health check reports healthy simply by being invoked', async () => {
    const health = createEventLoopHealthCheck()
    const status = await health.check()
    expect(status.healthy).toBe(true)
  })

  it('readiness reports not ready when a required configuration key is missing', async () => {
    const readiness = createReadinessCheck({
      configuration: new MapConfigurationReader({ present: 'value' }),
      requiredConfigurationKeys: ['present', 'missing'],
    })

    const status = await readiness.check()
    expect(status.ready).toBe(false)
    expect(status.details?.missingConfigurationKeys).toEqual(['missing'])
  })

  it('readiness reports not ready when a mandatory adapter is unavailable', async () => {
    const readiness = createReadinessCheck({
      configuration: new MapConfigurationReader(),
      requiredAdapters: [
        { name: 'database', isAvailable: () => true },
        { name: 'queue', isAvailable: () => false },
      ],
    })

    const status = await readiness.check()
    expect(status.ready).toBe(false)
    expect(status.details?.unavailableAdapters).toEqual(['queue'])
  })

  it('readiness reports ready when configuration and adapters are all satisfied', async () => {
    const readiness = createReadinessCheck({
      configuration: new MapConfigurationReader({ key: 'value' }),
      requiredConfigurationKeys: ['key'],
      requiredAdapters: [{ name: 'database', isAvailable: () => true }],
    })

    const status = await readiness.check()
    expect(status).toEqual({ ready: true })
  })

  it('readiness and health are independent: readiness can fail while health stays healthy', async () => {
    const health = createEventLoopHealthCheck()
    const readiness = createReadinessCheck({
      configuration: new MapConfigurationReader(),
      requiredConfigurationKeys: ['missing-key'],
    })

    expect((await health.check()).healthy).toBe(true)
    expect((await readiness.check()).ready).toBe(false)
  })
})
