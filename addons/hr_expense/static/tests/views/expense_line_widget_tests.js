/* @odoo-module */

import { startServer } from "@bus/../tests/helpers/mock_python_environment";

import { getOrigin } from "@web/core/utils/urls";
import { assertSteps, click, contains, step } from "@web/../tests/utils";
import { nextTick } from "@web/../tests/helpers/utils";

import { start } from "@mail/../tests/helpers/test_utils";
import { patchUiSize, SIZES } from "@mail/../tests/helpers/patch_ui_size";
import { ROUTES_TO_IGNORE as MAIL_ROUTES_TO_IGNORE } from "@mail/../tests/helpers/webclient_setup";

const ROUTES_TO_IGNORE = [
    "/mail/thread/messages",
    "/web/dataset/call_kw/ir.attachment/register_as_main_attachment",
    "/mail/thread/data",
    ...MAIL_ROUTES_TO_IGNORE,
];

QUnit.module("Views", {}, function () {
    QUnit.module("ExpenseLineWidget");

    const OpenPreparedView = async (size, sheet) => {
        const pyEnv = await startServer();
        const views = {
            "hr.expense.sheet,false,form": `<form>
                    <sheet name="Expenses">
                        <notebook>
                            <page name="expenses" string="Expense">
                                <field name="expense_line_ids" widget="expense_lines_widget">
                                    <tree>
                                        <field name="name"/>
                                        <field name="message_main_attachment_id"/>
                                    </tree>
                                </field>
                            </page>
                        </notebook>
                    </sheet>
                    <div class="o_attachment_preview"/>
                    <div class="oe_chatter">
                        <field name="message_follower_ids"/>
                        <field name="message_ids"/>
                    </div>
                </form>`,
        };
        patchUiSize({ size: size });
        const { openView } = await start({
            serverData: { views },
            mockRPC: function (route, args) {
                if (ROUTES_TO_IGNORE.includes(route)) {
                    return;
                }
                if (route.includes("/web/static/lib/pdfjs/web/viewer.html")) {
                    return Promise.resolve();
                }
                step(`${route} - ${JSON.stringify(args)}`);
            },
        });
        await assertSteps([
            `/mail/action - ${JSON.stringify({
                init_messaging: {},
                failures: true,
                systray_get_activities: true,
                context: { lang: "en", tz: "taht", uid: pyEnv.currentUserId },
            })}`,
        ]);
        await openView({
            res_model: "hr.expense.sheet",
            res_id: sheet,
            views: [[false, "form"]],
        });
    };

    QUnit.test("ExpenseLineWidget test attachments change on expense line click", async () => {
        const pyEnv = await startServer();
        const sheet = pyEnv["hr.expense.sheet"].create({ name: "Expense Sheet" });
        const expense_lines = pyEnv["hr.expense"].create([
            { name: "Lunch", sheet_id: sheet },
            { name: "Taxi", sheet_id: sheet },
            { name: "Misc", sheet_id: sheet },
        ]);
        const attachmentIds = pyEnv["ir.attachment"].create([
            { res_id: expense_lines[0], res_model: "hr.expense", mimetype: "application/pdf" },
            { res_id: expense_lines[0], res_model: "hr.expense", mimetype: "application/pdf" },
            { res_id: expense_lines[1], res_model: "hr.expense", mimetype: "application/pdf" },
            { res_id: expense_lines[1], res_model: "hr.expense", mimetype: "application/pdf" },
        ]);
        pyEnv["hr.expense.sheet"].write([sheet], { expense_line_ids: expense_lines });
        pyEnv["hr.expense"].write([expense_lines[0]], {
            message_main_attachment_id: attachmentIds[1],
        });
        pyEnv["hr.expense"].write([expense_lines[1]], {
            message_main_attachment_id: attachmentIds[2],
        });

        await OpenPreparedView(SIZES.XXL, sheet);

        await contains(".o_data_row", { count: 3 });
        await nextTick();
        await assertSteps([
            `/web/dataset/call_kw/hr.expense.sheet/get_views - ${JSON.stringify({
                model: "hr.expense.sheet",
                method: "get_views",
                args: [],
                kwargs: {
                    context: { lang: "en", tz: "taht", uid: pyEnv.currentUserId },
                    views: [
                        [false, "form"],
                        [false, "search"],
                    ],
                    options: { action_id: false, load_filters: true, toolbar: true },
                },
            })}`,
            `/web/dataset/call_kw/hr.expense.sheet/web_read - ${JSON.stringify({
                model: "hr.expense.sheet",
                method: "web_read",
                args: [[1]],
                kwargs: {
                    context: {
                        lang: "en",
                        tz: "taht",
                        uid: pyEnv.currentUserId,
                        bin_size: true,
                    },
                    specification: {
                        expense_line_ids: {
                            fields: {
                                name: {},
                                message_main_attachment_id: { fields: { display_name: {} } },
                            },
                            limit: 40,
                            order: "",
                        },
                        display_name: {},
                    },
                },
            })}`,
        ]);
        // Default attachment is the last one.
        await contains(
            `.o_attachment_preview iframe[data-src='/web/static/lib/pdfjs/web/viewer.html?file=${encodeURIComponent(
                getOrigin() + "/web/content/4"
            )}#pagemode=none']`
        );
        await click(":nth-child(1 of .o_data_row) :nth-child(1 of .o_data_cell)");
        // Attachment is switched to the main attachment in expense line one.
        await contains(
            `.o_attachment_preview iframe[data-src='/web/static/lib/pdfjs/web/viewer.html?file=${encodeURIComponent(
                getOrigin() + "/web/content/2"
            )}#pagemode=none']`
        );
        await assertSteps([], "no extra rpc should be done");
        // No change since line three has no attachments.
        await click(":nth-child(3 of .o_data_row) :nth-child(1 of .o_data_cell)");
        await contains(
            `.o_attachment_preview iframe[data-src='/web/static/lib/pdfjs/web/viewer.html?file=${encodeURIComponent(
                getOrigin() + "/web/content/2"
            )}#pagemode=none']`
        );
        await assertSteps([], "no extra rpc should be done");
        await click(":nth-child(2 of .o_data_row) :nth-child(1 of .o_data_cell)");
        // Attachment is switched to the main attachment in expense line two.
        await contains(
            `.o_attachment_preview iframe[data-src='/web/static/lib/pdfjs/web/viewer.html?file=${encodeURIComponent(
                getOrigin() + "/web/content/3"
            )}#pagemode=none']`
        );
        await assertSteps([], "no extra rpc should be done");
    });
});
