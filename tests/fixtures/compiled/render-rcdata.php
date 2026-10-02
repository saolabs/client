<?php

// Render compiler output with Laravel's actual Blade compiler and Core directives.
require dirname(__DIR__, 4) . '/saola/vendor/autoload.php';

$blade = new Illuminate\View\Compilers\BladeCompiler(new Illuminate\Filesystem\Filesystem(), sys_get_temp_dir());
$container = new Illuminate\Container\Container();
$container->instance('blade.compiler', $blade);
Illuminate\Support\Facades\Facade::setFacadeApplication($container);
(new Saola\Core\View\Compilers\AttrDirectiveService())->registerDirectives();
(new Saola\Core\View\Compilers\BindingDirectiveService())->registerDirectives();

$source = file_get_contents($argv[1]);
preg_match_all('~<(textarea|title)\b.*?</\1>~s', $source, $elements);
$__VIEW_PATH__ = 'fixtures.rcdata-content';
$__VIEW_ID__ = 'v_ssr';
$__helper = new Saola\Core\View\Services\ViewStorageManager();
$message = 'hello <world> & friends';
$raw = '&amp;<b>literal</b>';
eval('?>' . $blade->compileString(implode("\n", $elements[0])));
