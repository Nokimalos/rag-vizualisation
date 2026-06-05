import { useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import type { Mesh } from 'three'

interface ChunkPointProps {
  position: [number, number, number]
  color: string
  id: string
  text: string
  isHighlighted?: boolean
}

export function ChunkPoint({ position, color, id, text, isHighlighted = false }: ChunkPointProps) {
  const meshRef = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)

  const truncatedText = text.length > 120 ? text.slice(0, 120) + '…' : text

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={hovered ? 1.8 : 1}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[0.08, 12, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isHighlighted ? 1.4 : hovered ? 0.8 : 0.3}
        roughness={0.2}
        metalness={0.6}
      />
      {hovered && (
        <Html
          center
          style={{ pointerEvents: 'none', width: '240px' }}
        >
          {/* Tooltip floats over the dark 3D scene — keep a fixed dark surface so it
              reads consistently in both light and dark app themes. Token-based border
              and text colours are used where the contrast holds against the dark bg. */}
          <div className="rounded-lg border border-border bg-[#0c0d10]/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur-sm" style={{ width: '240px', wordBreak: 'break-word', whiteSpace: 'normal', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div className="mb-1 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {id}
            </div>
            <div className="text-slate-200 leading-snug">
              {truncatedText}
            </div>
          </div>
        </Html>
      )}
    </mesh>
  )
}
