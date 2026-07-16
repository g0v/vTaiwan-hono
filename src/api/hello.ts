import { corsFor } from './cors'
import type { App } from './types'

export function registerHelloApi(app: App) {
  app.use('/api/hello', corsFor(['GET']))
  app.get('/api/hello', c => c.text('Hello World!'))
}
