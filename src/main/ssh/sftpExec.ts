import type { Client, SFTPWrapper } from 'ssh2'

interface ProtocolLike {
  exec(chan: number, cmd: string, wantReply: boolean): unknown
  subsystem(chan: number, name: string, wantReply: boolean): unknown
  channelData(chan: number, data: Buffer): unknown
}

/**
 * Відкрити SFTP не через підсистему "sftp", а запуском довільної команди,
 * наприклад `sudo /usr/lib/openssh/sftp-server`. У ssh2 немає публічного API
 * для цього, тому на час одного виклику підміняємо запит subsystem на exec.
 * prewrite надсилається у stdin команди до пакета SFTP INIT: так sudo -S
 * зчитує пароль (побайтно, до переводу рядка), а решта потоку дістається sftp-server.
 */
export function openSftpOverExec(client: Client, cmd: string, prewrite?: Buffer): Promise<SFTPWrapper> {
  const proto = (client as unknown as { _protocol: ProtocolLike })._protocol
  const original = proto.subsystem
  let restored = false
  const restore = (): void => {
    if (restored) return
    restored = true
    proto.subsystem = original
  }
  proto.subsystem = function (this: ProtocolLike, chan: number, _name: string, wantReply: boolean) {
    restore()
    const r = proto.exec.call(this, chan, cmd, wantReply)
    if (prewrite && prewrite.length) proto.channelData.call(this, chan, prewrite)
    return r
  }
  return new Promise<SFTPWrapper>((resolve, reject) => {
    try {
      client.sftp((err, sftp) => {
        restore()
        if (err) reject(err)
        else resolve(sftp)
      })
    } catch (e) {
      restore()
      reject(e)
    }
  })
}
