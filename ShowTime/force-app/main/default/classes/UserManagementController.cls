public with sharing class UserManagementController {
    @AuraEnabled
    public static void setUserPassword(Id userId, String password) {
        try {
            System.setPassword(userId, password);
            System.debug('User password set successfully');
        } catch (Exception e) {
            System.debug('Error setting user password: ' + e.getMessage());
        }
    }
}