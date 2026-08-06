/**
 * Vitest 環境下的 cloudflare:workers 模擬。
 * 測試不會真正執行 DO，此 shim 只是讓 import 能夠解析，避免 "Cannot find package" 錯誤。
 */

export abstract class DurableObject<_Env = unknown> {
  protected ctx: unknown
  protected env: _Env

  constructor(ctx: unknown, env: _Env) {
    this.ctx = ctx
    this.env = env
  }
}
