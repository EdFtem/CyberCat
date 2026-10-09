import type { Target } from '@shared/types'
import { localFs } from './LocalFs'
import { RemoteFs } from './RemoteFs'
import { sessions } from '../ssh/SessionManager'
import type { FsAdapter } from './types'

export function getFs(target: Target): FsAdapter {
  if (target === 'local') return localFs
  return new RemoteFs(sessions.require(target))
}

export { localFs, RemoteFs }
export type { FsAdapter }
