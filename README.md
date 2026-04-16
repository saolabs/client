# Saola Client

> Modern TypeScript Framework for Laravel - Reactive SPAs with TypeScript-first approach

[![npm version](https://badge.fury.io/js/%40saolabs%2Fclient.svg)](https://www.npmjs.com/package/@saolabs/client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Saola Client is the TypeScript runtime library for building reactive single-page applications that integrate seamlessly with Laravel backends. The package is published on npm as `@saolabs/client`.

## Features

- ⚡ **TypeScript First**: Full TypeScript support with excellent type safety
- 🎨 **Reactive Views**: Built-in reactive view system with automatic state management
- 📦 **Modular Architecture**: Component-based architecture for scalable applications
- 🔄 **Hot Module Replacement**: Development watch mode with automatic compilation
- 🚀 **Laravel Integration**: Seamless integration with Laravel backends
- 📱 **SSR Support**: Server-side rendering capabilities
- 🎯 **Lightweight**: Minimal bundle size with tree-shaking support
- 🔧 **Developer Friendly**: Excellent DX with CLI tools and build utilities

## Installation

```bash
npm install @saolabs/client
# or
yarn add @saolabs/client
# or
pnpm add @saolabs/client
```

## Quick Start

### Basic Setup

```typescript
import { Application, app, appContainer } from '@saolabs/client';
import { ViewController } from '@saolabs/client';

// Initialize your app
const app = new Application({
  el: '#app',
  debug: true
});

await app.init();
```

### Creating a View

```typescript
import { ViewBase, ViewController } from '@saolabs/client';

export class HomeView extends ViewBase {
  constructor() {
    super('home', 'home-template');
  }

  onMount() {
    // Initialize view logic
  }
}

export class HomeController extends ViewController {
  view = HomeView;

  onLoad() {
    // Handle view data loading
  }
}
```

### Routing

```typescript
import { Router } from '@saolabs/client';

const router = new Router();

router.register('home', HomeController);
router.register('about', AboutController);

router.navigate('home');
```

### State Management

```typescript
import { ViewState, StateManager } from '@saolabs/client';

const state = new ViewState({
  count: 0,
  user: null
});

state.count = 5; // Trigger reactive updates
state.subscribe(newState => {
  console.log('State updated:', newState);
});
```

## API Reference

### Core Classes

#### Application

The main application class that manages the lifecycle of your Saola app.

```typescript
import { Application } from '@saolabs/client';

const app = new Application({
  el: '#app',           // Mount element
  debug: true,          // Enable debug mode
  baseUrl: '/app'       // Base URL for routing
});
```

#### View System

```typescript
import { View, ViewController, ViewManager } from '@saolabs/client';

// Create a view
class MyView extends View {
  template = '<div>Hello World</div>';

  onMount() {
    console.log('View mounted');
  }
}

// Create a controller
class MyController extends ViewController {
  view = MyView;

  onLoad() {
    // Load data
  }
}
```

#### Router

```typescript
import { Router } from '@saolabs/client';

const router = new Router();

// Register routes
router.register('home', HomeController);
router.register('user/:id', UserController);

// Navigate
router.navigate('home');
router.navigate('user/123');
```

## Plugins

Extend Saola Client with plugins:

```typescript
import { PluginManager } from '@saolabs/client/plugins';

const pluginManager = new PluginManager();

// Register and install plugins
pluginManager
  .register(myPlugin)
  .install('myPlugin', { option: 'value' });
```

## Development

### Building

```bash
npm run build    # Build for production
npm run dev      # Watch mode for development
npm run clean    # Clean build artifacts
```

### Testing

```bash
npm test
```

## Integration with Saola Compiler

Saola Client works seamlessly with [Saola Compiler](https://github.com/saolabs/saola-compiler) to compile `.one` files into Blade templates and JavaScript.

```bash
# Install both packages
npm install @saolabs/client saola-compiler

# Use in your Laravel project
# The compiler will generate files that use @saolabs/client
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Projects

- [Saola Compiler](https://github.com/saolabs/saola-compiler) - Template compiler for .one files
- [Saola Language Support](https://github.com/saolabs/saola-language-support) - VS Code extension for .one files

---

**Built with ❤️ by Saola Labs**