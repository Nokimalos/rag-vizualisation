import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { ChunkPoint } from './ChunkPoint'
import { SceneEffects } from './effects/SceneEffects'
import type { EmbeddingPoint } from '../../types'

const COLOR_PALETTE = [
  '#00d4ff', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
]

function getColorForDocumentId(docId: string, palette: string[]): string {
  let hash = 0
  for (let i = 0; i < docId.length; i++) {
    hash = (hash * 31 + docId.charCodeAt(i)) >>> 0
  }
  return palette[hash % palette.length]
}

interface QueryPointMarkerProps {
  position: [number, number, number]
}

function QueryPointMarker({ position }: QueryPointMarkerProps) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.14, 16, 16]} />
      <meshStandardMaterial
        color="#fbbf24"
        emissive="#f59e0b"
        emissiveIntensity={2.5}
        roughness={0.1}
        metalness={0.8}
      />
    </mesh>
  )
}

interface LaserLineProps {
  from: [number, number, number]
  to: [number, number, number]
}

function LaserLine({ from, to }: LaserLineProps) {
  const points: [number, number, number][] = [from, to]
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(points.flat()), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#fbbf24" transparent opacity={0.6} />
    </line>
  )
}

interface EmbeddingSpaceProps {
  points: EmbeddingPoint[]
  queryPoint?: { x: number; y: number; z: number }
  nearestIds?: string[]
  className?: string
}

export function EmbeddingSpace({ points, queryPoint, nearestIds = [], className }: EmbeddingSpaceProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [5, 5, 5], fov: 60 }}
        style={{ background: '#0a0a0f' }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} color="#8b5cf6" />

        <Stars radius={80} depth={50} count={3000} factor={3} saturation={0} fade speed={0.5} />

        {points.map((point) => {
          const docId = (point.metadata?.document_id as string) ?? point.id
          const color = getColorForDocumentId(docId, COLOR_PALETTE)
          const isHighlighted = nearestIds.includes(point.id)
          return (
            <ChunkPoint
              key={point.id}
              position={[point.x, point.y, point.z]}
              color={color}
              id={point.id}
              text={point.text}
              isHighlighted={isHighlighted}
            />
          )
        })}

        {queryPoint && (
          <QueryPointMarker position={[queryPoint.x, queryPoint.y, queryPoint.z]} />
        )}

        {queryPoint && nearestIds.length > 0 &&
          points
            .filter((p) => nearestIds.includes(p.id))
            .map((p) => (
              <LaserLine
                key={`laser-${p.id}`}
                from={[queryPoint.x, queryPoint.y, queryPoint.z]}
                to={[p.x, p.y, p.z]}
              />
            ))
        }

        <OrbitControls makeDefault enablePan enableZoom enableRotate />
        <SceneEffects />
      </Canvas>
    </div>
  )
}
