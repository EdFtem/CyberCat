import type { command as en } from '../en/command'

export const command: typeof en = {
  exitCode: (code) => `код ${code}`,
  statusRunning: 'виконується',
  running: 'Виконуємо…',
  noOutput: '(без виводу)',
  copyOutput: 'Копіювати вивід'
}
