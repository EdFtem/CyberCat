import type { Client, SFTPWrapper } from 'ssh2'

interface ProtocolLike {
  exec(chan: number, cmd: string, wantReply: boolean): unknown
  subsystem(chan: number, name: string, wantReply: boolean): unknown
  channelData(chan: number, data: Buffer): unknown
}

/**
 * Open SFTP by running an arbitrary command instead of the "sftp" subsystem,
 * e.g. `sudo /usr/lib/openssh/sftp-server`. ssh2 has no public API for this,
 * so for the duration of one call the subsystem request is swapped for exec.
 * prewrite is sent to the command's stdin before the SFTP INIT packet: this way
 * sudo -S reads the password (byte by byte, up to the newline) and the rest of the stream goes to sftp-server.
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
