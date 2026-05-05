@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@useState($isOpen, false)
@wrapper
<div @class([$__VIEW_ID__ . '-div-1', 'demo3-component'])>
    Status: @startMarker('output', 'div-1-output-1'){{ $isOpen ? 'Open' : 'Closed' }}@endMarker('output', 'div-1-output-1')
</div>
@endWrapper
