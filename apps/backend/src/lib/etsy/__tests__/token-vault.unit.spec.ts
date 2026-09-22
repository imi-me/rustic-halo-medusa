import { decryptEtsyToken, encryptEtsyToken } from '../token-vault'
const key=Buffer.alloc(32,7).toString('base64url')
test('refresh tokens are encrypted in an opaque authenticated envelope',()=>{const value=encryptEtsyToken('refresh-token',key); expect(value).not.toContain('refresh-token'); expect(decryptEtsyToken(value,key)).toBe('refresh-token')})
test('tampering fails closed',()=>{const value=encryptEtsyToken('refresh-token',key); expect(()=>decryptEtsyToken(value.split('.').map((part,index)=>index===2 ? (part[0] === 'A' ? 'B' : 'A') + part.slice(1) : part).join('.'),key)).toThrow('Invalid Etsy token envelope.')})
