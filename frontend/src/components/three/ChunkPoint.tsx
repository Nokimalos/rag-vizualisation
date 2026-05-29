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
          <div
            style={{
              background: 'rgba(10,10,20,0.92)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '8px 12px',
              width: '240px',
              fontSize: '11px',
              fontFamily: 'Inter, system-ui, sans-serif',
              color: '#e2e8f0',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: '4px', fontSize: '10px', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {id}
            </div>
            <div>{truncatedText}</div>
          </div>
        </Html>
      )}
    </mesh>
  )
}
