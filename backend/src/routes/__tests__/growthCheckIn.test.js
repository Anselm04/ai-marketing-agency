import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import express from 'express'
import request from 'supertest'

let current
const store = {
  findUserById: jest.fn(async () => current),
  updateUser: jest.fn(async (_id, patch) => { current = { ...current, ...patch }; return current }),
}
jest.unstable_mockModule('../../utils/store.js', () => ({ default: store }))
jest.unstable_mockModule('../../services/accountMemoryService.js', () => ({ getUserPreferences: jest.fn(), saveUserPreferences: jest.fn() }))
jest.unstable_mockModule('../../services/accountLifecycleService.js', () => ({ deleteCustomerAccount: jest.fn() }))
const { default: router } = await import('../settings.js')
const app = express()
app.use(express.json())
app.use((req, _res, next) => { req.user = { id: 'owner-1' }; next() })
app.use('/settings', router)

beforeEach(() => { current = { id: 'owner-1', profile: {} }; jest.clearAllMocks() })

describe('voluntary customer growth feedback', () => {
  test('no income or customer data is required', async () => {
    const r = await request(app).get('/settings/growth')
    expect(r.status).toBe(200)
    expect(r.body.settings.level).toBe('none')
    expect(r.body.reports).toEqual([])
  })
  test('customers must acknowledge limitations before enabling reporting', async () => {
    const response = await request(app).put('/settings/growth/preferences').send({level:'summary',cadence:'monthly',understoodLimitations:false})
    expect(response.status).toBe(400)
    expect(store.updateUser).not.toHaveBeenCalled()
  })
  test('customers may report directional feedback without income disclosure', async () => {
    await request(app).put('/settings/growth/preferences').send({level:'summary',cadence:'monthly',understoodLimitations:true}).expect(200)
    const response = await request(app).post('/settings/growth/reports').send({period:'2026-11',method:'direction',value:'up'})
    expect(response.status).toBe(201)
    expect(response.body.verifiedRevenue).toBe(false)
    const state = await request(app).get('/settings/growth')
    expect(state.body.reports[0].source).toBe('customer_self_report')
    await request(app).post('/settings/growth/reports').send({period:'2026-11',method:'direction',value:'up'}).expect(409)
  })
  test('counts require explicit count-level preference', async () => {
    await request(app).put('/settings/growth/preferences').send({level:'summary',cadence:'monthly',understoodLimitations:true}).expect(200)
    await request(app).post('/settings/growth/reports').send({period:'2026-11',method:'count',value:5}).expect(400)
  })
  test('customer can opt out and delete history', async () => {
    await request(app).put('/settings/growth/preferences').send({level:'counts',cadence:'monthly',understoodLimitations:true}).expect(200)
    await request(app).post('/settings/growth/reports').send({period:'2026-11',method:'count',value:4}).expect(201)
    await request(app).put('/settings/growth/preferences').send({level:'none',cadence:'off',understoodLimitations:true}).expect(200)
    await request(app).post('/settings/growth/reports').send({period:'2026-12',method:'count',value:7}).expect(403)
    await request(app).delete('/settings/growth/reports').expect(200)
    expect((await request(app).get('/settings/growth')).body.reports).toEqual([])
  })
})
