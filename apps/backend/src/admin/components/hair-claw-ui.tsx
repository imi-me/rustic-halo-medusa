import { useState, type ReactElement, type ReactNode } from 'react'
import { Tooltip } from '@medusajs/ui'
import './hair-claw-editor.css'

const icons = {
  info:'M12 17v-5m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  image:'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1m-1 14 6-6 4 4 3-3 5 5M8 7h.01',
  corners:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 7h10v10H7Z',
  crop:'M6 3v15h15M3 6h15v15',
  tune:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
  reset:'M3 11a9 9 0 1 1 2.5 7M3 3v8h8',
  rotate:'M4 10a8 8 0 1 1 1 8M4 3v7h7',
  flipH:'M12 3v18M8 7l-5 5 5 5V7m8 0 5 5-5 5V7',
  flipV:'M3 12h18M7 8l5-5 5 5H7m0 8 5 5 5-5H7',
  upload:'M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4',
  check:'m5 12 4 4L19 6',
  arrow:'m9 5 7 7-7 7',
  trash:'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6',
  link:'m9 15 6-6m-4-3 2-2a4 4 0 0 1 6 6l-2 2m-4 6-2 2a4 4 0 0 1-6-6l2-2',
} as const
export function FitIcon({name}:{name:keyof typeof icons}) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]}/></svg>
}
export function FitHint({tip,children}:{tip:ReactNode;children:ReactElement}) {
  return <Tooltip content={tip} maxWidth={280} className="rh-fit-tooltip" side="bottom">{children}</Tooltip>
}
export function FitHelp({label,children}:{label:string;children:ReactNode}) {
  const [open,setOpen]=useState(false)
  return <Tooltip content={children} open={open} onOpenChange={setOpen} onClick={()=>setOpen(true)} maxWidth={280} className="rh-fit-tooltip" side="bottom"><button type="button" className="rh-fit-help" aria-label={`${label} help`}><FitIcon name="info"/></button></Tooltip>
}
