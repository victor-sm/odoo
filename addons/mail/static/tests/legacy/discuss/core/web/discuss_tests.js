/** @odoo-module alias=@mail/../tests/discuss/core/web/discuss_tests default=false */

import { startServer } from "@bus/../tests/helpers/mock_python_environment";

import { start } from "@mail/../tests/helpers/test_utils";

import { triggerHotkey } from "@web/../tests/helpers/utils";
import { assertSteps, click, contains, insertText, step } from "@web/../tests/utils";

QUnit.module("discuss");

QUnit.test("can create a new channel [REQUIRE FOCUS]", async () => {
    const pyEnv = await startServer();
    const { openDiscuss } = await start({
        mockRPC(route, params) {
            if (
                route.startsWith("/mail") ||
                route.startsWith("/discuss") ||
                [
                    "/web/dataset/call_kw/discuss.channel/search_read",
                    "/web/dataset/call_kw/discuss.channel/channel_create",
                ].includes(route)
            ) {
                step(`${route} - ${JSON.stringify(params)}`);
            }
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
    await openDiscuss();
    await assertSteps([
        `/mail/data - ${JSON.stringify({
            channels_as_member: true,
            context: { lang: "en", tz: "taht", uid: pyEnv.currentUserId },
        })}`,
        '/mail/inbox/messages - {"limit":30}',
    ]);
    await click(".o-mail-DiscussSidebar i[title='Add or join a channel']");
    await contains(".o-mail-DiscussSidebarChannel", { count: 0 });
    await insertText(".o-discuss-ChannelSelector input", "abc");
    await assertSteps([
        `/web/dataset/call_kw/discuss.channel/search_read - ${JSON.stringify({
            model: "discuss.channel",
            method: "search_read",
            args: [],
            kwargs: {
                limit: 10,
                domain: [
                    ["channel_type", "=", "channel"],
                    ["name", "ilike", "abc"],
                ],
                fields: ["name"],
                context: { lang: "en", tz: "taht", uid: pyEnv.currentUserId },
            },
        })}`,
    ]);
    await click(".o-discuss-ChannelSelector-suggestion");
    await contains(".o-mail-DiscussSidebarChannel");
    await contains(".o-mail-Discuss-content .o-mail-Message", { count: 0 });
    const channelId = pyEnv["discuss.channel"].search([["name", "=", "abc"]]);
    await assertSteps([
        `/web/dataset/call_kw/discuss.channel/channel_create - ${JSON.stringify({
            model: "discuss.channel",
            method: "channel_create",
            args: ["abc", null],
            kwargs: { context: { lang: "en", tz: "taht", uid: pyEnv.currentUserId } },
        })}`,
        `/discuss/channel/messages - {"channel_id":${channelId},"limit":30}`,
    ]);
});

QUnit.test(
    "do not close channel selector when creating chat conversation after selection",
    async () => {
        const pyEnv = await startServer();
        const partnerId = pyEnv["res.partner"].create({ name: "Mario" });
        pyEnv["res.users"].create({ partner_id: partnerId });
        const { openDiscuss } = await start();
        await openDiscuss();
        await click("i[title='Start a conversation']");
        await insertText(".o-discuss-ChannelSelector input", "mario");
        await click(".o-discuss-ChannelSelector-suggestion");
        await contains(".o-discuss-ChannelSelector span[title='Mario']");
        await contains(".o-mail-DiscussSidebarChannel", { count: 0 });
        triggerHotkey("Backspace");
        await contains(".o-discuss-ChannelSelector span[title='Mario']", { count: 0 });
        await insertText(".o-discuss-ChannelSelector input", "mario");
        await contains(".o-discuss-ChannelSelector-suggestion");
        triggerHotkey("Enter");
        await contains(".o-discuss-ChannelSelector span[title='Mario']");
        await contains(".o-mail-DiscussSidebarChannel", { count: 0 });
    }
);

QUnit.test("can join a chat conversation", async (assert) => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({ name: "Mario" });
    pyEnv["res.users"].create({ partner_id: partnerId });
    const { openDiscuss } = await start({
        mockRPC(route, params) {
            if (
                route.startsWith("/mail") ||
                route.startsWith("/discuss") ||
                ["/web/dataset/call_kw/discuss.channel/channel_get"].includes(route)
            ) {
                step(`${route} - ${JSON.stringify(params)}`);
            }
            if (route === "/web/dataset/call_kw/discuss.channel/channel_get") {
                assert.equal(params.kwargs.partners_to[0], partnerId);
            }
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
    await openDiscuss();
    await assertSteps([
        `/mail/data - ${JSON.stringify({
            channels_as_member: true,
            context: { lang: "en", tz: "taht", uid: pyEnv.currentUserId },
        })}`,
        '/mail/inbox/messages - {"limit":30}',
    ]);
    await click(".o-mail-DiscussSidebar i[title='Start a conversation']");
    await contains(".o-mail-DiscussSidebarChannel", { count: 0 });
    await insertText(".o-discuss-ChannelSelector input", "mario");
    await click(".o-discuss-ChannelSelector-suggestion");
    await contains(".o-discuss-ChannelSelector-suggestion", { count: 0 });
    triggerHotkey("Enter");
    await assertSteps([
        `/web/dataset/call_kw/discuss.channel/channel_get - ${JSON.stringify({
            model: "discuss.channel",
            method: "channel_get",
            args: [],
            kwargs: {
                partners_to: [partnerId],
                force_open: false,
                context: { lang: "en", tz: "taht", uid: pyEnv.currentUserId },
            },
        })}`,
    ]);
    await contains(".o-mail-DiscussSidebarChannel");
    await contains(".o-mail-Message", { count: 0 });
    const channelId = pyEnv["discuss.channel"].search([["name", "=", "Mitchell Admin, Mario"]]);
    await assertSteps([`/discuss/channel/messages - {"channel_id":${channelId},"limit":30}`]);
});

QUnit.test("can create a group chat conversation", async () => {
    const pyEnv = await startServer();
    const [partnerId_1, partnerId_2] = pyEnv["res.partner"].create([
        { name: "Mario" },
        { name: "Luigi" },
    ]);
    pyEnv["res.users"].create([{ partner_id: partnerId_1 }, { partner_id: partnerId_2 }]);
    const { openDiscuss } = await start();
    await openDiscuss();
    await click(".o-mail-DiscussSidebar i[title='Start a conversation']");
    await contains(".o-mail-DiscussSidebarChannel", { count: 0 });
    await insertText(".o-discuss-ChannelSelector input", "Mario");
    await click(".o-discuss-ChannelSelector-suggestion");
    await contains(".o-discuss-ChannelSelector-suggestion", { count: 0 });
    await insertText(".o-discuss-ChannelSelector input", "Luigi");
    await click(".o-discuss-ChannelSelector-suggestion");
    await contains(".o-discuss-ChannelSelector-suggestion", { count: 0 });
    triggerHotkey("Enter");
    await contains(".o-mail-DiscussSidebarChannel");
    await contains(".o-mail-Message", { count: 0 });
});

QUnit.test("should create DM chat when adding self and another user", async () => {
    const pyEnv = await startServer();
    const partner_id = pyEnv["res.partner"].create([{ name: "Mario", im_status: "online" }]);
    pyEnv["res.users"].create({ partner_id });
    const { openDiscuss } = await start();
    await openDiscuss();
    await click(".o-mail-DiscussSidebar i[title='Start a conversation']");
    await contains(".o-mail-DiscussSidebarChannel", { count: 0 });
    await insertText(".o-discuss-ChannelSelector input", "Mi"); // Mitchell Admin
    await click(".o-discuss-ChannelSelector-suggestion");
    await contains(".o-discuss-ChannelSelector-suggestion", { count: 0 });
    await insertText(".o-discuss-ChannelSelector input", "Mario");
    await click(".o-discuss-ChannelSelector-suggestion");
    await contains(".o-discuss-ChannelSelector-suggestion", { count: 0 });
    triggerHotkey("Enter");
    await contains(".o-mail-DiscussSidebarChannel", { text: "Mario" });
});

QUnit.test("chat search should display no result when no matches found", async () => {
    const { openDiscuss } = await start();
    await openDiscuss();
    await click(".o-mail-DiscussSidebar i[title='Start a conversation']");
    await insertText(".o-discuss-ChannelSelector input", "Rainbow Panda");
    await contains(".o-discuss-ChannelSelector-suggestion", { text: "No results found" });
});

QUnit.test("chat search should not be visible when clicking outside of the field", async () => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({ name: "Panda" });
    pyEnv["res.users"].create({ partner_id: partnerId });
    const { openDiscuss } = await start();
    await openDiscuss();
    await click(".o-mail-DiscussSidebar i[title='Start a conversation']");
    await insertText(".o-discuss-ChannelSelector input", "Panda");
    await contains(".o-discuss-ChannelSelector-suggestion");
    await click(".o-mail-DiscussSidebar");
    await contains(".o-discuss-ChannelSelector-suggestion", { count: 0 });
});

QUnit.test("sidebar: add channel", async (assert) => {
    const { openDiscuss } = await start();
    await openDiscuss();
    await contains(".o-mail-DiscussSidebarCategory-channel .o-mail-DiscussSidebarCategory-add");
    assert.hasAttrValue(
        $(".o-mail-DiscussSidebarCategory-channel .o-mail-DiscussSidebarCategory-add")[0],
        "title",
        "Add or join a channel"
    );
    await click(".o-mail-DiscussSidebarCategory-channel .o-mail-DiscussSidebarCategory-add");
    await contains(".o-discuss-ChannelSelector");
    await contains(".o-discuss-ChannelSelector input[placeholder='Add or join a channel']");
});

QUnit.test("Chat is added to discuss on other tab that the one that joined", async () => {
    const pyEnv = await startServer();
    const partnerId = pyEnv["res.partner"].create({ name: "Jerry Golay" });
    pyEnv["res.users"].create({ partner_id: partnerId });
    const tab1 = await start({ asTab: true });
    const tab2 = await start({ asTab: true });
    tab1.openDiscuss();
    tab2.openDiscuss();
    await click(".o-mail-DiscussSidebarCategory-chat .o-mail-DiscussSidebarCategory-add", {
        target: tab1.target,
    });
    await insertText(".o-discuss-ChannelSelector input", "Jer", { target: tab1.target });
    await click(".o-discuss-ChannelSelector-suggestion", { target: tab1.target });
    triggerHotkey("Enter");
    await contains(".o-mail-DiscussSidebarChannel", { target: tab1.target, text: "Jerry Golay" });
    await contains(".o-mail-DiscussSidebarChannel", { target: tab2.target, text: "Jerry Golay" });
});

QUnit.test("no conversation selected when opening non-existing channel in discuss", async () => {
    await startServer();
    const { openDiscuss } = await start();
    await openDiscuss(200); // non-existing id
    await contains("h4", { text: "No conversation selected." });
    await contains(".o-mail-DiscussSidebarCategory-channel .oi-chevron-down");
    await click(".o-mail-DiscussSidebar .btn", { text: "Channels" }); // check no crash
    await contains(".o-mail-DiscussSidebarCategory-channel .oi-chevron-right");
});
