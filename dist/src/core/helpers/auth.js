import { app } from './app.js';
import { AuthService } from '../services/AuthService.js';
/** Same instance exposed by App.Auth and App.Helper.auth(). */
export function auth(guard) {
    const application = app();
    if (!application.has('Auth'))
        application.instance('Auth', AuthService.fromSnapshot(application.shared('auth')));
    return application.get('Auth').guard(guard);
}
//# sourceMappingURL=auth.js.map