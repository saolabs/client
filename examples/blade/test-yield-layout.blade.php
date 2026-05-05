@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@pageStart
@wrapper
{{-- Layout template sử dụng @yield --}}

<div @class([$__VIEW_ID__ . '-div-1', 'app-layout'])>
    <header @class([$__VIEW_ID__ . '-div-1-header-1'])>
        <h1 @class([$__VIEW_ID__ . '-div-1-header-1-h1-1'])>@yield('title', 'Default Title')</h1>
        <nav @class([$__VIEW_ID__ . '-div-1-header-1-nav-2'])>@yield('nav')</nav>
    </header>

    <main @class([$__VIEW_ID__ . '-div-1-main-2'])>
        @startMarker('yield', 'div-1-main-2-yield-1')
        @yield('content')
        @endMarker('yield', 'div-1-main-2-yield-1')
    </main>

    <footer @class([$__VIEW_ID__ . '-div-1-footer-3'])>
        @startMarker('yield', 'div-1-footer-3-yield-1')
        @yield('footer', '<p>Default Footer</p>')
        @endMarker('yield', 'div-1-footer-3-yield-1')
    </footer>
</div>
@endWrapper

@pageEnd
