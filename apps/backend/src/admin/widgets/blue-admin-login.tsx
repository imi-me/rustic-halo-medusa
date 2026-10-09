import { defineWidgetConfig } from '@medusajs/admin-sdk'
import '../styles/blue-admin.css'

const BlueAdminLogin = () => <div className="rh-login-brand"><span className="rh-deer" aria-hidden="true" /><div><strong>Rustic Halo</strong><span>Your store, beautifully organized.</span></div></div>

export const config = defineWidgetConfig({ zone: 'login.before' })
export default BlueAdminLogin
