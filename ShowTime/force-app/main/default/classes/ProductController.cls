public with sharing class ProductController {
    @AuraEnabled(cacheable=true)
    public static List<String> getCategoryPicklistValues() {
        List<String> picklistValues = new List<String>();
        Schema.DescribeFieldResult fieldResult = Product2.Family.getDescribe();
        List<Schema.PicklistEntry> picklistEntries = fieldResult.getPicklistValues();
        for (Schema.PicklistEntry entry : picklistEntries) {
            picklistValues.add(entry.getValue());
        }
        return picklistValues;
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Product2> getProductsData(String searchTerm, String categoryFilter) {
        String searchQuery = 'SELECT Id, Name, Description, Family, Image__c, Quantity__c, Price__c FROM Product2 WHERE Family != Null';
        List<String> searchTerms = new List<String>();
        List<String> categoryFilters = new List<String>();
        
        if (!String.isEmpty(searchTerm)) {
            searchTerms = searchTerm.split(' ');
            for (Integer i = 0; i < searchTerms.size(); i++) {
                searchTerms[i] = '%' + searchTerms[i] + '%';
            }
        }
        if (!String.isEmpty(categoryFilter)) {
            categoryFilters.add(categoryFilter);
        }
        
        if (!searchTerms.isEmpty()) {
            searchQuery += ' AND (Name LIKE :searchTerms OR Description LIKE :searchTerms)';
        }
        if (!categoryFilters.isEmpty()) {
            searchQuery += ' AND Family IN :categoryFilters';
        }
        
        return Database.query(searchQuery);
    }
    
    @AuraEnabled
    public static Boolean verifyEmail(Integer verificationCode, Id leadId, String email) {
        Lead lead = [SELECT Id, Email, verificationCode__c FROM Lead WHERE Id = :leadId LIMIT 1];
        if(email == lead.Email){
            return verificationCode == lead.verificationCode__c;
        } else {
            return false;
        }
    }
    
    @AuraEnabled
    public static convert convertLeadToAccountAndContact(Id leadId, Id eUserId) {
        convert result = new convert();
        Lead lead = [SELECT Id, Company, FirstName, LastName, Email, Phone FROM Lead WHERE Id = :leadId LIMIT 1];
        
        Database.LeadConvert leadConvert = new Database.LeadConvert();
        leadConvert.setLeadId(lead.Id);
        leadConvert.setConvertedStatus('Closed - Converted');
        leadConvert.setDoNotCreateOpportunity(false);
        
        Database.LeadConvertResult convertResult = Database.convertLead(leadConvert);
        
        if (convertResult.isSuccess()) {
            result.accountId = convertResult.getAccountId();
            result.contactId = convertResult.getContactId();
            result.opportunityId = convertResult.getOpportunityId();
        
            /*System.debug('eUserId: ' + eUserId);
            E_User__c eUser = [SELECT Id, Contact__c FROM E_User__c WHERE Id =: eUserId LIMIT 1];
            eUser.Contact__c = convertResult.getContactId();
            System.debug('E-User: ' + eUser);*/
        } else {
            System.debug('Lead conversion failed');
        }
        return result;
    }
    
    public class convert {
        @AuraEnabled public Id accountId { get; set; }
        @AuraEnabled public Id contactId { get; set; }
        @AuraEnabled public Id opportunityId { get; set; }
    }
    
    @AuraEnabled
    public static Id createOpp(Id EUserId) {
        try {
            E_User__c eUser = [SELECT Id, Contact__c, Contact__r.AccountId, Contact__r.Account.Name FROM E_User__c WHERE Id = :eUserId];
            String AId = eUser.Contact__r.AccountId;
            String aName = eUser.Contact__r.Account.Name;
            String CId = eUser.Contact__c;
            
            System.debug('getAccountId: ' + AId);
            System.debug('getAccountName: ' + aName);
            System.debug('getContactId: ' + CId);
            
            List<Opportunity> oppList = [SELECT Id, ContactId__c, StageName FROM Opportunity WHERE ContactId__c =: CId];
            
            for (Opportunity opp : oppList) {
                if (!opp.StageName.equalsIgnoreCase('Closed Won') && !opp.StageName.equalsIgnoreCase('Closed Lost')) {
                    return opp.Id;
                }
            }
            
            Opportunity opp = New Opportunity();
            opp.Name = aName;
            opp.AccountId = AId;
            opp.ContactId__c = CId;
            opp.StageName = 'Prospecting';
            opp.CloseDate = System.today();
            insert opp;
            
            Id oppId = opp.Id;
            
            System.debug('newOppId: ' + oppId);
            
            return oppId;
        } catch (Exception e) {
            System.debug('Error creating Opportunity: ' + e.getMessage());
            throw e; // Optionally re-throw the exception to handle it at the calling side
        }
    }
    
    @AuraEnabled
    public static void addToCart(Id oppsId, Id Pro2Id) {
        OpportunityLineItem existingCartItem = getExistingCartItem(oppsId, Pro2Id);
        PricebookEntry pricebookEntry = [SELECT Id, UnitPrice FROM PricebookEntry WHERE Product2Id = :Pro2Id LIMIT 1];
        Product2 product = [SELECT Id, Quantity__c FROM Product2 WHERE Id = :Pro2Id LIMIT 1];
        
        List<OpportunityLineItem> updateOppsLineItems = new List<OpportunityLineItem>();
        List<OpportunityLineItem> insertOppsLineItems = new List<OpportunityLineItem>(); 
        
        if (existingCartItem != null) {
            existingCartItem.UnitPrice = pricebookEntry.UnitPrice;
            existingCartItem.Quantity += 1;
            updateOppsLineItems.add(existingCartItem);
            
            product.Quantity__c -= 1;
        } else {
            OpportunityLineItem oli = new OpportunityLineItem();
            oli.Product2Id = Pro2Id;
            oli.UnitPrice = pricebookEntry.UnitPrice;
            oli.PricebookEntryId = pricebookEntry.Id;
            oli.Quantity = 1;
            oli.OpportunityId = oppsId;
            insertOppsLineItems.add(oli);
            
            product.Quantity__c -= 1;
        }
        
        if (!insertOppsLineItems.isEmpty()) {
            insert insertOppsLineItems;
            update product;
        }
        
        if (!updateOppsLineItems.isEmpty()) {
            update updateOppsLineItems;
            update product;
        }
    }
    
    private static OpportunityLineItem getExistingCartItem(Id oppsId, Id Pro2Id) {
        List<OpportunityLineItem> existingCartItems = [
            SELECT Id, Quantity, UnitPrice
            FROM OpportunityLineItem
            WHERE OpportunityId = :oppsId AND Product2Id = :Pro2Id
            LIMIT 1
        ];
        return existingCartItems.isEmpty() ? null : existingCartItems[0];
    }
}