function noop() { }
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

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_data(text, data) {
    data = '' + data;
    if (text.wholeText !== data)
        text.data = data;
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}
function attribute_to_object(attributes) {
    const result = {};
    for (const attribute of attributes) {
        result[attribute.name] = attribute.value;
    }
    return result;
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
function createEventDispatcher() {
    const component = get_current_component();
    return (type, detail) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail);
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
        }
    };
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
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
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
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
    flushing = false;
    seen_callbacks.clear();
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
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    // onMount happens before the initial afterUpdate
    add_render_callback(() => {
        const new_on_destroy = on_mount.map(run).filter(is_function);
        if (on_destroy) {
            on_destroy.push(...new_on_destroy);
        }
        else {
            // Edge case - component was destroyed immediately,
            // most likely as a result of a binding initialising
            run_all(new_on_destroy);
        }
        component.$$.on_mount = [];
    });
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
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
function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const prop_values = options.props || {};
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, prop_values, (i, ret, ...rest) => {
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
        mount_component(component, options.target, options.anchor);
        flush();
    }
    set_current_component(parent_component);
}
let SvelteElement;
if (typeof HTMLElement === 'function') {
    SvelteElement = class extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
        }
        connectedCallback() {
            // @ts-ignore todo: improve typings
            for (const key in this.$$.slotted) {
                // @ts-ignore todo: improve typings
                this.appendChild(this.$$.slotted[key]);
            }
        }
        attributeChangedCallback(attr, _oldValue, newValue) {
            this[attr] = newValue;
        }
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            // TODO should this delegate to addEventListener?
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
    };
}

/* src/stories/Icon.svelte generated by Svelte v3.31.2 */

function create_fragment(ctx) {
	let svg;
	let path;
	let svg_viewBox_value;

	return {
		c() {
			svg = svg_element("svg");
			path = svg_element("path");
			this.c = noop;
			attr(path, "d", /*data*/ ctx[2]);
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "width", /*width*/ ctx[0]);
			attr(svg, "height", /*height*/ ctx[1]);
			attr(svg, "viewBox", svg_viewBox_value = "0 0 " + /*viewBox*/ ctx[3] + " " + /*viewBox*/ ctx[3]);
		},
		m(target, anchor) {
			insert(target, svg, anchor);
			append(svg, path);
		},
		p(ctx, [dirty]) {
			if (dirty & /*data*/ 4) {
				attr(path, "d", /*data*/ ctx[2]);
			}

			if (dirty & /*width*/ 1) {
				attr(svg, "width", /*width*/ ctx[0]);
			}

			if (dirty & /*height*/ 2) {
				attr(svg, "height", /*height*/ ctx[1]);
			}

			if (dirty & /*viewBox*/ 8 && svg_viewBox_value !== (svg_viewBox_value = "0 0 " + /*viewBox*/ ctx[3] + " " + /*viewBox*/ ctx[3])) {
				attr(svg, "viewBox", svg_viewBox_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { width } = $$props;
	let { height } = $$props;
	let { data } = $$props;
	let { viewBox } = $$props;

	$$self.$$set = $$props => {
		if ("width" in $$props) $$invalidate(0, width = $$props.width);
		if ("height" in $$props) $$invalidate(1, height = $$props.height);
		if ("data" in $$props) $$invalidate(2, data = $$props.data);
		if ("viewBox" in $$props) $$invalidate(3, viewBox = $$props.viewBox);
	};

	return [width, height, data, viewBox];
}

class Icon extends SvelteElement {
	constructor(options) {
		super();

		init(
			this,
			{
				target: this.shadowRoot,
				props: attribute_to_object(this.attributes)
			},
			instance,
			create_fragment,
			safe_not_equal,
			{ width: 0, height: 1, data: 2, viewBox: 3 }
		);

		if (options) {
			if (options.target) {
				insert(options.target, this, options.anchor);
			}

			if (options.props) {
				this.$set(options.props);
				flush();
			}
		}
	}

	static get observedAttributes() {
		return ["width", "height", "data", "viewBox"];
	}

	get width() {
		return this.$$.ctx[0];
	}

	set width(width) {
		this.$set({ width });
		flush();
	}

	get height() {
		return this.$$.ctx[1];
	}

	set height(height) {
		this.$set({ height });
		flush();
	}

	get data() {
		return this.$$.ctx[2];
	}

	set data(data) {
		this.$set({ data });
		flush();
	}

	get viewBox() {
		return this.$$.ctx[3];
	}

	set viewBox(viewBox) {
		this.$set({ viewBox });
		flush();
	}
}

var screen = "M27 5H5a2 2 0 00-2 2v16a2 2 0 002 2h6v2H8a1 1 0 000 2h16a1 1 0 000-2h-3v-2h6a2 2 0 002-2V7a2 2 0 00-2-2zM5 7h22v11.6H5zm15 20h-8v-2h8zM5 23v-3.4h22V23z";
var Icons = {
	screen: screen
};

/* src/stories/Button.svelte generated by Svelte v3.31.2 */

function create_if_block_3(ctx) {
	let if_block_anchor;
	let current;
	let if_block = /*iconPosition*/ ctx[5] == "left" && create_if_block_4();

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (/*iconPosition*/ ctx[5] == "left") {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*iconPosition*/ 32) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block_4();
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

// (646:4) {#if iconPosition == 'left' }
function create_if_block_4(ctx) {
	let icon_1;
	let current;

	icon_1 = new Icon({
			props: {
				class: "mc-button__icon",
				width: "32px",
				height: "32px",
				viewBox: "32px",
				data: Icons.screen
			}
		});

	return {
		c() {
			create_component(icon_1.$$.fragment);
		},
		m(target, anchor) {
			mount_component(icon_1, target, anchor);
			current = true;
		},
		p: noop,
		i(local) {
			if (current) return;
			transition_in(icon_1.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(icon_1.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(icon_1, detaching);
		}
	};
}

// (651:2) {#if label }
function create_if_block_2(ctx) {
	let t;

	return {
		c() {
			t = text(/*label*/ ctx[1]);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*label*/ 2) set_data(t, /*label*/ ctx[1]);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (654:2) {#if icon }
function create_if_block(ctx) {
	let if_block_anchor;
	let current;
	let if_block = /*iconPosition*/ ctx[5] == "right" && create_if_block_1();

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (/*iconPosition*/ ctx[5] == "right") {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*iconPosition*/ 32) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block_1();
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

// (655:4) {#if iconPosition == 'right' }
function create_if_block_1(ctx) {
	let icon_1;
	let current;

	icon_1 = new Icon({
			props: {
				class: "mc-button__icon",
				width: "32px",
				height: "32px",
				viewBox: "32px",
				data: Icons.screen
			}
		});

	return {
		c() {
			create_component(icon_1.$$.fragment);
		},
		m(target, anchor) {
			mount_component(icon_1, target, anchor);
			current = true;
		},
		p: noop,
		i(local) {
			if (current) return;
			transition_in(icon_1.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(icon_1.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(icon_1, detaching);
		}
	};
}

function create_fragment$1(ctx) {
	let button;
	let t0;
	let t1;
	let button_class_value;
	let current;
	let if_block0 = /*icon*/ ctx[4] && create_if_block_3(ctx);
	let if_block1 = /*label*/ ctx[1] && create_if_block_2(ctx);
	let if_block2 = /*icon*/ ctx[4] && create_if_block(ctx);

	return {
		c() {
			button = element("button");
			if (if_block0) if_block0.c();
			t0 = space();
			if (if_block1) if_block1.c();
			t1 = space();
			if (if_block2) if_block2.c();
			this.c = noop;
			attr(button, "type", "button");

			attr(button, "class", button_class_value = [
				"mc-button",
				`mc-button--${/*size*/ ctx[0]}`,
				`mc-button--${/*theme*/ ctx[2]}`,
				`mc-button--${/*width*/ ctx[3]}`
			].join(" "));
		},
		m(target, anchor) {
			insert(target, button, anchor);
			if (if_block0) if_block0.m(button, null);
			append(button, t0);
			if (if_block1) if_block1.m(button, null);
			append(button, t1);
			if (if_block2) if_block2.m(button, null);
			current = true;
		},
		p(ctx, [dirty]) {
			if (/*icon*/ ctx[4]) {
				if (if_block0) {
					if_block0.p(ctx, dirty);

					if (dirty & /*icon*/ 16) {
						transition_in(if_block0, 1);
					}
				} else {
					if_block0 = create_if_block_3(ctx);
					if_block0.c();
					transition_in(if_block0, 1);
					if_block0.m(button, t0);
				}
			} else if (if_block0) {
				group_outros();

				transition_out(if_block0, 1, 1, () => {
					if_block0 = null;
				});

				check_outros();
			}

			if (/*label*/ ctx[1]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_2(ctx);
					if_block1.c();
					if_block1.m(button, t1);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (/*icon*/ ctx[4]) {
				if (if_block2) {
					if_block2.p(ctx, dirty);

					if (dirty & /*icon*/ 16) {
						transition_in(if_block2, 1);
					}
				} else {
					if_block2 = create_if_block(ctx);
					if_block2.c();
					transition_in(if_block2, 1);
					if_block2.m(button, null);
				}
			} else if (if_block2) {
				group_outros();

				transition_out(if_block2, 1, 1, () => {
					if_block2 = null;
				});

				check_outros();
			}

			if (!current || dirty & /*size, theme, width*/ 13 && button_class_value !== (button_class_value = [
				"mc-button",
				`mc-button--${/*size*/ ctx[0]}`,
				`mc-button--${/*theme*/ ctx[2]}`,
				`mc-button--${/*width*/ ctx[3]}`
			].join(" "))) {
				attr(button, "class", button_class_value);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block0);
			transition_in(if_block2);
			current = true;
		},
		o(local) {
			transition_out(if_block0);
			transition_out(if_block2);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(button);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let { size = "m" } = $$props;
	let { label = "" } = $$props;
	let { theme = "solid" } = $$props;
	let { width = "" } = $$props;
	let { icon } = $$props;
	let { iconPosition } = $$props;
	const dispatch = createEventDispatcher();

	$$self.$$set = $$props => {
		if ("size" in $$props) $$invalidate(0, size = $$props.size);
		if ("label" in $$props) $$invalidate(1, label = $$props.label);
		if ("theme" in $$props) $$invalidate(2, theme = $$props.theme);
		if ("width" in $$props) $$invalidate(3, width = $$props.width);
		if ("icon" in $$props) $$invalidate(4, icon = $$props.icon);
		if ("iconPosition" in $$props) $$invalidate(5, iconPosition = $$props.iconPosition);
	};

	return [size, label, theme, width, icon, iconPosition];
}

class Button extends SvelteElement {
	constructor(options) {
		super();
		this.shadowRoot.innerHTML = `<style>.mc-button{margin:0;box-shadow:none;text-decoration:none;outline:none;border:none;padding:0;cursor:pointer;color:#ffffff;background-color:#78be20;font-family:"LeroyMerlin", sans-serif;font-weight:600;font-size:1rem;line-height:1.375;padding:0.6875rem 2rem;min-height:3rem;min-width:3rem;height:0;cursor:pointer;border-radius:4px;text-align:center;border:2px solid transparent;transition:all ease 200ms;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;box-sizing:border-box;fill:currentColor}.mc-button.is-hover,.mc-button:hover{background-color:#41a017;color:#ffffff}.mc-button.is-active,.mc-button:active{background-color:#158110}.mc-button.is-disabled,.mc-button:disabled{border-color:transparent;background-color:#d3d2d6;color:#6f676c;cursor:not-allowed}.mc-button.is-focus,.mc-button:focus{box-shadow:0 0 0 0.125rem #ffffff, 0 0 0 0.25rem #25a8d0}.mc-button--s{font-size:0.875rem;line-height:1.2857142857;padding:0.3125rem 1rem;min-height:2rem;min-width:2rem;height:0}.mc-button--m{font-size:1rem;line-height:1.375;padding:0.6875rem 2rem;min-height:3rem;min-width:3rem;height:0}.mc-button--l{font-size:1.125rem;line-height:1.3333333333;padding:0.875rem 2rem;min-height:3.5rem;min-width:3.5rem;height:0}.mc-button--fit{display:inline-flex;width:auto}.mc-button--full{display:flex;width:100%}@supports ((width: -webkit-fill-available) or (width: -moz-available) or (width: stretch)){.mc-button--full{width:-webkit-fill-available;width:-moz-available;width:stretch}}.mc-button--square{padding:0}.mc-button__icon:last-child{margin-left:0.5rem;margin-right:-0.25rem}.mc-button__icon:first-child{margin-right:0.5rem;margin-left:-0.25rem}.mc-button__icon:only-child{margin:0}.mc-button__label{pointer-events:none}.mc-button--solid-primary-02{background-color:#007574}.mc-button--solid-primary-02.is-hover,.mc-button--solid-primary-02:hover{background-color:#063a44}.mc-button--solid-primary-02.is-active,.mc-button--solid-primary-02:active{background-color:#062b35}.mc-button--solid-primary-02.is-disabled,.mc-button--solid-primary-02:disabled{border-color:transparent;background-color:#d3d2d6;color:#6f676c;cursor:not-allowed}.mc-button--solid-neutral{background-color:#887f87}.mc-button--solid-neutral.is-hover,.mc-button--solid-neutral:hover{background-color:#554f52}.mc-button--solid-neutral.is-active,.mc-button--solid-neutral:active{background-color:#3c3738}.mc-button--solid-neutral.is-disabled,.mc-button--solid-neutral:disabled{border-color:transparent;background-color:#d3d2d6;color:#6f676c;cursor:not-allowed}.mc-button--solid-danger{background-color:#df382b}.mc-button--solid-danger.is-hover,.mc-button--solid-danger:hover{background-color:#b42a27}.mc-button--solid-danger.is-active,.mc-button--solid-danger:active{background-color:#8b2226}.mc-button--solid-danger.is-disabled,.mc-button--solid-danger:disabled{border-color:transparent;background-color:#d3d2d6;color:#6f676c;cursor:not-allowed}.mc-button--bordered{color:#78be20;border-color:#78be20;background-color:#ffffff}.mc-button--bordered.is-hover,.mc-button--bordered:hover{background-color:#eaf3e2;color:#78be20}.mc-button--bordered.is-active,.mc-button--bordered:active{background-color:#cbe3b5}.mc-button--bordered.is-disabled,.mc-button--bordered:disabled{border-color:transparent;background-color:#d3d2d6;color:#6f676c;cursor:not-allowed}.mc-button--bordered-primary-02{color:#007574;border-color:#007574;background-color:#ffffff}.mc-button--bordered-primary-02.is-hover,.mc-button--bordered-primary-02:hover{background-color:#dbedea;color:#007574}.mc-button--bordered-primary-02.is-active,.mc-button--bordered-primary-02:active{background-color:#a5d1cb}.mc-button--bordered-primary-02.is-disabled,.mc-button--bordered-primary-02:disabled{border-color:transparent;background-color:#d3d2d6;color:#6f676c;cursor:not-allowed}.mc-button--bordered-neutral{color:#887f87;border-color:#887f87;background-color:#ffffff}.mc-button--bordered-neutral.is-hover,.mc-button--bordered-neutral:hover{background-color:#eeeef0;color:#887f87}.mc-button--bordered-neutral.is-active,.mc-button--bordered-neutral:active{background-color:#d3d2d6}.mc-button--bordered-neutral.is-disabled,.mc-button--bordered-neutral:disabled{border-color:transparent;background-color:#d3d2d6;color:#6f676c;cursor:not-allowed}.mc-button--bordered-danger{color:#df382b;border-color:#df382b;background-color:#ffffff}.mc-button--bordered-danger.is-hover,.mc-button--bordered-danger:hover{background-color:#feedee;color:#df382b}.mc-button--bordered-danger.is-active,.mc-button--bordered-danger:active{background-color:#fab9bc}.mc-button--bordered-danger.is-disabled,.mc-button--bordered-danger:disabled{border-color:transparent;background-color:#d3d2d6;color:#6f676c;cursor:not-allowed}@media screen and (min-width: 680px){.mc-button--s\\@from-m{font-size:0.875rem;line-height:1.2857142857;padding:0.3125rem 1rem;min-height:2rem;min-width:2rem;height:0}.mc-button--m\\@from-m{font-size:1rem;line-height:1.375;padding:0.6875rem 2rem;min-height:3rem;min-width:3rem;height:0}.mc-button--l\\@from-m{font-size:1.125rem;line-height:1.3333333333;padding:0.875rem 2rem;min-height:3.5rem;min-width:3.5rem;height:0}.mc-button--fit\\@from-m{display:inline-flex;width:auto}.mc-button--full\\@from-m{display:flex;width:100%}@supports ((width: -webkit-fill-available) or (width: -moz-available) or (width: stretch)){.mc-button--full\\@from-m{width:-webkit-fill-available;width:-moz-available;width:stretch}}}@media screen and (min-width: 1024px){.mc-button--s\\@from-l{font-size:0.875rem;line-height:1.2857142857;padding:0.3125rem 1rem;min-height:2rem;min-width:2rem;height:0}.mc-button--m\\@from-l{font-size:1rem;line-height:1.375;padding:0.6875rem 2rem;min-height:3rem;min-width:3rem;height:0}.mc-button--l\\@from-l{font-size:1.125rem;line-height:1.3333333333;padding:0.875rem 2rem;min-height:3.5rem;min-width:3.5rem;height:0}.mc-button--fit\\@from-l{display:inline-flex;width:auto}.mc-button--full\\@from-l{display:flex;width:100%}@supports ((width: -webkit-fill-available) or (width: -moz-available) or (width: stretch)){.mc-button--full\\@from-l{width:-webkit-fill-available;width:-moz-available;width:stretch}}}@media screen and (min-width: 1280px){.mc-button--s\\@from-xl{font-size:0.875rem;line-height:1.2857142857;padding:0.3125rem 1rem;min-height:2rem;min-width:2rem;height:0}.mc-button--m\\@from-xl{font-size:1rem;line-height:1.375;padding:0.6875rem 2rem;min-height:3rem;min-width:3rem;height:0}.mc-button--l\\@from-xl{font-size:1.125rem;line-height:1.3333333333;padding:0.875rem 2rem;min-height:3.5rem;min-width:3.5rem;height:0}.mc-button--fit\\@from-xl{display:inline-flex;width:auto}.mc-button--full\\@from-xl{display:flex;width:100%}@supports ((width: -webkit-fill-available) or (width: -moz-available) or (width: stretch)){.mc-button--full\\@from-xl{width:-webkit-fill-available;width:-moz-available;width:stretch}}}@media screen and (min-width: 1920px){.mc-button--s\\@from-xxl{font-size:0.875rem;line-height:1.2857142857;padding:0.3125rem 1rem;min-height:2rem;min-width:2rem;height:0}.mc-button--m\\@from-xxl{font-size:1rem;line-height:1.375;padding:0.6875rem 2rem;min-height:3rem;min-width:3rem;height:0}.mc-button--l\\@from-xxl{font-size:1.125rem;line-height:1.3333333333;padding:0.875rem 2rem;min-height:3.5rem;min-width:3.5rem;height:0}.mc-button--fit\\@from-xxl{display:inline-flex;width:auto}.mc-button--full\\@from-xxl{display:flex;width:100%}@supports ((width: -webkit-fill-available) or (width: -moz-available) or (width: stretch)){.mc-button--full\\@from-xxl{width:-webkit-fill-available;width:-moz-available;width:stretch}}}</style>`;

		init(
			this,
			{
				target: this.shadowRoot,
				props: attribute_to_object(this.attributes)
			},
			instance$1,
			create_fragment$1,
			safe_not_equal,
			{
				size: 0,
				label: 1,
				theme: 2,
				width: 3,
				icon: 4,
				iconPosition: 5
			}
		);

		if (options) {
			if (options.target) {
				insert(options.target, this, options.anchor);
			}

			if (options.props) {
				this.$set(options.props);
				flush();
			}
		}
	}

	static get observedAttributes() {
		return ["size", "label", "theme", "width", "icon", "iconPosition"];
	}

	get size() {
		return this.$$.ctx[0];
	}

	set size(size) {
		this.$set({ size });
		flush();
	}

	get label() {
		return this.$$.ctx[1];
	}

	set label(label) {
		this.$set({ label });
		flush();
	}

	get theme() {
		return this.$$.ctx[2];
	}

	set theme(theme) {
		this.$set({ theme });
		flush();
	}

	get width() {
		return this.$$.ctx[3];
	}

	set width(width) {
		this.$set({ width });
		flush();
	}

	get icon() {
		return this.$$.ctx[4];
	}

	set icon(icon) {
		this.$set({ icon });
		flush();
	}

	get iconPosition() {
		return this.$$.ctx[5];
	}

	set iconPosition(iconPosition) {
		this.$set({ iconPosition });
		flush();
	}
}

customElements.define("mc-button", Button);

export default Button;
