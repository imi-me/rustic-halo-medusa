import { guardAppleStaffActor } from '../actor-guard'
describe('Apple staff actor guard', () => {
  const response = () => ({ setHeader: jest.fn(), clearCookie: jest.fn() }) as any
  it.each(['customer', 'seller', 'unknown'])('rejects the %s actor before consuming a grant', actor_type => {
    const next = jest.fn()
    expect(() => guardAppleStaffActor({ params: { actor_type, auth_provider: 'apple-staff' } } as any, response(), next)).toThrow('only for invited staff')
    expect(next).not.toHaveBeenCalled()
  })
  it('permits the native staff callback and clears temporary cookies from its response', () => {
    const res = response(), next = jest.fn()
    guardAppleStaffActor({ params: { actor_type: 'user', auth_provider: 'apple-staff' } } as any, res, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.clearCookie).toHaveBeenCalledTimes(2)
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
  })
  it('preserves other authentication providers', () => {
    const res = response(), next = jest.fn()
    guardAppleStaffActor({ params: { actor_type: 'customer', auth_provider: 'emailpass' } } as any, res, next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(res.clearCookie).not.toHaveBeenCalled()
  })
})
