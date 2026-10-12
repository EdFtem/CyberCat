import { promises as fsp } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

/** ~/.aws/credentials and ~/.aws/config, honouring the same environment variables as the AWS CLI */
function files(): { credentials: string; config: string } {
  return {
    credentials: process.env.AWS_SHARED_CREDENTIALS_FILE || join(homedir(), '.aws', 'credentials'),
    config: process.env.AWS_CONFIG_FILE || join(homedir(), '.aws', 'config')
  }
}

/** Sections of an ini file: section name -> key/value pairs (keys lower-cased) */
function parseIni(text: string): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>()
  let current: Record<string, string> | null = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue
    const section = /^\[([^\]]+)\]$/.exec(line)
    if (section) {
      current = {}
      out.set(section[1].trim(), current)
      continue
    }
    const eq = line.indexOf('=')
    if (current && eq > 0) current[line.slice(0, eq).trim().toLowerCase()] = line.slice(eq + 1).trim()
  }
  return out
}

async function read(path: string): Promise<Map<string, Record<string, string>>> {
  try {
    return parseIni(await fsp.readFile(path, 'utf8'))
  } catch {
    return new Map()
  }
}

/** In ~/.aws/config every profile but default is written as [profile name]; sso-session blocks are not profiles */
function configProfileName(section: string): string | null {
  if (section === 'default') return 'default'
  const m = /^profile\s+(.+)$/.exec(section)
  return m ? m[1].trim() : null
}

export async function listAwsProfiles(): Promise<string[]> {
  const { credentials, config } = files()
  const names = new Set<string>()
  for (const name of (await read(credentials)).keys()) names.add(name)
  for (const section of (await read(config)).keys()) {
    const name = configProfileName(section)
    if (name) names.add(name)
  }
  return [...names].sort((a, b) => (a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b)))
}

/** Default region of a profile from ~/.aws/config, or the AWS_REGION environment variables */
export async function awsProfileRegion(profile = 'default'): Promise<string | undefined> {
  const config = await read(files().config)
  const section = config.get(profile === 'default' ? 'default' : `profile ${profile}`)
  return section?.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || undefined
}
