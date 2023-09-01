import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import verifyEmail from '@salesforce/apex/ProductController.verifyEmail';

export default class EmailVerfy extends LightningElement {
    @api leadId;
    @api email;

    @track email = this.email;

    verificationCode = '';

    handleEmailChange(event) {
        this.email = event.target.value;
    }

    handleVerificationCodeChange(event) {
        this.verificationCode = event.target.value;
    }

    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleVerifyEmail() {
        verifyEmail({ verificationCode: this.verificationCode, leadId: this.leadId, email: this.email })
            .then(result => {
            if (result) {
                this.showToast('Success', 'Email verified', 'success');
                
                this.dispatchEvent(new CustomEvent('emailverified', {
                detail: { result }
            }));
            } else {
                this.showToast('Error', 'Invalid verification code', 'error');
            }
            })
            .catch(error => {
            console.error('Error verifying email:', error);
            this.showToast('Error', 'An error occurred while verifying email', 'error');
            });
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
        title: title,
        message: message,
        variant: variant
        });
        this.dispatchEvent(event);
    }
}