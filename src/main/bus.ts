import { EventEmitter } from 'events'

/** Внутрішня шина подій main-процесу (без IPC) */
export const bus = new EventEmitter()
bus.setMaxListeners(50)
