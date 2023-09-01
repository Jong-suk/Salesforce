public with sharing class CartController {
    @AuraEnabled(cacheable=true)
    public static List<OpportunityLineItem> getOppsProduct(Id OppsId){
        List<OpportunityLineItem> oppslineitem = [
            SELECT Id, Product2.Name, UnitPrice, Quantity, Product2.Family, TotalPrice, OpportunityId, Opportunity.AccountId
            FROM OpportunityLineItem WHERE OpportunityId =: OppsId
        ];
        return oppslineitem;
    }

    @AuraEnabled
    public static Id createOrder(List<OpportunityLineItem> oppsLineItems, Id OppsId, Id LeadId, Id eUserId) {
        Id contactId;
        List<Lead> convertedLeads = [SELECT Id, ConvertedContactId FROM Lead WHERE Id = :leadId AND IsConverted = true LIMIT 1];
        if (convertedLeads.size() > 0) {
            contactId = convertedLeads[0].ConvertedContactId;
        }

        Opportunity opp = [SELECT Id, StageName, Pricebook2Id FROM Opportunity where Id=: OppsId LIMIT 1];
        opp.StageName = 'Closed Won';
        update opp;
        
        System.debug('eUserId: ' + eUserId);
        E_User__c eUser = [SELECT Id, Contact__c FROM E_User__c WHERE Id =: eUserId LIMIT 1];
        if(eUser.Contact__c == null){
            eUser.Contact__c = contactId;
            update eUser;
        }
        System.debug('E-User: ' + eUser);

        Order newOrder = new Order();
        List<OpportunityLineItem> RecId = [SELECT Opportunity.AccountId, Opportunity.ContactId FROM OpportunityLineItem WHERE Id=: oppsLineItems[0].Id];
        String AId = RecId[0].Opportunity.AccountId;
        String CId = eUser.Contact__c;
        newOrder.AccountId = AId;
        newOrder.BillToContactId = CId;
        newOrder.EffectiveDate = System.today();
        newOrder.Status = 'Draft';
        newOrder.Pricebook2Id = opp.Pricebook2Id;
        insert newOrder;

        List<OrderItem> orderItems = new List<OrderItem>();
        for (OpportunityLineItem oppsLineItem : oppsLineItems) {
            OrderItem newOrderItem = new OrderItem();
            List<PricebookEntry> pricebookentry = [SELECT Id FROM PricebookEntry WHERE Name=: oppsLineItem.Name LIMIT 1];
            Id priceId = pricebookentry[0].Id;

            newOrderItem.OrderId = newOrder.Id;
            newOrderItem.PricebookEntryId = priceId;
            newOrderItem.Product2Id = oppsLineItem.Product2Id;
            newOrderItem.Quantity = oppsLineItem.Quantity;
            newOrderItem.UnitPrice = oppsLineItem.UnitPrice;
            newOrderItem.ServiceDate = System.today();
            newOrderItem.ListPrice = oppsLineItem.UnitPrice;
            orderItems.add(newOrderItem);
        }

        if(!orderItems.isEmpty()){
            insert orderItems;
        }

        newOrder.Status = 'Activated';
        update newOrder;

        return newOrder.Id;
    }

    @AuraEnabled
    public static void sendEmailAfterOrder(Id orderId) {
        Order newOrder = [SELECT Id, OrderNumber, Status, Account.Name, BillToContact.Email, BillToContact.Name FROM Order WHERE Id = :orderId LIMIT 1];
        List<OrderItem> orderItems = [SELECT Id, OrderId, Product2.Name, Quantity, UnitPrice FROM OrderItem WHERE OrderId = :orderId];
            
        System.debug(newOrder.BillToContact.Email);
        
        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setToAddresses(new List<String>{ newOrder.BillToContact.Email });
        email.setSubject('Order Placed - ' + newOrder.OrderNumber);
        
        Decimal GrandTotal = 0;
        
        String emailBody = 'Dear ' + newOrder.BillToContact.Name + ',<br><br>';
        emailBody += 'Thank you for your order! Below are the details of your recent purchase:<br><br>';
        emailBody += '<b>Order Number:</b> ' + newOrder.OrderNumber + '<br>';
        emailBody += '<b>Order Status:</b> ' + newOrder.Status + '<br>';
        emailBody += '<b>Customer Account Name:</b> ' + newOrder.Account.Name + '<br><br>';
        
        emailBody += '<b>Order Items:</b><br><br>';
        for (OrderItem item : orderItems) {
            if (item.OrderId == newOrder.Id) {
                emailBody += '<b>Product:</b> ' + item.Product2.Name + '<br>';
                emailBody += '<b>Quantity:</b> ' + item.Quantity + '<br>';
                emailBody += '<b>Unit Price:</b> ' + item.UnitPrice + '<br>';
                emailBody += '<b>Total Price:</b> ' + (item.Quantity * item.UnitPrice) + '<br><br>';
                GrandTotal += item.Quantity * item.UnitPrice;
            }
        }
        
        emailBody += '<b>Order Total:</b> ' + GrandTotal + '<br><br>';
        
        emailBody += 'If you have any questions or need further assistance, please feel free to contact us.<br>';
        emailBody += 'Thank you for choosing our services!<br><br>';
        emailBody += 'Best Regards,<br>Seed The Rise<br>';
        
        email.setHtmlBody(emailBody);
        
        Messaging.SendEmailResult[] results = Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{email});
        
        if (results[0].isSuccess()) {
            System.debug('Email sent successfully');
        } else {
            System.debug('Email sending failed: ' + results[0].getErrors()[0].getMessage());
        }
    }
}