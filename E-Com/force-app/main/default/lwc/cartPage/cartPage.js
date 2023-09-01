import { LightningElement, api, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getOppsProduct from '@salesforce/apex/CartController.getOppsProduct';
import createOrder from '@salesforce/apex/CartController.createOrder';
import sendEmailAfterOrder from '@salesforce/apex/CartController.sendEmailAfterOrder';

export default class CartPage extends LightningElement {
    @api opportunityRecordId;
    @api eUserId;
    @api leadId;
    @api cartItems = [];
    @track error;
    @track leadId;
    @api orderId;

    @track tableColumns = [
      {label: 'Product Name', fieldName: 'Name', type: 'text'},
      {label: 'Category', fieldName: 'Category', type: 'text'},
      {label: 'Unit Price', fieldName: 'UnitPrice', type: 'text'},
      {label: 'Quantity', fieldName: 'Quantity', type: 'text'},
      {label: 'Total Price', fieldName: 'TotalPrice', type: 'text'},
    ];

    handleClose() {
        // Dispatch an event to notify parent components to close the Cart component
        this.dispatchEvent(new CustomEvent('close'));
    }

    // Load the cart items
    @wire(getOppsProduct, { OppsId: '$opportunityRecordId' })
    wiredOpportunityLineItems({ data, error }) {
        if (data) {
            this.cartItems = data.map(result => ({
            Id: result.Id,
            Name: result.Product2.Name,
            Category: result.Product2.Family,
            UnitPrice: result.UnitPrice,
            Product2Id: result.Product2Id,
            Quantity: result.Quantity,
            TotalPrice: result.TotalPrice,
            Opportunity: result.OpportunityId
          })); 
        } else if (error) {
            console.error('Error while loading cart items:', error);
            /*const toastEvent = new ShowToastEvent({
                title: 'Error',
                message: 'An error occurred while loading cart items',
                variant: 'error'
            });
            this.dispatchEvent(toastEvent); */
        }
    }

    get totalPrice() {
        let total = 0;
        this.cartItems.forEach(item => {
            total += parseFloat(item.UnitPrice * item.Quantity);
        });
        return '₹' + total.toFixed(2);
    }

    handleCheckout() {
        createOrder({ oppsLineItems: this.cartItems, OppsId: this.opportunityRecordId, LeadId: this.leadId, eUserId: this.eUserId })
        .then(result => {
            this.orderId = result;
            /*const toastEvent = new ShowToastEvent({
                title: 'Success',
                message: 'Order created successfully',
                variant: 'success'
            });
            this.dispatchEvent(toastEvent);*/
            console.log('OrderId:', result);
            sendEmailAfterOrder({ orderId: this.orderId });
            this.cartItems = [];
            const orderCreatedEvent = new CustomEvent('ordercreated', {
                detail: { orderId: this.orderId } 
            });
            this.dispatchEvent(orderCreatedEvent);
            //this.cartItems = [];

            //this.dispatchEvent(new CustomEvent('checkout'));
        })
        .catch(error => {
            console.error('Error creating order:', error);
            const toastEvent = new ShowToastEvent({
                title: 'Error',
                message: error,
                variant: 'error'
            });
            this.dispatchEvent(toastEvent);
        });
    }
}