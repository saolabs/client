@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@useState($count, 0)
@let($message = 'Hello')
@const($MAX = 100)
@vars($temp)
@wrapper
<div @class([$__VIEW_ID__ . '-div-1', 'test-component'])>
    <h3 @class([$__VIEW_ID__ . '-div-1-h3-1'])>State: @startMarker('output', 'div-1-h3-1-output-1'){{ $count }}@endMarker('output', 'div-1-h3-1-output-1')</h3>
    <p @class([$__VIEW_ID__ . '-div-1-p-2'])>Message: {{ $message }}</p>
    <p @class([$__VIEW_ID__ . '-div-1-p-3'])>Max: {{ $MAX }}</p>
    
    @startMarker('reactive', 'div-1-rc-if-1', ['stateKey' => ['count'], 'type' => 'if'])
    @if($count > 5)
        <div @class([$__VIEW_ID__ . '-div-1-rc-if-1-case_1-div-1'])>Count is greater than 5</div>
    @else
        <div @class([$__VIEW_ID__ . '-div-1-rc-if-1-case_2-div-1'])>Count is 5 or less</div>
    @endif
    @endMarker('reactive', 'div-1-rc-if-1')
    
    @foreach([1, 2, 3] as $item)
        <div @class([$__VIEW_ID__ . "-div-1-foreach-2-{$loop->index}-div-1"])>Item: {{ $item }}</div>
    @endforeach
    
    <button @class([$__VIEW_ID__ . '-div-1-button-4'])>Increment</button>
</div>
@endWrapper
