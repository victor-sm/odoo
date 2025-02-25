/** @odoo-module */

import { whenReady } from "@odoo/owl";
import { getCurrentDimensions, isInDOM, mockedMatchMedia } from "@web/../lib/hoot-dom/helpers/dom";
import { MockMath } from "./math";
import { mockNavigator } from "./navigator";
import {
    MockCookie,
    MockHistory,
    MockLocation,
    MockRequest,
    MockResponse,
    MockSharedWorker,
    MockWebSocket,
    MockWorker,
    MockXMLHttpRequest,
    mockedFetch,
} from "./network";
import { MockNotification } from "./notification";
import { MockStorage } from "./storage";
import {
    MockDate,
    mockedCancelAnimationFrame,
    mockedClearInterval,
    mockedClearTimeout,
    mockedRequestAnimationFrame,
    mockedSetInterval,
    mockedSetTimeout,
} from "./time";

//-----------------------------------------------------------------------------
// Global
//-----------------------------------------------------------------------------

const { Object, document, innerWidth, innerHeight, outerWidth, outerHeight } = globalThis;

//-----------------------------------------------------------------------------
// Internal
//-----------------------------------------------------------------------------

/**
 * @param {any} target
 * @param {Record<string, PropertyDescriptor>} descriptors
 */
const applyPropertyDescriptors = (target, descriptors) => {
    for (const [property, rawDescriptor] of Object.entries(descriptors)) {
        const owner = findPropertyOwner(target, property);
        originalDescriptors.push({
            descriptor: Object.getOwnPropertyDescriptor(owner, property),
            owner,
            property,
            target,
        });
        const descriptor = { ...rawDescriptor };
        if ("value" in descriptor) {
            descriptor.writable = false;
        }
        Object.defineProperty(owner, property, descriptor);
    }
};

/**
 * @template T
 * @param {T} target
 * @param {keyof T} property
 */
const findOriginalDescriptor = (target, property) => {
    for (const { descriptor, target: t, property: p } of originalDescriptors) {
        if (t === target && p === property) {
            return descriptor;
        }
    }
    return null;
};

/**
 * @param {unknown} object
 * @param {string} property
 * @returns {any}
 */
const findPropertyOwner = (object, property) => {
    if (Object.hasOwn(object, property)) {
        return object;
    }
    const prototype = Object.getPrototypeOf(object);
    if (prototype) {
        return findPropertyOwner(prototype, property);
    }
    return object;
};

/**
 * @param {EventTarget} target
 */
const mockEventListeners = (target) => {
    const { addEventListener, removeEventListener } = target;

    /** @type {addEventListener} */
    const mockedAddEventListener = (type, callback, options) => {
        const listeners = listenerMap.get(target);
        if (listeners && !R_OWL_SYNTHETIC_LISTENER.test(String(callback))) {
            if (options?.once) {
                const originalCallback = callback;
                callback = (...args) => {
                    unregisterListener(listeners, type, callback);
                    return originalCallback(...args);
                };
            }
            registerListener(listeners, type, callback);
        }
        return addEventListener.call(target, type, callback, options);
    };

    /** @type {removeEventListener} */
    const mockedRemoveEventListener = (type, callback, options) => {
        const listeners = listenerMap.get(target);
        if (listeners) {
            unregisterListener(listeners, type, callback);
        }
        return removeEventListener.call(target, type, callback, options);
    };

    target.addEventListener = mockedAddEventListener;
    target.removeEventListener = mockedRemoveEventListener;
};

/**
 * @param {EventTarget} target
 * @param {string} type
 * @param {EventListener} callback
 */
const registerListener = (listeners, type, callback) => {
    if (!listeners[type]) {
        listeners[type] = new Set();
    }
    listeners[type].add(callback);
};

/**
 * @param {EventTarget} target
 * @param {string} type
 * @param {EventListener} callback
 */
const unregisterListener = (listeners, type, callback) => {
    if (!listeners[type]) {
        return;
    }
    listeners[type].delete(callback);
    if (!listeners[type].size) {
        delete listeners[type];
    }
};

const R_OWL_SYNTHETIC_LISTENER = /\bnativeToSyntheticEvent\b/;

// Early export: needed for mockHistory
export const mockLocation = new MockLocation();

/** @type {{ descriptor: PropertyDescriptor; owner: any; property: string; target: any }[]} */
const originalDescriptors = [];
const listenerMap = new Map();

const mockCookie = new MockCookie();
const mockHistory = new MockHistory(mockLocation);
const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();
let mockTitle = "";

// Mock descriptors
const DOCUMENT_MOCK_DESCRIPTORS = {
    cookie: {
        get: () => mockCookie.get(),
        set: (value) => mockCookie.set(value),
    },
    title: {
        get: () => mockTitle,
        set: (value) => (mockTitle = value),
    },
};
const WINDOW_MOCK_DESCRIPTORS = {
    cancelAnimationFrame: { value: mockedCancelAnimationFrame, writable: false },
    clearInterval: { value: mockedClearInterval, writable: false },
    clearTimeout: { value: mockedClearTimeout, writable: false },
    Date: { value: MockDate, writable: false },
    fetch: { value: mockedFetch, writable: false },
    history: { value: mockHistory },
    innerHeight: { get: () => getCurrentDimensions().height || innerHeight },
    innerWidth: { get: () => getCurrentDimensions().width || innerWidth },
    localStorage: { value: mockLocalStorage, writable: false },
    matchMedia: { value: mockedMatchMedia },
    Math: { value: MockMath },
    navigator: { value: mockNavigator },
    Notification: { value: MockNotification },
    outerHeight: { get: () => getCurrentDimensions().height || outerHeight },
    outerWidth: { get: () => getCurrentDimensions().width || outerWidth },
    Request: { value: MockRequest, writable: false },
    requestAnimationFrame: { value: mockedRequestAnimationFrame, writable: false },
    Response: { value: MockResponse, writable: false },
    sessionStorage: { value: mockSessionStorage, writable: false },
    setInterval: { value: mockedSetInterval, writable: false },
    setTimeout: { value: mockedSetTimeout, writable: false },
    SharedWorker: { value: MockSharedWorker },
    WebSocket: { value: MockWebSocket },
    Worker: { value: MockWorker },
    XMLHttpRequest: { value: MockXMLHttpRequest },
};

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export function cleanupWindow() {
    // Cookies, history and location
    mockCookie.clear();
    mockHistory.__clear();
    mockLocation.__clear();

    // Storages
    mockLocalStorage.clear();
    mockSessionStorage.clear();

    // Title
    mockTitle = "";

    // Listeners
    for (const [target, listeners] of listenerMap) {
        if (!isInDOM(target)) {
            continue;
        }
        for (const [type, callbacks] of Object.entries(listeners)) {
            for (const callback of callbacks) {
                target.removeEventListener(type, callback);
            }
        }
    }
}

export function getTitle() {
    const titleDescriptor = findOriginalDescriptor(document, "title");
    if (titleDescriptor) {
        return titleDescriptor.get.call(document);
    } else {
        return document.title;
    }
}

/**
 * @param {typeof globalThis} global
 */
export function patchWindow({ document, window } = globalThis) {
    applyPropertyDescriptors(window, WINDOW_MOCK_DESCRIPTORS);
    mockEventListeners(window);
    whenReady(() => {
        applyPropertyDescriptors(document, DOCUMENT_MOCK_DESCRIPTORS);
        for (const target of [document, document.body, document.head]) {
            mockEventListeners(target);
        }
    });
}

/**
 * @param {string} value
 */
export function setTitle(value) {
    const titleDescriptor = findOriginalDescriptor(document, "title");
    if (titleDescriptor) {
        titleDescriptor.set.call(document, value);
    } else {
        document.title = value;
    }
}

/**
 * TODO: is this useful?
 */
export function unpatchWindow() {
    for (const { descriptor, owner, property } of originalDescriptors) {
        Object.defineProperty(owner, property, descriptor);
    }
    originalDescriptors.length = 0;
}

/**
 * Returns a function checking that no listeners are left on the given target, and
 * optionally removing them.
 *
 * @param {...EventTarget} targets
 */
export function watchListeners(...targets) {
    for (const target of targets) {
        listenerMap.set(target, {});
    }

    return function unwatchListeners() {
        listenerMap.clear();
    };
}
