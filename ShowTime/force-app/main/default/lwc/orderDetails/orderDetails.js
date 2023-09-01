import { LightningElement, api, wire, track } from 'lwc';
import getOrderDetails from '@salesforce/apex/OrderController.getOrderDetails';

const orderItemColumns = [
    { label: 'Product Name', fieldName: 'Name', type: 'text', wrapText: true },
    { label: 'Quantity', fieldName: 'Quantity', type: 'number' },
    { label: 'Unit Price', fieldName: 'UnitPrice', type: 'currency', typeAttributes: { currencyCode: 'INR' } }
];

export default class OrderDetails extends LightningElement {
    @api order_id;
    @track order;
    @track orderItems;
    @track showOrderItems = false;

    orderItemColumns = orderItemColumns;

    @wire(getOrderDetails, { orderId: '$order_id' })
    wiredOrder({ data, error }) {
        if (data) {
            this.order = data.order;
            this.orderItems = this.mapOrderItems(data.orderItems);
        } else if (error) {
            console.error('Error fetching order details:', error);
        }
    }

    mapOrderItems(items) {
        return items.map((item) => {
            return { ...item, Name: item.Product2.Name };
        });
    }

    get buttonLabel() {
        return this.showOrderItems ? 'Hide Order Items' : 'Show Order Items';
    }

    toggleOrderItems() {
        this.showOrderItems = !this.showOrderItems;
    }

    handleBack() {
        this.dispatchEvent(new CustomEvent('close'));
    }
}