public with sharing class OrderController {
    @AuraEnabled(cacheable=true)
    public static List<OrderWrappers> getOrders(Id eUserId) {
        E_User__c eUser = [SELECT Id, Contact__c FROM E_User__c WHERE Id = :eUserId];
        String contactId = eUser.Contact__c;
        
        List<Order> orders = [
            SELECT Id, OrderNumber, Status, EffectiveDate, TotalAmount, Account.Name
            FROM Order
            WHERE BillToContactId = :contactId
            ORDER BY CreatedDate DESC
        ];
        
        List<OrderWrappers> orderWrappers = new List<OrderWrappers>();
        for (Order order : orders) {
            orderWrappers.add(new OrderWrappers(order));
        }
        
        return orderWrappers;
    }
    
    public class OrderWrappers {
        @AuraEnabled public Id Id;
        @AuraEnabled public String OrderNumber;
        @AuraEnabled public String Status;
        @AuraEnabled public Date EffectiveDate;
        @AuraEnabled public Decimal TotalAmount;
        @AuraEnabled public String AccountName;
        
        public OrderWrappers(Order order) {
            this.Id = order.Id;
            this.OrderNumber = order.OrderNumber;
            this.Status = order.Status;
            this.EffectiveDate = order.EffectiveDate;
            this.TotalAmount = order.TotalAmount;
            this.AccountName = order.Account.Name;
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static OrderWrapper getOrderDetails(Id orderId) {
        OrderWrapper result = new OrderWrapper();
        
        result.order = [
            SELECT Id, OrderNumber, Status, EffectiveDate, TotalAmount, Account.Name, BillToContact.Name
            FROM Order WHERE Id =: orderId
        ];
        
        result.orderItems = [
            SELECT Id, Product2.Name, Quantity, UnitPrice
            FROM OrderItem WHERE OrderId = :orderId
        ];
        
        return result;
    }
    
    public class OrderWrapper {
        @AuraEnabled public Order order;
        @AuraEnabled public List<OrderItem> orderItems;
    }
}