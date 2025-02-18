import { queryAll, queryAllTexts, queryOne } from "@odoo/hoot-dom";
import { contains, fields, models } from "@web/../tests/web_test_helpers";

export class Partner extends models.Model {
    foo = fields.Char();
    bar = fields.Boolean();
    product_id = fields.Many2one({ relation: "product" });
    int = fields.Integer();
    date = fields.Date();
    datetime = fields.Datetime();
    json_field = fields.Json({ string: "Json Field" });
    state = fields.Selection({
        selection: [
            ["abc", "ABC"],
            ["def", "DEF"],
            ["ghi", "GHI"],
        ],
    });

    _records = [
        { id: 1, foo: "yop", bar: true, product_id: 37 },
        { id: 2, foo: "blip", bar: true, product_id: false },
        { id: 4, foo: "abc", bar: false, product_id: 41 },
    ];
}

export class Product extends models.Model {
    name = fields.Char({ string: "Product Name" });

    _records = [
        { id: 37, name: "xphone" },
        { id: 41, name: "xpad" },
    ];
}

export const SELECTORS = {
    node: ".o_tree_editor_node",
    row: ".o_tree_editor_row",
    tree: ".o_tree_editor > .o_tree_editor_node",
    connector: ".o_tree_editor_connector",
    condition: ".o_tree_editor_condition",
    addNewRule: ".o_tree_editor_row > a",
    buttonAddNewRule: ".o_tree_editor_node_control_panel > button:nth-child(1)",
    buttonAddBranch: ".o_tree_editor_node_control_panel > button:nth-child(2)",
    buttonDeleteNode: ".o_tree_editor_node_control_panel > button:nth-child(3)",
    pathEditor: ".o_tree_editor_condition > .o_tree_editor_editor:nth-child(1)",
    operatorEditor: ".o_tree_editor_condition > .o_tree_editor_editor:nth-child(2)",
    valueEditor: ".o_tree_editor_condition > .o_tree_editor_editor:nth-child(3)",
    editor: ".o_tree_editor_editor",
    clearNotSupported: ".o_input .fa-times",
    tag: ".o_input .o_tag",
    toggleArchive: ".form-switch",
    complexCondition: ".o_tree_editor_complex_condition",
    complexConditionInput: ".o_tree_editor_complex_condition input",
};

const CHILD_SELECTOR = ["connector", "condition", "complexCondition"]
    .map((k) => SELECTORS[k])
    .join(",");

export function getTreeEditorContent(options = {}) {
    const content = [];
    const nodes = queryAll(SELECTORS.node);
    const mapping = new Map();
    for (const node of nodes) {
        const parent = node.parentElement.closest(SELECTORS.node);
        const level = parent ? mapping.get(parent) + 1 : 0;
        mapping.set(node, level);
        const nodeValue = { level };
        const associatedNode = node.querySelector(CHILD_SELECTOR);
        const className = associatedNode.className;
        if (className.includes("connector")) {
            nodeValue.value = getCurrentConnector(0, node);
        } else if (className.includes("complex_condition")) {
            nodeValue.value = getCurrentComplexCondition(0, node);
        } else {
            nodeValue.value = getCurrentCondition(0, node);
        }
        if (options.node) {
            nodeValue.node = node;
        }
        content.push(nodeValue);
    }
    return content;
}

export function get(selector, index = 0, target = document) {
    return queryAll(selector, { root: target }).at(index);
}

function getValue(target) {
    if (target) {
        const el = queryOne("input,select,span:not(.o_tag)", { root: target });
        switch (el.tagName) {
            case "INPUT":
                return el.value;
            case "SELECT":
                return el.options[el.selectedIndex].label;
            case "SPAN":
                return el.innerText;
        }
    }
}

export function getCurrentPath(index = 0, target = document) {
    const pathEditor = get(SELECTORS.pathEditor, index, target);
    if (pathEditor) {
        if (pathEditor.querySelector(".o_model_field_selector")) {
            return getModelFieldSelectorValues(pathEditor).join(" > ");
        }
        return pathEditor.textContent;
    }
}

export function getCurrentOperator(index = 0, target = document) {
    const operatorEditor = get(SELECTORS.operatorEditor, index, target);
    return getValue(operatorEditor);
}

export function getCurrentValue(index = 0, target = document) {
    const valueEditor = get(SELECTORS.valueEditor, index, target);
    const value = getValue(valueEditor);
    if (valueEditor) {
        const tags = queryAll(".o_tag", { root: valueEditor });
        if (tags.length) {
            let text = `${tags.map((t) => t.innerText).join(" ")}`;
            if (value) {
                text += ` ${value}`;
            }
            return text;
        }
    }
    return value;
}

export function getOperatorOptions(index = 0, target = document) {
    const el = get(SELECTORS.operatorEditor, index, target);
    if (el) {
        const select = queryOne("select", { root: el });
        return [...select.options].map((o) => o.label);
    }
}

export function getValueOptions(index = 0, target = document) {
    const el = get(SELECTORS.valueEditor, index, target);
    if (el) {
        const select = queryOne("select", { root: el });
        return [...select.options].map((o) => o.label);
    }
}

function getCurrentComplexCondition(index = 0, target = document) {
    const input = get(SELECTORS.complexConditionInput, index, target);
    return input?.value;
}

export function getConditionText(index = 0, target = document) {
    const condition = get(SELECTORS.condition, index, target);
    if (condition) {
        const texts = [];
        for (const t of Array.from(condition.childNodes).map((n) => n.textContent)) {
            const t2 = t.trim();
            if (t2) {
                texts.push(t2);
            }
        }
        return texts.join(" ");
    }
}

function getCurrentCondition(index = 0, target = document) {
    const values = [getCurrentPath(index, target), getCurrentOperator(index, target)];
    const valueEditor = get(SELECTORS.valueEditor, index, target);
    if (valueEditor) {
        values.push(getCurrentValue(index, target));
    }
    return values;
}

function getCurrentConnector(index = 0, target = document) {
    const connector = get(
        `${SELECTORS.connector} .dropdown-toggle, ${SELECTORS.connector} > span:nth-child(2), ${SELECTORS.connector} > span > strong`,
        index,
        target
    );
    return connector?.textContent.search("all") >= 0 ? "all" : connector?.textContent;
}

////////////////////////////////////////////////////////////////////////////////

export function isNotSupportedPath(index = 0, target = document) {
    const pathEditor = get(SELECTORS.pathEditor, index, target);
    return Boolean(queryOne(SELECTORS.clearNotSupported, { root: pathEditor }));
}

export function isNotSupportedOperator(index = 0, target = document) {
    const operatorEditor = get(SELECTORS.operatorEditor, index, target);
    return Boolean(queryOne(SELECTORS.clearNotSupported, { root: operatorEditor }));
}

export function isNotSupportedValue(index = 0, target = document) {
    const valueEditor = get(SELECTORS.valueEditor, index, target);
    return Boolean(queryOne(SELECTORS.clearNotSupported, { root: valueEditor }));
}

////////////////////////////////////////////////////////////////////////////////

export async function selectOperator(operator, index = 0, target = document) {
    await contains(get(SELECTORS.operatorEditor + " select", index, target)).select(
        JSON.stringify(operator)
    );
}

export async function selectValue(value, index = 0, target = document) {
    await contains(get(SELECTORS.valueEditor + " select", index, target)).select(
        JSON.stringify(value)
    );
}

export async function editValue(value, options = {}, index = 0, target = document) {
    await contains(get(SELECTORS.valueEditor + " input", index, target)).edit(value, options);
}

export async function clickOnButtonAddNewRule(index = 0, target = document) {
    await contains(get(SELECTORS.buttonAddNewRule, index, target)).click();
}

export async function clickOnButtonAddBranch(index = 0, target = document) {
    await contains(get(SELECTORS.buttonAddBranch, index, target)).click();
}

export async function clickOnButtonDeleteNode(index = 0, target = document) {
    await contains(get(SELECTORS.buttonDeleteNode, index, target)).click();
}

export async function clearNotSupported(index = 0, target = document) {
    await contains(get(SELECTORS.clearNotSupported, index, target)).click();
}

export async function addNewRule() {
    await contains(SELECTORS.addNewRule).click();
}

export async function toggleArchive() {
    await contains(SELECTORS.toggleArchive).click();
}

////////////////////////////////////////////////////////////////////////////////

export async function openModelFieldSelectorPopover(index = 0) {
    await contains(queryAll(".o_model_field_selector")[index]).click();
}

export function getModelFieldSelectorValues(target = document) {
    return queryAll("span.o_model_field_selector_chain_part", { root: target }).map(
        (n) => n.textContent
    );
}

export function getDisplayedFieldNames() {
    return queryAllTexts(".o_model_field_selector_popover_item_name");
}

export function getTitle() {
    return queryOne(".o_model_field_selector_popover .o_model_field_selector_popover_title")
        .innerText;
}

export async function clickPrev() {
    await contains(".o_model_field_selector_popover_prev_page").click();
}

export async function followRelation(index = 0) {
    await contains(queryAll(".o_model_field_selector_popover_item_relation")[index]).click();
}

export function getFocusedFieldName() {
    return queryOne(".o_model_field_selector_popover_item.active").innerText;
}
