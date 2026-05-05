@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@useState($users, [])
@const([$userList, $setUserList] = useState([]))
@let([$loading, $setLoading] = useState(false))
@wrapper
<div @class([$__VIEW_ID__ . '-div-1', 'test'])>
    <h2 @class([$__VIEW_ID__ . '-div-1-h2-1'])>Test @startMarker('output', 'div-1-h2-1-output-1'){{ $users }}@endMarker('output', 'div-1-h2-1-output-1')</h2>
</div>
@endWrapper
