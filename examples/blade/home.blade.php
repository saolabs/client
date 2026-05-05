@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@wrapper
<tasks @class([$__VIEW_ID__ . '-tasks-1'])>
        <demo @class([$__VIEW_ID__ . '-tasks-1-demo-1']) @attr([':users' => 'users']) />
    </tasks>
    <tasks @class([$__VIEW_ID__ . '-tasks-2']) @attr(['title' => ''Custom Task List'']) />
    <projects @class([$__VIEW_ID__ . '-projects-3']) @attr([':projects' => 'projects'])>
        <div @class([$__VIEW_ID__ . '-projects-3-div-1', 'header'])>
            <h2 @class([$__VIEW_ID__ . '-projects-3-div-1-h2-1'])>My Projects</h2>
        </div>
        <div @class([$__VIEW_ID__ . '-projects-3-div-2', 'footer'])>
            <p @class([$__VIEW_ID__ . '-projects-3-div-2-p-1'])>Total Projects: {{ count($projects) }}</p>
        </div>
        <tasks @class([$__VIEW_ID__ . '-projects-3-tasks-3']) @attr([':owners' => '['Alice', 'Bob']'])>
            <div @class([$__VIEW_ID__ . '-projects-3-tasks-3-div-1', 'header'])>
                <h3 @class([$__VIEW_ID__ . '-projects-3-tasks-3-div-1-h3-1'])>Task Owners</h3>
            </div>
            <demo @class([$__VIEW_ID__ . '-projects-3-tasks-3-demo-2']) @attr([':users' => 'users']) />
        </tasks>
    </projects>
    <counter @class([$__VIEW_ID__ . '-counter-4'])></counter>
    <demo @class([$__VIEW_ID__ . '-demo-5'])></demo>
    <alert @class([$__VIEW_ID__ . '-alert-6']) @attr(['type' => 'success', 'message' => 'This is a custom alert component!'])></alert>
@endWrapper
