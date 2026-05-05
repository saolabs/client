@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

<?php if(!isset($a) || (!$a && $a !== false)) $a = 0; if(!isset($cProp) || (!$cProp && $cProp !== false)) $cProp = 0; ?>
<?php if(!isset($b) || (!$b && $b !== false)) $b = 0; if(!isset($d) || (!$d && $d !== false)) $d = 0; ?>
@useState($countState, 0)
@useState($eState, $b)
@const([$count, $setCount] = useState(0))
@let($testVar = 'This is a test variable')
@const([$message, $setMessage] = useState('Hello, Saola!'))
@let($textContent = $message . ' Count is ' . $count)
@wrapper
<div @class([$__VIEW_ID__ . '-div-1', 'counter-component'])>
    <h4 @class([$__VIEW_ID__ . '-div-1-h4-1'])>Count: <span @class([$__VIEW_ID__ . '-div-1-h4-1-span-1']) @attr(['id' => 'counter-value', 'data-count' => $count])>@startMarker('output', 'div-1-h4-1-span-1-output-1'){{ $count }}@endMarker('output', 'div-1-h4-1-span-1-output-1')</span></h4>
    <div @class([$__VIEW_ID__ . '-div-1-div-2', 'btn-group'])>
        <button @class([$__VIEW_ID__ . '-div-1-div-2-button-1', 'btn', 'btn-primary'])>-</button>
        <button @class([$__VIEW_ID__ . '-div-1-div-2-button-2', 'btn', 'btn-primary'])>+</button>
        <button @class([$__VIEW_ID__ . '-div-1-div-2-button-3', 'btn', 'btn-primary'])>Reset</button>
    </div>
</div>
@endWrapper
