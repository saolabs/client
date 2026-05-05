@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@wrapper
<h1 @class([$__VIEW_ID__ . '-h1-1'])>{{ $title }}</h1>
    <p @class([$__VIEW_ID__ . '-p-2'])>{{ $content }}</p>
@endWrapper
