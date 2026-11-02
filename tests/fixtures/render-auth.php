<?php

// Execute actual compiler output with Laravel Blade and Core marker directives.
require dirname(__DIR__, 3).'/core/vendor/autoload.php';

$blade = new Illuminate\View\Compilers\BladeCompiler(new Illuminate\Filesystem\Filesystem(), sys_get_temp_dir());
$container = new Illuminate\Container\Container();
Illuminate\Container\Container::setInstance($container);
$container->instance('blade.compiler', $blade);
Illuminate\Support\Facades\Facade::setFacadeApplication($container);
foreach (['Attr', 'Binding', 'MarkerRegistry', 'Wrapper', 'LetConst'] as $name) {
    $class = 'Saola\\Core\\View\\Compilers\\'.$name.'DirectiveService';
    (new $class())->registerDirectives();
}
$auth = new class implements Illuminate\Contracts\Auth\Factory {
    public function guard($name = null) {
        return new Illuminate\Auth\RequestGuard(
            fn () => $name === 'admin' ? null : new Illuminate\Auth\GenericUser(['id' => 1, 'name' => 'Lan', 'username' => 'lan', 'email' => 'private-auth@example.test', 'password' => 'private-password']),
            Illuminate\Http\Request::create('/'),
        );
    }
    public function shouldUse($name) {}
    public function getDefaultDriver() { return 'web'; }
    public function __call($name, $arguments) { return $this->guard()->$name(...$arguments); }
};
$container->instance(Illuminate\Contracts\Auth\Factory::class, $auth);
$container->instance('auth', $auth);
$container->instance('config', new Illuminate\Config\Repository(['sao' => ['client_auth' => ['user_fields' => ['name', 'username']]]]));
$request = Illuminate\Http\Request::create('/');
$request->setUserResolver(fn ($guard = null) => $auth->guard($guard)->user());
$container->instance('request', $request);
$__VIEW_PATH__ = $argv[2] ?? 'fixtures.auth-reactivity';
$__VIEW_ID__ = 'ssr-auth';
$storage = new Saola\Core\View\Services\ViewStorageManager();
$__helper = new Saola\Core\View\Services\ViewHelperService($storage);
eval('?>'.$blade->compileString(file_get_contents($argv[1])));
if ($__VIEW_PATH__ === 'fixtures.use-auth') {
    $state = $storage->exportApplicationData()[$__VIEW_PATH__]['instances'][$__VIEW_ID__]['states']['__auth__'] ?? null;
    if ($state !== ['name' => 'Lan', 'username' => 'lan', 'id' => 1]) throw new RuntimeException('Unsafe or missing SSR auth state.');
}
