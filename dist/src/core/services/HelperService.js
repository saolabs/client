import { app } from "../hellpers/app";
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
export class HelperService {
    constructor(App) {
        this.App = null;
        this.config = {};
        if (App)
            this.App = App;
    }
    app(key, value) {
        return app(key, value);
    }
    make(name, defaultValue) {
        return app.make(name, defaultValue);
    }
    setApp(App) {
        this.App = App;
    }
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    // ─── Execution ──────────────────────────────────────────────
    /** Execute a function safely, return result or empty string on error */
    execute(fn) {
        try {
            return fn();
        }
        catch (error) {
            console.error('[Helper] execute error:', error);
            return '';
        }
    }
    /** Alias for execute with arguments */
    exec(fn, ...args) {
        try {
            return fn(...args);
        }
        catch (error) {
            console.error('[Helper] exec error:', error);
            return null;
        }
    }
    // ─── Type Checks (PHP-compatible) ───────────────────────────
    /** PHP isset() — true if value is not null/undefined */
    isset(...values) {
        return values.every(v => v !== null && v !== undefined);
    }
    /** PHP empty() — true if value is falsy, empty string, empty array, empty object */
    empty(value) {
        if (value == null)
            return true;
        if (value === false || value === 0 || value === '' || value === '0')
            return true;
        if (Array.isArray(value))
            return value.length === 0;
        if (typeof value === 'object')
            return Object.keys(value).length === 0;
        return false;
    }
    /** PHP is_null() */
    is_null(value) {
        return value === null || value === undefined;
    }
    /** PHP is_array() — true for arrays and plain objects */
    is_array(value) {
        return Array.isArray(value);
    }
    /** PHP is_string() */
    is_string(value) {
        return typeof value === 'string';
    }
    /** PHP is_numeric() */
    is_numeric(value) {
        if (typeof value === 'number')
            return !isNaN(value);
        if (typeof value === 'string')
            return value.trim() !== '' && !isNaN(Number(value));
        return false;
    }
    /** PHP is_object() */
    is_object(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
    /** PHP is_bool() */
    is_bool(value) {
        return typeof value === 'boolean';
    }
    /** PHP is_int() / is_integer() / is_long() */
    is_int(value) {
        return typeof value === 'number' && Number.isInteger(value);
    }
    /** PHP is_float() / is_double() */
    is_float(value) {
        return typeof value === 'number' && !Number.isInteger(value);
    }
    // ─── Count / Length ─────────────────────────────────────────
    /** PHP count() — length of string, array, or object keys */
    count(value) {
        if (value == null)
            return 0;
        if (typeof value === 'string' || Array.isArray(value))
            return value.length;
        if (typeof value === 'object')
            return Object.keys(value).length;
        if (typeof value === 'number')
            return value;
        if (typeof value === 'boolean')
            return value ? 1 : 0;
        return 0;
    }
    /** PHP sizeof() — alias for count */
    sizeof(value) {
        return this.count(value);
    }
    // ─── String Functions ───────────────────────────────────────
    /** PHP strlen() */
    strlen(str) {
        return String(str ?? '').length;
    }
    /** PHP substr() */
    substr(str, start, length) {
        const s = String(str ?? '');
        if (start < 0)
            start = Math.max(0, s.length + start);
        if (length === undefined)
            return s.substring(start);
        if (length < 0)
            return s.substring(start, Math.max(0, s.length + length));
        return s.substring(start, start + length);
    }
    /** PHP mb_substr() — alias for substr (JS strings are UTF-16) */
    mb_substr(str, start, length) {
        return this.substr(str, start, length);
    }
    /** PHP trim() */
    trim(str, chars) {
        const s = String(str ?? '');
        if (!chars)
            return s.trim();
        const escaped = chars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        return s.replace(new RegExp(`^[${escaped}]+|[${escaped}]+$`, 'g'), '');
    }
    /** PHP ltrim() */
    ltrim(str, chars) {
        const s = String(str ?? '');
        if (!chars)
            return s.trimStart();
        const escaped = chars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        return s.replace(new RegExp(`^[${escaped}]+`), '');
    }
    /** PHP rtrim() / chop() */
    rtrim(str, chars) {
        const s = String(str ?? '');
        if (!chars)
            return s.trimEnd();
        const escaped = chars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        return s.replace(new RegExp(`[${escaped}]+$`), '');
    }
    /** PHP strtolower() */
    strtolower(str) {
        return String(str ?? '').toLowerCase();
    }
    /** PHP strtoupper() */
    strtoupper(str) {
        return String(str ?? '').toUpperCase();
    }
    /** PHP ucfirst() */
    ucfirst(str) {
        const s = String(str ?? '');
        if (!s)
            return s;
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    /** PHP lcfirst() */
    lcfirst(str) {
        const s = String(str ?? '');
        if (!s)
            return s;
        return s.charAt(0).toLowerCase() + s.slice(1);
    }
    /** PHP ucwords() */
    ucwords(str, delimiters = " \t\r\n\f\v") {
        const s = String(str ?? '');
        const delimSet = new Set(delimiters.split(''));
        let result = '';
        let capitalizeNext = true;
        for (const ch of s) {
            if (delimSet.has(ch)) {
                result += ch;
                capitalizeNext = true;
            }
            else if (capitalizeNext) {
                result += ch.toUpperCase();
                capitalizeNext = false;
            }
            else {
                result += ch;
            }
        }
        return result;
    }
    /** PHP str_replace() */
    str_replace(search, replace, subject) {
        let s = String(subject ?? '');
        if (Array.isArray(search)) {
            for (let i = 0; i < search.length; i++) {
                const rep = Array.isArray(replace) ? (replace[i] ?? '') : replace;
                s = s.split(search[i]).join(rep);
            }
            return s;
        }
        return s.split(search).join(String(replace));
    }
    /** PHP str_ireplace() — case-insensitive str_replace */
    str_ireplace(search, replace, subject) {
        let s = String(subject ?? '');
        const searches = Array.isArray(search) ? search : [search];
        const replaces = Array.isArray(replace) ? replace : [replace];
        for (let i = 0; i < searches.length; i++) {
            const rep = replaces[i] ?? replaces[replaces.length - 1] ?? '';
            s = s.replace(new RegExp(searches[i].replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'gi'), rep);
        }
        return s;
    }
    /** PHP explode() */
    explode(delimiter, str, limit) {
        const s = String(str ?? '');
        if (!delimiter)
            return [s];
        if (limit === undefined)
            return s.split(delimiter);
        if (limit > 0)
            return s.split(delimiter).slice(0, limit).concat(limit <= s.split(delimiter).length ? [s.split(delimiter).slice(limit - 1).join(delimiter)] : []);
        const parts = s.split(delimiter);
        if (limit < 0)
            return parts.slice(0, parts.length + limit);
        return parts;
    }
    /** PHP implode() / join() */
    implode(glue, pieces) {
        // PHP allows implode(array) with no glue
        if (Array.isArray(glue)) {
            return glue.join('');
        }
        if (!pieces)
            return '';
        return pieces.join(glue);
    }
    /** PHP str_repeat() */
    str_repeat(str, times) {
        return String(str ?? '').repeat(Math.max(0, Math.floor(times)));
    }
    /** PHP str_pad() */
    str_pad(input, length, padString = ' ', padType = 1) {
        const s = String(input ?? '');
        if (s.length >= length)
            return s;
        const pad = length - s.length;
        const STR_PAD_RIGHT = 1, STR_PAD_LEFT = 0, STR_PAD_BOTH = 2;
        switch (padType) {
            case STR_PAD_LEFT:
                return s.padStart(length, padString);
            case STR_PAD_BOTH: {
                const leftPad = Math.floor(pad / 2);
                const rightPad = pad - leftPad;
                return padString.repeat(Math.ceil(leftPad / padString.length)).slice(0, leftPad)
                    + s
                    + padString.repeat(Math.ceil(rightPad / padString.length)).slice(0, rightPad);
            }
            default: // STR_PAD_RIGHT
                return s.padEnd(length, padString);
        }
    }
    /** PHP str_contains() (PHP 8) */
    str_contains(haystack, needle) {
        return String(haystack ?? '').includes(needle);
    }
    /** PHP str_starts_with() (PHP 8) */
    str_starts_with(haystack, needle) {
        return String(haystack ?? '').startsWith(needle);
    }
    /** PHP str_ends_with() (PHP 8) */
    str_ends_with(haystack, needle) {
        return String(haystack ?? '').endsWith(needle);
    }
    /** PHP str_word_count() */
    str_word_count(str, format = 0) {
        const s = String(str ?? '').trim();
        if (!s)
            return format === 0 ? 0 : [];
        const words = s.split(/\s+/);
        return format === 0 ? words.length : words;
    }
    /** PHP str_split() */
    str_split(str, length = 1) {
        const s = String(str ?? '');
        if (length < 1)
            return [s];
        const result = [];
        for (let i = 0; i < s.length; i += length) {
            result.push(s.substring(i, i + length));
        }
        return result.length ? result : [''];
    }
    /** PHP substr_count() */
    substr_count(haystack, needle, offset = 0, length) {
        let s = String(haystack ?? '');
        if (offset)
            s = s.substring(offset);
        if (length !== undefined)
            s = s.substring(0, length);
        if (!needle)
            return 0;
        return s.split(needle).length - 1;
    }
    /** PHP substr_replace() */
    substr_replace(str, replacement, start, length) {
        const s = String(str ?? '');
        const realStart = start < 0 ? Math.max(0, s.length + start) : Math.min(start, s.length);
        const realLength = length === undefined ? s.length - realStart : (length < 0 ? Math.max(0, s.length + length - realStart) : length);
        return s.substring(0, realStart) + replacement + s.substring(realStart + realLength);
    }
    /** PHP nl2br() */
    nl2br(str, isXhtml = true) {
        const br = isXhtml ? '<br />' : '<br>';
        return String(str ?? '').replace(/\r\n|\n|\r/g, br + '\n');
    }
    /** PHP wordwrap() */
    wordwrap(str, width = 75, breakStr = '\n', cutLongWords = false) {
        const s = String(str ?? '');
        if (!s)
            return '';
        const lines = [];
        const words = s.split(' ');
        let currentLine = '';
        for (const word of words) {
            if (cutLongWords && word.length > width) {
                for (let i = 0; i < word.length; i += width) {
                    const chunk = word.substring(i, i + width);
                    if (currentLine.length + (currentLine ? 1 : 0) + chunk.length > width && currentLine) {
                        lines.push(currentLine);
                        currentLine = chunk;
                    }
                    else {
                        currentLine += (currentLine ? ' ' : '') + chunk;
                    }
                }
            }
            else if (currentLine.length + 1 + word.length > width && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            }
            else {
                currentLine += (currentLine ? ' ' : '') + word;
            }
        }
        if (currentLine)
            lines.push(currentLine);
        return lines.join(breakStr);
    }
    /** PHP chunk_split() */
    chunk_split(body, chunklen = 76, end = '\r\n') {
        const s = String(body ?? '');
        let result = '';
        for (let i = 0; i < s.length; i += chunklen) {
            result += s.substring(i, i + chunklen) + end;
        }
        return result;
    }
    /** PHP sprintf() — basic implementation */
    sprintf(format, ...args) {
        let i = 0;
        return format.replace(/%([+\-0 ]*)(\d+)?(?:\.(\d+))?([sdfc%bBoxXeEgG])/g, (match, flags, width, precision, type) => {
            if (type === '%')
                return '%';
            const arg = args[i++];
            let result;
            switch (type) {
                case 'd':
                    result = String(parseInt(arg, 10) || 0);
                    break;
                case 'f':
                    result = (parseFloat(arg) || 0).toFixed(precision !== undefined ? parseInt(precision) : 6);
                    break;
                case 's':
                    result = String(arg ?? '');
                    break;
                case 'c':
                    result = String.fromCharCode(parseInt(arg, 10));
                    break;
                case 'b':
                    result = (parseInt(arg, 10) >>> 0).toString(2);
                    break;
                case 'o':
                    result = (parseInt(arg, 10) >>> 0).toString(8);
                    break;
                case 'x':
                    result = (parseInt(arg, 10) >>> 0).toString(16);
                    break;
                case 'X':
                    result = (parseInt(arg, 10) >>> 0).toString(16).toUpperCase();
                    break;
                case 'e':
                case 'E':
                    result = (parseFloat(arg) || 0).toExponential(precision !== undefined ? parseInt(precision) : undefined);
                    if (type === 'E')
                        result = result.toUpperCase();
                    break;
                default: result = String(arg ?? '');
            }
            const w = parseInt(width) || 0;
            if (w > result.length) {
                const padChar = flags.includes('0') ? '0' : ' ';
                if (flags.includes('-')) {
                    result = result.padEnd(w, padChar);
                }
                else {
                    result = result.padStart(w, padChar);
                }
            }
            return result;
        });
    }
    /** PHP strtolower + first char upper — alias */
    mb_strtolower(str) { return this.strtolower(str); }
    mb_strtoupper(str) { return this.strtoupper(str); }
    mb_strlen(str) { return this.strlen(str); }
    /** PHP strpos() */
    strpos(haystack, needle, offset = 0) {
        const idx = String(haystack ?? '').indexOf(needle, offset);
        return idx === -1 ? false : idx;
    }
    /** PHP strrpos() */
    strrpos(haystack, needle, offset = 0) {
        const idx = String(haystack ?? '').lastIndexOf(needle, offset || undefined);
        return idx === -1 ? false : idx;
    }
    /** PHP stripos() */
    stripos(haystack, needle, offset = 0) {
        const idx = String(haystack ?? '').toLowerCase().indexOf(needle.toLowerCase(), offset);
        return idx === -1 ? false : idx;
    }
    /** PHP str_getcsv() — basic */
    str_getcsv(str, separator = ',', enclosure = '"', escape = '\\') {
        const s = String(str ?? '');
        const result = [];
        let current = '';
        let inQuote = false;
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (ch === escape && i + 1 < s.length && inQuote) {
                current += s[++i];
            }
            else if (ch === enclosure) {
                inQuote = !inQuote;
            }
            else if (ch === separator && !inQuote) {
                result.push(current);
                current = '';
            }
            else {
                current += ch;
            }
        }
        result.push(current);
        return result;
    }
    // ─── HTML / Encoding ────────────────────────────────────────
    /** PHP htmlspecialchars() */
    htmlspecialchars(str, flags, encoding, doubleEncode = true) {
        let s = String(str ?? '');
        if (!doubleEncode) {
            s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
        }
        s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        return s;
    }
    /** PHP htmlspecialchars_decode() */
    htmlspecialchars_decode(str) {
        return String(str ?? '')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&#039;/g, "'");
    }
    /** Escape HTML — alias for htmlspecialchars */
    escapeHtml(str) {
        return this.htmlspecialchars(str);
    }
    /** escString — safe output escaping for template echo */
    escString(value) {
        if (value == null)
            return '';
        return this.htmlspecialchars(String(value));
    }
    /** PHP strip_tags() — basic implementation */
    strip_tags(str, allowedTags) {
        let s = String(str ?? '');
        if (!allowedTags)
            return s.replace(/<\/?[^>]+(>|$)/g, '');
        const allowed = (allowedTags.match(/<[a-z][a-z0-9]*>/gi) || []).map(t => t.replace(/[<>]/g, '').toLowerCase());
        return s.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
            return allowed.includes(tag.toLowerCase()) ? match : '';
        });
    }
    /** PHP addslashes() */
    addslashes(str) {
        return String(str ?? '').replace(/[\\"']/g, '\\$&').replace(/\0/g, '\\0');
    }
    /** PHP stripslashes() */
    stripslashes(str) {
        return String(str ?? '').replace(/\\(.)/g, '$1');
    }
    /** PHP urlencode() */
    urlencode(str) {
        return encodeURIComponent(String(str ?? '')).replace(/%20/g, '+');
    }
    /** PHP urldecode() */
    urldecode(str) {
        return decodeURIComponent(String(str ?? '').replace(/\+/g, '%20'));
    }
    /** PHP rawurlencode() */
    rawurlencode(str) {
        return encodeURIComponent(String(str ?? ''));
    }
    /** PHP rawurldecode() */
    rawurldecode(str) {
        return decodeURIComponent(String(str ?? ''));
    }
    /** PHP base64_encode() */
    base64_encode(str) {
        try {
            return btoa(unescape(encodeURIComponent(String(str ?? ''))));
        }
        catch {
            return btoa(String(str ?? ''));
        }
    }
    /** PHP base64_decode() */
    base64_decode(str) {
        try {
            return decodeURIComponent(escape(atob(String(str ?? ''))));
        }
        catch {
            return atob(String(str ?? ''));
        }
    }
    /** PHP md5() — simple hash (not cryptographic, for display only) */
    md5(str) {
        return this._simpleHash(String(str ?? ''), 32);
    }
    /** PHP sha1() — simple hash (not cryptographic, for display only) */
    sha1(str) {
        return this._simpleHash(String(str ?? ''), 40);
    }
    /** PHP crc32() — basic CRC32 */
    crc32(str) {
        const s = String(str ?? '');
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < s.length; i++) {
            crc ^= s.charCodeAt(i);
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
            }
        }
        return (crc ^ 0xFFFFFFFF) | 0;
    }
    /** Simple string hash for md5/sha1 approximation */
    _simpleHash(str, len) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        const hex = Math.abs(hash).toString(16);
        return hex.padStart(len, '0').slice(0, len);
    }
    // ─── Array Functions ────────────────────────────────────────
    /** PHP array_push() */
    array_push(arr, ...items) {
        if (!Array.isArray(arr))
            return 0;
        return arr.push(...items);
    }
    /** PHP array_pop() */
    array_pop(arr) {
        if (!Array.isArray(arr) || arr.length === 0)
            return null;
        return arr.pop();
    }
    /** PHP array_shift() */
    array_shift(arr) {
        if (!Array.isArray(arr) || arr.length === 0)
            return null;
        return arr.shift();
    }
    /** PHP array_unshift() */
    array_unshift(arr, ...items) {
        if (!Array.isArray(arr))
            return 0;
        return arr.unshift(...items);
    }
    /** PHP array_merge() */
    array_merge(...arrays) {
        // If all arrays → merge into flat array
        if (arrays.every(a => Array.isArray(a))) {
            return [].concat(...arrays);
        }
        // If objects → merge like PHP assoc arrays
        const result = {};
        for (const arr of arrays) {
            if (Array.isArray(arr)) {
                arr.forEach((v, i) => { result[Object.keys(result).length] = v; });
            }
            else if (arr && typeof arr === 'object') {
                Object.assign(result, arr);
            }
        }
        return result;
    }
    /** PHP array_keys() */
    array_keys(arr) {
        if (Array.isArray(arr))
            return arr.map((_, i) => i);
        if (arr && typeof arr === 'object')
            return Object.keys(arr);
        return [];
    }
    /** PHP array_values() */
    array_values(arr) {
        if (Array.isArray(arr))
            return [...arr];
        if (arr && typeof arr === 'object')
            return Object.values(arr);
        return [];
    }
    /** PHP array_reverse() */
    array_reverse(arr, preserveKeys = false) {
        if (!Array.isArray(arr))
            return [];
        return [...arr].reverse();
    }
    /** PHP array_unique() */
    array_unique(arr) {
        if (!Array.isArray(arr))
            return [];
        return [...new Set(arr)];
    }
    /** PHP array_slice() */
    array_slice(arr, offset, length, preserveKeys = false) {
        if (!Array.isArray(arr))
            return [];
        const start = offset < 0 ? Math.max(0, arr.length + offset) : offset;
        if (length === undefined)
            return arr.slice(start);
        if (length < 0)
            return arr.slice(start, arr.length + length);
        return arr.slice(start, start + length);
    }
    /** PHP array_splice() */
    array_splice(arr, offset, length, ...replacement) {
        if (!Array.isArray(arr))
            return [];
        if (length === undefined)
            return arr.splice(offset);
        return arr.splice(offset, length, ...replacement);
    }
    /** PHP array_map() */
    array_map(callback, arr, ...arrays) {
        if (!arr)
            return [];
        if (Array.isArray(arr)) {
            if (callback === null) {
                // PHP: array_map(null, a, b) → zip arrays
                if (arrays.length === 0)
                    return [...arr];
                return arr.map((v, i) => [v, ...arrays.map(a => a?.[i] ?? null)]);
            }
            return arr.map((v, i) => callback(v, i));
        }
        if (typeof arr === 'object') {
            return Object.entries(arr).map(([k, v]) => callback ? callback(v, k) : v);
        }
        return [];
    }
    /** PHP array_filter() */
    array_filter(arr, callback) {
        if (!arr)
            return [];
        if (Array.isArray(arr)) {
            return callback ? arr.filter(callback) : arr.filter(Boolean);
        }
        if (typeof arr === 'object') {
            const entries = Object.entries(arr);
            const filtered = callback ? entries.filter(([k, v]) => callback(v, k)) : entries.filter(([_, v]) => Boolean(v));
            return filtered.map(([_, v]) => v);
        }
        return [];
    }
    /** PHP array_reduce() */
    array_reduce(arr, callback, initial = null) {
        if (!Array.isArray(arr))
            return initial;
        return arr.reduce(callback, initial);
    }
    /** PHP array_find() (PHP 8.4) */
    array_find(arr, callback) {
        if (!Array.isArray(arr))
            return null;
        return arr.find(callback) ?? null;
    }
    /** PHP array_find_key() (PHP 8.4) */
    array_find_key(arr, callback) {
        if (!Array.isArray(arr))
            return null;
        const idx = arr.findIndex(callback);
        return idx === -1 ? null : idx;
    }
    /** PHP array_column() */
    array_column(arr, columnKey, indexKey) {
        if (!Array.isArray(arr))
            return [];
        if (indexKey !== undefined) {
            const result = {};
            for (const item of arr) {
                if (item && typeof item === 'object') {
                    const key = String(item[indexKey] ?? '');
                    result[key] = columnKey !== null ? item[columnKey] : item;
                }
            }
            return result;
        }
        return arr.map(item => item && typeof item === 'object' ? item[columnKey] : null);
    }
    /** PHP array_combine() */
    array_combine(keys, values) {
        const result = {};
        if (!Array.isArray(keys) || !Array.isArray(values))
            return result;
        for (let i = 0; i < keys.length; i++) {
            result[String(keys[i])] = values[i] ?? null;
        }
        return result;
    }
    /** PHP array_chunk() */
    array_chunk(arr, size, preserveKeys = false) {
        if (!Array.isArray(arr) || size < 1)
            return [];
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
        }
        return result;
    }
    /** PHP array_pad() */
    array_pad(arr, size, value) {
        if (!Array.isArray(arr))
            return [];
        const result = [...arr];
        const absSize = Math.abs(size);
        if (result.length >= absSize)
            return result;
        const padCount = absSize - result.length;
        const padding = Array(padCount).fill(value);
        return size > 0 ? result.concat(padding) : padding.concat(result);
    }
    /** PHP array_flip() */
    array_flip(arr) {
        const result = {};
        if (Array.isArray(arr)) {
            arr.forEach((v, i) => { result[String(v)] = i; });
        }
        else if (arr && typeof arr === 'object') {
            Object.entries(arr).forEach(([k, v]) => { result[String(v)] = k; });
        }
        return result;
    }
    /** PHP array_sum() */
    array_sum(arr) {
        if (!Array.isArray(arr))
            return 0;
        return arr.reduce((sum, v) => sum + (Number(v) || 0), 0);
    }
    /** PHP array_product() */
    array_product(arr) {
        if (!Array.isArray(arr) || arr.length === 0)
            return 0;
        return arr.reduce((product, v) => product * (Number(v) || 0), 1);
    }
    /** PHP array_count_values() */
    array_count_values(arr) {
        const result = {};
        if (!Array.isArray(arr))
            return result;
        for (const v of arr) {
            const key = String(v);
            result[key] = (result[key] || 0) + 1;
        }
        return result;
    }
    /** PHP array_fill() */
    array_fill(startIndex, num, value) {
        return Array(num).fill(value);
    }
    /** PHP array_fill_keys() */
    array_fill_keys(keys, value) {
        const result = {};
        for (const k of keys)
            result[String(k)] = value;
        return result;
    }
    /** PHP array_intersect() */
    array_intersect(arr, ...arrays) {
        if (!Array.isArray(arr))
            return [];
        return arr.filter(v => arrays.every(a => a.includes(v)));
    }
    /** PHP array_diff() */
    array_diff(arr, ...arrays) {
        if (!Array.isArray(arr))
            return [];
        const others = new Set([].concat(...arrays));
        return arr.filter(v => !others.has(v));
    }
    /** PHP array_intersect_key() */
    array_intersect_key(obj, ...objects) {
        const result = {};
        const keySets = objects.map(o => new Set(Object.keys(o)));
        for (const [k, v] of Object.entries(obj)) {
            if (keySets.every(s => s.has(k)))
                result[k] = v;
        }
        return result;
    }
    /** PHP array_diff_key() */
    array_diff_key(obj, ...objects) {
        const result = {};
        const keySets = objects.map(o => new Set(Object.keys(o)));
        for (const [k, v] of Object.entries(obj)) {
            if (!keySets.some(s => s.has(k)))
                result[k] = v;
        }
        return result;
    }
    /** PHP array_search() */
    array_search(needle, haystack, strict = false) {
        if (Array.isArray(haystack)) {
            const idx = strict
                ? haystack.findIndex(v => v === needle)
                : haystack.findIndex(v => v == needle);
            return idx === -1 ? false : idx;
        }
        return false;
    }
    /** PHP in_array() */
    in_array(needle, haystack, strict = false) {
        if (!Array.isArray(haystack))
            return false;
        return strict ? haystack.some(v => v === needle) : haystack.some(v => v == needle);
    }
    /** PHP array_key_exists() */
    array_key_exists(key, arr) {
        if (Array.isArray(arr))
            return typeof key === 'number' && key >= 0 && key < arr.length;
        if (arr && typeof arr === 'object')
            return key in arr;
        return false;
    }
    /** PHP sort() — sort array in-place ascending */
    sort(arr) {
        if (!Array.isArray(arr))
            return false;
        arr.sort((a, b) => {
            if (typeof a === 'string' && typeof b === 'string')
                return a.localeCompare(b);
            return (a > b ? 1 : a < b ? -1 : 0);
        });
        return true;
    }
    /** PHP rsort() — sort array in-place descending */
    rsort(arr) {
        if (!Array.isArray(arr))
            return false;
        arr.sort((a, b) => {
            if (typeof a === 'string' && typeof b === 'string')
                return b.localeCompare(a);
            return (b > a ? 1 : b < a ? -1 : 0);
        });
        return true;
    }
    /** PHP ksort() — sort object by keys ascending */
    ksort(obj) {
        const sorted = {};
        Object.keys(obj).sort().forEach(k => { sorted[k] = obj[k]; });
        return sorted;
    }
    /** PHP krsort() — sort object by keys descending */
    krsort(obj) {
        const sorted = {};
        Object.keys(obj).sort().reverse().forEach(k => { sorted[k] = obj[k]; });
        return sorted;
    }
    /** PHP usort() — sort using user comparison function */
    usort(arr, compareFunc) {
        if (!Array.isArray(arr))
            return false;
        arr.sort(compareFunc);
        return true;
    }
    /** PHP uasort() — same as usort for JS arrays */
    uasort(arr, compareFunc) {
        return this.usort(arr, compareFunc);
    }
    /** PHP uksort() — sort object by keys using comparison function */
    uksort(obj, compareFunc) {
        const sorted = {};
        Object.keys(obj).sort(compareFunc).forEach(k => { sorted[k] = obj[k]; });
        return sorted;
    }
    /** PHP range() */
    range(start, end, step = 1) {
        if (typeof start === 'string' && typeof end === 'string' && start.length === 1 && end.length === 1) {
            const result = [];
            const s = start.charCodeAt(0), e = end.charCodeAt(0);
            const dir = s <= e ? 1 : -1;
            const actualStep = Math.max(1, Math.abs(step)) * dir;
            for (let i = s; dir > 0 ? i <= e : i >= e; i += actualStep) {
                result.push(String.fromCharCode(i));
            }
            return result;
        }
        const s = Number(start), e = Number(end);
        const result = [];
        step = Math.abs(step) || 1;
        if (s <= e) {
            for (let i = s; i <= e; i += step)
                result.push(i);
        }
        else {
            for (let i = s; i >= e; i -= step)
                result.push(i);
        }
        return result;
    }
    /** PHP compact() — create object from variable names */
    compact(...names) {
        // Note: In browser context, this won't work like PHP's compact().
        // Compiler should transform this to an object literal.
        console.warn('[Helper] compact() requires compiler transformation. Use object literal instead.');
        const result = {};
        for (const name of names)
            result[name] = undefined;
        return result;
    }
    /** PHP head() — first element */
    head(arr) {
        if (!Array.isArray(arr))
            return null;
        return arr[0] ?? null;
    }
    /** PHP last() — last element */
    last(arr) {
        if (!Array.isArray(arr) || arr.length === 0)
            return null;
        return arr[arr.length - 1];
    }
    // ─── Math Functions ─────────────────────────────────────────
    /** PHP min() */
    min(...values) {
        const flat = values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
        return Math.min(...flat.map(Number));
    }
    /** PHP max() */
    max(...values) {
        const flat = values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
        return Math.max(...flat.map(Number));
    }
    /** PHP abs() */
    abs(n) { return Math.abs(n); }
    /** PHP ceil() */
    ceil(n) { return Math.ceil(n); }
    /** PHP floor() */
    floor(n) { return Math.floor(n); }
    /** PHP round() */
    round(n, precision = 0) {
        if (precision === 0)
            return Math.round(n);
        const factor = Math.pow(10, precision);
        return Math.round(n * factor) / factor;
    }
    /** PHP sqrt() */
    sqrt(n) { return Math.sqrt(n); }
    /** PHP pow() */
    pow(base, exp) { return Math.pow(base, exp); }
    /** PHP log() */
    log(n, base) {
        if (base !== undefined)
            return Math.log(n) / Math.log(base);
        return Math.log(n);
    }
    /** PHP log10() */
    log10(n) { return Math.log10(n); }
    /** PHP exp() */
    exp(n) { return Math.exp(n); }
    /** PHP fmod() */
    fmod(x, y) { return x % y; }
    /** PHP intdiv() */
    intdiv(a, b) { return Math.trunc(a / b); }
    /** PHP pi() */
    pi() { return Math.PI; }
    /** PHP rand() / mt_rand() */
    rand(min, max) {
        if (min === undefined && max === undefined)
            return Math.floor(Math.random() * 2147483647);
        min = min ?? 0;
        max = max ?? 2147483647;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    /** PHP mt_rand() — alias for rand */
    mt_rand(min, max) { return this.rand(min, max); }
    /** PHP array_rand() */
    array_rand(arr, num = 1) {
        if (!Array.isArray(arr) || arr.length === 0)
            return num === 1 ? 0 : [];
        const indices = arr.map((_, i) => i);
        // Fisher-Yates shuffle
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const selected = indices.slice(0, num);
        return num === 1 ? selected[0] : selected.sort((a, b) => a - b);
    }
    // ─── JSON ───────────────────────────────────────────────────
    /** PHP json_encode() */
    json_encode(value, options) {
        try {
            // options: JSON_PRETTY_PRINT = 128
            if (options && (options & 128)) {
                return JSON.stringify(value, null, 4);
            }
            return JSON.stringify(value);
        }
        catch {
            return 'null';
        }
    }
    /** PHP json_decode() */
    json_decode(json, assoc = true) {
        try {
            return JSON.parse(String(json ?? ''));
        }
        catch {
            return null;
        }
    }
    // ─── Number Formatting ──────────────────────────────────────
    /** PHP number_format() */
    number_format(number, decimals = 0, decimalSeparator = '.', thousandsSeparator = ',') {
        const num = typeof number === 'string' ? parseFloat(number) : number;
        if (typeof num !== 'number' || isNaN(num))
            return '0';
        const parts = num.toFixed(decimals).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
        return decimals > 0 ? parts.join(decimalSeparator) : parts[0];
    }
    /** Format number with options */
    formatNumber(num, options = {}) {
        const { decimals = 2, thousandsSeparator = ',', decimalSeparator = '.', prefix = '', suffix = '' } = options;
        return prefix + this.number_format(num, decimals, decimalSeparator, thousandsSeparator) + suffix;
    }
    /** Format as currency */
    formatCurrency(amount, currency = 'USD', locale = 'en-US') {
        try {
            return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
        }
        catch {
            return `${currency} ${this.number_format(amount, 2)}`;
        }
    }
    // ─── Date / Time ────────────────────────────────────────────
    /** PHP now() — Carbon-like: returns current Date */
    now() {
        return new Date();
    }
    /** PHP today() — returns today at midnight */
    today() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }
    /** PHP date() */
    date(format, timestamp) {
        const d = timestamp ? new Date(timestamp * 1000) : new Date();
        return this._formatDatePHP(d, format);
    }
    /** PHP time() — Unix timestamp in seconds */
    time() {
        return Math.floor(Date.now() / 1000);
    }
    /** PHP strtotime() — parse date string to Unix timestamp */
    strtotime(dateStr, baseTimestamp) {
        try {
            const base = baseTimestamp ? new Date(baseTimestamp * 1000) : new Date();
            // Handle relative expressions
            const relativeMatch = dateStr.match(/^([+-]?\d+)\s+(second|minute|hour|day|week|month|year)s?$/i);
            if (relativeMatch) {
                const amount = parseInt(relativeMatch[1]);
                const unit = relativeMatch[2].toLowerCase();
                const d = new Date(base);
                switch (unit) {
                    case 'second':
                        d.setSeconds(d.getSeconds() + amount);
                        break;
                    case 'minute':
                        d.setMinutes(d.getMinutes() + amount);
                        break;
                    case 'hour':
                        d.setHours(d.getHours() + amount);
                        break;
                    case 'day':
                        d.setDate(d.getDate() + amount);
                        break;
                    case 'week':
                        d.setDate(d.getDate() + amount * 7);
                        break;
                    case 'month':
                        d.setMonth(d.getMonth() + amount);
                        break;
                    case 'year':
                        d.setFullYear(d.getFullYear() + amount);
                        break;
                }
                return Math.floor(d.getTime() / 1000);
            }
            // Handle "next/last" expressions
            const nextLastMatch = dateStr.match(/^(next|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i);
            if (nextLastMatch) {
                const direction = nextLastMatch[1].toLowerCase() === 'next' ? 1 : -1;
                const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const targetDay = days.indexOf(nextLastMatch[2].toLowerCase());
                const d = new Date(base);
                const currentDay = d.getDay();
                let diff = targetDay - currentDay;
                if (direction === 1) {
                    if (diff <= 0)
                        diff += 7;
                }
                else {
                    if (diff >= 0)
                        diff -= 7;
                }
                d.setDate(d.getDate() + diff);
                return Math.floor(d.getTime() / 1000);
            }
            // Handle special strings
            if (dateStr.toLowerCase() === 'now')
                return Math.floor(base.getTime() / 1000);
            if (dateStr.toLowerCase() === 'today') {
                base.setHours(0, 0, 0, 0);
                return Math.floor(base.getTime() / 1000);
            }
            if (dateStr.toLowerCase() === 'tomorrow') {
                base.setDate(base.getDate() + 1);
                base.setHours(0, 0, 0, 0);
                return Math.floor(base.getTime() / 1000);
            }
            if (dateStr.toLowerCase() === 'yesterday') {
                base.setDate(base.getDate() - 1);
                base.setHours(0, 0, 0, 0);
                return Math.floor(base.getTime() / 1000);
            }
            // Fall back to Date.parse
            const parsed = new Date(dateStr);
            if (isNaN(parsed.getTime()))
                return false;
            return Math.floor(parsed.getTime() / 1000);
        }
        catch {
            return false;
        }
    }
    /** PHP mktime() */
    mktime(hour = 0, minute = 0, second = 0, month, day, year) {
        const d = new Date();
        if (year !== undefined)
            d.setFullYear(year);
        if (month !== undefined)
            d.setMonth(month - 1);
        if (day !== undefined)
            d.setDate(day);
        d.setHours(hour, minute, second, 0);
        return Math.floor(d.getTime() / 1000);
    }
    /** PHP microtime() */
    microtime(asFloat = false) {
        const ms = performance.now();
        if (asFloat)
            return ms / 1000;
        const sec = Math.floor(ms / 1000);
        const frac = (ms % 1000) / 1000;
        return `${frac.toFixed(8)} ${sec}`;
    }
    /** Format date matching PHP date() format chars */
    formatDate(date, format = 'YYYY-MM-DD') {
        const d = new Date(date);
        if (isNaN(d.getTime()))
            return '';
        const tokens = {
            YYYY: String(d.getFullYear()),
            YY: String(d.getFullYear()).slice(-2),
            MM: String(d.getMonth() + 1).padStart(2, '0'),
            M: String(d.getMonth() + 1),
            DD: String(d.getDate()).padStart(2, '0'),
            D: String(d.getDate()),
            HH: String(d.getHours()).padStart(2, '0'),
            H: String(d.getHours()),
            mm: String(d.getMinutes()).padStart(2, '0'),
            m: String(d.getMinutes()),
            ss: String(d.getSeconds()).padStart(2, '0'),
            s: String(d.getSeconds()),
        };
        let result = format;
        // Replace longest tokens first
        for (const [token, value] of Object.entries(tokens).sort((a, b) => b[0].length - a[0].length)) {
            result = result.replace(new RegExp(token, 'g'), value);
        }
        return result;
    }
    /** Carbon-like: diffInDays */
    diffInDays(date1, date2) {
        const d1 = new Date(date1), d2 = date2 ? new Date(date2) : new Date();
        return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / 86400000);
    }
    /** Carbon-like: diffInHours */
    diffInHours(date1, date2) {
        const d1 = new Date(date1), d2 = date2 ? new Date(date2) : new Date();
        return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / 3600000);
    }
    /** Carbon-like: diffInMinutes */
    diffInMinutes(date1, date2) {
        const d1 = new Date(date1), d2 = date2 ? new Date(date2) : new Date();
        return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / 60000);
    }
    /** Carbon-like: diffInSeconds */
    diffInSeconds(date1, date2) {
        const d1 = new Date(date1), d2 = date2 ? new Date(date2) : new Date();
        return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / 1000);
    }
    /** Carbon-like: addDays */
    addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }
    /** Carbon-like: subDays */
    subDays(date, days) {
        return this.addDays(date, -days);
    }
    /** Carbon-like: addHours */
    addHours(date, hours) {
        const d = new Date(date);
        d.setHours(d.getHours() + hours);
        return d;
    }
    /** Carbon-like: subHours */
    subHours(date, hours) {
        return this.addHours(date, -hours);
    }
    /** Carbon-like: addMinutes */
    addMinutes(date, minutes) {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() + minutes);
        return d;
    }
    /** Carbon-like: subMinutes */
    subMinutes(date, minutes) {
        return this.addMinutes(date, -minutes);
    }
    // ─── Misc Helpers ───────────────────────────────────────────
    /** PHP intval() */
    intval(value, base = 10) {
        return parseInt(value, base) || 0;
    }
    /** PHP floatval() */
    floatval(value) {
        return parseFloat(value) || 0;
    }
    /** PHP strval() */
    strval(value) {
        if (value == null)
            return '';
        return String(value);
    }
    /** PHP boolval() */
    boolval(value) {
        return Boolean(value);
    }
    /** PHP gettype() */
    gettype(value) {
        if (value === null)
            return 'NULL';
        if (Array.isArray(value))
            return 'array';
        const t = typeof value;
        switch (t) {
            case 'boolean': return 'boolean';
            case 'number': return Number.isInteger(value) ? 'integer' : 'double';
            case 'string': return 'string';
            case 'object': return 'object';
            case 'undefined': return 'NULL';
            default: return t;
        }
    }
    /** Laravel Str::slug() / slug helper */
    slug(str, separator = '-') {
        return String(str ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/[\s_]+/g, separator)
            .replace(new RegExp(`[${separator}]+`, 'g'), separator)
            .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '');
    }
    /** Truncate text */
    truncate(str, length = 100, suffix = '...') {
        const s = String(str ?? '');
        if (s.length <= length)
            return s;
        return s.substring(0, length - suffix.length) + suffix;
    }
    /** PHP uniqid() */
    uniqid(prefix = '', moreEntropy = false) {
        const id = Date.now().toString(16) + Math.random().toString(16).slice(2, 10);
        return prefix + id + (moreEntropy ? '.' + Math.random().toString(36).slice(2, 10) : '');
    }
    /** PHP collect() — Laravel Collection-like (simple wrapper) */
    collect(items) {
        return new CollectionProxy(items ?? []);
    }
    /** PHP dd() — dump and die (in browser: console.log + throw) */
    dd(...args) {
        console.log('[dd]', ...args);
        throw new Error('[dd] Dump and die');
    }
    /** PHP dump() — console.log */
    dump(...args) {
        console.log('[dump]', ...args);
    }
    /** PHP var_dump() */
    var_dump(...args) {
        for (const arg of args) {
            console.log(`${this.gettype(arg)}(${JSON.stringify(arg)})`);
        }
    }
    /** PHP print_r() */
    print_r(value, returnOutput = false) {
        const output = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        if (returnOutput)
            return output;
        console.log(output);
    }
    /** PHP class_exists() */
    class_exists(name) {
        try {
            return typeof globalThis[name] === 'function';
        }
        catch {
            return false;
        }
    }
    /** PHP function_exists() */
    function_exists(name) {
        try {
            return typeof globalThis[name] === 'function';
        }
        catch {
            return false;
        }
    }
    /** URL helper — build URL with base */
    url(path = '') {
        const baseUrl = this.config.base_url || '';
        if (!path)
            return baseUrl;
        return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    }
    /** PHP asset() — generate asset URL */
    asset(path) {
        const baseUrl = this.config.asset_url || this.config.base_url || '';
        return `${baseUrl}/${path.replace(/^\//, '')}`;
    }
    /** Deep clone */
    deepClone(obj) {
        if (typeof structuredClone === 'function')
            return structuredClone(obj);
        if (obj === null || typeof obj !== 'object')
            return obj;
        try {
            return JSON.parse(JSON.stringify(obj));
        }
        catch {
            return obj;
        }
    }
    /** Get nested value by dot path */
    data_get(obj, path, defaultValue) {
        const keys = path.split('.');
        let result = obj;
        for (const key of keys) {
            if (result == null)
                return defaultValue;
            result = result[key];
        }
        return result !== undefined ? result : defaultValue;
    }
    /** Set nested value by dot path */
    data_set(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = obj;
        for (const key of keys) {
            if (!(key in current))
                current[key] = {};
            current = current[key];
        }
        current[lastKey] = value;
    }
    /** PHP old() — get old form input (stub for client-side) */
    old(key, defaultValue = '') {
        return defaultValue;
    }
    // ─── Internal Date Formatting (PHP date() format) ───────────
    _formatDatePHP(d, format) {
        const pad = (n, w = 2) => String(n).padStart(w, '0');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const tokens = {
            // Day
            d: () => pad(d.getDate()),
            D: () => days[d.getDay()].slice(0, 3),
            j: () => String(d.getDate()),
            l: () => days[d.getDay()],
            N: () => String(d.getDay() || 7),
            w: () => String(d.getDay()),
            // Month
            F: () => months[d.getMonth()],
            m: () => pad(d.getMonth() + 1),
            M: () => months[d.getMonth()].slice(0, 3),
            n: () => String(d.getMonth() + 1),
            t: () => String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()),
            // Year
            Y: () => String(d.getFullYear()),
            y: () => String(d.getFullYear()).slice(-2),
            L: () => String(d.getFullYear() % 4 === 0 && (d.getFullYear() % 100 !== 0 || d.getFullYear() % 400 === 0) ? 1 : 0),
            // Time
            A: () => d.getHours() < 12 ? 'AM' : 'PM',
            a: () => d.getHours() < 12 ? 'am' : 'pm',
            g: () => String(d.getHours() % 12 || 12),
            G: () => String(d.getHours()),
            h: () => pad(d.getHours() % 12 || 12),
            H: () => pad(d.getHours()),
            i: () => pad(d.getMinutes()),
            s: () => pad(d.getSeconds()),
            u: () => pad(d.getMilliseconds() * 1000, 6),
            // Timezone
            U: () => String(Math.floor(d.getTime() / 1000)),
        };
        let result = '';
        let escaped = false;
        for (let i = 0; i < format.length; i++) {
            const ch = format[i];
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (escaped) {
                result += ch;
                escaped = false;
                continue;
            }
            result += tokens[ch] ? tokens[ch]() : ch;
        }
        return result;
    }
}
// ─── Collection Proxy (Laravel Collection subset) ───────────
/**
 * Lightweight Collection — wraps an array with chainable PHP/Laravel methods.
 */
export class CollectionProxy {
    constructor(items) {
        this.items = Array.isArray(items) ? items : Object.values(items ?? {});
    }
    all() { return this.items; }
    toArray() { return [...this.items]; }
    count() { return this.items.length; }
    isEmpty() { return this.items.length === 0; }
    isNotEmpty() { return this.items.length > 0; }
    first(cb) { return cb ? this.items.find(cb) ?? null : this.items[0] ?? null; }
    last(cb) {
        if (cb) {
            for (let i = this.items.length - 1; i >= 0; i--)
                if (cb(this.items[i]))
                    return this.items[i];
            return null;
        }
        return this.items[this.items.length - 1] ?? null;
    }
    get(index, defaultValue) { return this.items[index] ?? defaultValue ?? null; }
    map(cb) { return new CollectionProxy(this.items.map(cb)); }
    filter(cb) { return new CollectionProxy(cb ? this.items.filter(cb) : this.items.filter(Boolean)); }
    reject(cb) { return new CollectionProxy(this.items.filter(v => !cb(v))); }
    reduce(cb, initial) { return this.items.reduce(cb, initial); }
    each(cb) { this.items.forEach(cb); return this; }
    pluck(key) { return new CollectionProxy(this.items.map(item => item?.[key])); }
    where(key, value) { return new CollectionProxy(this.items.filter(item => item?.[key] === value)); }
    whereIn(key, values) { return new CollectionProxy(this.items.filter(item => values.includes(item?.[key]))); }
    whereNotIn(key, values) { return new CollectionProxy(this.items.filter(item => !values.includes(item?.[key]))); }
    sortBy(key) {
        const sorted = [...this.items].sort((a, b) => {
            const va = typeof key === 'function' ? key(a) : a?.[key];
            const vb = typeof key === 'function' ? key(b) : b?.[key];
            return va > vb ? 1 : va < vb ? -1 : 0;
        });
        return new CollectionProxy(sorted);
    }
    sortByDesc(key) {
        const sorted = [...this.items].sort((a, b) => {
            const va = typeof key === 'function' ? key(a) : a?.[key];
            const vb = typeof key === 'function' ? key(b) : b?.[key];
            return vb > va ? 1 : vb < va ? -1 : 0;
        });
        return new CollectionProxy(sorted);
    }
    reverse() { return new CollectionProxy([...this.items].reverse()); }
    unique(key) {
        if (!key)
            return new CollectionProxy([...new Set(this.items)]);
        const seen = new Set();
        return new CollectionProxy(this.items.filter(item => { const v = item?.[key]; if (seen.has(v))
            return false; seen.add(v); return true; }));
    }
    flatten(depth = Infinity) { return new CollectionProxy(this.items.flat(depth)); }
    chunk(size) {
        const chunks = [];
        for (let i = 0; i < this.items.length; i += size)
            chunks.push(this.items.slice(i, i + size));
        return new CollectionProxy(chunks);
    }
    take(count) { return count >= 0 ? new CollectionProxy(this.items.slice(0, count)) : new CollectionProxy(this.items.slice(count)); }
    skip(count) { return new CollectionProxy(this.items.slice(count)); }
    sum(key) {
        return this.items.reduce((total, item) => {
            const val = key ? (typeof key === 'function' ? key(item) : Number(item?.[key] ?? 0)) : Number(item ?? 0);
            return total + val;
        }, 0);
    }
    avg(key) {
        if (this.items.length === 0)
            return 0;
        return this.sum(key) / this.items.length;
    }
    min(key) {
        if (this.items.length === 0)
            return null;
        return this.items.reduce((m, item) => { const v = key ? item?.[key] : item; return v < m ? v : m; }, key ? this.items[0]?.[key] : this.items[0]);
    }
    max(key) {
        if (this.items.length === 0)
            return null;
        return this.items.reduce((m, item) => { const v = key ? item?.[key] : item; return v > m ? v : m; }, key ? this.items[0]?.[key] : this.items[0]);
    }
    contains(key, value) {
        if (value !== undefined)
            return this.items.some(item => item?.[key] === value);
        if (typeof key === 'function')
            return this.items.some(key);
        return this.items.includes(key);
    }
    groupBy(key) {
        const groups = {};
        for (const item of this.items) {
            const k = typeof key === 'function' ? key(item) : String(item?.[key] ?? '');
            if (!groups[k])
                groups[k] = [];
            groups[k].push(item);
        }
        return groups;
    }
    keyBy(key) {
        const result = {};
        for (const item of this.items) {
            const k = typeof key === 'function' ? key(item) : String(item?.[key] ?? '');
            result[k] = item;
        }
        return result;
    }
    join(glue, finalGlue) {
        if (finalGlue && this.items.length > 1) {
            const allButLast = this.items.slice(0, -1).join(glue);
            return allButLast + finalGlue + this.items[this.items.length - 1];
        }
        return this.items.join(glue);
    }
    push(...items) { return new CollectionProxy([...this.items, ...items]); }
    prepend(...items) { return new CollectionProxy([...items, ...this.items]); }
    pop() { const items = [...this.items]; return items.pop(); }
    shift() { const items = [...this.items]; return items.shift(); }
    merge(other) { return new CollectionProxy([...this.items, ...other]); }
    values() { return new CollectionProxy([...this.items]); }
    keys() { return new CollectionProxy(this.items.map((_, i) => i)); }
    tap(cb) { cb(this); return this; }
    pipe(cb) { return cb(this); }
    toJSON() { return this.toArray(); }
    toString() { return JSON.stringify(this.items); }
}
//# sourceMappingURL=HelperService.js.map