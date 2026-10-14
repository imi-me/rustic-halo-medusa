import { cleanDescription, descriptionHTML, descriptionText } from '../product-description'
describe('product descriptions', () => {
  it('renders legacy text and Markdown without interpreting markup', () => {
    expect(descriptionHTML('**Wood**\n- Natural\n<script>alert(1)</script>')).toContain('<strong>Wood</strong>')
    expect(descriptionHTML('<script>alert(1)</script>')).toContain('&lt;script&gt;')
  })
  it('removes executable tags, event handlers, dangerous links and styles', () => {
    const html = cleanDescription('<p onclick="alert(1)" style="position:fixed;color:#ff0000">Wood<script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="data:image/svg+xml,x" onerror="alert(1)"></p>')
    expect(html).not.toMatch(/script|onclick|onerror|position|javascript:|data:/)
    expect(html).toContain('color:#ff0000')
  })
  it('preserves headings, lists, tables, links, image alt and alignment', () => {
    const html = cleanDescription('<h2 style="text-align:center">Care</h2><ol><li>Wipe</li></ol><table><tr><td>Wood</td></tr></table><a href="/us/store">Shop</a><img src="https://cdn.rustichalo.com/x.png" alt="Claw">')
    expect(html).toContain('<h2 style="text-align:center">Care</h2>')
    expect(html).toContain('<td>Wood</td>')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('alt="Claw"')
  })
  it('keeps Etsy and AI copy free of formatting tags', () => {
    expect(descriptionText('<p>Wood</p><p><strong>Natural</strong></p>')).toBe('Wood\nNatural')
  })
})
