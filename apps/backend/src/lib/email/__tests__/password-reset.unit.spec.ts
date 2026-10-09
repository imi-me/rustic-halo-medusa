import { passwordResetEmail, passwordResetKey } from '../password-reset'
test('encodes reset tokens and email safely',()=>{
 const result=passwordResetEmail('token&one','a+b@example.com','https://rustichalo.com/us/reset-password')
 expect(result.text).toContain('token=token%26one')
 expect(result.text).toContain('Makers of laser cut, engraved, and handpainted products.')
 expect(result.html).toContain('src="cid:rustic-halo-logo"')
 expect(result.html).toContain('&amp;email=a%2Bb%40example.com')
})
test.each(['http://public.example/reset','javascript:alert(1)','https://user:pass@example.com/reset','https://example.com/reset?redirect=evil'])('rejects unsafe configuration %s',base=>{
 expect(()=>passwordResetEmail('token','test@example.com',base)).toThrow()
})
test('permits the private localhost preview',()=>{expect(()=>passwordResetEmail('token','test@example.com','http://localhost:18000/us/reset-password')).not.toThrow()})
test('idempotency key is stable without exposing token',()=>{expect(passwordResetKey('secret-fixture')).toBe(passwordResetKey('secret-fixture'));expect(passwordResetKey('secret-fixture')).not.toContain('secret-fixture');expect(passwordResetKey('different')).not.toBe(passwordResetKey('secret-fixture'))})
