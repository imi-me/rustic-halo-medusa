import sanitize from 'sanitize-html'
export const richDescription = (value: string) => /<\/?(?:p|div|h[1-6]|strong|b|em|i|u|s|ul|ol|li|br|a|img|table|blockquote|pre)\b/i.test(value)
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export function cleanDescription(value: string) {
  return sanitize(value, {
    allowedTags: ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'blockquote', 'ul', 'ol', 'li', 'br', 'hr', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre', 'code', 'span'],
    allowedAttributes: { '*': ['style'], a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title', 'width', 'height'], ol: ['start'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] },
    allowedStyles: { '*': { 'text-align': [/^(left|center|right|justify)$/], color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/], 'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/] } },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'], allowedSchemesByTag: { img: ['https', 'http'] }, allowProtocolRelative: false,
    transformTags: { a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } }) },
  })
}
export function descriptionHTML(value: string) {
  if (richDescription(value)) return cleanDescription(value)
  const inline = (text: string) => escape(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>')
  let output = '', list = false
  for (const line of value.split(/\r?\n/)) {
    if (/^[-•]\s/.test(line)) { if (!list) output += '<ul>'; list = true; output += `<li>${inline(line.slice(2))}</li>` }
    else { if (list) output += '</ul>'; list = false; output += `<p>${inline(line) || '<br>'}</p>` }
  }
  return output + (list ? '</ul>' : '')
}
export function descriptionText(value: string) {
  if (!richDescription(value)) return value
  return sanitize(value.replace(/<br\s*\/?\s*>|<\/(?:p|div|h[1-6]|li|tr|blockquote)>/gi, '\n'), { allowedTags: [], allowedAttributes: {} }).replace(/\n{3,}/g, '\n\n').trim()
}
