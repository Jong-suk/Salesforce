import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { createRecord } from 'lightning/uiRecordApi';
//import setUserPassword from '@salesforce/apex/UserManagementController.setUserPassword';
import signupLogin from '@salesforce/apex/SignupLoginController.signupLogin';
import login from '@salesforce/apex/SignupLoginController.login';
import sendVerificationEmail from '@salesforce/apex/SignupLoginController.sendVerificationEmail';
import LEAD_OBJECT from '@salesforce/schema/Lead';
//import USER_OBJECT from '@salesforce/schema/User';
import FIRST_NAME_FIELD from '@salesforce/schema/Lead.FirstName';
import LAST_NAME_FIELD from '@salesforce/schema/Lead.LastName';
import COMPANY_FIELD from '@salesforce/schema/Lead.Company';
import EMAIL_FIELD from '@salesforce/schema/Lead.Email';
import PHONE_FIELD from '@salesforce/schema/Lead.Phone';

const VERIFICATION_CODE_LENGTH = 6;

export default class SignInLogin extends LightningElement {
  @track firstName = '';
  @track lastName = '';
  @track company = '';
  @track email = '';
  @track phone = '';

  @track showLogin = true;
  @track showSignUp = false;
  @track newUsername = '';
  @track newPassword = '';
  @track savedUsername = '';
  @track savedPassword = '';

  handleLoginOption() {
    this.showLogin = true;
    this.showSignUp = false;
  }

  handleSignUpOption() {
    this.showSignUp = true;
    this.showLogin = false;
  }

  get isLoginActive() {
    return this.showLogin ? 'login active' : '';  
  }

  get isSignupActive() {
    return this.showSignUp ? 'signup active' : '';  
  }

  handleNewUsernameChange(event) {
    this.newUsername = event.target.value;
  }

  handleNewPasswordChange(event) {
    this.newPassword = event.target.value;
  }

  handleSavedUsernameChange(event) {
    this.savedUsername = event.target.value;
  }

  handleSavedPasswordChange(event) {
    this.savedPassword = event.target.value;
  }

  handleClose() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  handleFirstNameChange(event) {
    this.firstName = event.target.value;
  }

  handleLastNameChange(event) {
    this.lastName = event.target.value;
  }

  handleCompanyChange(event) {
    this.company = event.target.value;
  }

  handleEmailChange(event) {
    this.email = event.target.value;
  }

  handlePhoneChange(event) {
    this.phone = event.target.value;
  }

  handleSignUp() {
    const username = this.newUsername;

    const email = this.email;

    const signUpData = {
      Username: this.newUsername,
      FirstName: this.firstName,
      LastName: this.lastName,
      Email: this.email,
      Password: this.newPassword
    };

    const generatedCode = this.generateVerificationCode();

    signupLogin({ signUpData: signUpData, isSignup: true })
    .then(result => {
        const eUserId = result;
        console.log('Signup\'s E-UserId: ', eUserId);
        const event = new ShowToastEvent({
          title: 'Success',
          message: 'Sign-in successful',
          variant: 'success',
        });
        this.dispatchEvent(event);

        const fields = {};
        fields[FIRST_NAME_FIELD.fieldApiName] = this.firstName;
        fields[LAST_NAME_FIELD.fieldApiName] = this.lastName;
        fields[COMPANY_FIELD.fieldApiName] = this.company;
        fields[EMAIL_FIELD.fieldApiName] = this.email;
        fields[PHONE_FIELD.fieldApiName] = this.phone;

        const recordInput = { apiName: LEAD_OBJECT.objectApiName, fields };

        createRecord(recordInput)
          .then((result) => {
            if (result && result.id) {
              const leadId = result.id;

              this.firstName = '';
              this.lastName = '';
              this.company = '';
              this.email = '';
              this.phone = '';

              this.dispatchEvent(new CustomEvent('registrationcomplete', {
                detail: { leadId: leadId, username: username, email: email, generatedCode: generatedCode, eUserId: eUserId }
              }));

                sendVerificationEmail({ leadId: leadId, generatedCode: generatedCode })
                .then(resultEmail => {
                  if(resultEmail){
                    const event = new ShowToastEvent({
                      title: 'Success',
                      message: 'Email Sent',
                      variant: 'success',
                    });
                    this.dispatchEvent(event);
                  } else {
                    const event = new ShowToastEvent({
                      title: 'Error',
                      message: 'Invalid Email',
                      variant: 'error',
                    });
                    this.dispatchEvent(event);
                  }
                })
                .catch((error) => {
                  console.error(error);
                })
            } else{
              console.error('Error creating Lead: Empty result');
            }
          })
          .catch((error) => {
            const toastEvent = new ShowToastEvent({
                title: 'Error',
                message: error.message,
                variant: 'error'
            });
            this.dispatchEvent(toastEvent);
          });
            
          this.newUsername = '';
          this.newPassword = '';          
        })
    .catch(error => {
      console.error(error);
        const toastEvent = new ShowToastEvent({
            title: 'Error',
            message: error.body.message,
            variant: 'error'
        });
        this.dispatchEvent(toastEvent);
    });

    this.sendVerificationEmail();
  }
  

  generateVerificationCode() {
      // Generate a random integer with specified length
      const min = Math.pow(10, VERIFICATION_CODE_LENGTH - 1);
      const max = Math.pow(10, VERIFICATION_CODE_LENGTH) - 1;
      return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  handleLogin() {
    const username = this.savedUsername;
    login({ username: this.savedUsername, password: this.savedPassword})
    .then(result => {
      console.log('(Sign in): ', result);
      if(result.Success === true){
      const eUserId = result.EUserId;
      //this.eUserId = result.EUserId;
        const event = new ShowToastEvent({
          title: 'Success',
          message: 'Login successful',
          variant: 'success',
        });
        this.dispatchEvent(event);

        this.dispatchEvent(new CustomEvent('logincomplete', {
          detail: {username: username, eUserId: eUserId}
        }));

        this.savedUsername = '';
        this.savedPassword = '';
      }
    })
    .catch(error => {
      const event = new ShowToastEvent({
        title: 'Error',
        message: 'Invalid username or password',
        variant: 'error',
      });
      this.dispatchEvent(event);
    });
  }
}