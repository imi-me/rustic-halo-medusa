import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TableKit } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { cleanDescription, descriptionHTML } from '../../lib/product-description'
import '../styles/description-editor.css'
export function DescriptionEditor({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const emitted = useRef(value)
  const interacted = useRef(false)
  const [source, setSource] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState('')
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: false }, codeBlock: false }), TextAlign.configure({ types: ['heading', 'paragraph'] }), TableKit, Image, TextStyleKit],
    content: descriptionHTML(value),
    editorProps: { attributes: { role: 'textbox', 'aria-label': 'Description', 'aria-multiline': 'true', spellcheck: 'true' } },
    onUpdate: ({ editor }) => { if (!interacted.current) return; const next = cleanDescription(editor.getHTML()); emitted.current = next; onChange(next) },
  })
  useEffect(() => { editor?.setEditable(!disabled) }, [editor, disabled])
  const state = useEditorState({ editor, selector: ({ editor }) => editor ? { bold: editor.isActive('bold'), italic: editor.isActive('italic'), underline: editor.isActive('underline'), bullet: editor.isActive('bulletList'), numbered: editor.isActive('orderedList'), undo: editor.can().undo(), redo: editor.can().redo(), heading: [1, 2, 3, 4, 5, 6].find(level => editor.isActive('heading', { level })) ?? 0, align: editor.getAttributes('paragraph').textAlign || editor.getAttributes('heading').textAlign || 'left', table: editor.isActive('table') } : null })
  useEffect(() => {
    if (!editor || value === emitted.current) return
    emitted.current = value; editor.commands.setContent(descriptionHTML(value), { emitUpdate: false })
  }, [value, editor])
  if (!editor || !state) return <div>Loading description editor…</div>
  const button = (label: string, caption: string, run: () => void, active = false, unavailable = false) => <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled || unavailable || source !== null} onMouseDown={event => event.preventDefault()} onClick={run}>{caption}</button>
  const validURL = (url: string, media = false) => media ? /^https:\/\/[^\s]+$/i.test(url) : /^(https?:\/\/|mailto:|tel:|\/(?!\/))[^\s]+$/i.test(url)
  return <div className="rh-inline-field wide rh-rich-description" onFocusCapture={() => { interacted.current = true }} onPointerDownCapture={() => { interacted.current = true }}><span>Description</span>
    <div className="rh-rich-toolbar" role="toolbar" aria-label="Description formatting">
      <select aria-label="Text format" disabled={disabled || source !== null} value={state.heading} onChange={event => { const level = Number(event.target.value); if (level) editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run(); else editor.chain().focus().setParagraph().run() }}><option value="0">Paragraph</option>{[1,2,3,4,5,6].map(level => <option key={level} value={level}>Heading {level}</option>)}</select>
      {button('Bold', 'B', () => editor.chain().focus().toggleBold().run(), state.bold)}
      {button('Italic', 'I', () => editor.chain().focus().toggleItalic().run(), state.italic)}
      {button('Underline', 'U', () => editor.chain().focus().toggleUnderline().run(), state.underline)}
      {button('Bullet list', '• List', () => editor.chain().focus().toggleBulletList().run(), state.bullet)}
      {button('Numbered list', '1. List', () => editor.chain().focus().toggleOrderedList().run(), state.numbered)}
      <select aria-label="Text alignment" disabled={disabled || source !== null} value={state.align} onChange={event => editor.chain().focus().setTextAlign(event.target.value).run()}>{['left','center','right','justify'].map(align => <option key={align} value={align}>{align[0].toUpperCase()+align.slice(1)}</option>)}</select>
      <label className="rh-rich-color" title="Text color">A<input aria-label="Text color" type="color" disabled={disabled || source !== null} defaultValue="#253047" onChange={event => editor.chain().focus().setColor(event.target.value).run()}/></label>
      {button('Insert or edit link', 'Link', () => { setLink(editor.getAttributes('link').href || ''); setError('') })}
      {button('Remove link', 'Unlink', () => editor.chain().focus().unsetLink().run())}
      {button('Insert image', 'Image', () => { setImage(''); setError('') })}
      {button('Insert table', 'Table', () => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run())}
      {button('Blockquote', 'Quote', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
      {button('Clear formatting', 'Clear', () => editor.chain().focus().unsetAllMarks().clearNodes().run())}
      {button('Undo', '↶', () => editor.chain().focus().undo().run(), false, !state.undo)}
      {button('Redo', '↷', () => editor.chain().focus().redo().run(), false, !state.redo)}
      <button type="button" disabled={disabled} aria-label={source === null ? 'Edit HTML' : 'Return to visual editor'} onClick={() => { if (source === null) setSource(editor.getHTML()); else { const next = cleanDescription(source); editor.commands.setContent(next); setSource(null) } }}>{source === null ? '</> HTML' : 'Apply HTML'}</button>
    </div>
    {state.table && source === null && <div className="rh-rich-toolbar" aria-label="Table tools">{button('Add table row', '+ Row', () => editor.chain().focus().addRowAfter().run())}{button('Add table column', '+ Column', () => editor.chain().focus().addColumnAfter().run())}{button('Delete table row', '− Row', () => editor.chain().focus().deleteRow().run())}{button('Delete table column', '− Column', () => editor.chain().focus().deleteColumn().run())}{button('Delete table', 'Remove table', () => editor.chain().focus().deleteTable().run())}</div>}
    {link !== null && <div className="rh-rich-dialog"><label>Link URL<input aria-label="Link URL" value={link} placeholder="https://… or /us/products/…" onChange={event => setLink(event.target.value)}/></label><button type="button" onClick={() => { if (!validURL(link)) { setError('Enter a website, email, phone or internal link.'); return } editor.chain().focus().extendMarkRange('link').setLink({ href: link }).run(); setLink(null); setError('') }}>Apply link</button><button type="button" onClick={() => { setLink(null); setError('') }}>Cancel</button></div>}
    {image !== null && <div className="rh-rich-dialog"><label>Public image URL<input aria-label="Description image URL" value={image} placeholder="https://…" onChange={event => setImage(event.target.value)}/></label><button type="button" onClick={() => { if (!validURL(image, true)) { setError('Enter a public HTTPS image URL.'); return } editor.chain().focus().setImage({ src: image, alt: '' }).run(); setImage(null); setError('') }}>Insert image</button><button type="button" onClick={() => { setImage(null); setError('') }}>Cancel</button></div>}
    {error && <small role="alert">{error}</small>}
    {source !== null ? <><textarea aria-label="Description HTML" disabled={disabled} rows={10} value={source} onChange={event => { const next = event.target.value; setSource(next); emitted.current = cleanDescription(next); onChange(emitted.current) }}/><small>Supported formatting is kept. Scripts and embedded video/audio are removed.</small></> : <EditorContent editor={editor}/>}
  </div>
}
