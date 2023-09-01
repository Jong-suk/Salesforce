import { LightningElement, api } from 'lwc';

export default class OrderViewer extends LightningElement {
    @api eUserId;
    selectedOrderId;

    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleOrderSelected(event) {
        this.selectedOrderId = event.detail;
    }

    handleCloseDetails() {
        this.selectedOrderId = null;
    }
}