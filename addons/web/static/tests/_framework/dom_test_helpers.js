import {
    check,
    click,
    drag,
    edit,
    fill,
    getActiveElement,
    hover,
    keyDown,
    keyUp,
    manuallyDispatchProgrammaticEvent,
    pointerDown,
    press,
    queryOne,
    scroll,
    select,
    uncheck,
    waitFor,
} from "@odoo/hoot-dom";
import { advanceTime, animationFrame } from "@odoo/hoot-mock";

/**
 * @typedef {import("@odoo/hoot-dom").DragHelpers} DragHelpers
 * @typedef {import("@odoo/hoot-dom").FillOptions} FillOptions
 * @typedef {import("@odoo/hoot-dom").InputValue} InputValue
 * @typedef {import("@odoo/hoot-dom").KeyStrokes} KeyStrokes
 * @typedef {import("@odoo/hoot-dom").PointerOptions} PointerOptions
 * @typedef {import("@odoo/hoot-dom").Position} Position
 * @typedef {import("@odoo/hoot-dom").QueryOptions} QueryOptions
 * @typedef {import("@odoo/hoot-dom").Target} Target
 *
 * @typedef {{
 *  altKey?: boolean;
 *  ctrlKey?: boolean;
 *  metaKey?: boolean;
 *  shiftKey?: boolean;
 * }} KeyModifierOptions
 *
 * @typedef {{
 *  cancel: () => Promise<void>;
 *  drop: () => Promise<AsyncDragHelpers>;
 *  moveTo: (...args: Parameters<DragHelpers["moveTo"]>) => Promise<void>;
 * }} AsyncDragHelpers
 */

/**
 * @template T
 * @typedef {import("@odoo/hoot-dom").MaybePromise<T>} MaybePromise
 */

/**
 * @template T
 * @typedef {(...args: Parameters<T>) => MaybePromise<ReturnType<T>>} Promisify
 */

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

const dragEffectDelay = async () => {
    await advanceTime(20);
    await animationFrame();
};

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * @param {Target} target
 * @param {QueryOptions} [options]
 */
export function contains(target, options) {
    if (target?.raw) {
        return contains(String.raw(...arguments));
    }

    const focusCurrent = async () => {
        const node = await nodePromise;
        if (node !== getActiveElement()) {
            pointerDown(node);
        }
    };

    const nodePromise = waitFor(target, { visible: true, ...options });
    return {
        /**
         * @param {PointerOptions} [options]
         */
        check: async (options) => {
            check(await nodePromise, options);
            await animationFrame();
        },
        /**
         * @param {PointerOptions & KeyModifierOptions} [options]
         */
        click: async (options) => {
            const actions = [() => click(node, options)];
            if (options?.altKey) {
                actions.unshift(() => keyDown("Alt"));
                actions.push(() => keyUp("Alt"));
            }
            if (options?.ctrlKey) {
                actions.unshift(() => keyDown("Control"));
                actions.push(() => keyUp("Control"));
            }
            if (options?.metaKey) {
                actions.unshift(() => keyDown("Meta"));
                actions.push(() => keyUp("Meta"));
            }
            if (options?.shiftKey) {
                actions.unshift(() => keyDown("Shift"));
                actions.push(() => keyUp("Shift"));
            }

            const node = await nodePromise;
            for (const action of actions) {
                action();
            }
            await animationFrame();
        },
        /**
         * @param {PointerOptions} [options]
         * @returns {Promise<AsyncDragHelpers>}
         */
        drag: async (options) => {
            /** @type {AsyncDragHelpers["cancel"]} */
            const asyncCancel = async () => {
                cancel();
                await dragEffectDelay();
            };

            /** @type {AsyncDragHelpers["drop"]} */
            const asyncDrop = async () => {
                drop();
                await dragEffectDelay();
            };

            /** @type {AsyncDragHelpers["moveTo"]} */
            const asyncMoveTo = async (to, options) => {
                moveTo(to, options);
                await dragEffectDelay();
            };

            const node = await nodePromise;
            const { cancel, drop, moveTo } = drag(node, options);
            await dragEffectDelay();

            hover(node, {
                position: {
                    x: 100,
                    y: 100,
                },
                relative: true,
            });
            await dragEffectDelay();

            return {
                cancel: asyncCancel,
                drop: asyncDrop,
                moveTo: asyncMoveTo,
            };
        },
        /**
         * @param {Target} target
         * @param {PointerOptions} [options]
         */
        dragAndDrop: async (target, options) => {
            const { drop, moveTo } = drag(await nodePromise);
            await dragEffectDelay();

            moveTo(target, options);
            await dragEffectDelay();

            drop();
            await dragEffectDelay();
        },
        /**
         * @param {InputValue} value
         * @param {FillOptions} [options]
         */
        edit: async (value, options) => {
            await focusCurrent();
            edit(value, { confirm: true, ...options });
            await animationFrame();
        },
        /**
         * @param {InputValue} value
         * @param {FillOptions} [options]
         */
        fill: async (value, options) => {
            await focusCurrent();
            fill(value, { confirm: true, ...options });
            await animationFrame();
        },
        focus: async () => {
            await focusCurrent();
            await animationFrame();
        },
        hover: async () => {
            hover(await nodePromise);
            await animationFrame();
        },
        /**
         * @param {KeyStrokes} keyStrokes
         */
        press: async (keyStrokes) => {
            await focusCurrent();
            press(keyStrokes);
            await animationFrame();
        },
        /**
         * @param {Position} position
         */
        scroll: async (position) => {
            scroll(await nodePromise, position);
            await animationFrame();
        },
        /**
         * @param {InputValue} value
         */
        select: async (value) => {
            await focusCurrent();
            select(value);
            await animationFrame();
        },
        /**
         * @param {PointerOptions} [options]
         */
        uncheck: async (options) => {
            uncheck(await nodePromise, options);
            await animationFrame();
        },
    };
}

/**
 * @param {string} value
 */
export async function editAce(value) {
    // Ace editor traps focus on "mousedown" events, which are not triggered in
    // mobile. To support both environments, a single "mouedown" event is triggered
    // in this specific case. This should not be reproduced and is only accepted
    // because the tested behaviour comes from a lib on which we have no control.
    manuallyDispatchProgrammaticEvent(queryOne(".ace_editor .ace_content"), "mousedown");

    await contains(".ace_editor textarea", { displayed: true, visible: false }).edit(value);
}
