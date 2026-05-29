import { EffectComposer, Bloom } from '@react-three/postprocessing'

export function SceneEffects() {
  return (
    <EffectComposer>
      <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={0.6} mipmapBlur />
    </EffectComposer>
  )
}
