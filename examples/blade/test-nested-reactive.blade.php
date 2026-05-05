@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@const([$items, $setItems] = useState([
    ['id'=> 1, 'name'=> 'Apple', 'category'=> 'fruit', 'price'=> 2, 'tags'=> ['red', 'sweet']],
    ['id'=> 2, 'name'=> 'Carrot', 'category'=> 'vegetable', 'price'=> 1, 'tags'=> ['orange']],
    ['id'=> 3, 'name'=> 'Banana', 'category'=> 'fruit', 'price'=> 3, 'tags'=> ['yellow', 'sweet', 'tropical']],
    ['id'=> 4, 'name'=> 'Broccoli', 'category'=> 'vegetable', 'price'=> 4, 'tags'=> ['green', 'healthy']]
]))
@const([$status, $setStatus] = useState('active'))
@const([$count, $setCount] = useState(0))
@const([$showDetails, $setShowDetails] = useState(true))
@wrapper
<div @class([$__VIEW_ID__ . '-div-1', 'nested-reactive-demo'])>
    {{-- Level 1: @if with output --}}
    <h2 @class([$__VIEW_ID__ . '-div-1-h2-1'])>Total items: @startMarker('output', 'div-1-h2-1-output-1'){{ count($items) }}@endMarker('output', 'div-1-h2-1-output-1')</h2>
    <p @class([$__VIEW_ID__ . '-div-1-p-2'])>Status: @startMarker('output', 'div-1-p-2-output-1'){{ $status }}@endMarker('output', 'div-1-p-2-output-1')</p>

    {{-- Level 1: @if block → Level 2: @foreach → Level 3: @if + output --}}
    @startMarker('reactive', 'div-1-rc-if-1', ['stateKey' => ['showDetails'], 'type' => 'if'])
    @if($showDetails)
        <div @class([$__VIEW_ID__ . '-div-1-rc-if-1-case_1-div-1', 'details-panel'])>
            <h3 @class([$__VIEW_ID__ . '-div-1-rc-if-1-case_1-div-1-h3-1'])>Item Details (count: @startMarker('output', 'div-1-rc-if-1-case_1-div-1-h3-1-output-1'){{ $count }}@endMarker('output', 'div-1-rc-if-1-case_1-div-1-h3-1-output-1'))</h3>
            @startMarker('reactive', 'div-1-rc-if-1-case_1-div-1-foreach-1', ['stateKey' => ['items'], 'type' => 'foreach'])
            @foreach($items as $item)
                <div @class([$__VIEW_ID__ . "-div-1-rc-if-1-case_1-div-1-foreach-1-{$loop->index}-div-1", 'item-card']) @attr(['data-id' => $item->id])>
                    <strong @class([$__VIEW_ID__ . "-div-1-rc-if-1-case_1-div-1-foreach-1-{$loop->index}-div-1-strong-1"])>{{ $item->name }}</strong> - ${{ $item->price }}

                    {{-- Level 3: nested @if inside @foreach inside @if --}}
                    @startMarker('reactive', 'div-1-rc-if-1-case_1-div-1-foreach-1-div-1-rc-if-1', ['stateKey' => [], 'type' => 'if'])
                    @if($item->price > 2)
                        <span @class([$__VIEW_ID__ . "-div-1-rc-if-1-case_1-div-1-foreach-1-{$loop->index}-div-1-rc-if-1-case_1-span-1", 'badge', 'expensive'])>Expensive</span>
                    @else
                        <span @class([$__VIEW_ID__ . "-div-1-rc-if-1-case_1-div-1-foreach-1-{$loop->index}-div-1-rc-if-1-case_2-span-1", 'badge', 'cheap'])>Affordable</span>
                    @endif
                    @endMarker('reactive', 'div-1-rc-if-1-case_1-div-1-foreach-1-div-1-rc-if-1')

                    {{-- Level 3: nested @foreach inside @foreach (tags) --}}
                    <div @class([$__VIEW_ID__ . "-div-1-rc-if-1-case_1-div-1-foreach-1-{$loop->index}-div-1-div-2", 'tags'])>
                        @foreach($item->tags as $tag)
                            <span @class([$__VIEW_ID__ . "-div-1-rc-if-1-case_1-div-1-foreach-1-{$loop->index}-div-1-div-2-foreach-1-{$loop->index}-span-1", 'tag'])>{{ $tag }}</span>
                        @endforeach
                    </div>
                </div>
            @endforeach
            @endMarker('reactive', 'div-1-rc-if-1-case_1-div-1-foreach-1')
        </div>
    @else
        <p @class([$__VIEW_ID__ . '-div-1-rc-if-1-case_2-p-1'])>Details hidden. Click to show.</p>
    @endif
    @endMarker('reactive', 'div-1-rc-if-1')

    {{-- Level 1: @switch block --}}
    @startMarker('reactive', 'div-1-rc-switch-2', ['stateKey' => ['status'], 'type' => 'switch'])
    @switch($status)
        @case('active')
            <div @class([$__VIEW_ID__ . '-div-1-rc-switch-2-case_1-div-1', 'status-active'])>
                <p @class([$__VIEW_ID__ . '-div-1-rc-switch-2-case_1-div-1-p-1'])>System is active</p>
                {{-- Level 2: @for inside @switch --}}
                @startMarker('reactive', 'div-1-rc-switch-2-case_1-div-1-for-1', ['stateKey' => ['count'], 'type' => 'for'])
                @for($i = 0; $i < $count; $i++)
                    <div @class([$__VIEW_ID__ . "-div-1-rc-switch-2-case_1-div-1-for-1-{$i}-div-1", 'counter-item'])>
                        Item #{{ $i + 1 }}
                        @startMarker('reactive', 'div-1-rc-switch-2-case_1-div-1-for-1-div-1-rc-if-1', ['stateKey' => [], 'type' => 'if'])
                        @if($i % 2 === 0)
                            <span @class([$__VIEW_ID__ . "-div-1-rc-switch-2-case_1-div-1-for-1-{$i}-div-1-rc-if-1-case_1-span-1"])>(even)</span>
                        @else
                            <span @class([$__VIEW_ID__ . "-div-1-rc-switch-2-case_1-div-1-for-1-{$i}-div-1-rc-if-1-case_2-span-1"])>(odd)</span>
                        @endif
                        @endMarker('reactive', 'div-1-rc-switch-2-case_1-div-1-for-1-div-1-rc-if-1')
                    </div>
                @endfor
                @endMarker('reactive', 'div-1-rc-switch-2-case_1-div-1-for-1')
            </div>
            @break
        @case('inactive')
            <div @class([$__VIEW_ID__ . '-div-1-rc-switch-2-case_2-div-1', 'status-inactive'])>
                <p @class([$__VIEW_ID__ . '-div-1-rc-switch-2-case_2-div-1-p-1'])>System is inactive</p>
            </div>
            @break
        @default
            <div @class([$__VIEW_ID__ . '-div-1-rc-switch-2-case_3-div-1', 'status-unknown'])>
                <p @class([$__VIEW_ID__ . '-div-1-rc-switch-2-case_3-div-1-p-1'])>Unknown status: @startMarker('output', 'div-1-rc-switch-2-case_3-div-1-p-1-output-1'){{ $status }}@endMarker('output', 'div-1-rc-switch-2-case_3-div-1-p-1-output-1')</p>
            </div>
    @endswitch
    @endMarker('reactive', 'div-1-rc-switch-2')

    {{-- Level 1: @foreach with complex nesting --}}
    <div @class([$__VIEW_ID__ . '-div-1-div-3', 'category-groups'])>
        @startMarker('reactive', 'div-1-div-3-foreach-1', ['stateKey' => ['items'], 'type' => 'foreach'])
        @foreach($items as $key => $item)
            <div @class([$__VIEW_ID__ . "-div-1-div-3-foreach-1-{$loop->index}-div-1", 'group'])>
                <h4 @class([$__VIEW_ID__ . "-div-1-div-3-foreach-1-{$loop->index}-div-1-h4-1"])>[{{ $key }}] {{ $item->name }} ({{ $item->category }})</h4>

                {{-- Level 2: @switch inside @foreach --}}
                @startMarker('reactive', 'div-1-div-3-foreach-1-div-1-rc-switch-1', ['stateKey' => [], 'type' => 'switch'])
                @switch($item->category)
                    @case('fruit')
                        <span @class([$__VIEW_ID__ . "-div-1-div-3-foreach-1-{$loop->index}-div-1-rc-switch-1-case_1-span-1", 'icon'])>🍎</span>
                        @break
                    @case('vegetable')
                        <span @class([$__VIEW_ID__ . "-div-1-div-3-foreach-1-{$loop->index}-div-1-rc-switch-1-case_2-span-1", 'icon'])>🥦</span>
                        @break
                @endswitch
                @endMarker('reactive', 'div-1-div-3-foreach-1-div-1-rc-switch-1')

                {{-- Level 2: @if with nested @foreach --}}
                @startMarker('reactive', 'div-1-div-3-foreach-1-div-1-rc-if-2', ['stateKey' => [], 'type' => 'if'])
                @if(count($item->tags) > 1)
                    <ul @class([$__VIEW_ID__ . "-div-1-div-3-foreach-1-{$loop->index}-div-1-rc-if-2-case_1-ul-1"])>
                        @foreach($item->tags as $idx => $tag)
                            <li @class([$__VIEW_ID__ . "-div-1-div-3-foreach-1-{$loop->index}-div-1-rc-if-2-case_1-ul-1-foreach-1-{$loop->index}-li-1"])>
                                Tag {{ $idx }}: {{ $tag }}
                                @startMarker('reactive', 'div-1-div-3-foreach-1-div-1-rc-if-2-case_1-ul-1-foreach-1-li-1-rc-if-1', ['stateKey' => [], 'type' => 'if'])
                                @if($tag === 'sweet')
                                    <em @class([$__VIEW_ID__ . "-div-1-div-3-foreach-1-{$loop->index}-div-1-rc-if-2-case_1-ul-1-foreach-1-{$loop->index}-li-1-rc-if-1-case_1-em-1"])> ← popular!</em>
                                @endif
                                @endMarker('reactive', 'div-1-div-3-foreach-1-div-1-rc-if-2-case_1-ul-1-foreach-1-li-1-rc-if-1')
                            </li>
                        @endforeach
                    </ul>
                @else
                    <p @class([$__VIEW_ID__ . "-div-1-div-3-foreach-1-{$loop->index}-div-1-rc-if-2-case_2-p-1"])>Only one tag: {{ $item->tags[0] }}</p>
                @endif
                @endMarker('reactive', 'div-1-div-3-foreach-1-div-1-rc-if-2')
            </div>
        @endforeach
        @endMarker('reactive', 'div-1-div-3-foreach-1')
    </div>

    {{-- Include with state vars --}}
    @startMarker('component', 'div-1-component-1')
    @include('components.item-card', ['items'=> $items, 'count'=> $count])
    @endMarker('component', 'div-1-component-1')
</div>
@endWrapper
