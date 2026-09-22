import { createEtsyAuthorization, etsyReadConfig, validState } from '../oauth'
test('catalog authorization requests only the approved Etsy scopes with PKCE S256', () => {
 const config=etsyReadConfig({ETSY_READ_ENABLED:'true',ETSY_API_KEY:'keystring',ETSY_OAUTH_CALLBACK_URL:'https://staging.rustichalo.com/integrations/etsy/callback'} as NodeJS.ProcessEnv)!
 const auth=createEtsyAuthorization(config,100), url=new URL(auth.url)
 expect(url.origin+url.pathname).toBe('https://www.etsy.com/oauth/connect'); expect(url.searchParams.get('scope')).toBe('listings_r listings_w shops_r'); expect(url.searchParams.get('code_challenge_method')).toBe('S256'); expect(url.searchParams.get('code_challenge')).not.toBe(auth.verifier); expect(validState(auth.state,auth.state,auth.expiresAt,101)).toBe(true); expect(validState(auth.state,'different',auth.expiresAt,101)).toBe(false)
})
test('connection remains disabled without an exact https callback',()=>expect(etsyReadConfig({ETSY_READ_ENABLED:'true',ETSY_API_KEY:'keystring',ETSY_OAUTH_CALLBACK_URL:'http://localhost/callback'} as NodeJS.ProcessEnv)).toBeNull())
test('order report scope is separately gated and never adds transaction writes', () => {
 const base = { ETSY_READ_ENABLED:'true', ETSY_API_KEY:'keystring', ETSY_OAUTH_CALLBACK_URL:'https://staging.rustichalo.com/integrations/etsy/callback' } as NodeJS.ProcessEnv
 expect(etsyReadConfig(base)?.scopes).not.toContain('transactions_r')
 const enabled = etsyReadConfig({ ...base, ETSY_ORDER_REPORT_ENABLED: 'true' })!
 expect(enabled.scopes).toContain('transactions_r')
 expect(enabled.scopes).not.toContain('transactions_w')
})
