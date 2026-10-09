/** Round decimal currency half-up without binary multiplication at .005. */
export function decimalCents(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw Error('Invalid currency amount')
  const [mantissa, exponent = '0'] = String(amount).split('e')
  const result = Math.round(Number(`${mantissa}e${Number(exponent) + 2}`))
  if (!Number.isSafeInteger(result)) throw Error('Invalid currency cents')
  return result
}
