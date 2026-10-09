import { decimalCents } from '../cents'
test.each([[1.015,102],[15.015,1502],[5.005,501],[1.0049,100],[0,0],[1e-7,0],[12.34,1234]])('rounds %p to %p cents', (amount,expected) => {
  expect(decimalCents(amount)).toBe(expected)
})
test.each([-1,NaN,Infinity,1e20])('rejects invalid currency %p', amount => expect(()=>decimalCents(amount)).toThrow())
