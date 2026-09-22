import { claimResetToken } from '../reset-replay-guard'
const token = (data: object) => 'fixture.' + Buffer.from(JSON.stringify(data)).toString('base64url') + '.fixture'
const payload = {purpose: 'reset', jti: 'private-token-id', exp: Math.floor(Date.now()/1000)+900}
test('claims by token ID atomically and never exposes the ID in Redis', async () => {
 const set = jest.fn().mockResolvedValue('OK')
 expect(await claimResetToken(token(payload), {set} as any)).toBe(true)
 expect(set.mock.calls[0][0]).not.toContain(payload.jti)
 expect(set.mock.calls[0].slice(1)).toEqual(['1','EX',expect.any(Number),'NX'])
})
test('denies replay', async () => { expect(await claimResetToken(token(payload), {set: jest.fn().mockResolvedValue(null)} as any)).toBe(false) })
test.each([{...payload,purpose:'session'},{...payload,exp:1},{...payload,jti:null}])('rejects invalid reset claims', async data => {
 const set = jest.fn()
 await expect(claimResetToken(token(data), {set} as any)).rejects.toThrow()
 expect(set).not.toHaveBeenCalled()
})
test('does not allow an unavailable Redis to pass', async () => {
 await expect(claimResetToken(token(payload), {set: jest.fn().mockRejectedValue(Error('offline'))} as any)).rejects.toThrow()
})
