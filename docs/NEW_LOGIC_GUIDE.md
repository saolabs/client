Dưới đây là mô tả đầu vào và đầu ra của hệ thông One Compiler
input:
```blade
@vars($demoList = [])

@useState($status, false)
@const([$user, $setUser] = useState(['name' => 'Jone', 'email' => 'jon@test.com']))
@const([$posts, $setPosts] = useState([
    ['title' => '...', 'content' => '...'],
    ['title' => '...', 'content' => '...'],
    ['title' => '...', 'content' => '...'],
    ['title' => '...', 'content' => '...'],
]))

@let($i = 0)

<div class="demo" @class(['active' => $status]) @attr(['data-count' => count($demoList), 'data-user-name' => $user['name']])>
    <h1>Hello, {{ $user['name'] }}!</h1>
    <p>Your email is <span>{{ $user['email'] }}</span>.</p>

    <button @click($setStatus(!$status))>Toggle Status: {{ $status ? 'On' : 'Off' }}</button>

    <h2>Posts:</h2>
    <ul>
        @if(count($posts) === 0)
            <li>No posts available.</li>
        @else
            @foreach($posts as $post)
                <li>
                    <h3>{{ $post['title'] }}</h3>
                    <p>{{ $post['content'] }}</p>
                </li>
            @endforeach
        @endif
    </ul>
    <div class="while-loop-demo">
        @while($i < 5)
            <p>Counter: {{ $i }}</p>
            @exec($i++)
        @endwhile
    </div>

</div>


```

output (js/ts):

```javascript

// bent trong class View template dc extends từ class View
    //render: function () {
                let parentElement = null;
                let parentReactive = null;
                const ctx = this;
                return fragment({ ctx, parentElement }, (parentElement) => [
                    html("div", { ctx, parentElement, classes: { "demo": { type: 'static', value: true }, "active": { type: 'binding', value: "active", factory: () => status, stateKeys: ["status"] } }, attrs: { "data-count": { type: 'binding', value: App.Helper.count(demoList), factory: () => App.Helper.count(demoList), stateKeys: ["demoList"] }, "data-user-name": { type: 'binding', value: user["name"], factory: () => user["name"], stateKeys: ["user"] } } }, (parentElement) => [
                        html("h1", { ctx, parentElement }, (parentElement) => [
                            "Hello, ",
                            output({ ctx, parentElement, stateKeys: ["user"], isEscapeHTML: true }, () => user["name"]),
                            "!"
                        ]),
                        html("p", { ctx, parentElement }, (parentElement) => [
                            "Your email is ",
                            html("span", { ctx, parentElement }, (parentElement) => [
                                output({ ctx, parentElement, stateKeys: ["user"], isEscapeHTML: true }, () => user["email"])
                            ]),
                            "."
                        ]),
                        html("button", { ctx, parentElement, events: {click: [(event) => setStatus(!status)]}}, (parentElement) => [
                            "Toggle Status: ",
                            output({ ctx, parentElement, stateKeys: ["status"] }, () => status ? 'On' : 'Off')
                        ]),
                        html("h2", { ctx, parentElement }, (parentElement) => ["Posts:"]),
                        html("ul", { ctx, parentElement }, (parentElement) => [
                            reactive("if", {id: `rc-${__VIEW_ID__}-if-1`, ctx, parentElement, parentReactive, stateKeys: ["posts"] }, (parentReactive, parentElement) => {
                                if(App.Helper.count(posts) === 0) {
                                    return [
                                        html("li", { ctx, parentElement }, (parentElement) => ["No posts available."])
                                    ];
                                } 

                                else {
                                    return [
                                        reactive("foreach", {id: `rc-${__VIEW_ID__}-if-1-foreach-1`, ctx, parentElement, parentReactive, stateKeys: ["posts"] }, (parentReactive, parentElement) => {
                                            return __foreach({ctx, parentElement}, posts, (post, __loopKey, __loopIndex, __loop) => [
                                                html("li", { ctx, parentElement }, (parentElement) => [
                                                    html("h3", { ctx, parentElement }, (parentElement) => [post["title"]]),
                                                    html("p", { ctx, parentElement }, (parentElement) => [post["content"]])
                                                ])
                                            ])
                                        })
                                    ]
                                }

                                return [];
                                
                            })
                        ]),
                        html("div", { ctx, parentElement, classes: { "while-loop-demo": { type: 'static', value: true } } }, (parentElement) => [
                            __while({ctx, parentElement, start: i, max: 5}, (parentElement, __loop) => {
                                __loop.setCount(max);
                                let __whileOutput_1 = [];
                                while(i < 5) {
                                    __loop.setCurrentTimes(i);
                                    __whileOutput_1.push(
                                        html("p", { ctx, parentElement }, (parentElement) => [
                                            "Counter: ",
                                            output({ ctx, parentElement, stateKeys: ["i"] }, () => i)
                                        ])
                                    );
                                    __exec(() => i++);
                                }
                                return __whileOutput_1;
                            })
                        ])


                    ])
                ]);
            //}
    
    // code khac

```