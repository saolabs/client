@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

<?php if(!isset($title) || (!$title && $title !== false)) $title = 'test'; if(!isset($description) || (!$description && $description !== false)) $description = 'Mô tả'; if(!isset($user) || (!$user && $user !== false)) $user = request()->user(); ?>
@let($test = 'demo')
@useState($userState, $user)
@useState($counter, 0)
@useState($posts, [
    ['title'=> 'title 1', 'description'=> 'Mô tả 1'],
    ['title'=> 'title 2', 'description'=> 'Mô tả 2'],
    ['title'=> 'title 3', 'description'=> 'Mô tả 3'],
    ])
@const([$userAvatar, $setAvatar] = useState(getUserAvatar($user)))
@extends($__template__ . 'main')
    @section('meta:type', 'article')
    @section('meta:og:image', 'https://vcc.vn/static/images/thumbnai.jpg')
    @block('footer')
        <div @class([$__VIEW_ID__ . '-block-footer-div-1', 'footer-container'])>
            Footer Content
        </div>
    @endblock
    @block('content')
        <main @class([$__VIEW_ID__ . '-block-content-main-1'])>
            <header @class([$__VIEW_ID__ . '-block-content-main-1-header-1'])>
                <nav @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1'])>
                    <a @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-a-1', 'home', 'demo'=> $test]) @attr(['href' => route('web.home'), 'title' => siteinfo('site_name')])>
                        <img @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-a-1-img-1', 'site-logo', 'has-login'=> $userState]) @attr(['src' => asset('static/web/images/loho.png'), 'alt' => siteinfo('site_name')]) />
                    </a>
                    <ul @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-ul-2', 'site-menu'])>
                        @startMarker('reactive', 'block-content-main-1-header-1-nav-1-ul-2-foreach-1', ['stateKey' => ['posts'], 'type' => 'foreach'])
                        @foreach($posts as $post)
                            <li @class([$__VIEW_ID__ . "-block-content-main-1-header-1-nav-1-ul-2-foreach-1-{$loop->index}-li-1", 'menu-item', 'nav-item'])>
                                <a @class([$__VIEW_ID__ . "-block-content-main-1-header-1-nav-1-ul-2-foreach-1-{$loop->index}-li-1-a-1", 'nav-link']) @attr(['href' => webPostUrl($post)])>
                                    {{ $post->title }}
                                </a>
                            </li>
                        @endforeach
                        @endMarker('reactive', 'block-content-main-1-header-1-nav-1-ul-2-foreach-1')
                    </ul>
                    <div @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3', 'account'])>
                        @startMarker('reactive', 'block-content-main-1-header-1-nav-1-div-3-rc-if-1', ['stateKey' => ['userState'], 'type' => 'if'])
                        @if($userState)
                            <a @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-a-1', 'account-btn', 'btn-show-menu']) @attr(['href' => route('web.account'), 'data-menu-target' => 'account-menu'])>
                                <img @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-a-1-img-1', 'account-image', 'user-avatar']) @attr(['src' => getUserAvatar($userState), 'alt' => $userState->name]) />
                            </a>
                            <ul @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2', 'account-menu']) @attr(['id' => 'account-menu'])>
                                {{--  --}}
                                <li @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-1'])><a @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-1-a-1']) @attr(['href' => route('web.account')])>{{ text('web.account.dashboard') }}</a></li>
                                <li @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-2'])><a @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-2-a-1']) @attr(['href' => route('web.account.profile')])>{{ text('web.account.profile') }}</a></li>
                                <li @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-3'])><a @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-3-a-1']) @attr(['href' => route('web.account.change-avatar')])>{{ text('web.account.change-avatar') }}</a></li>
                                <li @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-4'])><a @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-4-a-1']) @attr(['href' => route('web.account.signout')])>{{ text('web.account.signout') }}</a></li>
                            </ul>
                        @else
                            <a @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_2-a-1']) @attr(['href' => route('web.account.signin')])>{{ text('web.account.signin') }}</a>
                            <a @class([$__VIEW_ID__ . '-block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_2-a-2']) @attr(['href' => route('web.account.signup')])>{{ text('web.account.signup') }}</a>
                        @endif
                        @endMarker('reactive', 'block-content-main-1-header-1-nav-1-div-3-rc-if-1')
                    </div>
                </nav>

            </header>
            <h1 @class([$__VIEW_ID__ . '-block-content-main-1-h1-2', 'page-title'])>{{ $title }}</h1>
            <p @class([$__VIEW_ID__ . '-block-content-main-1-p-3'])>{{ $description }}</p>
            <div @class([$__VIEW_ID__ . '-block-content-main-1-div-4', 'card'])>
                <button @class([$__VIEW_ID__ . '-block-content-main-1-div-4-button-1'])>@startMarker('output', 'block-content-main-1-div-4-button-1-output-1'){{ text('web.contents.clickme', ['counter'=> $counter]) }}@endMarker('output', 'block-content-main-1-div-4-button-1-output-1')</button>
            </div>

        </main>
    @endblock
