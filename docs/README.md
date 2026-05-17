# Saola Client Documentation

> Tài liệu kỹ thuật cho Saola Client - TypeScript Runtime Library

## 📚 Tổng Quan

Thư mục này chứa tất cả tài liệu kỹ thuật liên quan đến **Saola Client** - thư viện runtime TypeScript cho reactive SPAs.

## 📋 Danh Sách Tài Liệu

### 🔄 Runtime & Architecture
- **[RUNTIME_API_SPEC.md](RUNTIME_API_SPEC.md)** - Thông số kỹ thuật API runtime
- **[RUNTIME_ARCHITECTURE.md](RUNTIME_ARCHITECTURE.md)** - Kiến trúc runtime system

### 🎨 Reactive System
- **[REACTIVE_DIRECTIVE_LARAVEL.md](REACTIVE_DIRECTIVE_LARAVEL.md)** - Hệ thống reactive directives
- **[MOUNT_VIEW_DESIGN.md](MOUNT_VIEW_DESIGN.md)** - Thiết kế view mounting
- **[FOREACH_RECONCILIATION_DESIGN.md](FOREACH_RECONCILIATION_DESIGN.md)** - Reconciliation cho foreach loops

### 🏗️ Bootstrap & Logic
- **[BOOTSTRAP_PROVIDER_GUIDE.md](BOOTSTRAP_PROVIDER_GUIDE.md)** - Hướng dẫn bootstrap providers
- **[NEW_LOGIC_GUIDE.md](NEW_LOGIC_GUIDE.md)** - Hướng dẫn logic mới

## 🚀 Bắt Đầu

1. **Đọc RUNTIME_ARCHITECTURE.md** để hiểu kiến trúc tổng thể
2. **Xem RUNTIME_API_SPEC.md** để biết API reference
3. **Đọc các design docs** để hiểu implementation details

## 📖 API Reference

```typescript
import { Application, ViewController, ViewState } from '@saolabs/client';

// Tạo app instance
const app = new Application({
  el: '#app',
  debug: true
});

// Tạo reactive state
const state = new ViewState({
  count: 0,
  user: null
});
```

## 🔗 Liên Kết

- [Saola Client README](../README.md)
- [Saola Compiler](../../compiler/README.md)
- [Examples](../../examples/)

---

*Tài liệu này được tách từ SaoView V2 để phục vụ Saola Client ecosystem.*