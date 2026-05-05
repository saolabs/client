@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@vars($demoList = [])
@useState($status, false)
@const([$user, $setUser] = useState(['name'=> 'Jone', 'email'=> 'jon@test.com']))
@const([$posts, $setPosts] = useState([
    ['title'=> '...', 'content'=> '...'],
    ['title'=> '...', 'content'=> '...'],
    ['title'=> '...', 'content'=> '...'],
    ['title'=> '...', 'content'=> '...'],
]))
@let($i = 0)
@wrapper
<div @class([$__VIEW_ID__ . '-div-1', 'demo', 'active'=> $status]) @attr(['dataCount'=> count($demoList), 'dataUserName'=> $user->name])>
    <h1 @class([$__VIEW_ID__ . '-div-1-h1-1'])>Hello, @startMarker('output', 'div-1-h1-1-output-1'){{ $user->name }}@endMarker('output', 'div-1-h1-1-output-1')!</h1>
    <p @class([$__VIEW_ID__ . '-div-1-p-2'])>Your email is <span @class([$__VIEW_ID__ . '-div-1-p-2-span-1'])>@startMarker('output', 'div-1-p-2-span-1-output-1'){{ $user->email }}@endMarker('output', 'div-1-p-2-span-1-output-1')</span>.</p>

    <button @class([$__VIEW_ID__ . '-div-1-button-3'])>Toggle Status: @startMarker('output', 'div-1-button-3-output-1'){{ $status ? 'On' : 'Off' }}@endMarker('output', 'div-1-button-3-output-1')</button>

    <h2 @class([$__VIEW_ID__ . '-div-1-h2-4'])>Posts:</h2>
    <ul @class([$__VIEW_ID__ . '-div-1-ul-5'])>
        @startMarker('reactive', 'div-1-ul-5-rc-if-1', ['stateKey' => ['posts'], 'type' => 'if'])
        @if(count($posts) === 0)
            <li @class([$__VIEW_ID__ . '-div-1-ul-5-rc-if-1-case_1-li-1'])>No posts available.</li>
        @else
            @startMarker('reactive', 'div-1-ul-5-rc-if-1-case_2-foreach-1', ['stateKey' => ['posts'], 'type' => 'foreach'])
            @foreach($posts as $post)
                <li @class([$__VIEW_ID__ . "-div-1-ul-5-rc-if-1-case_2-foreach-1-{$loop->index}-li-1"])>
                    <h3 @class([$__VIEW_ID__ . "-div-1-ul-5-rc-if-1-case_2-foreach-1-{$loop->index}-li-1-h3-1"])>{{ $post->title }}</h3>
                    <p @class([$__VIEW_ID__ . "-div-1-ul-5-rc-if-1-case_2-foreach-1-{$loop->index}-li-1-p-2"])>{{ $post->content }}</p>
                </li>
            @endforeach
            @endMarker('reactive', 'div-1-ul-5-rc-if-1-case_2-foreach-1')
        @endif
        @endMarker('reactive', 'div-1-ul-5-rc-if-1')
    </ul>
    <div @class([$__VIEW_ID__ . '-div-1-div-6', 'while-loop-demo'])>
        @startMarker('while', 'div-1-div-6-while-1', ['start' => $i, 'end' => 5])
        @while($i < 5)
            <p @class([$__VIEW_ID__ . "-div-1-div-6-while-1-{$i}-p-1"])>Counter: {{ $i }}</p>
            @exec($i++)
        @endwhile
        @endMarker('while', 'div-1-div-6-while-1')
    </div>

</div>
@endWrapper
