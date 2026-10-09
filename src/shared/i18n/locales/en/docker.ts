import { pluralEn } from '../../plural'

/** Docker view: containers, images, volumes and compose projects */
export const docker = {
  // Header
  backToFiles: 'Back to files (Ctrl+Shift+D)',
  files: 'Files',
  tabContainers: 'Containers',
  tabImages: 'Images',
  tabVolumes: 'Volumes',
  filterPlaceholder: 'Filter…',
  autoRefreshOn: 'Auto-refresh every 5 s is on',
  autoRefreshOff: 'Auto-refresh is off',

  // Docker unavailable
  notFound: 'Docker not found',
  notAccessible: 'Docker is installed but not accessible',
  enableSudo: 'Enable sudo mode',
  checkAgain: 'Check again',

  // Containers
  noContainers: 'No containers',
  noContainersHint: 'Start something with docker run or compose up and it will show up here.',
  standalone: 'Standalone containers',
  containers: (n: number) => `${n} ${pluralEn(n, 'container', 'containers')}`,
  openFile: (path: string) => `Open ${path}`,
  runningOf: (running: number, total: number) => `${running} of ${total} running`,
  reclaimable: (size: string) => `(${size} reclaimable)`,
  portHint: 'Click a port to open it in the browser through a tunnel',
  restarts: (n: number) => `restarts: ${n}`,
  openPortTitle: (addr: string) => `Open http://localhost → ${addr} through a tunnel`,
  portNotPublished: 'Port not published',
  start: 'Start',
  stop: 'Stop',
  restart: 'Restart',
  pause: 'Pause',
  unpause: 'Unpause',
  followLogs: 'Follow logs',
  shell: 'Shell in container',
  details: 'Details (inspect)',
  removeContainer: 'Remove container',
  remove: 'Remove',
  removeContainerTitle: (name: string) => `Remove container ${name}?`,
  removeRunningMessage: 'The container is running and will be force-stopped. Data in named volumes is kept.',
  removeStoppedMessage: 'Data in named volumes is kept.',
  tunnelOpened: 'Tunnel opened',
  tunnelOpenedMessage: (localPort: number, host: string, hostPort: number) =>
    `localhost:${localPort} → ${host}:${hostPort} on the server. Stop it from the tunnels menu in the title bar.`,
  tunnelFailed: 'Could not open tunnel',
  composeConfirmTitle: (action: string, project: string) => `compose ${action} for ${project}?`,
  composeDownMessage: 'The project’s containers will be stopped and removed. Volumes are kept.',

  // Images and volumes
  inUse: 'in use',
  unused: 'unused',
  dangling: 'dangling',
  prune: 'Prune',
  images: (n: number) => `${n} ${pluralEn(n, 'image', 'images')}`,
  danglingCount: (n: number) => `${n} dangling`,
  pruneImagesTitle: 'Prune dangling images?',
  pruneImagesMessage: (n: number) => `This removes ${n} dangling ${pluralEn(n, 'image', 'images')} not used by any container.`,
  pruneDangling: 'Prune dangling',
  pullImage: 'Update image (pull)',
  imageInUse: 'Image is in use by a container',
  removeImage: 'Remove image',
  removeImageTitle: (name: string) => `Remove image ${name}?`,
  removeImageMessage: (size: string) => `This frees about ${size}.`,
  noImages: 'No images',

  volumes: (n: number) => `${n} ${pluralEn(n, 'volume', 'volumes')}`,
  unusedCount: (n: number) => `${n} unused`,
  pruneVolumesTitle: 'Prune unused volumes?',
  pruneVolumesMessage: (n: number) =>
    `This permanently deletes ${n} ${pluralEn(n, 'volume', 'volumes')} and their data. Make sure you really don’t need them.`,
  pruneUnused: 'Prune unused',
  volumeInUse: 'Volume is in use by a container',
  removeVolume: 'Remove volume',
  removeVolumeTitle: (name: string) => `Remove volume ${name}?`,
  removeVolumeMessage: 'All data in the volume will be permanently lost.',
  noVolumes: 'No volumes'
}
