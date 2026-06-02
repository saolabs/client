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
@extends($__layout__ . 'base')
@block('content')
    <div @class([$__VIEW_ID__ . '-e085b222', 'demo', 'active'=> $status]) @attr(['dataCount'=> count($demoList), 'dataUserName'=> $user->name])>
        <h1 @class([$__VIEW_ID__ . '-06fe9377'])>Hello, @startMarker('output', '34dcf3fa'){{ $user->name }}@endMarker('output', '34dcf3fa')!</h1>
        <p @class([$__VIEW_ID__ . '-f0393273'])>Your email is <span @class([$__VIEW_ID__ . '-d17cd335'])>@startMarker('output', '8615be57'){{ $user->email }}@endMarker('output', '8615be57')</span>.</p>

        <button @class([$__VIEW_ID__ . '-21f51b84'])>Toggle Status: @startMarker('output', 'a24990ac'){{ $status ? 'On' : 'Off' }}@endMarker('output', 'a24990ac')</button>

        <h2 @class([$__VIEW_ID__ . '-7a87cfa0'])>Posts:</h2>
        <ul @class([$__VIEW_ID__ . '-7ad81052'])>
            @startMarker('reactive', '40a9567d', ['stateKey' => ['posts'], 'type' => 'if'])
            @if(count($posts) === 0)
                <li @class([$__VIEW_ID__ . '-091f500d'])>No posts available.</li>
            @else
                @startMarker('reactive', 'f47cbfd6', ['stateKey' => ['posts'], 'type' => 'foreach'])
                @foreach($posts as $post)
                    <li @class([$__VIEW_ID__ . "-bce9cd15-{$loop->index}"])>
                        <h3 @class([$__VIEW_ID__ . "-54dc212f-{$loop->index}"])>{{ $post->title }}</h3>
                        <p @class([$__VIEW_ID__ . "-a90ddb5d-{$loop->index}"])>{{ $post->content }}</p>
                    </li>
                @endforeach
                @endMarker('reactive', 'f47cbfd6')
            @endif
            @endMarker('reactive', '40a9567d')
        </ul>
        <div @class([$__VIEW_ID__ . '-0158164e', 'while-loop-demo'])>
            @startMarker('while', 'c8bde4a7', ['start' => $i, 'end' => 5])
            @while($i < 5)
                <p @class([$__VIEW_ID__ . "-03ca1bcb-{$i}"])>Counter: {{ $i }}</p>
                @exec($i++)
            @endwhile
            @endMarker('while', 'c8bde4a7')
        </div>

    </div>
@endblock
