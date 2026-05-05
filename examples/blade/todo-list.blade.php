@exec($__ONE_COMPONENT_REGISTRY__ = []) {{-- Khai báo để sử dụng các component đã đăng ký trong $__ONE_COMPONENT_REGISTRY__ --}}

@vars($users = [])
@const([$todos, $setTodos] = useState([]))
@const([$newTodo, $setNewTodo] = useState(''))
@const([$todoIndex, $setTodoIndex] = useState(0))
@wrapper
@await
<div @class([$__VIEW_ID__ . '-div-1', 'col-lg-6', 'mb-4']) @attr(['data-category' => 'basic forms'])>
        <div @class([$__VIEW_ID__ . '-div-1-div-1', 'example-card'])>
            <div @class([$__VIEW_ID__ . '-div-1-div-1-div-1', 'example-header'])>
                <h3 @class([$__VIEW_ID__ . '-div-1-div-1-div-1-h3-1'])>Todo List</h3>
                <div @class([$__VIEW_ID__ . '-div-1-div-1-div-1-div-2', 'example-tags'])>
                    <span @class([$__VIEW_ID__ . '-div-1-div-1-div-1-div-2-span-1', 'tag', 'tag-basic'])>Basic</span>
                    <span @class([$__VIEW_ID__ . '-div-1-div-1-div-1-div-2-span-2', 'tag', 'tag-forms'])>Forms</span>
                    <span @class([$__VIEW_ID__ . '-div-1-div-1-div-1-div-2-span-3', 'tag', 'tag-list'])>Lists</span>
                </div>
            </div>

            <div @class([$__VIEW_ID__ . '-div-1-div-1-div-2', 'example-description'])>
                <p @class([$__VIEW_ID__ . '-div-1-div-1-div-2-p-1'])>Interactive todo list with add, toggle, and delete functionality.</p>
            </div>

            <div @class([$__VIEW_ID__ . '-div-1-div-1-div-3', 'example-demo'])>
                <div @class([$__VIEW_ID__ . '-div-1-div-1-div-3-div-1', 'demo-container']) @attr(['id' => 'todo-demo'])>
                    <div @class([$__VIEW_ID__ . '-div-1-div-1-div-3-div-1-div-1', 'todo-app'])>
                        <div @class([$__VIEW_ID__ . '-div-1-div-1-div-3-div-1-div-1-div-1', 'input-group', 'mb-3'])>
                            <input @class([$__VIEW_ID__ . '-div-1-div-1-div-3-div-1-div-1-div-1-input-1', 'form-control']) @attr(['type' => 'text', 'id' => 'todo-input', 'placeholder' => 'Add new todo...']) @bind($newTodo)>
                            <button @class([$__VIEW_ID__ . '-div-1-div-1-div-3-div-1-div-1-div-1-button-2', 'btn', 'btn-primary'])>Add</button>
                        </div>
                        <ul @class([$__VIEW_ID__ . '-div-1-div-1-div-3-div-1-div-1-ul-2', 'list-unstyled']) @attr(['id' => 'todo-list'])>
                            @startMarker('reactive', 'div-1-div-1-div-3-div-1-div-1-ul-2-foreach-1', ['stateKey' => ['todos'], 'type' => 'foreach'])
                            @foreach($todos as $todo)
                                <li @class([$__VIEW_ID__ . "-div-1-div-1-div-3-div-1-div-1-ul-2-foreach-1-{$loop->index}-li-1", 'todo-item', '{{', '$todo->completed', '?', ''completed'', ':', '''', '}}'])>
                                    <input @class([$__VIEW_ID__ . "-div-1-div-1-div-3-div-1-div-1-ul-2-foreach-1-{$loop->index}-li-1-input-1"]) @attr(['type' => 'checkbox']) @checked($todo->completed)>
                                    {{ $todo->text }}
                                    <button @class([$__VIEW_ID__ . "-div-1-div-1-div-3-div-1-div-1-ul-2-foreach-1-{$loop->index}-li-1-button-2", 'btn', 'btn-sm', 'btn-outline-danger'])>×</button>
                                </li>
                            @endforeach
                            @endMarker('reactive', 'div-1-div-1-div-3-div-1-div-1-ul-2-foreach-1')

                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
@endWrapper
