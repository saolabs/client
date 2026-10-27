// Mẫu khai báo kiểu cho namespace của gói context (App.Admin…). Gói đi kèm file
// kiểu này; `tsc` biên dịch nó trong test để chứng minh phương thức sai LỖI.
import type { ApplicationInterface } from '../../../src/core/contracts/ApplicationInterface.js';

export interface AdminApi {
    createSettingsForm(editor: { group: string }): { save(): Promise<void> };
}

declare module '../../../src/core/contracts/ApplicationInterface.js' {
    interface ApplicationInterface {
        Admin: AdminApi;
    }
}

// Class `Application` implements ApplicationInterface nên phải khai CẢ HAI,
// nếu không tsc báo "Property 'Admin' is missing in type 'Application'".
declare module '../../../src/core/app/Application.js' {
    interface Application {
        Admin: AdminApi;
    }
}

declare const App: ApplicationInterface;

// Đúng: có kiểu, gọi được.
App.Admin.createSettingsForm({ group: 'general' }).save();

// Sai: nếu dòng dưới KHÔNG lỗi biên dịch thì @ts-expect-error báo lỗi → test đỏ.
// @ts-expect-error phương thức không tồn tại trên AdminApi
App.Admin.khongCo();
// @ts-expect-error sai kiểu tham số
App.Admin.createSettingsForm({ group: 1 });
