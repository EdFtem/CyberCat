import { createHash } from 'crypto'
import { JsonStore } from '../store/jsonStore'

export interface KnownHost {
  keyType: string
  fingerprint: string
  key: string
  addedAt: number
}

const store = new JsonStore<Record<string, KnownHost>>('known_hosts.json', {})

function hostId(host: string, port: number): string {
  return port === 22 ? host.toLowerCase() : `[${host.toLowerCase()}]:${port}`
}

export function parseKeyType(key: Buffer): string {
  try {
    const len = key.readUInt32BE(0)
    return key.subarray(4, 4 + len).toString('ascii')
  } catch {
    return 'unknown'
  }
}

/** Fingerprint in OpenSSH format: SHA256 in base64 without padding */
export function fingerprint(key: Buffer): string {
  return 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '')
}

export const hostKeys = {
  lookup(host: string, port: number): KnownHost | undefined {
    return store.get()[hostId(host, port)]
  },
  save(host: string, port: number, key: Buffer): void {
    store.update((s) => ({
      ...s,
      [hostId(host, port)]: {
        keyType: parseKeyType(key),
        fingerprint: fingerprint(key),
        key: key.toString('base64'),
        addedAt: Date.now()
      }
    }))
  },
  remove(host: string, port: number): void {
    store.update((s) => {
      const next = { ...s }
      delete next[hostId(host, port)]
      return next
    })
  }
}
