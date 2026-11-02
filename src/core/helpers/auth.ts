import { app } from './app.js';
import { AuthService } from '../services/AuthService.js';
import type { ApplicationInterface } from '../contracts/ApplicationInterface.js';

/** Same instance exposed by App.Auth and App.Helper.auth(). */
export function auth(guard?: string | null): AuthService {
    const application = app<ApplicationInterface>();
    if (!application.has('Auth')) application.instance('Auth', AuthService.fromSnapshot(application.shared('auth')));
    return application.get<AuthService>('Auth').guard(guard);
}
