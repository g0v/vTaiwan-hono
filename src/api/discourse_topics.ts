import { corsFor } from './cors'
import { getAllTopics, getFormattedTopics } from '../lib/discourse-server'
import type { App } from './types'

export function registerDiscourseTopicsApi(app: App) {
  app.use('/api/discourse/topics', corsFor(['GET']))
  app.get('/api/discourse/topics', async c => {
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
}
