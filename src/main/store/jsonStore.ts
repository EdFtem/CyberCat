import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'

/** A JSON file in userData with atomic writes. The path and the defaults are resolved lazily. */
export class JsonStore<T> {
  private _file?: string
  private cache: T | undefined

  constructor(
    private name: string,
    private defaults: T | (() => T)
  ) {}

  private get file(): string {
    if (!this._file) {
      const dir = app.getPath('userData')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      this._file = join(dir, this.name)
    }
    return this._file
  }

  private resolveDefaults(): T {
    return typeof this.defaults === 'function' ? (this.defaults as () => T)() : structuredClone(this.defaults)
  }

  get(): T {
    if (this.cache !== undefined) return this.cache
    try {
      if (existsSync(this.file)) {
        const raw = readFileSync(this.file, 'utf8')
        this.cache = { ...this.resolveDefaults(), ...(JSON.parse(raw) as T) }
        return this.cache
      }
    } catch (e) {
      console.error(`[store] failed to read ${this.file}:`, e)
    }
    this.cache = this.resolveDefaults()
    return this.cache
  }

  set(value: T): void {
    this.cache = value
    const tmp = this.file + '.tmp'
    writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
    renameSync(tmp, this.file)
  }

  update(fn: (v: T) => T): T {
    const next = fn(this.get())
    this.set(next)
    return next
  }
}
