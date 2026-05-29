import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { PanelRouter } from '../panels/PanelRouter'

export function RightPanel() {
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen)
  const selectedNode = useUIStore((s) => s.selectedNode)
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen)

  const isVisible = rightPanelOpen && selectedNode != null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          key="right-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="flex flex-col glass border-l border-glass-border overflow-hidden shrink-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border shrink-0">
            <span className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">
              Node Detail
            </span>
            <button
              onClick={() => setRightPanelOpen(false)}
              className="p-1 rounded-md text-gray-500 hover:text-gray-200 hover:bg-glass-bg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedNode && <PanelRouter nodeType={selectedNode} />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
