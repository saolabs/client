@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@useState($count, 0)
@useState($name, 'World')
@extends($__layout__ . 'test-yield-layout')
@block('title')
    Page Title - @startMarker('output', 'block-title-output-1'){{ $name }}@endMarker('output', 'block-title-output-1')
@endblock
@block('nav')
    <a @class([$__VIEW_ID__ . '-block-nav-a-1']) @attr(['href' => '/'])>Home</a>
    <a @class([$__VIEW_ID__ . '-block-nav-a-2']) @attr(['href' => '/about'])>About</a>
@endblock
@block('content')
    <div @class([$__VIEW_ID__ . '-block-content-div-1', 'content-area'])>
        <h2 @class([$__VIEW_ID__ . '-block-content-div-1-h2-1'])>Hello, @startMarker('output', 'block-content-div-1-h2-1-output-1'){{ $name }}@endMarker('output', 'block-content-div-1-h2-1-output-1')!</h2>
        <p @class([$__VIEW_ID__ . '-block-content-div-1-p-2'])>Count: @startMarker('output', 'block-content-div-1-p-2-output-1'){{ $count }}@endMarker('output', 'block-content-div-1-p-2-output-1')</p>
        <button @class([$__VIEW_ID__ . '-block-content-div-1-button-3'])>Increment</button>
    </div>
@endblock
@block('footer')
    <p @class([$__VIEW_ID__ . '-block-footer-p-1'])>Custom Footer for @startMarker('output', 'block-footer-p-1-output-1'){{ $name }}@endMarker('output', 'block-footer-p-1-output-1')</p>
@endblock
