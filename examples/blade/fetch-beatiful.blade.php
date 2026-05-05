@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@const([$users, $setUsers] = useState([]), 
    [$isLoading, $setIsLoading] = useState(true),
    [$error, $setError] = useState(null))
@extends($__layout__ . 'base')
    @section('meta:title', 'Demo Fetch Users')
    @block('content')
        <div @class([$__VIEW_ID__ . '-block-content-div-1', 'container', 'py-5'])>
            <h1 @class([$__VIEW_ID__ . '-block-content-div-1-h1-1', 'mb-4'])>Fetch Users Demo</h1>

            @startMarker('reactive', 'block-content-div-1-rc-if-1', ['stateKey' => ['isLoading'], 'type' => 'if'])
            @if($isLoading)
                <div @class([$__VIEW_ID__ . '-block-content-div-1-rc-if-1-case_1-div-1', 'alert', 'alert-info'])>Đang tải users...</div>
            @elseif($error)
                <div @class([$__VIEW_ID__ . '-block-content-div-1-rc-if-1-case_2-div-1', 'alert', 'alert-danger'])>Error: @startMarker('output', 'block-content-div-1-rc-if-1-case_2-div-1-output-1'){{ $error }}@endMarker('output', 'block-content-div-1-rc-if-1-case_2-div-1-output-1')</div>
            @elseif(!$users || count($users) === 0)
                <div @class([$__VIEW_ID__ . '-block-content-div-1-rc-if-1-case_3-div-1', 'alert', 'alert-danger'])>Error không có users</div>
            @else
                @startMarker('reactive', 'block-content-div-1-rc-if-1-case_4-foreach-1', ['stateKey' => ['users'], 'type' => 'foreach'])
                @foreach($users as $user)
                    <div @class([$__VIEW_ID__ . "-block-content-div-1-rc-if-1-case_4-foreach-1-{$loop->index}-div-1", 'user-card', 'mb-3', 'p-3', 'border', 'rounded'])>
                        <h6 @class([$__VIEW_ID__ . "-block-content-div-1-rc-if-1-case_4-foreach-1-{$loop->index}-div-1-h6-1"])>{{ $user->name }}</h6>
                        <p @class([$__VIEW_ID__ . "-block-content-div-1-rc-if-1-case_4-foreach-1-{$loop->index}-div-1-p-2", 'mb-1'])>{{ $user->email }}</p>
                        <small @class([$__VIEW_ID__ . "-block-content-div-1-rc-if-1-case_4-foreach-1-{$loop->index}-div-1-small-3", 'text-muted'])>{{ $user->company->name }}</small>
                    </div>
                @endforeach
                @endMarker('reactive', 'block-content-div-1-rc-if-1-case_4-foreach-1')
            @endif
            @endMarker('reactive', 'block-content-div-1-rc-if-1')
        </div>
    @endblock
