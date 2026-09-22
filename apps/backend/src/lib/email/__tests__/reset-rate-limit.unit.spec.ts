import { allowReset, limitPasswordReset, RESET_LIMIT_SCRIPT } from '../reset-rate-limit'

test('shares normalized account limits without storing the email', async () => {
  const evalMock = jest.fn().mockResolvedValue(1)
  const connection = { eval: evalMock } as any
  expect(await allowReset(' Person@Example.com ', connection)).toBe(true)
  await allowReset('person@example.com', connection)
  expect(evalMock.mock.calls[0]).toEqual(evalMock.mock.calls[1])
  expect(JSON.stringify(evalMock.mock.calls)).not.toContain('example.com')
  expect(evalMock.mock.calls[0][0]).toBe(RESET_LIMIT_SCRIPT)
})

test('denies when Redis refuses the request and propagates outages', async () => {
  expect(await allowReset('a@example.com', { eval: jest.fn().mockResolvedValue(0) } as any)).toBe(false)
  await expect(allowReset('a@example.com', { eval: jest.fn().mockRejectedValue(Error('offline')) } as any)).rejects.toThrow('offline')
})

test('disabled recovery does not reach the auth handler', async () => {
  const previous = process.env.CUSTOMER_PASSWORD_RESET_ENABLED
  process.env.CUSTOMER_PASSWORD_RESET_ENABLED = 'false'
  try {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    const next = jest.fn()
    await limitPasswordReset({ body: { identifier: 'a@example.com' } } as any, res as any, next)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(next).not.toHaveBeenCalled()
  } finally {
    if (previous === undefined) delete process.env.CUSTOMER_PASSWORD_RESET_ENABLED
    else process.env.CUSTOMER_PASSWORD_RESET_ENABLED = previous
  }
})
