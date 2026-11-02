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
            fn () => $name === 'admin' ? null : new Illuminate\Auth\GenericUser(['id' => 1, 'name' => 'Lan', 'username' => 'lan']),
            Illuminate\Http\Request::create('/'),
        );
    }
    public function shouldUse($name) {}
    public function __call($name, $arguments) { return $this->guard()->$name(...$arguments); }
};
$container->instance(Illuminate\Contracts\Auth\Factory::class, $auth);
$__VIEW_PATH__ = 'fixtures.auth-reactivity';
$__VIEW_ID__ = 'ssr-auth';
$__helper = new Saola\Core\View\Services\ViewHelperService(new Saola\Core\View\Services\ViewStorageManager());
eval('?>'.$blade->compileString(file_get_contents($argv[1])));
