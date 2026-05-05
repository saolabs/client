@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@vars($user = null, $counter = 0)
@await
@extends('layout')
@block('content')
    <div @class([$__VIEW_ID__ . '-block-content-div-1'])>
        @startMarker('reactive', 'block-content-div-1-rc-if-1', ['stateKey' => [], 'type' => 'if'])
        @if($user)
            <h1 @class([$__VIEW_ID__ . '-block-content-div-1-rc-if-1-case_1-h1-1'])>Welcome {{ $user->name }}</h1>
        @else
            <p @class([$__VIEW_ID__ . '-block-content-div-1-rc-if-1-case_2-p-1'])>Please login first</p>
        @endif
        @endMarker('reactive', 'block-content-div-1-rc-if-1')
    </div>
    <div @class([$__VIEW_ID__ . '-block-content-div-2'])>
        <button @class([$__VIEW_ID__ . '-block-content-div-2-button-1'])>Login</button>
        <button @class([$__VIEW_ID__ . '-block-content-div-2-button-2'])>Increment Counter</button>
        <p @class([$__VIEW_ID__ . '-block-content-div-2-p-3'])>Counter: {{ $counter }}</p>
    </div>
@endblock
@block('footer')
    <footer @class([$__VIEW_ID__ . '-block-footer-footer-1'])>Copyright 2026</footer>
@endblock
@section('sidebar', 'posts')
