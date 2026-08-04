/**
 * Harness nội bộ — nay chỉ re-export `src/testing` (bản public,
 * `@saolabs/client/testing`). Giữ file này để test cũ không phải đổi import,
 * và để test nội bộ chạy trên ĐÚNG code mà người dùng cuối nhận được.
 */
export { mount, mountView, nextFrame, visibleText } from '../../src/testing';
export type { Harness, MountOptions } from '../../src/testing';
