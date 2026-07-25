import { describe, expect, it } from 'vitest';
import { app } from '../../src/core/helpers/app';

describe('app helper compiler contract', () => {
    it('app("App") luôn trả về cùng container mà compiled view sử dụng', () => {
        expect(app('App')).toBe(app());
    });
});
