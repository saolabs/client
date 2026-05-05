@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

<?php if(!isset($posts) || (!$posts && $posts !== false)) $posts = []; if(!isset($categories) || (!$categories && $categories !== false)) $categories = []; if(!isset($postCategories) || (!$postCategories && $postCategories !== false)) $postCategories = []; if(!isset($postTags) || (!$postTags && $postTags !== false)) $postTags = []; if(!isset($postAuthors) || (!$postAuthors && $postAuthors !== false)) $postAuthors = []; ?>
@useState($postList, $posts)
@useState($categoryList, $categories)
@let($i = 0)
@wrapper
<div @class([$__VIEW_ID__ . '-div-1', 'flex', 'flex-col', 'gap-2'])>
        @for($i = 0; $i < 10; $i++)
            <div @class([$__VIEW_ID__ . "-div-1-for-1-{$i}-div-1", 'flex', 'items-center', 'gap-2'])>
                <h2 @class([$__VIEW_ID__ . "-div-1-for-1-{$i}-div-1-h2-1", 'text-sm'])>Title {{ $i }}</h2>
                @startMarker('reactive', 'div-1-for-1-div-1-foreach-1', ['stateKey' => ['categoryList'], 'type' => 'foreach'])
                @foreach($categoryList as $categoryItem)
                    <div @class([$__VIEW_ID__ . "-div-1-for-1-{$i}-div-1-foreach-1-{$categoryItem->id}-div-1", 'category-item'])>
                        <h3 @class([$__VIEW_ID__ . "-div-1-for-1-{$i}-div-1-foreach-1-{$categoryItem->id}-div-1-h3-1", 'category-name'])>{{ $categoryItem->name }}</h3>
                        <div @class([$__VIEW_ID__ . "-div-1-for-1-{$i}-div-1-foreach-1-{$categoryItem->id}-div-1-div-2", 'post-list'])>
                            @foreach($categoryItem->posts as $postItem)
                                <div @class([$__VIEW_ID__ . "-div-1-for-1-{$i}-div-1-foreach-1-{$categoryItem->id}-div-1-div-2-foreach-1-{$postItem->id}-div-1", 'post-item'])>
                                    <h4 @class([$__VIEW_ID__ . "-div-1-for-1-{$i}-div-1-foreach-1-{$categoryItem->id}-div-1-div-2-foreach-1-{$postItem->id}-div-1-h4-1", 'post-title'])>{{ $postItem->title }}</h4>
                                    <p @class([$__VIEW_ID__ . "-div-1-for-1-{$i}-div-1-foreach-1-{$categoryItem->id}-div-1-div-2-foreach-1-{$postItem->id}-div-1-p-2", 'post-content'])>{{ $postItem->content }}</p>
                                </div>
                            @endforeach
                        </div>
                    </div>
                @endforeach
                @endMarker('reactive', 'div-1-for-1-div-1-foreach-1')
            </div>
        @endfor
    </div>
@endWrapper
