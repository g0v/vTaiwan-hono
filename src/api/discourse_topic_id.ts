import { Hono } from 'hono'
import { corsFor } from './cors'
import { getTopic } from '../lib/discourse-server'
import type { AppEnv } from './types'

export const app = new Hono<AppEnv>()

app.use('/:id', corsFor(['GET']))
app.get('/:id', async c => {
  try {
    const topic = await getTopic(c.req.param('id'))
    return c.json(topic)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return c.json({ error: 'Discourse request failed', message }, 502)
  }
})
export default app
