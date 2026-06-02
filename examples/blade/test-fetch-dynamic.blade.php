@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@vars($items = [])
@wrapper
@fetch("https://api.example.com/items")
<div @class([$__VIEW_ID__ . '-d69e6b1d'])>
    <h2 @class([$__VIEW_ID__ . '-9d70118d'])>Items</h2>
    @foreach($items as $item)
        <p @class([$__VIEW_ID__ . "-c88c9722-{$loop->index}"])>{{ $item->name }}</p>
    @endforeach
</div>
@endWrapper
