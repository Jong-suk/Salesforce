import { LightningElement, wire, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getProductsData from '@salesforce/apex/ProductController.getProductsData';
import getCategoryPicklistValues from '@salesforce/apex/ProductController.getCategoryPicklistValues';
import addToCart from '@salesforce/apex/ProductController.addToCart';
import convertLeadToAccountAndContact from '@salesforce/apex/ProductController.convertLeadToAccountAndContact';
import createOpp from '@salesforce/apex/ProductController.createOpp';

const PAGE_SIZE = 3;

export default class Products extends LightningElement {
  @track searchTerm = '';
  @track categoryFilter = '';
  @track products = [];
  @track categoryOptions = [];
  @track cartItemCount = 0;
  @track quantityChecker;

  @track currentPage = 1;
  @track totalRecords = 0;
  @track totalPages = 0;

  @api accountRecordId='';
  @api contactRecordId='';
  @track opportunityRecordId='';
  @track leadId; 
  @api orderId;

  @track isLoggedIn = false;
  @track username;
  @track eUserId='';
  @track email;
  @track isProfileDropdownOpen = false;

  @track showEmailVerificationPage = false;
  @track showRegistrationForm = false;
  @track showLoginButton = true;
  @track showCartButton = false;
  @track showCartPage = false;
  @track showOrderButton = false;
  @track showOrderPage = false;

  @wire(getCategoryPicklistValues)
  wiredCategoryPicklist({ data, error }) {
    if (data) {
      this.categoryOptions = [{ label: 'All Categories', value: '' }, ...data.map(category => ({ label: category, value: category }))];
    } else if (error) {
      console.error('Error fetching category picklist values:', error);
    }
  }

  handleSearch(event) {
    this.searchTerm = event.target.value;
  }

  handleCategoryFilter(event) {
    this.categoryFilter = event.target.value;
    this.currentPage = 1;
  }

  @wire(getProductsData, { searchTerm: '$searchTerm', categoryFilter: '$categoryFilter' })
  wiredProductsData({ data, error }) {
    if (data) {
      this.products = data;
      this.totalRecords = data ? data.length : 0;
      this.totalPages = Math.ceil(this.totalRecords / PAGE_SIZE);
    } else if (error) {
      console.error('Error fetching products data:', error);
    }
  }

  toggleProfileDropdown() {
    this.isProfileDropdownOpen = !this.isProfileDropdownOpen;
  }

  get filteredProducts() {
    let filteredProducts = [];

    if (this.categoryFilter === '') {
      filteredProducts = this.products;
    } else {
      filteredProducts = this.products.filter(product => product.Family === this.categoryFilter);
    }

    const start = (this.currentPage - 1) * PAGE_SIZE;
    const end = this.currentPage * PAGE_SIZE;

    return filteredProducts.slice(start, end);
  }

   get isPreviousDisabled() {
    return this.currentPage === 1;
  }

  get isNextDisabled() {
    return this.currentPage === this.totalPages;
  }

  handlePreviousPage() {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  handleNextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }
  
  //Registeration Block
  get registrationFormClass() {
    return this.showRegistrationForm ? 'registration-form-overlay show' : 'registration-form-overlay';
  }

  toggleRegistrationForm() {
    if (this.isLoggedIn) {
      this.isLoggedIn = false;
      this.username = '';
    } else {
      this.showRegistrationForm = !this.showRegistrationForm;
    }
  }

  handleRegistrationComplete(event) {
    this.showRegistrationForm = false;
    this.showLoginButton = false;
    this.leadId = event.detail.leadId;
    this.isLoggedIn = true;
    this.username = event.detail.username;
    this.email = event.detail.email;
    this.eUserId = event.detail.eUserId;
    console.log('eUserId: ', event.detail.eUserId);
    this.showEmailVerificationPage = true;
  }

  handleLoginComplete(event){
    this.showRegistrationForm = false;
    this.showLoginButton = false;
    this.isLoggedIn = true;
    this.username = event.detail.username;
    this.eUserId = event.detail.eUserId;
    console.log('eUserId: ', this.eUserId);
    this.createOpp(this.eUserId);
  }

  async createOpp(eUserId){
    try{
      this.opportunityRecordId = await createOpp({ EUserId: eUserId });
    } catch (error) {
      console.error('Error getting oppId:', error);
    }
  }

  handleEmailVerificationComplete(event) {
    const emailVerified = event.detail.result;
    if(emailVerified){ 
      this.showEmailVerificationPage = false;
      this.convertLeadToAccountAndContact();
    }
  }

  handleAddToCart(event) {
    if (this.isLoggedIn) {
        this.showCartButton = true;
        const productId = event.target.dataset.productId;
        const selectedProduct = this.products.find(product => product.Id === productId);
        if (selectedProduct.Quantity__c > 0) {
            this.addToCart(selectedProduct.Id);
        } else {
            const toastEvent = new ShowToastEvent({
                title: 'Error',
                message: 'Product is out of stock. Cannot add to cart.',
                variant: 'error'
            });
            this.dispatchEvent(toastEvent);
        }
    } else {
        const toastEvent = new ShowToastEvent({
            title: 'Error',
            message: 'Please log in to add products to cart.',
            variant: 'error'
        });
        this.dispatchEvent(toastEvent);
    }
  }

  quantityChecker(event) {
    const productId = event.target.dataset.productId;
    const selectedProduct = this.products.find(product => product.Id === productId);
    return selectedProduct.Quantity__c <= 0;
  }   

  async convertLeadToAccountAndContact() {
    try {
      console.log('EUserId in convert: ', this.eUserId);
      const result = await convertLeadToAccountAndContact({ leadId: this.leadId, eUserId: this.eUserId });
      this.accountRecordId = result.accountId;
      this.contactRecordId = result.contactId;
      this.opportunityRecordId = result.opportunityId;

      /*const toastEvent = new ShowToastEvent({
        title: 'Success',
        message: 'Lead successfully converted to Account, Contact, and Opportunity',
        variant: 'success'
      });
      this.dispatchEvent(toastEvent);*/

      await refreshApex(this.wiredProductsData);
    } catch (error) {
      console.error('Error converting lead:', error);
    }
  }

  async addToCart(selectedProduct) {
    try {
      await addToCart({ oppsId: this.opportunityRecordId, Pro2Id: selectedProduct });
      this.cartItemCount++;

      const toastEvent = new ShowToastEvent({
        title: 'Success',
        message: 'Product added to cart.',
        variant: 'success'
      });
      this.dispatchEvent(toastEvent);
    } catch (error) {
      console.error('Error adding product to cart:', error);
    }
  }

  openCartPage() {
    this.showCartPage = true;
  }

  openOrderPage() {
    this.showOrderPage = true;
  }

  handleOrderButton(event) {
    this.showCartPage = false;
    this.showOrderButton = true;
    this.orderId = event.detail.orderId;
  }

  handleClose() {
    this.showRegistrationForm = false;
    this.showEmailVerificationPage = false;
    this.showCartPage = false;
    this.showOrderPage = false;
  }
}