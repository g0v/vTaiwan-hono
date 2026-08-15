import { Hono } from 'hono'
import { corsFor } from './cors'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

app.use('/', corsFor(['GET']))
app.get('/', c => c.text('Hello World!'))
export default app
