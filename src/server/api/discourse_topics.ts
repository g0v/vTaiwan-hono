import { Hono } from 'hono'
import { corsFor } from './cors'
import { getAllTopics, getFormattedTopics } from '../../lib/discourse-server'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

app.use('/', corsFor(['GET']))
app.get('/', async c => {
  const category = c.req.query('category')
  const detailed = c.req.query('detailed') === '1'
  try {
    const topics = detailed ? await getFormattedTopics(category || undefined) : await getAllTopics(category || undefined)
    return c.json(topics)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return c.json({ error: 'Discourse request failed', message }, 502)
  }
})
export default app
