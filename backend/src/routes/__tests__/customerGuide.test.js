import {afterEach,describe,expect,jest,test} from '@jest/globals'
import express from 'express'
import request from 'supertest'

const generate=jest.fn(async()=>({content:'Open Campaigns, review the draft, then visit Social to schedule your post.',fallback:false}))
jest.unstable_mockModule('../../services/openaiService.js',()=>({generateAgentResponse:generate}))
const {default:guide}=await import('../customerGuide.js')
const app=express()
app.use(express.json())
app.use((req,_res,next)=>{req.user={id:'customer-1'};next()})
app.use('/guide',guide)
afterEach(()=>{generate.mockClear()})

describe('safe platform assistant',()=>{
  test('rejects unbounded questions or arbitrary pages',async()=>{
    await request(app).post('/guide/ask').send({question:'hi',page:'/dashboard'}).expect(400)
    await request(app).post('/guide/ask').send({question:'How do I publish?',page:'/owner/secrets'}).expect(400)
    expect(generate).not.toHaveBeenCalled()
  })
  test('uses metered guide role and authenticated customer context, without executing tools',async()=>{
    const r=await request(app).post('/guide/ask').send({question:'How do I schedule posts?',page:'/dashboard/social'})
    expect(r.status).toBe(200)
    expect(r.body.actionsExecuted).toBe(false)
    expect(r.body.mode).toBe('guidance_only')
    expect(generate).toHaveBeenCalledWith('platform-guide','How do I schedule posts?',expect.objectContaining({userId:'customer-1',currentPage:'/dashboard/social'}))
  })
  test('provider failure does not invent an AI answer',async()=>{
    generate.mockImplementationOnce(async()=>({fallback:true,content:null}))
    const r=await request(app).post('/guide/ask').send({question:'How do I create a campaign?',page:'/dashboard/campaigns'})
    expect(r.status).toBe(503)
    expect(r.body.code).toBe('guided_help_unavailable')
  })
})
