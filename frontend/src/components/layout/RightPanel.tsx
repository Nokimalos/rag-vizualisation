import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { PanelRouter } from '../panels/PanelRouter'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

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
          className="flex flex-col bg-surface border-l border-border overflow-hidden shrink-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <span className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
              Node Detail
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setRightPanelOpen(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              {selectedNode && <PanelRouter nodeType={selectedNode} />}
            </div>
          </ScrollArea>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
