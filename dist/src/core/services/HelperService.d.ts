import { CollectionProxyInterface, HelperInterface } from "../contracts/HelperInterface";
import { ApplicationInterface } from "../contracts/ApplicationInterface";
/**
 * HelperService — PHP-compatible helper functions for OneView runtime.
 *
 * The compiler converts PHP function calls → `App.Helper.xxx()`.
 * This class provides JavaScript implementations of those PHP functions
 * so compiled .one templates work correctly at runtime.
 *
 * Categories:
 *   - Execution helpers (execute, exec)
 *   - Type checks (isset, empty, is_null, is_array, is_string, is_numeric, is_object, is_bool, is_int, is_float)
 *   - String functions (strlen, substr, trim, ltrim, rtrim, strtolower, strtoupper, ucfirst, lcfirst,
 *     str_replace, str_repeat, str_pad, str_contains, str_starts_with, str_ends_with,
 *     str_word_count, nl2br, wordwrap, chunk_split, sprintf, number_format, md5, sha1,
 *     base64_encode, base64_decode, urlencode, urldecode, htmlspecialchars, htmlspecialchars_decode,
 *     strip_tags, addslashes, stripslashes, str_split, substr_count, substr_replace,
 *     str_getcsv, quoted_printable_encode, quoted_printable_decode)
 *   - Array functions (count, array_push, array_pop, array_shift, array_unshift, array_merge,
 *     array_keys, array_values, array_reverse, array_unique, array_slice, array_splice,
 *     array_map, array_filter, array_reduce, array_find, array_find_key, array_column,
 *     array_combine, array_chunk, array_pad, array_flip, array_sum, array_product,
 *     array_count_values, array_fill, array_fill_keys, array_intersect, array_diff,
 *     array_search, in_array, array_key_exists, sort, rsort, ksort, krsort,
 *     usort, uasort, uksort, array_multisort, range, compact, extract, list, head, last)
 *   - Math functions (min, max, abs, ceil, floor, round, sqrt, pow, log, log10, exp,
 *     fmod, intdiv, pi, rand, mt_rand, array_rand)
 *   - JSON (json_encode, json_decode)
 *   - Date/Time (now, today, date, time, strtotime, mktime, microtime, date_create, date_format,
 *     date_diff, date_modify)
 *   - Formatting (number_format, formatDate, formatNumber, formatCurrency, truncate, slug)
 *   - Misc (collect, dd, dump, var_dump, print_r, class_exists, function_exists, sleep,
 *     uniqid, crc32, intval, floatval, strval, boolval, settype, gettype)
 *   - Output (escString, escapeHtml)
 */
export declare class HelperService implements HelperInterface {
    App: any;
    private config;
    constructor(App?: any);
    app<T = any>(key?: any, value?: any): T | ApplicationInterface;
    make<T>(name: string, defaultValue?: T): T | undefined;
    setApp(App: any): void;
    setConfig(config: Record<string, any>): void;
    /** Execute a function safely, return result or empty string on error */
    execute<T>(fn: () => T): T;
    /** Alias for execute with arguments */
    exec(fn: Function, ...args: any[]): any;
    /** PHP isset() — true if value is not null/undefined */
    isset(...values: any[]): boolean;
    /** PHP empty() — true if value is falsy, empty string, empty array, empty object */
    empty(value: any): boolean;
    /** PHP is_null() */
    is_null(value: any): boolean;
    /** PHP is_array() — true for arrays and plain objects */
    is_array(value: any): boolean;
    /** PHP is_string() */
    is_string(value: any): boolean;
    /** PHP is_numeric() */
    is_numeric(value: any): boolean;
    /** PHP is_object() */
    is_object(value: any): boolean;
    /** PHP is_bool() */
    is_bool(value: any): boolean;
    /** PHP is_int() / is_integer() / is_long() */
    is_int(value: any): boolean;
    /** PHP is_float() / is_double() */
    is_float(value: any): boolean;
    /** PHP count() — length of string, array, or object keys */
    count(value: any): number;
    /** PHP sizeof() — alias for count */
    sizeof(value: any): number;
    /** PHP strlen() */
    strlen(str: any): number;
    /** PHP substr() */
    substr(str: any, start: number, length?: number): string;
    /** PHP mb_substr() — alias for substr (JS strings are UTF-16) */
    mb_substr(str: any, start: number, length?: number): string;
    /** PHP trim() */
    trim(str: any, chars?: string): string;
    /** PHP ltrim() */
    ltrim(str: any, chars?: string): string;
    /** PHP rtrim() / chop() */
    rtrim(str: any, chars?: string): string;
    /** PHP strtolower() */
    strtolower(str: any): string;
    /** PHP strtoupper() */
    strtoupper(str: any): string;
    /** PHP ucfirst() */
    ucfirst(str: any): string;
    /** PHP lcfirst() */
    lcfirst(str: any): string;
    /** PHP ucwords() */
    ucwords(str: any, delimiters?: string): string;
    /** PHP str_replace() */
    str_replace(search: string | string[], replace: string | string[], subject: string): string;
    /** PHP str_ireplace() — case-insensitive str_replace */
    str_ireplace(search: string | string[], replace: string | string[], subject: string): string;
    /** PHP explode() */
    explode(delimiter: string, str: any, limit?: number): string[];
    /** PHP implode() / join() */
    implode(glue: string, pieces?: any[]): string;
    /** PHP str_repeat() */
    str_repeat(str: any, times: number): string;
    /** PHP str_pad() */
    str_pad(input: any, length: number, padString?: string, padType?: number): string;
    /** PHP str_contains() (PHP 8) */
    str_contains(haystack: any, needle: string): boolean;
    /** PHP str_starts_with() (PHP 8) */
    str_starts_with(haystack: any, needle: string): boolean;
    /** PHP str_ends_with() (PHP 8) */
    str_ends_with(haystack: any, needle: string): boolean;
    /** PHP str_word_count() */
    str_word_count(str: any, format?: number): number | string[];
    /** PHP str_split() */
    str_split(str: any, length?: number): string[];
    /** PHP substr_count() */
    substr_count(haystack: any, needle: string, offset?: number, length?: number): number;
    /** PHP substr_replace() */
    substr_replace(str: any, replacement: string, start: number, length?: number): string;
    /** PHP nl2br() */
    nl2br(str: any, isXhtml?: boolean): string;
    /** PHP wordwrap() */
    wordwrap(str: any, width?: number, breakStr?: string, cutLongWords?: boolean): string;
    /** PHP chunk_split() */
    chunk_split(body: any, chunklen?: number, end?: string): string;
    /** PHP sprintf() — basic implementation */
    sprintf(format: string, ...args: any[]): string;
    /** PHP strtolower + first char upper — alias */
    mb_strtolower(str: any): string;
    mb_strtoupper(str: any): string;
    mb_strlen(str: any): number;
    /** PHP strpos() */
    strpos(haystack: any, needle: string, offset?: number): number | false;
    /** PHP strrpos() */
    strrpos(haystack: any, needle: string, offset?: number): number | false;
    /** PHP stripos() */
    stripos(haystack: any, needle: string, offset?: number): number | false;
    /** PHP str_getcsv() — basic */
    str_getcsv(str: any, separator?: string, enclosure?: string, escape?: string): string[];
    /** PHP htmlspecialchars() */
    htmlspecialchars(str: any, flags?: number, encoding?: string, doubleEncode?: boolean): string;
    /** PHP htmlspecialchars_decode() */
    htmlspecialchars_decode(str: any): string;
    /** Escape HTML — alias for htmlspecialchars */
    escapeHtml(str: any): string;
    /** escString — safe output escaping for template echo */
    escString(value: any): string;
    /** PHP strip_tags() — basic implementation */
    strip_tags(str: any, allowedTags?: string): string;
    /** PHP addslashes() */
    addslashes(str: any): string;
    /** PHP stripslashes() */
    stripslashes(str: any): string;
    /** PHP urlencode() */
    urlencode(str: any): string;
    /** PHP urldecode() */
    urldecode(str: any): string;
    /** PHP rawurlencode() */
    rawurlencode(str: any): string;
    /** PHP rawurldecode() */
    rawurldecode(str: any): string;
    /** PHP base64_encode() */
    base64_encode(str: any): string;
    /** PHP base64_decode() */
    base64_decode(str: any): string;
    /** PHP md5() — simple hash (not cryptographic, for display only) */
    md5(str: any): string;
    /** PHP sha1() — simple hash (not cryptographic, for display only) */
    sha1(str: any): string;
    /** PHP crc32() — basic CRC32 */
    crc32(str: any): number;
    /** Simple string hash for md5/sha1 approximation */
    private _simpleHash;
    /** PHP array_push() */
    array_push(arr: any[], ...items: any[]): number;
    /** PHP array_pop() */
    array_pop(arr: any[]): any;
    /** PHP array_shift() */
    array_shift(arr: any[]): any;
    /** PHP array_unshift() */
    array_unshift(arr: any[], ...items: any[]): number;
    /** PHP array_merge() */
    array_merge(...arrays: any[]): any[] | Record<string, any>;
    /** PHP array_keys() */
    array_keys(arr: any): string[] | number[];
    /** PHP array_values() */
    array_values(arr: any): any[];
    /** PHP array_reverse() */
    array_reverse(arr: any[], preserveKeys?: boolean): any[];
    /** PHP array_unique() */
    array_unique(arr: any[]): any[];
    /** PHP array_slice() */
    array_slice(arr: any[], offset: number, length?: number, preserveKeys?: boolean): any[];
    /** PHP array_splice() */
    array_splice(arr: any[], offset: number, length?: number, ...replacement: any[]): any[];
    /** PHP array_map() */
    array_map(callback: ((item: any, key?: any) => any) | null, arr: any, ...arrays: any[]): any[];
    /** PHP array_filter() */
    array_filter(arr: any, callback?: (value: any, key?: any) => boolean): any[];
    /** PHP array_reduce() */
    array_reduce(arr: any[], callback: (carry: any, item: any) => any, initial?: any): any;
    /** PHP array_find() (PHP 8.4) */
    array_find(arr: any[], callback: (value: any, key?: any) => boolean): any;
    /** PHP array_find_key() (PHP 8.4) */
    array_find_key(arr: any[], callback: (value: any, key?: any) => boolean): number | null;
    /** PHP array_column() */
    array_column(arr: any[], columnKey: string, indexKey?: string): any[] | Record<string, any>;
    /** PHP array_combine() */
    array_combine(keys: any[], values: any[]): Record<string, any>;
    /** PHP array_chunk() */
    array_chunk(arr: any[], size: number, preserveKeys?: boolean): any[][];
    /** PHP array_pad() */
    array_pad(arr: any[], size: number, value: any): any[];
    /** PHP array_flip() */
    array_flip(arr: any): Record<string, any>;
    /** PHP array_sum() */
    array_sum(arr: any[]): number;
    /** PHP array_product() */
    array_product(arr: any[]): number;
    /** PHP array_count_values() */
    array_count_values(arr: any[]): Record<string, number>;
    /** PHP array_fill() */
    array_fill(startIndex: number, num: number, value: any): any[];
    /** PHP array_fill_keys() */
    array_fill_keys(keys: any[], value: any): Record<string, any>;
    /** PHP array_intersect() */
    array_intersect(arr: any[], ...arrays: any[][]): any[];
    /** PHP array_diff() */
    array_diff(arr: any[], ...arrays: any[][]): any[];
    /** PHP array_intersect_key() */
    array_intersect_key(obj: Record<string, any>, ...objects: Record<string, any>[]): Record<string, any>;
    /** PHP array_diff_key() */
    array_diff_key(obj: Record<string, any>, ...objects: Record<string, any>[]): Record<string, any>;
    /** PHP array_search() */
    array_search(needle: any, haystack: any[], strict?: boolean): number | string | false;
    /** PHP in_array() */
    in_array(needle: any, haystack: any[], strict?: boolean): boolean;
    /** PHP array_key_exists() */
    array_key_exists(key: string | number, arr: any): boolean;
    /** PHP sort() — sort array in-place ascending */
    sort(arr: any[]): boolean;
    /** PHP rsort() — sort array in-place descending */
    rsort(arr: any[]): boolean;
    /** PHP ksort() — sort object by keys ascending */
    ksort(obj: Record<string, any>): Record<string, any>;
    /** PHP krsort() — sort object by keys descending */
    krsort(obj: Record<string, any>): Record<string, any>;
    /** PHP usort() — sort using user comparison function */
    usort(arr: any[], compareFunc: (a: any, b: any) => number): boolean;
    /** PHP uasort() — same as usort for JS arrays */
    uasort(arr: any[], compareFunc: (a: any, b: any) => number): boolean;
    /** PHP uksort() — sort object by keys using comparison function */
    uksort(obj: Record<string, any>, compareFunc: (a: string, b: string) => number): Record<string, any>;
    /** PHP range() */
    range(start: number | string, end: number | string, step?: number): (number | string)[];
    /** PHP compact() — create object from variable names */
    compact(...names: string[]): Record<string, any>;
    /** PHP head() — first element */
    head(arr: any[]): any;
    /** PHP last() — last element */
    last(arr: any[]): any;
    /** PHP min() */
    min(...values: any[]): any;
    /** PHP max() */
    max(...values: any[]): any;
    /** PHP abs() */
    abs(n: number): number;
    /** PHP ceil() */
    ceil(n: number): number;
    /** PHP floor() */
    floor(n: number): number;
    /** PHP round() */
    round(n: number, precision?: number): number;
    /** PHP sqrt() */
    sqrt(n: number): number;
    /** PHP pow() */
    pow(base: number, exp: number): number;
    /** PHP log() */
    log(n: number, base?: number): number;
    /** PHP log10() */
    log10(n: number): number;
    /** PHP exp() */
    exp(n: number): number;
    /** PHP fmod() */
    fmod(x: number, y: number): number;
    /** PHP intdiv() */
    intdiv(a: number, b: number): number;
    /** PHP pi() */
    pi(): number;
    /** PHP rand() / mt_rand() */
    rand(min?: number, max?: number): number;
    /** PHP mt_rand() — alias for rand */
    mt_rand(min?: number, max?: number): number;
    /** PHP array_rand() */
    array_rand(arr: any[], num?: number): number | number[];
    /** PHP json_encode() */
    json_encode(value: any, options?: number): string;
    /** PHP json_decode() */
    json_decode(json: any, assoc?: boolean): any;
    /** PHP number_format() */
    number_format(number: number | string, decimals?: number, decimalSeparator?: string, thousandsSeparator?: string): string;
    /** Format number with options */
    formatNumber(num: number, options?: {
        decimals?: number;
        thousandsSeparator?: string;
        decimalSeparator?: string;
        prefix?: string;
        suffix?: string;
    }): string;
    /** Format as currency */
    formatCurrency(amount: number, currency?: string, locale?: string): string;
    /** PHP now() — Carbon-like: returns current Date */
    now(): Date;
    /** PHP today() — returns today at midnight */
    today(): Date;
    /** PHP date() */
    date(format: string, timestamp?: number): string;
    /** PHP time() — Unix timestamp in seconds */
    time(): number;
    /** PHP strtotime() — parse date string to Unix timestamp */
    strtotime(dateStr: string, baseTimestamp?: number): number | false;
    /** PHP mktime() */
    mktime(hour?: number, minute?: number, second?: number, month?: number, day?: number, year?: number): number;
    /** PHP microtime() */
    microtime(asFloat?: boolean): string | number;
    /** Format date matching PHP date() format chars */
    formatDate(date: Date | string | number, format?: string): string;
    /** Carbon-like: diffInDays */
    diffInDays(date1: Date | string, date2?: Date | string): number;
    /** Carbon-like: diffInHours */
    diffInHours(date1: Date | string, date2?: Date | string): number;
    /** Carbon-like: diffInMinutes */
    diffInMinutes(date1: Date | string, date2?: Date | string): number;
    /** Carbon-like: diffInSeconds */
    diffInSeconds(date1: Date | string, date2?: Date | string): number;
    /** Carbon-like: addDays */
    addDays(date: Date | string, days: number): Date;
    /** Carbon-like: subDays */
    subDays(date: Date | string, days: number): Date;
    /** Carbon-like: addHours */
    addHours(date: Date | string, hours: number): Date;
    /** Carbon-like: subHours */
    subHours(date: Date | string, hours: number): Date;
    /** Carbon-like: addMinutes */
    addMinutes(date: Date | string, minutes: number): Date;
    /** Carbon-like: subMinutes */
    subMinutes(date: Date | string, minutes: number): Date;
    /** PHP intval() */
    intval(value: any, base?: number): number;
    /** PHP floatval() */
    floatval(value: any): number;
    /** PHP strval() */
    strval(value: any): string;
    /** PHP boolval() */
    boolval(value: any): boolean;
    /** PHP gettype() */
    gettype(value: any): string;
    /** Laravel Str::slug() / slug helper */
    slug(str: any, separator?: string): string;
    /** Truncate text */
    truncate(str: any, length?: number, suffix?: string): string;
    /** PHP uniqid() */
    uniqid(prefix?: string, moreEntropy?: boolean): string;
    /** PHP collect() — Laravel Collection-like (simple wrapper) */
    collect(items?: any[]): CollectionProxy;
    /** PHP dd() — dump and die (in browser: console.log + throw) */
    dd(...args: any[]): never;
    /** PHP dump() — console.log */
    dump(...args: any[]): void;
    /** PHP var_dump() */
    var_dump(...args: any[]): void;
    /** PHP print_r() */
    print_r(value: any, returnOutput?: boolean): string | void;
    /** PHP class_exists() */
    class_exists(name: string): boolean;
    /** PHP function_exists() */
    function_exists(name: string): boolean;
    /** URL helper — build URL with base */
    url(path?: string): string;
    /** PHP asset() — generate asset URL */
    asset(path: string): string;
    /** Deep clone */
    deepClone<T>(obj: T): T;
    /** Get nested value by dot path */
    data_get(obj: any, path: string, defaultValue?: any): any;
    /** Set nested value by dot path */
    data_set(obj: any, path: string, value: any): void;
    /** PHP old() — get old form input (stub for client-side) */
    old(key: string, defaultValue?: any): any;
    private _formatDatePHP;
}
/**
 * Lightweight Collection — wraps an array with chainable PHP/Laravel methods.
 */
export declare class CollectionProxy implements CollectionProxyInterface {
    private items;
    constructor(items: any[]);
    all(): any[];
    toArray(): any[];
    count(): number;
    isEmpty(): boolean;
    isNotEmpty(): boolean;
    first(cb?: (item: any) => boolean): any;
    last(cb?: (item: any) => boolean): any;
    get(index: number, defaultValue?: any): any;
    map(cb: (item: any, i: number) => any): CollectionProxyInterface;
    filter(cb?: (item: any, i: number) => boolean): CollectionProxyInterface;
    reject(cb: (item: any) => boolean): CollectionProxyInterface;
    reduce(cb: (carry: any, item: any) => any, initial?: any): any;
    each(cb: (item: any, i: number) => void): CollectionProxyInterface;
    pluck(key: string): CollectionProxyInterface;
    where(key: string, value: any): CollectionProxyInterface;
    whereIn(key: string, values: any[]): CollectionProxyInterface;
    whereNotIn(key: string, values: any[]): CollectionProxyInterface;
    sortBy(key: string | ((a: any) => any)): CollectionProxyInterface;
    sortByDesc(key: string | ((a: any) => any)): CollectionProxyInterface;
    reverse(): CollectionProxyInterface;
    unique(key?: string): CollectionProxyInterface;
    flatten(depth?: number): CollectionProxy;
    chunk(size: number): CollectionProxy;
    take(count: number): CollectionProxy;
    skip(count: number): CollectionProxy;
    sum(key?: string | ((item: any) => number)): number;
    avg(key?: string): number;
    min(key?: string): any;
    max(key?: string): any;
    contains(key: any, value?: any): boolean;
    groupBy(key: string | ((item: any) => string)): Record<string, any[]>;
    keyBy(key: string | ((item: any) => string)): Record<string, any>;
    join(glue: string, finalGlue?: string): string;
    push(...items: any[]): CollectionProxy;
    prepend(...items: any[]): CollectionProxy;
    pop(): any;
    shift(): any;
    merge(other: any[]): CollectionProxy;
    values(): CollectionProxy;
    keys(): CollectionProxy;
    tap(cb: (collection: CollectionProxy) => void): CollectionProxy;
    pipe<T>(cb: (collection: CollectionProxy) => T): T;
    toJSON(): any[];
    toString(): string;
}
//# sourceMappingURL=HelperService.d.ts.map