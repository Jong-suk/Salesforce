import { LightningElement, api, wire, track } from 'lwc';
import getOrders from '@salesforce/apex/OrderController.getOrders';

const columns = [
    { label: 'Order Number', fieldName: 'OrderNumber', type: 'text' },
    { label: 'Status', fieldName: 'Status', type: 'text' },
    { label: 'Effective Date', fieldName: 'EffectiveDate', type: 'date' },
    { label: 'Account Name', fieldName: 'AccountName', type: 'text' },
    { label: 'Total Amount', fieldName: 'TotalAmount', type: 'currency', typeAttributes: { currencyCode: 'INR' } },
    { type: 'action', typeAttributes: { rowActions: [{ label: 'Check Details', name: 'view_details' }] } }
];

export default class OrderTable extends LightningElement {
    @api eUserId;
    @track orders;

    @wire(getOrders, { eUserId: '$eUserId' })
    wiredOrders({ error, data }) {
        if (data) {
            this.orders = data;
        } else if (error) {
            console.error('Error fetching orders:', error);
        }
    }

    columns = columns;

    handleRowAction(event) {
        const action = event.detail.action;
        const row = event.detail.row;
        if (action.name === 'view_details') {
            this.dispatchEvent(new CustomEvent('orderselected', { detail: row.Id }));
        }
    }
}