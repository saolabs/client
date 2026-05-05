@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@let($name = 'John Doe')
@let($posts = [
    ['title'=> 'Post 1', 'content'=> 'Content of post 1'],
    ['title'=> 'Post 2', 'content'=> 'Content of post 2'],
    ['title'=> 'Post 3', 'content'=> 'Content of post 3'],
])
@wrapper
@exec($a = 10, $b = 20, $c = $a + $b)
    <div @class([$__VIEW_ID__ . '-div-1'])>
        <p @class([$__VIEW_ID__ . '-div-1-p-1'])>Value of a: {{ $a }}</p>
        <p @class([$__VIEW_ID__ . '-div-1-p-2'])>Value of b: {{ $b }}</p>
        <p @class([$__VIEW_ID__ . '-div-1-p-3'])>Value of c (a + b): {{ $c }}</p>
    </div>
    <div @class([$__VIEW_ID__ . '-div-2'])>
        @exec($email = 'Jane Smith', $age = 30)
        <p @class([$__VIEW_ID__ . '-div-2-p-1'])>Name: {{ $name }}</p>
        <p @class([$__VIEW_ID__ . '-div-2-p-2'])>Email: {{ $email }}</p>
        <p @class([$__VIEW_ID__ . '-div-2-p-3'])>Age: {{ $age }}</p>
    </div>
    <tasks @class([$__VIEW_ID__ . '-tasks-3'])>
        <demo @class([$__VIEW_ID__ . '-tasks-3-demo-1']) @attr([':users' => 'users']) />
    </tasks>
    <tasks @class([$__VIEW_ID__ . '-tasks-4']) @attr(['title' => ''Custom Task List'']) />
    <projects @class([$__VIEW_ID__ . '-projects-5']) @attr([':projects' => 'projects'])>
        <div @class([$__VIEW_ID__ . '-projects-5-div-1', 'header'])>
            <h2 @class([$__VIEW_ID__ . '-projects-5-div-1-h2-1'])>My Projects @if(!($t = count($projects))) Rỗng @else ({{ $t }}) @endif</h2>
        </div>
        <div @class([$__VIEW_ID__ . '-projects-5-div-2', 'footer'])>
            <p @class([$__VIEW_ID__ . '-projects-5-div-2-p-1'])>Total Projects: {{ count($projects) }}</p>
        </div>
        <tasks @class([$__VIEW_ID__ . '-projects-5-tasks-3']) @attr([':owners' => '['Alice', 'Bob']'])>
            <div @class([$__VIEW_ID__ . '-projects-5-tasks-3-div-1', 'header'])>
                <h3 @class([$__VIEW_ID__ . '-projects-5-tasks-3-div-1-h3-1'])>Task Owners</h3>
                <p @class([$__VIEW_ID__ . '-projects-5-tasks-3-div-1-p-2'])>{{ $content }}</p>
                @exec($test = 'Hello World')
                @foreach($posts as $post)
                    <p @class([$__VIEW_ID__ . "-projects-5-tasks-3-div-1-foreach-1-{$loop->index}-p-1"])>{{ $content }}</p>
                    @exec($content = 'This is a test')
                    <p @class([$__VIEW_ID__ . "-projects-5-tasks-3-div-1-foreach-1-{$loop->index}-p-2"])>{{ $post->title }}: {{ $post->content }} {{ $content }}</p>
                @endforeach
            </div>
            <p @class([$__VIEW_ID__ . '-projects-5-tasks-3-p-2'])>{{ $content }}</p>
            <demo @class([$__VIEW_ID__ . '-projects-5-tasks-3-demo-3']) @attr([':users' => 'users']) />
            @startMarker('reactive', 'projects-5-tasks-3-rc-if-1', ['stateKey' => [], 'type' => 'if'])
            @if(!($person = getPerson()))
                <p @class([$__VIEW_ID__ . '-projects-5-tasks-3-rc-if-1-case_1-p-1'])>No person found.</p>
            @else
                <p @class([$__VIEW_ID__ . '-projects-5-tasks-3-rc-if-1-case_2-p-1'])>Person found: {{ $person->name }}</p>
            @endif
            @endMarker('reactive', 'projects-5-tasks-3-rc-if-1')
        </tasks>
    </projects>
    <counter @class([$__VIEW_ID__ . '-counter-6'])></counter>
    <demo @class([$__VIEW_ID__ . '-demo-7'])></demo>
    <alert @class([$__VIEW_ID__ . '-alert-8']) @attr(['type' => 'success', 'message' => 'This is a custom alert component!'])></alert>
@endWrapper
