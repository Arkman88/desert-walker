export type PlayerPose = { x: number; y: number; z: number; yaw: number; pitch: number }
type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>

export const PLAYER_SAVE_KEY = 'desert-walker.player.v1'
const SAVE_VERSION = 1
export const AUTOSAVE_SECONDS = 3

export function parsePlayerSave(raw: string | null): PlayerPose | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (data?.version !== SAVE_VERSION) return null
    const pose = data.pose
    if (!pose || !['x', 'y', 'z', 'yaw', 'pitch'].every(key => typeof pose[key] === 'number' && Number.isFinite(pose[key]))) return null
    if (Math.abs(pose.x) > 1_000_000 || Math.abs(pose.z) > 1_000_000 || Math.abs(pose.y) > 10_000) return null
    return { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw % (Math.PI * 2),
      pitch: Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, pose.pitch)) }
  } catch { return null }
}

export function loadPlayerSave(storage?: SaveStorage): PlayerPose | null {
  try { return parsePlayerSave((storage ?? localStorage).getItem(PLAYER_SAVE_KEY)) }
  catch { return null }
}

export function savePlayerPose(pose: PlayerPose, storage?: SaveStorage): boolean {
  try {
    const raw = JSON.stringify({ version: SAVE_VERSION, pose })
    if (!parsePlayerSave(raw)) return false
    ;(storage ?? localStorage).setItem(PLAYER_SAVE_KEY, raw)
    return true
  } catch { return false }
}
