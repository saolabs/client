// ─── Collection Proxy Interface ─────────────────────────────────

import { ApplicationInterface } from "./ApplicationInterface";

export interface CollectionProxyInterface {
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
    flatten(depth?: number): CollectionProxyInterface;
    chunk(size: number): CollectionProxyInterface;
    take(count: number): CollectionProxyInterface;
    skip(count: number): CollectionProxyInterface;
    sum(key?: string | ((item: any) => number)): number;
    avg(key?: string): number;
    min(key?: string): any;
    max(key?: string): any;
    contains(key: any, value?: any): boolean;
    groupBy(key: string | ((item: any) => string)): Record<string, any[]>;
    keyBy(key: string | ((item: any) => string)): Record<string, any>;
    join(glue: string, finalGlue?: string): string;
    push(...items: any[]): CollectionProxyInterface;
    prepend(...items: any[]): CollectionProxyInterface;
    pop(): any;
    shift(): any;
    merge(other: any[]): CollectionProxyInterface;
    values(): CollectionProxyInterface;
    keys(): CollectionProxyInterface;
    tap(cb: (collection: CollectionProxyInterface) => void): CollectionProxyInterface;
    pipe<T>(cb: (collection: CollectionProxyInterface) => T): T;
    toJSON(): any[];
    toString(): string;
}

// ─── Helper Interface ───────────────────────────────────────────

export interface HelperInterface {
    [key: string]: any;

     // ─── App / Service Container ─────────────────────────────────
    app<T>(): T;
    app<T>(key: string): T;
    app<T>(key: string, value: any): ApplicationInterface;
    make<T>(name: string, defaultValue?: T): T | undefined;

    // ─── Execution ──────────────────────────────────────────────
    execute<T>(fn: () => T): T;
    exec(fn: Function, ...args: any[]): any;

    // ─── Type Checks ────────────────────────────────────────────
    isset(...values: any[]): boolean;
    empty(value: any): boolean;
    is_null(value: any): boolean;
    is_array(value: any): boolean;
    is_string(value: any): boolean;
    is_numeric(value: any): boolean;
    is_object(value: any): boolean;
    is_bool(value: any): boolean;
    is_int(value: any): boolean;
    is_float(value: any): boolean;

    // ─── Count / Length ─────────────────────────────────────────
    count(value: any): number;
    sizeof(value: any): number;

    // ─── String Functions ───────────────────────────────────────
    strlen(str: any): number;
    substr(str: any, start: number, length?: number): string;
    mb_substr(str: any, start: number, length?: number): string;
    trim(str: any, chars?: string): string;
    ltrim(str: any, chars?: string): string;
    rtrim(str: any, chars?: string): string;
    strtolower(str: any): string;
    strtoupper(str: any): string;
    ucfirst(str: any): string;
    lcfirst(str: any): string;
    ucwords(str: any, delimiters?: string): string;
    str_replace(search: string | string[], replace: string | string[], subject: string): string;
    str_ireplace(search: string | string[], replace: string | string[], subject: string): string;
    explode(delimiter: string, str: any, limit?: number): string[];
    implode(glue: string, pieces?: any[]): string;
    str_repeat(str: any, times: number): string;
    str_pad(input: any, length: number, padString?: string, padType?: number): string;
    str_contains(haystack: any, needle: string): boolean;
    str_starts_with(haystack: any, needle: string): boolean;
    str_ends_with(haystack: any, needle: string): boolean;
    str_word_count(str: any, format?: number): number | string[];
    str_split(str: any, length?: number): string[];
    substr_count(haystack: any, needle: string, offset?: number, length?: number): number;
    substr_replace(str: any, replacement: string, start: number, length?: number): string;
    nl2br(str: any, isXhtml?: boolean): string;
    wordwrap(str: any, width?: number, breakStr?: string, cutLongWords?: boolean): string;
    chunk_split(body: any, chunklen?: number, end?: string): string;
    sprintf(format: string, ...args: any[]): string;
    mb_strtolower(str: any): string;
    mb_strtoupper(str: any): string;
    mb_strlen(str: any): number;
    strpos(haystack: any, needle: string, offset?: number): number | false;
    strrpos(haystack: any, needle: string, offset?: number): number | false;
    stripos(haystack: any, needle: string, offset?: number): number | false;
    str_getcsv(str: any, separator?: string, enclosure?: string, escape?: string): string[];

    // ─── HTML / Encoding ────────────────────────────────────────
    htmlspecialchars(str: any, flags?: number, encoding?: string, doubleEncode?: boolean): string;
    htmlspecialchars_decode(str: any): string;
    escapeHtml(str: any): string;
    escString(value: any): string;
    strip_tags(str: any, allowedTags?: string): string;
    addslashes(str: any): string;
    stripslashes(str: any): string;
    urlencode(str: any): string;
    urldecode(str: any): string;
    rawurlencode(str: any): string;
    rawurldecode(str: any): string;
    base64_encode(str: any): string;
    base64_decode(str: any): string;
    md5(str: any): string;
    sha1(str: any): string;
    crc32(str: any): number;

    // ─── Array Functions ────────────────────────────────────────
    array_push(arr: any[], ...items: any[]): number;
    array_pop(arr: any[]): any;
    array_shift(arr: any[]): any;
    array_unshift(arr: any[], ...items: any[]): number;
    array_merge(...arrays: any[]): any[] | Record<string, any>;
    array_keys(arr: any): string[] | number[];
    array_values(arr: any): any[];
    array_reverse(arr: any[], preserveKeys?: boolean): any[];
    array_unique(arr: any[]): any[];
    array_slice(arr: any[], offset: number, length?: number, preserveKeys?: boolean): any[];
    array_splice(arr: any[], offset: number, length?: number, ...replacement: any[]): any[];
    array_map(callback: ((item: any, key?: any) => any) | null, arr: any, ...arrays: any[]): any[];
    array_filter(arr: any, callback?: (value: any, key?: any) => boolean): any[];
    array_reduce(arr: any[], callback: (carry: any, item: any) => any, initial?: any): any;
    array_find(arr: any[], callback: (value: any, key?: any) => boolean): any;
    array_find_key(arr: any[], callback: (value: any, key?: any) => boolean): number | null;
    array_column(arr: any[], columnKey: string, indexKey?: string): any[] | Record<string, any>;
    array_combine(keys: any[], values: any[]): Record<string, any>;
    array_chunk(arr: any[], size: number, preserveKeys?: boolean): any[][];
    array_pad(arr: any[], size: number, value: any): any[];
    array_flip(arr: any): Record<string, any>;
    array_sum(arr: any[]): number;
    array_product(arr: any[]): number;
    array_count_values(arr: any[]): Record<string, number>;
    array_fill(startIndex: number, num: number, value: any): any[];
    array_fill_keys(keys: any[], value: any): Record<string, any>;
    array_intersect(arr: any[], ...arrays: any[][]): any[];
    array_diff(arr: any[], ...arrays: any[][]): any[];
    array_intersect_key(obj: Record<string, any>, ...objects: Record<string, any>[]): Record<string, any>;
    array_diff_key(obj: Record<string, any>, ...objects: Record<string, any>[]): Record<string, any>;
    array_search(needle: any, haystack: any[], strict?: boolean): number | string | false;
    in_array(needle: any, haystack: any[], strict?: boolean): boolean;
    array_key_exists(key: string | number, arr: any): boolean;
    sort(arr: any[]): boolean;
    rsort(arr: any[]): boolean;
    ksort(obj: Record<string, any>): Record<string, any>;
    krsort(obj: Record<string, any>): Record<string, any>;
    usort(arr: any[], compareFunc: (a: any, b: any) => number): boolean;
    uasort(arr: any[], compareFunc: (a: any, b: any) => number): boolean;
    uksort(obj: Record<string, any>, compareFunc: (a: string, b: string) => number): Record<string, any>;
    range(start: number | string, end: number | string, step?: number): (number | string)[];
    compact(...names: string[]): Record<string, any>;
    head(arr: any[]): any;
    last(arr: any[]): any;

    // ─── Math Functions ─────────────────────────────────────────
    min(...values: any[]): any;
    max(...values: any[]): any;
    abs(n: number): number;
    ceil(n: number): number;
    floor(n: number): number;
    round(n: number, precision?: number): number;
    sqrt(n: number): number;
    pow(base: number, exp: number): number;
    log(n: number, base?: number): number;
    log10(n: number): number;
    exp(n: number): number;
    fmod(x: number, y: number): number;
    intdiv(a: number, b: number): number;
    pi(): number;
    rand(min?: number, max?: number): number;
    mt_rand(min?: number, max?: number): number;
    array_rand(arr: any[], num?: number): number | number[];

    // ─── JSON ───────────────────────────────────────────────────
    json_encode(value: any, options?: number): string;
    json_decode(json: any, assoc?: boolean): any;

    // ─── Number Formatting ──────────────────────────────────────
    number_format(number: number | string, decimals?: number, decimalSeparator?: string, thousandsSeparator?: string): string;
    formatNumber(num: number, options?: { decimals?: number; thousandsSeparator?: string; decimalSeparator?: string; prefix?: string; suffix?: string }): string;
    formatCurrency(amount: number, currency?: string, locale?: string): string;

    // ─── Date / Time ────────────────────────────────────────────
    now(): Date;
    today(): Date;
    date(format: string, timestamp?: number): string;
    time(): number;
    strtotime(dateStr: string, baseTimestamp?: number): number | false;
    mktime(hour?: number, minute?: number, second?: number, month?: number, day?: number, year?: number): number;
    microtime(asFloat?: boolean): string | number;
    formatDate(date: Date | string | number, format?: string): string;
    diffInDays(date1: Date | string, date2?: Date | string): number;
    diffInHours(date1: Date | string, date2?: Date | string): number;
    diffInMinutes(date1: Date | string, date2?: Date | string): number;
    diffInSeconds(date1: Date | string, date2?: Date | string): number;
    addDays(date: Date | string, days: number): Date;
    subDays(date: Date | string, days: number): Date;
    addHours(date: Date | string, hours: number): Date;
    subHours(date: Date | string, hours: number): Date;
    addMinutes(date: Date | string, minutes: number): Date;
    subMinutes(date: Date | string, minutes: number): Date;

    // ─── Type Conversion ────────────────────────────────────────
    intval(value: any, base?: number): number;
    floatval(value: any): number;
    strval(value: any): string;
    boolval(value: any): boolean;
    gettype(value: any): string;

    // ─── Misc Helpers ───────────────────────────────────────────
    slug(str: any, separator?: string): string;
    truncate(str: any, length?: number, suffix?: string): string;
    uniqid(prefix?: string, moreEntropy?: boolean): string;
    collect(items?: any[]): CollectionProxyInterface;
    dd(...args: any[]): never;
    dump(...args: any[]): void;
    var_dump(...args: any[]): void;
    print_r(value: any, returnOutput?: boolean): string | void;
    class_exists(name: string): boolean;
    function_exists(name: string): boolean;
    url(path?: string): string;
    asset(path: string): string;
    deepClone<T>(obj: T): T;
    data_get(obj: any, path: string, defaultValue?: any): any;
    data_set(obj: any, path: string, value: any): void;
    old(key: string, defaultValue?: any): any;
}