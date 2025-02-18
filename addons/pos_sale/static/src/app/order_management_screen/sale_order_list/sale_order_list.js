/** @odoo-module */

import { Component, useState } from "@odoo/owl";
import { SaleOrderRow } from "@pos_sale/app/order_management_screen/sale_order_row/sale_order_row";
import { useService } from "@web/core/utils/hooks";

/**
 * @props {models.Order} [initHighlightedOrder] initially highligted order
 * @props {Array<models.Order>} orders
 */
export class SaleOrderList extends Component {
    static components = { SaleOrderRow };
    static template = "pos_sale.SaleOrderList";
    static props = {
        initHighlightedOrder: [Object, { value: null }],
        orders: Array,
        onClickSaleOrder: Function,
    };

    setup() {
        this.ui = useState(useService("ui"));
        this.state = useState({ highlightedOrder: this.props.initHighlightedOrder || null });
    }
    get highlightedOrder() {
        return this.state.highlightedOrder;
    }
}
