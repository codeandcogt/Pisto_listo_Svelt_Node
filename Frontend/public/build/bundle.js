
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value == null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.59.2 */

    const { Error: Error_1, console: console_1 } = globals;
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[20] = list[i];
    	return child_ctx;
    }

    // (138:4) {#if error}
    function create_if_block_6(ctx) {
    	let div;
    	let t0;
    	let t1;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text(/*error*/ ctx[3]);
    			t1 = space();
    			button = element("button");
    			button.textContent = "×";
    			attr_dev(button, "class", "svelte-1qyvton");
    			add_location(button, file, 140, 8, 3968);
    			attr_dev(div, "class", "error svelte-1qyvton");
    			add_location(div, file, 138, 6, 3922);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t0);
    			append_dev(div, t1);
    			append_dev(div, button);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_3*/ ctx[12], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*error*/ 8) set_data_dev(t0, /*error*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(138:4) {#if error}",
    		ctx
    	});

    	return block;
    }

    // (146:4) {#if vistaActual === 'dashboard'}
    function create_if_block_5(ctx) {
    	let section;
    	let h2;
    	let t1;
    	let div5;
    	let div0;
    	let h30;
    	let t3;
    	let p0;
    	let t4_value = (/*estadisticas*/ ctx[1].total || 0) + "";
    	let t4;
    	let t5;
    	let div1;
    	let h31;
    	let t7;
    	let p1;
    	let t8_value = (/*estadisticas*/ ctx[1].activos || 0) + "";
    	let t8;
    	let t9;
    	let div2;
    	let h32;
    	let t11;
    	let p2;
    	let t12_value = (/*estadisticas*/ ctx[1].pagados || 0) + "";
    	let t12;
    	let t13;
    	let div3;
    	let h33;
    	let t15;
    	let p3;
    	let t16_value = (/*estadisticas*/ ctx[1].enMora || 0) + "";
    	let t16;
    	let t17;
    	let div4;
    	let h34;
    	let t19;
    	let p4;
    	let t20;
    	let t21_value = (/*estadisticas*/ ctx[1].montoTotal || 0) + "";
    	let t21;

    	const block = {
    		c: function create() {
    			section = element("section");
    			h2 = element("h2");
    			h2.textContent = "Estadísticas Generales";
    			t1 = space();
    			div5 = element("div");
    			div0 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Total Préstamos";
    			t3 = space();
    			p0 = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Activos";
    			t7 = space();
    			p1 = element("p");
    			t8 = text(t8_value);
    			t9 = space();
    			div2 = element("div");
    			h32 = element("h3");
    			h32.textContent = "Pagados";
    			t11 = space();
    			p2 = element("p");
    			t12 = text(t12_value);
    			t13 = space();
    			div3 = element("div");
    			h33 = element("h3");
    			h33.textContent = "En Mora";
    			t15 = space();
    			p3 = element("p");
    			t16 = text(t16_value);
    			t17 = space();
    			div4 = element("div");
    			h34 = element("h3");
    			h34.textContent = "Monto Total";
    			t19 = space();
    			p4 = element("p");
    			t20 = text("$");
    			t21 = text(t21_value);
    			add_location(h2, file, 147, 8, 4151);
    			attr_dev(h30, "class", "svelte-1qyvton");
    			add_location(h30, file, 150, 12, 4265);
    			attr_dev(p0, "class", "stat-number svelte-1qyvton");
    			add_location(p0, file, 151, 12, 4303);
    			attr_dev(div0, "class", "stat-card svelte-1qyvton");
    			add_location(div0, file, 149, 10, 4228);
    			attr_dev(h31, "class", "svelte-1qyvton");
    			add_location(h31, file, 154, 12, 4422);
    			attr_dev(p1, "class", "stat-number svelte-1qyvton");
    			set_style(p1, "color", "#28a745");
    			add_location(p1, file, 155, 12, 4452);
    			attr_dev(div1, "class", "stat-card svelte-1qyvton");
    			add_location(div1, file, 153, 10, 4385);
    			attr_dev(h32, "class", "svelte-1qyvton");
    			add_location(h32, file, 158, 12, 4596);
    			attr_dev(p2, "class", "stat-number svelte-1qyvton");
    			set_style(p2, "color", "#007bff");
    			add_location(p2, file, 159, 12, 4626);
    			attr_dev(div2, "class", "stat-card svelte-1qyvton");
    			add_location(div2, file, 157, 10, 4559);
    			attr_dev(h33, "class", "svelte-1qyvton");
    			add_location(h33, file, 162, 12, 4770);
    			attr_dev(p3, "class", "stat-number svelte-1qyvton");
    			set_style(p3, "color", "#dc3545");
    			add_location(p3, file, 163, 12, 4800);
    			attr_dev(div3, "class", "stat-card svelte-1qyvton");
    			add_location(div3, file, 161, 10, 4733);
    			attr_dev(h34, "class", "svelte-1qyvton");
    			add_location(h34, file, 166, 12, 4948);
    			attr_dev(p4, "class", "stat-number svelte-1qyvton");
    			add_location(p4, file, 167, 12, 4982);
    			attr_dev(div4, "class", "stat-card wide svelte-1qyvton");
    			add_location(div4, file, 165, 10, 4906);
    			attr_dev(div5, "class", "stats-grid svelte-1qyvton");
    			add_location(div5, file, 148, 8, 4192);
    			attr_dev(section, "class", "dashboard");
    			add_location(section, file, 146, 6, 4114);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, h2);
    			append_dev(section, t1);
    			append_dev(section, div5);
    			append_dev(div5, div0);
    			append_dev(div0, h30);
    			append_dev(div0, t3);
    			append_dev(div0, p0);
    			append_dev(p0, t4);
    			append_dev(div5, t5);
    			append_dev(div5, div1);
    			append_dev(div1, h31);
    			append_dev(div1, t7);
    			append_dev(div1, p1);
    			append_dev(p1, t8);
    			append_dev(div5, t9);
    			append_dev(div5, div2);
    			append_dev(div2, h32);
    			append_dev(div2, t11);
    			append_dev(div2, p2);
    			append_dev(p2, t12);
    			append_dev(div5, t13);
    			append_dev(div5, div3);
    			append_dev(div3, h33);
    			append_dev(div3, t15);
    			append_dev(div3, p3);
    			append_dev(p3, t16);
    			append_dev(div5, t17);
    			append_dev(div5, div4);
    			append_dev(div4, h34);
    			append_dev(div4, t19);
    			append_dev(div4, p4);
    			append_dev(p4, t20);
    			append_dev(p4, t21);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*estadisticas*/ 2 && t4_value !== (t4_value = (/*estadisticas*/ ctx[1].total || 0) + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*estadisticas*/ 2 && t8_value !== (t8_value = (/*estadisticas*/ ctx[1].activos || 0) + "")) set_data_dev(t8, t8_value);
    			if (dirty & /*estadisticas*/ 2 && t12_value !== (t12_value = (/*estadisticas*/ ctx[1].pagados || 0) + "")) set_data_dev(t12, t12_value);
    			if (dirty & /*estadisticas*/ 2 && t16_value !== (t16_value = (/*estadisticas*/ ctx[1].enMora || 0) + "")) set_data_dev(t16, t16_value);
    			if (dirty & /*estadisticas*/ 2 && t21_value !== (t21_value = (/*estadisticas*/ ctx[1].montoTotal || 0) + "")) set_data_dev(t21, t21_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(146:4) {#if vistaActual === 'dashboard'}",
    		ctx
    	});

    	return block;
    }

    // (175:4) {#if vistaActual === 'prestamos'}
    function create_if_block_1(ctx) {
    	let section;
    	let h2;
    	let t1;

    	function select_block_type(ctx, dirty) {
    		if (/*prestamos*/ ctx[0].length > 0) return create_if_block_2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			section = element("section");
    			h2 = element("h2");
    			h2.textContent = "Gestión de Préstamos";
    			t1 = space();
    			if_block.c();
    			add_location(h2, file, 176, 8, 5224);
    			attr_dev(section, "class", "prestamos");
    			add_location(section, file, 175, 6, 5187);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, h2);
    			append_dev(section, t1);
    			if_block.m(section, null);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(section, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(175:4) {#if vistaActual === 'prestamos'}",
    		ctx
    	});

    	return block;
    }

    // (224:8) {:else}
    function create_else_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "No hay préstamos registrados";
    			add_location(p, file, 224, 10, 7176);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(224:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (178:8) {#if prestamos.length > 0}
    function create_if_block_2(ctx) {
    	let div;
    	let each_value = /*prestamos*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div, "class", "prestamos-grid svelte-1qyvton");
    			add_location(div, file, 178, 10, 5301);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div, null);
    				}
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*cambiarEstado, prestamos, getColorEstado*/ 257) {
    				each_value = /*prestamos*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(178:8) {#if prestamos.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (198:18) {#if prestamo.estado === 'Activo'}
    function create_if_block_4(ctx) {
    	let button0;
    	let t1;
    	let button1;
    	let mounted;
    	let dispose;

    	function click_handler_4() {
    		return /*click_handler_4*/ ctx[13](/*prestamo*/ ctx[20]);
    	}

    	function click_handler_5() {
    		return /*click_handler_5*/ ctx[14](/*prestamo*/ ctx[20]);
    	}

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			button0.textContent = "Marcar Pagado";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Marcar Mora";
    			attr_dev(button0, "class", "btn-success svelte-1qyvton");
    			add_location(button0, file, 198, 20, 6255);
    			attr_dev(button1, "class", "btn-danger svelte-1qyvton");
    			add_location(button1, file, 204, 20, 6497);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button1, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", click_handler_4, false, false, false, false),
    					listen_dev(button1, "click", click_handler_5, false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(198:18) {#if prestamo.estado === 'Activo'}",
    		ctx
    	});

    	return block;
    }

    // (212:18) {#if prestamo.estado === 'En Mora'}
    function create_if_block_3(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	function click_handler_6() {
    		return /*click_handler_6*/ ctx[15](/*prestamo*/ ctx[20]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Marcar Pagado";
    			attr_dev(button, "class", "btn-success svelte-1qyvton");
    			add_location(button, file, 212, 20, 6817);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler_6, false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(212:18) {#if prestamo.estado === 'En Mora'}",
    		ctx
    	});

    	return block;
    }

    // (180:12) {#each prestamos as prestamo}
    function create_each_block(ctx) {
    	let div3;
    	let div0;
    	let h3;
    	let t0_value = /*prestamo*/ ctx[20].cliente + "";
    	let t0;
    	let t1;
    	let span;
    	let t2_value = /*prestamo*/ ctx[20].estado + "";
    	let t2;
    	let t3;
    	let div1;
    	let p0;
    	let strong0;
    	let t5;
    	let t6_value = /*prestamo*/ ctx[20].articulo + "";
    	let t6;
    	let t7;
    	let p1;
    	let strong1;
    	let t9;
    	let t10_value = /*prestamo*/ ctx[20].monto + "";
    	let t10;
    	let t11;
    	let p2;
    	let strong2;
    	let t13;
    	let t14_value = /*prestamo*/ ctx[20].interes + "";
    	let t14;
    	let t15;
    	let t16;
    	let p3;
    	let strong3;
    	let t18;
    	let t19_value = /*prestamo*/ ctx[20].fechaSolicitud + "";
    	let t19;
    	let t20;
    	let div2;
    	let t21;
    	let t22;
    	let if_block0 = /*prestamo*/ ctx[20].estado === 'Activo' && create_if_block_4(ctx);
    	let if_block1 = /*prestamo*/ ctx[20].estado === 'En Mora' && create_if_block_3(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			h3 = element("h3");
    			t0 = text(t0_value);
    			t1 = space();
    			span = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			div1 = element("div");
    			p0 = element("p");
    			strong0 = element("strong");
    			strong0.textContent = "Artículo:";
    			t5 = space();
    			t6 = text(t6_value);
    			t7 = space();
    			p1 = element("p");
    			strong1 = element("strong");
    			strong1.textContent = "Monto:";
    			t9 = text(" $");
    			t10 = text(t10_value);
    			t11 = space();
    			p2 = element("p");
    			strong2 = element("strong");
    			strong2.textContent = "Interés:";
    			t13 = space();
    			t14 = text(t14_value);
    			t15 = text("%");
    			t16 = space();
    			p3 = element("p");
    			strong3 = element("strong");
    			strong3.textContent = "Fecha:";
    			t18 = space();
    			t19 = text(t19_value);
    			t20 = space();
    			div2 = element("div");
    			if (if_block0) if_block0.c();
    			t21 = space();
    			if (if_block1) if_block1.c();
    			t22 = space();
    			attr_dev(h3, "class", "svelte-1qyvton");
    			add_location(h3, file, 182, 18, 5482);
    			attr_dev(span, "class", "estado-badge svelte-1qyvton");
    			set_style(span, "background-color", getColorEstado(/*prestamo*/ ctx[20].estado));
    			add_location(span, file, 183, 18, 5529);
    			attr_dev(div0, "class", "prestamo-header svelte-1qyvton");
    			add_location(div0, file, 181, 16, 5433);
    			add_location(strong0, file, 191, 21, 5841);
    			attr_dev(p0, "class", "svelte-1qyvton");
    			add_location(p0, file, 191, 18, 5838);
    			add_location(strong1, file, 192, 21, 5914);
    			attr_dev(p1, "class", "svelte-1qyvton");
    			add_location(p1, file, 192, 18, 5911);
    			add_location(strong2, file, 193, 21, 5982);
    			attr_dev(p2, "class", "svelte-1qyvton");
    			add_location(p2, file, 193, 18, 5979);
    			add_location(strong3, file, 194, 21, 6054);
    			attr_dev(p3, "class", "svelte-1qyvton");
    			add_location(p3, file, 194, 18, 6051);
    			attr_dev(div1, "class", "prestamo-details svelte-1qyvton");
    			add_location(div1, file, 190, 16, 5788);
    			attr_dev(div2, "class", "prestamo-actions svelte-1qyvton");
    			add_location(div2, file, 196, 16, 6149);
    			attr_dev(div3, "class", "prestamo-card svelte-1qyvton");
    			add_location(div3, file, 180, 14, 5388);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, h3);
    			append_dev(h3, t0);
    			append_dev(div0, t1);
    			append_dev(div0, span);
    			append_dev(span, t2);
    			append_dev(div3, t3);
    			append_dev(div3, div1);
    			append_dev(div1, p0);
    			append_dev(p0, strong0);
    			append_dev(p0, t5);
    			append_dev(p0, t6);
    			append_dev(div1, t7);
    			append_dev(div1, p1);
    			append_dev(p1, strong1);
    			append_dev(p1, t9);
    			append_dev(p1, t10);
    			append_dev(div1, t11);
    			append_dev(div1, p2);
    			append_dev(p2, strong2);
    			append_dev(p2, t13);
    			append_dev(p2, t14);
    			append_dev(p2, t15);
    			append_dev(div1, t16);
    			append_dev(div1, p3);
    			append_dev(p3, strong3);
    			append_dev(p3, t18);
    			append_dev(p3, t19);
    			append_dev(div3, t20);
    			append_dev(div3, div2);
    			if (if_block0) if_block0.m(div2, null);
    			append_dev(div2, t21);
    			if (if_block1) if_block1.m(div2, null);
    			append_dev(div3, t22);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*prestamos*/ 1 && t0_value !== (t0_value = /*prestamo*/ ctx[20].cliente + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*prestamos*/ 1 && t2_value !== (t2_value = /*prestamo*/ ctx[20].estado + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*prestamos*/ 1) {
    				set_style(span, "background-color", getColorEstado(/*prestamo*/ ctx[20].estado));
    			}

    			if (dirty & /*prestamos*/ 1 && t6_value !== (t6_value = /*prestamo*/ ctx[20].articulo + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*prestamos*/ 1 && t10_value !== (t10_value = /*prestamo*/ ctx[20].monto + "")) set_data_dev(t10, t10_value);
    			if (dirty & /*prestamos*/ 1 && t14_value !== (t14_value = /*prestamo*/ ctx[20].interes + "")) set_data_dev(t14, t14_value);
    			if (dirty & /*prestamos*/ 1 && t19_value !== (t19_value = /*prestamo*/ ctx[20].fechaSolicitud + "")) set_data_dev(t19, t19_value);

    			if (/*prestamo*/ ctx[20].estado === 'Activo') {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					if_block0.m(div2, t21);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*prestamo*/ ctx[20].estado === 'En Mora') {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(div2, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(180:12) {#each prestamos as prestamo}",
    		ctx
    	});

    	return block;
    }

    // (231:4) {#if vistaActual === 'nuevo'}
    function create_if_block(ctx) {
    	let section;
    	let h2;
    	let t1;
    	let form;
    	let div0;
    	let label0;
    	let t3;
    	let input0;
    	let t4;
    	let div1;
    	let label1;
    	let t6;
    	let input1;
    	let t7;
    	let div2;
    	let label2;
    	let t9;
    	let input2;
    	let t10;
    	let div3;
    	let label3;
    	let t12;
    	let input3;
    	let t13;
    	let button;
    	let t14_value = (/*loading*/ ctx[2] ? 'Creando...' : 'Crear Préstamo') + "";
    	let t14;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			section = element("section");
    			h2 = element("h2");
    			h2.textContent = "Crear Nuevo Préstamo";
    			t1 = space();
    			form = element("form");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Nombre del Cliente:";
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Artículo a Empeñar:";
    			t6 = space();
    			input1 = element("input");
    			t7 = space();
    			div2 = element("div");
    			label2 = element("label");
    			label2.textContent = "Monto del Préstamo:";
    			t9 = space();
    			input2 = element("input");
    			t10 = space();
    			div3 = element("div");
    			label3 = element("label");
    			label3.textContent = "Tasa de Interés (%):";
    			t12 = space();
    			input3 = element("input");
    			t13 = space();
    			button = element("button");
    			t14 = text(t14_value);
    			add_location(h2, file, 232, 8, 7373);
    			attr_dev(label0, "for", "cliente");
    			attr_dev(label0, "class", "svelte-1qyvton");
    			add_location(label0, file, 235, 12, 7509);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "cliente");
    			input0.required = true;
    			attr_dev(input0, "class", "svelte-1qyvton");
    			add_location(input0, file, 236, 12, 7571);
    			attr_dev(div0, "class", "form-group svelte-1qyvton");
    			add_location(div0, file, 234, 10, 7471);
    			attr_dev(label1, "for", "articulo");
    			attr_dev(label1, "class", "svelte-1qyvton");
    			add_location(label1, file, 245, 12, 7805);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "articulo");
    			input1.required = true;
    			attr_dev(input1, "class", "svelte-1qyvton");
    			add_location(input1, file, 246, 12, 7868);
    			attr_dev(div1, "class", "form-group svelte-1qyvton");
    			add_location(div1, file, 244, 10, 7767);
    			attr_dev(label2, "for", "monto");
    			attr_dev(label2, "class", "svelte-1qyvton");
    			add_location(label2, file, 255, 12, 8104);
    			attr_dev(input2, "type", "number");
    			attr_dev(input2, "id", "monto");
    			attr_dev(input2, "min", "1");
    			attr_dev(input2, "step", "0.01");
    			input2.required = true;
    			attr_dev(input2, "class", "svelte-1qyvton");
    			add_location(input2, file, 256, 12, 8164);
    			attr_dev(div2, "class", "form-group svelte-1qyvton");
    			add_location(div2, file, 254, 10, 8066);
    			attr_dev(label3, "for", "interes");
    			attr_dev(label3, "class", "svelte-1qyvton");
    			add_location(label3, file, 267, 12, 8448);
    			attr_dev(input3, "type", "number");
    			attr_dev(input3, "id", "interes");
    			attr_dev(input3, "min", "1");
    			attr_dev(input3, "max", "50");
    			attr_dev(input3, "step", "0.1");
    			attr_dev(input3, "class", "svelte-1qyvton");
    			add_location(input3, file, 268, 12, 8511);
    			attr_dev(div3, "class", "form-group svelte-1qyvton");
    			add_location(div3, file, 266, 10, 8410);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "btn-primary svelte-1qyvton");
    			button.disabled = /*loading*/ ctx[2];
    			add_location(button, file, 278, 10, 8760);
    			attr_dev(form, "class", "svelte-1qyvton");
    			add_location(form, file, 233, 8, 7412);
    			attr_dev(section, "class", "nuevo-prestamo svelte-1qyvton");
    			add_location(section, file, 231, 6, 7331);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);
    			append_dev(section, h2);
    			append_dev(section, t1);
    			append_dev(section, form);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t3);
    			append_dev(div0, input0);
    			set_input_value(input0, /*nuevoPrestamo*/ ctx[5].cliente);
    			append_dev(form, t4);
    			append_dev(form, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t6);
    			append_dev(div1, input1);
    			set_input_value(input1, /*nuevoPrestamo*/ ctx[5].articulo);
    			append_dev(form, t7);
    			append_dev(form, div2);
    			append_dev(div2, label2);
    			append_dev(div2, t9);
    			append_dev(div2, input2);
    			set_input_value(input2, /*nuevoPrestamo*/ ctx[5].monto);
    			append_dev(form, t10);
    			append_dev(form, div3);
    			append_dev(div3, label3);
    			append_dev(div3, t12);
    			append_dev(div3, input3);
    			set_input_value(input3, /*nuevoPrestamo*/ ctx[5].interes);
    			append_dev(form, t13);
    			append_dev(form, button);
    			append_dev(button, t14);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[16]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[17]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[18]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[19]),
    					listen_dev(form, "submit", prevent_default(/*crearPrestamo*/ ctx[7]), false, true, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*nuevoPrestamo*/ 32 && input0.value !== /*nuevoPrestamo*/ ctx[5].cliente) {
    				set_input_value(input0, /*nuevoPrestamo*/ ctx[5].cliente);
    			}

    			if (dirty & /*nuevoPrestamo*/ 32 && input1.value !== /*nuevoPrestamo*/ ctx[5].articulo) {
    				set_input_value(input1, /*nuevoPrestamo*/ ctx[5].articulo);
    			}

    			if (dirty & /*nuevoPrestamo*/ 32 && to_number(input2.value) !== /*nuevoPrestamo*/ ctx[5].monto) {
    				set_input_value(input2, /*nuevoPrestamo*/ ctx[5].monto);
    			}

    			if (dirty & /*nuevoPrestamo*/ 32 && to_number(input3.value) !== /*nuevoPrestamo*/ ctx[5].interes) {
    				set_input_value(input3, /*nuevoPrestamo*/ ctx[5].interes);
    			}

    			if (dirty & /*loading*/ 4 && t14_value !== (t14_value = (/*loading*/ ctx[2] ? 'Creando...' : 'Crear Préstamo') + "")) set_data_dev(t14, t14_value);

    			if (dirty & /*loading*/ 4) {
    				prop_dev(button, "disabled", /*loading*/ ctx[2]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(231:4) {#if vistaActual === 'nuevo'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let header;
    	let h1;
    	let t1;
    	let nav;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let button2;
    	let t7;
    	let button3;
    	let t8_value = (/*loading*/ ctx[2] ? 'Cargando...' : 'Actualizar') + "";
    	let t8;
    	let t9;
    	let t10;
    	let t11;
    	let t12;
    	let mounted;
    	let dispose;
    	let if_block0 = /*error*/ ctx[3] && create_if_block_6(ctx);
    	let if_block1 = /*vistaActual*/ ctx[4] === 'dashboard' && create_if_block_5(ctx);
    	let if_block2 = /*vistaActual*/ ctx[4] === 'prestamos' && create_if_block_1(ctx);
    	let if_block3 = /*vistaActual*/ ctx[4] === 'nuevo' && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			header = element("header");
    			h1 = element("h1");
    			h1.textContent = "Sistema de Préstamos Pignoraticios";
    			t1 = space();
    			nav = element("nav");
    			button0 = element("button");
    			button0.textContent = "Dashboard";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Préstamos";
    			t5 = space();
    			button2 = element("button");
    			button2.textContent = "Nuevo Préstamo";
    			t7 = space();
    			button3 = element("button");
    			t8 = text(t8_value);
    			t9 = space();
    			if (if_block0) if_block0.c();
    			t10 = space();
    			if (if_block1) if_block1.c();
    			t11 = space();
    			if (if_block2) if_block2.c();
    			t12 = space();
    			if (if_block3) if_block3.c();
    			attr_dev(h1, "class", "svelte-1qyvton");
    			add_location(h1, file, 111, 6, 3146);
    			attr_dev(button0, "class", "svelte-1qyvton");
    			toggle_class(button0, "active", /*vistaActual*/ ctx[4] === 'dashboard');
    			add_location(button0, file, 113, 8, 3212);
    			attr_dev(button1, "class", "svelte-1qyvton");
    			toggle_class(button1, "active", /*vistaActual*/ ctx[4] === 'prestamos');
    			add_location(button1, file, 119, 8, 3390);
    			attr_dev(button2, "class", "svelte-1qyvton");
    			toggle_class(button2, "active", /*vistaActual*/ ctx[4] === 'nuevo');
    			add_location(button2, file, 125, 8, 3568);
    			button3.disabled = /*loading*/ ctx[2];
    			attr_dev(button3, "class", "svelte-1qyvton");
    			add_location(button3, file, 131, 8, 3743);
    			attr_dev(nav, "class", "svelte-1qyvton");
    			add_location(nav, file, 112, 6, 3197);
    			attr_dev(header, "class", "svelte-1qyvton");
    			add_location(header, file, 110, 4, 3130);
    			attr_dev(main, "class", "svelte-1qyvton");
    			add_location(main, file, 109, 2, 3118);
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, header);
    			append_dev(header, h1);
    			append_dev(header, t1);
    			append_dev(header, nav);
    			append_dev(nav, button0);
    			append_dev(nav, t3);
    			append_dev(nav, button1);
    			append_dev(nav, t5);
    			append_dev(nav, button2);
    			append_dev(nav, t7);
    			append_dev(nav, button3);
    			append_dev(button3, t8);
    			append_dev(main, t9);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t10);
    			if (if_block1) if_block1.m(main, null);
    			append_dev(main, t11);
    			if (if_block2) if_block2.m(main, null);
    			append_dev(main, t12);
    			if (if_block3) if_block3.m(main, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[9], false, false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[10], false, false, false, false),
    					listen_dev(button2, "click", /*click_handler_2*/ ctx[11], false, false, false, false),
    					listen_dev(button3, "click", /*cargarDatos*/ ctx[6], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*vistaActual*/ 16) {
    				toggle_class(button0, "active", /*vistaActual*/ ctx[4] === 'dashboard');
    			}

    			if (dirty & /*vistaActual*/ 16) {
    				toggle_class(button1, "active", /*vistaActual*/ ctx[4] === 'prestamos');
    			}

    			if (dirty & /*vistaActual*/ 16) {
    				toggle_class(button2, "active", /*vistaActual*/ ctx[4] === 'nuevo');
    			}

    			if (dirty & /*loading*/ 4 && t8_value !== (t8_value = (/*loading*/ ctx[2] ? 'Cargando...' : 'Actualizar') + "")) set_data_dev(t8, t8_value);

    			if (dirty & /*loading*/ 4) {
    				prop_dev(button3, "disabled", /*loading*/ ctx[2]);
    			}

    			if (/*error*/ ctx[3]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_6(ctx);
    					if_block0.c();
    					if_block0.m(main, t10);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*vistaActual*/ ctx[4] === 'dashboard') {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_5(ctx);
    					if_block1.c();
    					if_block1.m(main, t11);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*vistaActual*/ ctx[4] === 'prestamos') {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_1(ctx);
    					if_block2.c();
    					if_block2.m(main, t12);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*vistaActual*/ ctx[4] === 'nuevo') {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block(ctx);
    					if_block3.c();
    					if_block3.m(main, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function getColorEstado(estado) {
    	switch (estado) {
    		case 'Activo':
    			return '#28a745';
    		case 'Pagado':
    			return '#007bff';
    		case 'En Mora':
    			return '#dc3545';
    		default:
    			return '#6c757d';
    	}
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let prestamos = [];
    	let estadisticas = {};
    	let loading = false;
    	let error = '';
    	let vistaActual = 'dashboard'; // dashboard, prestamos, nuevo

    	// Formulario para nuevo préstamo
    	let nuevoPrestamo = {
    		cliente: '',
    		monto: '',
    		articulo: '',
    		interes: 15
    	};

    	// Cargar datos al iniciar
    	onMount(async () => {
    		await cargarDatos();
    	});

    	async function cargarDatos() {
    		$$invalidate(2, loading = true);
    		$$invalidate(3, error = '');

    		try {
    			// Cargar préstamos
    			const responseP = await fetch('http://localhost:3001/api/prestamos');

    			if (!responseP.ok) throw new Error('Error al cargar préstamos');
    			$$invalidate(0, prestamos = await responseP.json());

    			// Cargar estadísticas
    			const responseE = await fetch('http://localhost:3001/api/estadisticas');

    			if (!responseE.ok) throw new Error('Error al cargar estadísticas');
    			$$invalidate(1, estadisticas = await responseE.json());
    		} catch(err) {
    			$$invalidate(3, error = 'Error de conexión: ' + err.message);
    			console.error('Error:', err);
    		} finally {
    			$$invalidate(2, loading = false);
    		}
    	}

    	async function crearPrestamo() {
    		if (!nuevoPrestamo.cliente || !nuevoPrestamo.monto || !nuevoPrestamo.articulo) {
    			$$invalidate(3, error = 'Todos los campos son requeridos');
    			return;
    		}

    		$$invalidate(2, loading = true);
    		$$invalidate(3, error = '');

    		try {
    			const response = await fetch('http://localhost:3001/api/prestamos', {
    				method: 'POST',
    				headers: { 'Content-Type': 'application/json' },
    				body: JSON.stringify(nuevoPrestamo)
    			});

    			if (!response.ok) throw new Error('Error al crear préstamo');

    			// Limpiar formulario
    			$$invalidate(5, nuevoPrestamo = {
    				cliente: '',
    				monto: '',
    				articulo: '',
    				interes: 15
    			});

    			// Recargar datos y volver al dashboard
    			await cargarDatos();

    			$$invalidate(4, vistaActual = 'prestamos');
    		} catch(err) {
    			$$invalidate(3, error = 'Error al crear préstamo: ' + err.message);
    		} finally {
    			$$invalidate(2, loading = false);
    		}
    	}

    	async function cambiarEstado(id, nuevoEstado) {
    		try {
    			const response = await fetch(`http://localhost:3001/api/prestamos/${id}`, {
    				method: 'PUT',
    				headers: { 'Content-Type': 'application/json' },
    				body: JSON.stringify({ estado: nuevoEstado })
    			});

    			if (!response.ok) throw new Error('Error al actualizar préstamo');
    			await cargarDatos();
    		} catch(err) {
    			$$invalidate(3, error = 'Error al actualizar: ' + err.message);
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(4, vistaActual = 'dashboard');
    	const click_handler_1 = () => $$invalidate(4, vistaActual = 'prestamos');
    	const click_handler_2 = () => $$invalidate(4, vistaActual = 'nuevo');
    	const click_handler_3 = () => $$invalidate(3, error = '');
    	const click_handler_4 = prestamo => cambiarEstado(prestamo.id, 'Pagado');
    	const click_handler_5 = prestamo => cambiarEstado(prestamo.id, 'En Mora');
    	const click_handler_6 = prestamo => cambiarEstado(prestamo.id, 'Pagado');

    	function input0_input_handler() {
    		nuevoPrestamo.cliente = this.value;
    		$$invalidate(5, nuevoPrestamo);
    	}

    	function input1_input_handler() {
    		nuevoPrestamo.articulo = this.value;
    		$$invalidate(5, nuevoPrestamo);
    	}

    	function input2_input_handler() {
    		nuevoPrestamo.monto = to_number(this.value);
    		$$invalidate(5, nuevoPrestamo);
    	}

    	function input3_input_handler() {
    		nuevoPrestamo.interes = to_number(this.value);
    		$$invalidate(5, nuevoPrestamo);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		prestamos,
    		estadisticas,
    		loading,
    		error,
    		vistaActual,
    		nuevoPrestamo,
    		cargarDatos,
    		crearPrestamo,
    		cambiarEstado,
    		getColorEstado
    	});

    	$$self.$inject_state = $$props => {
    		if ('prestamos' in $$props) $$invalidate(0, prestamos = $$props.prestamos);
    		if ('estadisticas' in $$props) $$invalidate(1, estadisticas = $$props.estadisticas);
    		if ('loading' in $$props) $$invalidate(2, loading = $$props.loading);
    		if ('error' in $$props) $$invalidate(3, error = $$props.error);
    		if ('vistaActual' in $$props) $$invalidate(4, vistaActual = $$props.vistaActual);
    		if ('nuevoPrestamo' in $$props) $$invalidate(5, nuevoPrestamo = $$props.nuevoPrestamo);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		prestamos,
    		estadisticas,
    		loading,
    		error,
    		vistaActual,
    		nuevoPrestamo,
    		cargarDatos,
    		crearPrestamo,
    		cambiarEstado,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
