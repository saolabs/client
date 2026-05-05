@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@pageStart
@wrapper
{{-- đây là trang layout --}}

<div @class([$__VIEW_ID__ . '-div-1', 'container'])>
    @useBlock('content')
    {{-- tương đương vói dạng @blockoutlet('content') hay <block-outlet name="content"></block-outlet> --}}
</div>
@endWrapper

@pageEnd
