import { useRef, useState } from 'react'
const inline = (text: string) => text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => /^\*\*[^*]+\*\*$/.test(part) ? <strong key={index}>{part.slice(2, -2)}</strong> : /^\*[^*]+\*$/.test(part) ? <em key={index}>{part.slice(1, -1)}</em> : part)
export function DescriptionEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)
  const format = (kind: 'bold' | 'italic' | 'list') => {
    const start = input.current?.selectionStart ?? value.length
    const end = input.current?.selectionEnd ?? start
    const selected = value.slice(start, end) || (kind === 'list' ? 'List item' : 'Text')
    const replacement = kind === 'list' ? selected.split('\n').map(line => `- ${line}`).join('\n') : `${kind === 'bold' ? '**' : '*'}${selected}${kind === 'bold' ? '**' : '*'}`
    onChange(value.slice(0, start) + replacement + value.slice(end)); setPreview(false)
    input.current?.focus()
  }
  return <div className="rh-inline-field wide"><span>Description</span><div className="rh-description-toolbar"><button type="button" onClick={() => format('bold')}>Bold</button><button type="button" onClick={() => format('italic')}>Italic</button><button type="button" onClick={() => format('list')}>Bullet list</button><button type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? 'Edit description' : 'Preview description'}</button></div>{preview ? <div className="rh-description-preview">{value.split('\n').map((line, index) => /^[-•]\s/.test(line) ? <div key={index}>• {inline(line.slice(2))}</div> : <p key={index}>{inline(line) || <br/>}</p>)}</div> : <textarea ref={input} aria-label="Description" rows={6} value={value} onChange={event => onChange(event.target.value)}/>}</div>
}
