@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@vars($items = [])
@wrapper
@fetch("https://api.example.com/items")
<div @class([$__VIEW_ID__ . '-div-1'])>
    <h2 @class([$__VIEW_ID__ . '-div-1-h2-1'])>Items</h2>
    @foreach($items as $item)
        <p @class([$__VIEW_ID__ . "-div-1-foreach-1-{$loop->index}-p-1"])>{{ $item->name }}</p>
    @endforeach
</div>
@endWrapper
