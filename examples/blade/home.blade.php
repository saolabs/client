@exec($__ONE_COMPONENT_REGISTRY__ = ['tasks' => $__template__ . 'sessions.tasks', 'projects' => $__template__ . 'sessions.projects', 'counter' => 'sessions.tasks.count', 'demo' => $__template__ . 'demo.fetch', 'baseLayout' => $__layout__ . 'base', 'alert' => $__blade_custom_path__]) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@wrapper

@startMarker('component', 'component-1')
@exec($__env->startSection($__ONE_COMPONENT_REGISTRY__['tasks'].'_0'))
@startMarker('component', 'component-1-component-1')
@include($__template__ . 'demo.fetch', ['users' => $users])
@endMarker('component', 'component-1-component-1')
@exec($__env->stopSection())
@exec($__tasks__0_content = $__env->yieldContent($__ONE_COMPONENT_REGISTRY__['tasks'].'_0'))
@include($__template__ . 'sessions.tasks', ['__ONE_CHILDREN_CONTENT__' => $__tasks__0_content])
@endMarker('component', 'component-1')
    @startMarker('component', 'component-2')
    @include($__template__ . 'sessions.tasks', ['title' => 'Custom Task List'])
    @endMarker('component', 'component-2')
    @startMarker('component', 'component-3')
    @exec($__env->startSection($__ONE_COMPONENT_REGISTRY__['projects'].'_2'))
<div @class([$__VIEW_ID__ . '-component-3-div-1', 'header'])>
            <h2 @class([$__VIEW_ID__ . '-component-3-div-1-h2-1'])>My Projects</h2>
        </div>
        <div @class([$__VIEW_ID__ . '-component-3-div-2', 'footer'])>
            <p @class([$__VIEW_ID__ . '-component-3-div-2-p-1'])>Total Projects: {{ count($projects) }}</p>
        </div>
        @startMarker('component', 'component-3-component-1')
        @exec($__env->startSection($__ONE_COMPONENT_REGISTRY__['tasks'].'_1'))
<div @class([$__VIEW_ID__ . '-component-3-component-1-div-1', 'header'])>
                <h3 @class([$__VIEW_ID__ . '-component-3-component-1-div-1-h3-1'])>Task Owners</h3>
            </div>
            @startMarker('component', 'component-3-component-1-component-1')
            @include($__template__ . 'demo.fetch', ['users' => $users])
            @endMarker('component', 'component-3-component-1-component-1')
@exec($__env->stopSection())
@exec($__tasks__1_content = $__env->yieldContent($__ONE_COMPONENT_REGISTRY__['tasks'].'_1'))
@include($__template__ . 'sessions.tasks', ['owners' => ['Alice', 'Bob'], '__ONE_CHILDREN_CONTENT__' => $__tasks__1_content])
@endMarker('component', 'component-3-component-1')
@exec($__env->stopSection())
@exec($__projects__2_content = $__env->yieldContent($__ONE_COMPONENT_REGISTRY__['projects'].'_2'))
@include($__template__ . 'sessions.projects', ['projects' => $projects, '__ONE_CHILDREN_CONTENT__' => $__projects__2_content])
@endMarker('component', 'component-3')
    @startMarker('component', 'component-4')
    @include('sessions.tasks.count')
    @endMarker('component', 'component-4')
    @startMarker('component', 'component-5')
    @include($__template__ . 'demo.fetch')
    @endMarker('component', 'component-5')
    @startMarker('component', 'component-6')
    @include($__blade_custom_path__, ['type' => "success", 'message' => "This is a custom alert component!"])
    @endMarker('component', 'component-6')
@endWrapper
