import { craftModelPools } from './craftModelAssets'
import type { CraftModelKind } from './craftModelConfig'
import { ModelInstances } from './ModelInstances'
import type { ModelPlacement } from './ModelInstances'

export function CraftModels({ kind, placements, tint }: {
  kind: CraftModelKind
  placements: readonly ModelPlacement[]
  tint?: string
}) {
  return <ModelInstances key={kind} pool={craftModelPools[kind]} placements={placements} tint={tint}/>
}
