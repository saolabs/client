/**
 * LoopContext — provides loop metadata for @foreach, @for, @while directives.
 *
 * Available properties inside loops:
 *   $loop.index      — 0-based index
 *   $loop.iteration  — 1-based iteration count
 *   $loop.count      — total items (or -1 for @while)
 *   $loop.remaining  — items left
 *   $loop.first      — is first iteration
 *   $loop.last       — is last iteration
 *   $loop.odd        — is odd iteration (1-based)
 *   $loop.even       — is even iteration (1-based)
 *   $loop.depth      — nesting depth (starts at 1)
 *   $loop.parent     — parent LoopContext (for nested loops)
 */
export class LoopContext {
    constructor(parent = null) {
        this.index = 0;
        this.iteration = 0;
        this.count = 0;
        this.remaining = -1;
        this.first = false;
        this.last = false;
        this.odd = true;
        this.even = false;
        this.depth = 1;
        this.type = 'increment';
        this.parent = parent;
        if (parent) {
            this.depth = parent.depth + 1;
        }
    }
    setType(type) {
        if (type === 'increment' || type === 'decrement') {
            this.type = type;
        }
    }
    setCount(count) {
        this.count = count;
        if (count === -1) {
            // Unknown count (@while) — remaining/last unreliable
            this.remaining = -1;
            this.last = false;
        }
        else {
            this.remaining = count;
        }
    }
    setCurrentTimes(index) {
        this.index = index;
        this.iteration = index + 1;
        this.first = index === 0;
        this.last = this.count > 0 ? index === this.count - 1 : false;
        this.odd = this.iteration % 2 === 1;
        this.even = !this.odd;
        if (this.count > 0) {
            this.remaining = this.count - this.iteration;
        }
    }
    next() {
        if (this.type === 'increment') {
            this.increment();
        }
        else {
            this.decrement();
        }
    }
    reset() {
        this.iteration = 0;
        this.index = 0;
        this.remaining = -1;
        this.count = 0;
        this.first = false;
        this.last = false;
        this.odd = true;
        this.even = false;
    }
    increment() {
        this.iteration++;
        this.index = this.iteration - 1;
        if (this.remaining !== -1) {
            this.remaining--;
        }
        this.first = this.index === 0;
        this.last = this.count > 0 ? this.index === this.count - 1 : false;
        this.odd = this.iteration % 2 === 1;
        this.even = !this.odd;
    }
    decrement() {
        this.iteration--;
        this.index = this.iteration - 1;
        if (this.remaining !== -1) {
            this.remaining++;
        }
        this.last = this.count > 0 ? this.index === this.count - 1 : false;
        this.odd = this.iteration % 2 === 1;
        this.even = !this.odd;
    }
}
//# sourceMappingURL=LoopContext.js.map