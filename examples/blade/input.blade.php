@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@vars($users, $posts)
@useState($editMode, false)
@useState($todos, [
    ['id'=> 1, 'task'=> 'Buy groceries', 'completed'=> false],
    ['id'=> 2, 'task'=> 'Walk the dog', 'completed'=> true],
    ['id'=> 3, 'task'=> 'Read a book', 'completed'=> false],
    ])
@useState($newTodo, '')
@useState($nextTodoIndex, 4)
@useState($products, [
    ['id'=> 1, 'name'=> 'Apple', 'category'=> 'fruit', 'price'=> 2, 'tags'=> ['red', 'sweet']],
    ['id'=> 2, 'name'=> 'Carrot', 'category'=> 'vegetable', 'price'=> 1, 'tags'=> ['orange']],
    ['id'=> 3, 'name'=> 'Banana', 'category'=> 'fruit', 'price'=> 3, 'tags'=> ['yellow', 'sweet', 'tropical']],
    ['id'=> 4, 'name'=> 'Broccoli', 'category'=> 'vegetable', 'price'=> 4, 'tags'=> ['green', 'healthy']]
])
@useState($inventory, [
    ['id'=> 1, 'name'=> 'Apple', 'category'=> 'fruit', 'price'=> 2, 'tags'=> ['red', 'sweet']],
    ['id'=> 2, 'name'=> 'Carrot', 'category'=> 'vegetable', 'price'=> 1, 'tags'=> ['orange']],
    ['id'=> 3, 'name'=> 'Banana', 'category'=> 'fruit', 'price'=> 3, 'tags'=> ['yellow', 'sweet', 'tropical']],
    ['id'=> 4, 'name'=> 'Broccoli', 'category'=> 'vegetable', 'price'=> 4, 'tags'=> ['green', 'healthy']]
])
@useState($catalog, [
    ['id'=> 1, 'name'=> 'Apple', 'category'=> 'fruit', 'price'=> 2, 'tags'=> ['red', 'sweet']],
    ['id'=> 2, 'name'=> 'Carrot', 'category'=> 'vegetable', 'price'=> 1, 'tags'=> ['orange']],
    ['id'=> 3, 'name'=> 'Banana', 'category'=> 'fruit', 'price'=> 3, 'tags'=> ['yellow', 'sweet', 'tropical']],
    ['id'=> 4, 'name'=> 'Broccoli', 'category'=> 'vegetable', 'price'=> 4, 'tags'=> ['green', 'healthy']]
])
@const($MAX_COUNT = 10)
@let($n = 0)
@wrapper
<div @class([$__VIEW_ID__ . '-div-1', 'input-demo'])>
        <h2 @class([$__VIEW_ID__ . '-div-1-h2-1'])>Input State Demo</h2>
        <div @class([$__VIEW_ID__ . '-div-1-div-2', 'users'])>
            <h3 @class([$__VIEW_ID__ . '-div-1-div-2-h3-1'])>Users</h3>
            <ul @class([$__VIEW_ID__ . '-div-1-div-2-ul-2'])>
                @foreach($users as $user)
                    <li @class([$__VIEW_ID__ . "-div-1-div-2-ul-2-foreach-1-{$loop->index}-li-1"])>{{ $user->name }} ({{ $user->email }})</li>
                @endforeach
            </ul>
        </div>
        <div @class([$__VIEW_ID__ . '-div-1-div-3', 'posts'])>
            <h3 @class([$__VIEW_ID__ . '-div-1-div-3-h3-1'])>Posts</h3>
            <ul @class([$__VIEW_ID__ . '-div-1-div-3-ul-2'])>
                @foreach($posts as $post)
                    <li @class([$__VIEW_ID__ . "-div-1-div-3-ul-2-foreach-1-{$loop->index}-li-1"])><strong @class([$__VIEW_ID__ . "-div-1-div-3-ul-2-foreach-1-{$loop->index}-li-1-strong-1"])>{{ $post->title }}</strong>: {{ $post->content }}</li>
                @endforeach
            </ul>
        </div>
    </div>
    <div @class([$__VIEW_ID__ . '-div-2', 'todos-demo'])>
        <h2 @class([$__VIEW_ID__ . '-div-2-h2-1'])>Todos</h2>
        <ul @class([$__VIEW_ID__ . '-div-2-ul-2'])>
            @startMarker('reactive', 'div-2-ul-2-foreach-1', ['stateKey' => ['todos'], 'type' => 'foreach'])
            @foreach($todos as $todo)
                <li @class([$__VIEW_ID__ . "-div-2-ul-2-foreach-1-{$loop->index}-li-1"])>
                    <label @class([$__VIEW_ID__ . "-div-2-ul-2-foreach-1-{$loop->index}-li-1-label-1"])>
                        <input @class([$__VIEW_ID__ . "-div-2-ul-2-foreach-1-{$loop->index}-li-1-label-1-input-1"]) @attr(['type' => 'checkbox']) @bind($todo->completed) @checked($todo->completed) />
                        {{ $todo->task }}
                    </label>

                </li>
            @endforeach
            @endMarker('reactive', 'div-2-ul-2-foreach-1')
        </ul>
        <div @class([$__VIEW_ID__ . '-div-2-div-3', 'is-edit-mode'])>
            <input @class([$__VIEW_ID__ . '-div-2-div-3-input-1']) @attr(['type' => 'text', 'placeholder' => 'Nhập công việc mới']) @bind($newTodo) />
            <button @class([$__VIEW_ID__ . '-div-2-div-3-button-2'])>+</button>
        </div>
    </div>
    <div @class([$__VIEW_ID__ . '-div-3', 'products-demo'])>
        <h2 @class([$__VIEW_ID__ . '-div-3-h2-1'])>Products @startMarker('output', 'div-3-h2-1-output-1'){{ count($products) }}@endMarker('output', 'div-3-h2-1-output-1')</h2>
        @startMarker('reactive', 'div-3-rc-if-1', ['stateKey' => ['products'], 'type' => 'if'])
        @if(count($products) === 0)
            <p @class([$__VIEW_ID__ . '-div-3-rc-if-1-case_1-p-1'])>No products available.</p>
        @else
            <ul @class([$__VIEW_ID__ . '-div-3-rc-if-1-case_2-ul-1'])>
                @startMarker('reactive', 'div-3-rc-if-1-case_2-ul-1-foreach-1', ['stateKey' => ['products'], 'type' => 'foreach'])
                @foreach($products as $product)
                    <li @class([$__VIEW_ID__ . "-div-3-rc-if-1-case_2-ul-1-foreach-1-{$loop->index}-li-1"])>
                        {{ $product->name }} - ${{ $product->price }}
                        @startMarker('reactive', 'div-3-rc-if-1-case_2-ul-1-foreach-1-li-1-rc-if-1', ['stateKey' => [], 'type' => 'if'])
                        @if($product->tags && count($product->tags) > 0)
                            <div @class([$__VIEW_ID__ . "-div-3-rc-if-1-case_2-ul-1-foreach-1-{$loop->index}-li-1-rc-if-1-case_1-div-1", 'tags'])>
                                @foreach($product->tags as $tag)
                                    <span @class([$__VIEW_ID__ . "-div-3-rc-if-1-case_2-ul-1-foreach-1-{$loop->index}-li-1-rc-if-1-case_1-div-1-foreach-1-{$loop->index}-span-1", 'tag'])>{{ $tag }}</span>
                                @endforeach
                            </div>
                        @endif
                        @endMarker('reactive', 'div-3-rc-if-1-case_2-ul-1-foreach-1-li-1-rc-if-1')
                    </li>
                @endforeach
                @endMarker('reactive', 'div-3-rc-if-1-case_2-ul-1-foreach-1')
            </ul>
        @endif
        @endMarker('reactive', 'div-3-rc-if-1')
    </div>
    {{-- for --}}
    <div @class([$__VIEW_ID__ . '-div-4', 'for-loop'])>
        <h2 @class([$__VIEW_ID__ . '-div-4-h2-1'])>Inventory (For Loop Demo)</h2>
        <ul @class([$__VIEW_ID__ . '-div-4-ul-2'])>
            @startMarker('reactive', 'div-4-ul-2-for-1', ['stateKey' => ['inventory'], 'type' => 'for'])
            @for($i = 0; $i < count($inventory); $i++)
                <li @class([$__VIEW_ID__ . "-div-4-ul-2-for-1-{$i}-li-1"])>
                    @startMarker('output', "div-4-ul-2-for-1-{$i}-li-1-output-1"){{ $inventory[$i]->name }}@endMarker('output', "div-4-ul-2-for-1-{$i}-li-1-output-1") - $@startMarker('output', "div-4-ul-2-for-1-{$i}-li-1-output-2"){{ $inventory[$i]->price }}@endMarker('output', "div-4-ul-2-for-1-{$i}-li-1-output-2")
                    @startMarker('reactive', 'div-4-ul-2-for-1-li-1-rc-if-1', ['stateKey' => ['inventory'], 'type' => 'if'])
                    @if($inventory[$i]->tags && count($inventory[$i]->tags) > 0)
                        <div @class([$__VIEW_ID__ . "-div-4-ul-2-for-1-{$i}-li-1-rc-if-1-case_1-div-1", 'tags'])>
                            @startMarker('reactive', 'div-4-ul-2-for-1-li-1-rc-if-1-case_1-div-1-for-1', ['stateKey' => ['inventory'], 'type' => 'for'])
                            @for($j = 0; $j < count($inventory[$i]->tags); $j++)
                                <span @class([$__VIEW_ID__ . "-div-4-ul-2-for-1-{$i}-li-1-rc-if-1-case_1-div-1-for-1-{$j}-span-1", 'tag'])>@startMarker('output', "div-4-ul-2-for-1-{$i}-li-1-rc-if-1-case_1-div-1-for-1-{$j}-span-1-output-1"){{ $inventory[$i]->tags[$j] }}@endMarker('output', "div-4-ul-2-for-1-{$i}-li-1-rc-if-1-case_1-div-1-for-1-{$j}-span-1-output-1")</span>
                            @endfor
                            @endMarker('reactive', 'div-4-ul-2-for-1-li-1-rc-if-1-case_1-div-1-for-1')
                        </div>
                    @endif
                    @endMarker('reactive', 'div-4-ul-2-for-1-li-1-rc-if-1')
                </li>
            @endfor
            @endMarker('reactive', 'div-4-ul-2-for-1')
        </ul>
    </div>
    {{-- while --}}
    <div @class([$__VIEW_ID__ . '-div-5', 'while-loop'])>
        <h2 @class([$__VIEW_ID__ . '-div-5-h2-1'])>Catalog (While Loop Demo)</h2>
        <ul @class([$__VIEW_ID__ . '-div-5-ul-2'])>
            @for($i = 0; $i < $MAX_COUNT; $i++)
                @startMarker('reactive', 'div-5-ul-2-for-1-rc-if-1', ['stateKey' => ['catalog'], 'type' => 'if'])
                @if($i >= count($catalog))
                    @break
                @endif
                @endMarker('reactive', 'div-5-ul-2-for-1-rc-if-1')
                <li @class([$__VIEW_ID__ . "-div-5-ul-2-for-1-{$i}-li-1"])>
                    @startMarker('output', "div-5-ul-2-for-1-{$i}-li-1-output-1"){{ $catalog[$i]->name }}@endMarker('output', "div-5-ul-2-for-1-{$i}-li-1-output-1") - $@startMarker('output', "div-5-ul-2-for-1-{$i}-li-1-output-2"){{ $catalog[$i]->price }}@endMarker('output', "div-5-ul-2-for-1-{$i}-li-1-output-2")
                    @startMarker('reactive', 'div-5-ul-2-for-1-li-1-rc-if-1', ['stateKey' => ['catalog'], 'type' => 'if'])
                    @if($catalog[$i]->tags && count($catalog[$i]->tags) > 0)
                        <div @class([$__VIEW_ID__ . "-div-5-ul-2-for-1-{$i}-li-1-rc-if-1-case_1-div-1", 'tags'])>
                            @startMarker('reactive', 'div-5-ul-2-for-1-li-1-rc-if-1-case_1-div-1-for-1', ['stateKey' => ['catalog'], 'type' => 'for'])
                            @for($j = 0; $j < count($catalog[$i]->tags); $j++)
                                <span @class([$__VIEW_ID__ . "-div-5-ul-2-for-1-{$i}-li-1-rc-if-1-case_1-div-1-for-1-{$j}-span-1", 'tag'])>@startMarker('output', "div-5-ul-2-for-1-{$i}-li-1-rc-if-1-case_1-div-1-for-1-{$j}-span-1-output-1"){{ $catalog[$i]->tags[$j] }}@endMarker('output', "div-5-ul-2-for-1-{$i}-li-1-rc-if-1-case_1-div-1-for-1-{$j}-span-1-output-1")</span>
                            @endfor
                            @endMarker('reactive', 'div-5-ul-2-for-1-li-1-rc-if-1-case_1-div-1-for-1')
                        </div>
                    @endif
                    @endMarker('reactive', 'div-5-ul-2-for-1-li-1-rc-if-1')
                </li>
            @endfor
        </ul>
        @exec($n = 0)
        <h3 @class([$__VIEW_ID__ . '-div-5-h3-3'])>While Loop Example</h3>
        <ul @class([$__VIEW_ID__ . '-div-5-ul-4'])>
            @startMarker('while', 'div-5-ul-4-while-1', ['start' => $n])
            @while($n < $MAX_COUNT)
                <li @class([$__VIEW_ID__ . "-div-5-ul-4-while-1-{$n}-li-1"])>
                    Item #{{ $n + 1 }}
                </li>
                @exec($n++)
            @endwhile
            @endMarker('while', 'div-5-ul-4-while-1')
        </ul>
    </div>
    @startMarker('component', 'component-1')
    @include('esamples/partial.sao', ['data'=> $products])
    @endMarker('component', 'component-1')
    {{-- Level 1: @if block --}}
@endWrapper
