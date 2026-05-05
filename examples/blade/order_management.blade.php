@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

<?php if(!isset($pageTitle) || (!$pageTitle && $pageTitle !== false)) $pageTitle = 'Quản lý đơn hàng'; if(!isset($currentUser) || (!$currentUser && $currentUser !== false)) $currentUser = request()->user(); if(!isset($filters) || (!$filters && $filters !== false)) $filters = [
        'status'=> 'all',
        'search'=> ''
    ]; ?>
@useState($orders, [])
@useState($isLoading, true)
@useState($stats, [ 'total'=> 0, 'revenue'=> 0 ])
@useState($sidebarOpen, true)
@useState($debugMode, true)
@useState($totalPages, 10)
@useState($currentPage, 1)
@let($i = 3)
@let($i = $i - 1)
@let(i = 3)
@let(i = i - 1)
@extends('layouts.admin')

    @block('content')
        <div @class([$__VIEW_ID__ . '-block-content-div-1', 'admin-wrapper', 'sidebar-collapsed'=> !$sidebarOpen])>
            
            {{-- Header & Stats --}}
            <header @class([$__VIEW_ID__ . '-block-content-div-1-header-1', 'flex', 'justify-between', 'items-center', 'mb-8'])>
                <h1 @class([$__VIEW_ID__ . '-block-content-div-1-header-1-h1-1'])>{{ $pageTitle }}</h1>
                <div @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2', 'user-profile', 'flex', 'items-center', 'gap-3'])>
                    @startMarker('reactive', 'block-content-div-1-header-1-div-2-rc-if-1', ['stateKey' => [], 'type' => 'if'])
                    @if($currentUser && $currentUser->is_admin) {
                        <span @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-span-1', 'badge', 'badge-admin'])>Admin Mode</span>
                    } @else {
                        <span @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-span-2', 'badge', 'badge-staff'])>Staff</span>
                    }
                    @startMarker('reactive', 'block-content-div-1-header-1-div-2-rc-if-1-case_1-rc-if-1', ['stateKey' => [], 'type' => 'if'])
                    @if($currentUser) {
                        <img @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-rc-if-1-case_1-img-1', 'w-10', 'h-10', 'rounded-full']) @attr(['src' => $currentUser->avatar, 'alt' => 'avatar']) />
                    }
                </div>
            </header>

            {{-- Thống kê nhanh --}}
            <div @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3', 'grid', 'grid-cols-4', 'gap-4', 'mb-6'])>
                @each (key, value in stats) {
                    <div @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1', 'stat-card', 'p-4', 'bg-white', 'shadow', 'rounded-lg'])>
                        <label @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-label-1', 'text-gray-500', 'uppercase', 'text-xs', 'font-bold'])>{{ $key }}</label>
                        <div @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-2', 'text-2xl', 'font-semibold'])>
                            @startMarker('reactive', 'block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-2-rc-switch-1', ['stateKey' => [], 'type' => 'switch'])
                            @switch($key) {
                                @case('revenue'):
                                    <span @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-2-rc-switch-1-case_1-span-1'])>${{ formatMoney($value) }}</span>
                                @break
                                @default:
                                    <span @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-2-rc-switch-1-case_1-span-2'])>{{ $value }}</span>
                            }
                        </div>
                    </div>
                }
            </div>

            {{-- Bộ lọc --}}
            <section @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-section-3', 'filters-bar', 'mb-6', 'p-4', 'bg-gray-50', 'rounded', 'flex', 'gap-4'])>
                <input @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-section-3-input-1']) @attr(['type' => 'text', 'placeholder' => 'Tìm mã đơn hàng...']) />
                
                <select @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-section-3-select-2'])>
                    @each (status in ['all', 'pending', 'shipping', 'completed', 'cancelled']) {
                        <option @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-section-3-select-2-option-1']) @attr(['value' => $status]) @selected($filters->status == $status)>
                            {{ text('status.' + $status) }}
                        </option>
                    }
                </select>
            </section>

            {{-- Bảng dữ liệu chính --}}
            <div @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4', 'table-responsive', 'bg-white', 'rounded-xl', 'shadow-sm', 'overflow-hidden'])>
                @startMarker('reactive', 'block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1', ['stateKey' => ['isLoading'], 'type' => 'if'])
                @if($isLoading) {
                    <div @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-div-1', 'p-20', 'text-center'])>
                        <div @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-div-1-div-1', 'spinner'])></div>
                        <p @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-div-1-p-2'])>Đang tải dữ liệu đơn hàng...</p>
                    </div>
                } @elseif($orders && count($orders) > 0) {
                    <table @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2', 'w-full', 'text-left'])>
                        <thead @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-thead-1', 'bg-gray-100', 'border-b'])>
                            <tr @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1'])>
                                <th @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1-th-1'])>ID</th>
                                <th @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1-th-2'])>Khách hàng</th>
                                <th @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1-th-3'])>Sản phẩm</th>
                                <th @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1-th-4'])>Trạng thái</th>
                                <th @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1-th-5'])>Tổng tiền</th>
                                <th @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1-th-6'])>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2'])>
                            @each (order in orders) {
                                <tr @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1', 'hover:bg-gray-50', 'transition-colors', 'border-b'])>
                                    <td @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-1', 'font-mono', 'text-blue-600'])>#{{ $order->id }}</td>
                                    <td @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-2'])>
                                        <div @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-2-div-1', 'font-bold'])>{{ $order->customer->name }}</div>
                                        <div @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-2-div-2', 'text-xs', 'text-gray-400'])>{{ $order->customer->email }}</div>
                                    </td>
                                    <td @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-3'])>
                                        <ul @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-3-ul-1', 'item-list'])>
                                            @each (item in order.items) {
                                                <li @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-3-ul-1-li-1', 'text-sm'])>
                                                    {{ $item->qty }}x {{ $item->name }}
                                                </li>
                                            }
                                        </ul>
                                    </td>
                                    <td @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-4'])>
                                        <span @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-4-span-1', 'status-dot', 'status-' + $order->status])></span>
                                        {{ $order->status_label }}
                                    </td>
                                    <td @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-5', 'font-bold'])>${{ $order->total_amount }}</td>
                                    <td @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-6', 'actions'])>
                                        <button @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-6-button-1', 'btn-icon'])>👁️</button>
                                        @startMarker('reactive', 'block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-6-rc-if-1', ['stateKey' => [], 'type' => 'if'])
                                        @if($order->status == 'pending' && $currentUser->can('edit_orders')) {
                                            <button @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-6-rc-if-1-case_1-button-1', 'btn-icon', 'text-green-500'])>✅</button>
                                        }
                                        <button @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-6-rc-if-1-case_1-button-2', 'btn-icon', 'text-red-500'])>🗑️</button>
                                    </td>
                                </tr>
                            }
                        </tbody>
                    </table>
                    
                    {{-- Phân trang --}}
                    <footer @class([$__VIEW_ID__ . '-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-footer-2', 'pagination', 'p-4', 'flex', 'justify-center', 'gap-2'])>
                        @startMarker('reactive', 'block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-footer-2-for-1', ['stateKey' => ['totalPages'], 'type' => 'for'])
                        @for($i = 1; $i <= $totalPages; $i++) {
                            <button @class([$__VIEW_ID__ . "-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-footer-2-for-1-{$i}-button-1", 'page-link', 'active'=> $i == $currentPage])>
                                {{ $i }}
                            </button>
                        }
                    </footer>

                } @else {
                    <div @class([$__VIEW_ID__ . "-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-footer-2-div-1", 'empty-state', 'p-20', 'text-center'])>
                        <img @class([$__VIEW_ID__ . "-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-footer-2-div-1-img-1", 'mx-auto', 'mb-4']) @attr(['src' => '/static/empty-orders.svg']) />
                        <h3 @class([$__VIEW_ID__ . "-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-footer-2-div-1-h3-2"])>Không tìm thấy đơn hàng nào</h3>
                        <p @class([$__VIEW_ID__ . "-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-footer-2-div-1-p-3"])>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm của bạn.</p>
                        <button @class([$__VIEW_ID__ . "-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-footer-2-div-1-button-4", 'btn-primary', 'mt-4'])>Xóa bộ lọc</button>
                    </div>
                }
            </div>

            {{-- Debug Panel (Ví dụ về While) --}}
            @startMarker('reactive', 'block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-rc-if-1', ['stateKey' => ['debugMode'], 'type' => 'if'])
            @if($debugMode) {
                <div @class([$__VIEW_ID__ . "-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-rc-if-1-case_1-div-1", 'debug-panel', 'fixed', 'bottom-0', 'right-0', 'p-4', 'bg-black', 'text-green-400', 'font-mono', 'text-xs', 'opacity-75'])>
                    
                    @startMarker('while', 'block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-rc-if-1-case_1-div-1-while-1', ['start' => $i, 'end' => 0])
                    @while($i > 0) {
                        <div @class([$__VIEW_ID__ . "-block-content-div-1-header-1-div-2-rc-if-1-case_1-div-3-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-rc-if-1-case_1-div-1-while-1-{$i}-div-1"])>[DEBUG] System health check: OK ({{ $i }})</div>
                        
                    }
                </div>
            }

        </div>
    @endblock
