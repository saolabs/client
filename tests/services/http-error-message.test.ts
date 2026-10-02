import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpService } from '../../src/core/services/HttpService';

/** fetch giả trả về body JSON + status tuỳ ý. */
function stubFetch(status: number, statusText: string, body: any) {
    vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: status >= 200 && status < 300,
        status,
        statusText,
        headers: new Headers(),
        json: async () => body,
    })));
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('HttpService — lỗi HTTP', () => {
    it('dùng message của server thay cho "HTTP <status>"', async () => {
        // Laravel 422: message + errors từng field.
        stubFetch(422, 'Unprocessable Content', {
            message: 'The email field is required.',
            errors: { email: ['The email field is required.'] },
        });

        const http = new HttpService();
        const err: any = await http.post('/api/roster', { name: 'A' }).catch(e => e);

        expect(err.message).toBe('The email field is required.');
        // Body đầy đủ vẫn còn để caller đọc lỗi từng field
        expect(err.response.statusCode).toBe(422);
        expect(err.response.data.errors.email[0]).toBe('The email field is required.');
    });

    it('không có message thì rơi về "HTTP <status> <statusText>"', async () => {
        stubFetch(500, 'Internal Server Error', {});

        const http = new HttpService();
        const err: any = await http.get('/api/roster').catch(e => e);

        expect(err.message).toBe('HTTP 500 Internal Server Error');
    });
});
