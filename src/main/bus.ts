import { EventEmitter } from 'events'

/** Internal event bus of the main process (no IPC) */
export const bus = new EventEmitter()
bus.setMaxListeners(50)
