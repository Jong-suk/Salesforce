public with sharing class SignupLoginController {
    @AuraEnabled
    public static Id signupLogin(Map<String,Object> signUpData, Boolean isSignup) {
        String username = (String) signUpData.get('Username');
        String password = (String) signUpData.get('Password');
        
        Id newUserId;

        if (isSignup) {
            // Signup logic
            E_User__c newUser = new E_User__c();
            newUser.Username__c = (String) signUpData.get('Username');
            newUser.Email__c = (String) signUpData.get('Email');
            newUser.FirstName__c = (String) signUpData.get('FirstName');
            newUser.LastName__c = (String) signUpData.get('LastName');
            
            Blob passwordBlob = EncodingUtil.base64Decode(EncodingUtil.base64Encode(Blob.valueOf(password)));
            String hashedPassword = EncodingUtil.convertToHex(Crypto.generateDigest('SHA-256', passwordBlob));
            //String hashedPassword = passwordBlob.toString();
            newUser.Password__c = hashedPassword;
            
            try {
                insert newUser;
                newUserId = newUser.Id;
            } catch (Exception e) {
                System.debug('Error during signup: ' + e.getMessage());
                throw new AuraHandledException('Signup failed: ' + e.getMessage());
            }
        }
        System.debug(newUserId);
        return newUserId;
    }

    @AuraEnabled
    public static LoginWrapper login(String username, String password){
        LoginWrapper lw = new LoginWrapper();
        Blob passwordBlob = EncodingUtil.base64Decode(EncodingUtil.base64Encode(Blob.valueOf(password)));
        String hashedPassword = EncodingUtil.convertToHex(Crypto.generateDigest('SHA-256', passwordBlob));
        
        List<E_User__c> matchingUser = [SELECT Id, Username__c FROM E_User__c WHERE Username__c = :username AND Password__c = :hashedPassword LIMIT 1];
        
        System.debug('Matching Users:' + matchingUser);
        
        if (!matchingUser.isEmpty()) {
            System.debug('Matching User Id:' + matchingUser[0].Id);
            lw.EUserId = matchingUser[0].Id;
            lw.Success = true;
            
            return lw;
        } else {
            throw new AuraHandledException('Login failed!');
        }
    }
    
    public class LoginWrapper {
        @AuraEnabled public Id EUserId;
        @AuraEnabled public Boolean Success;
    }

    @AuraEnabled
    public static Boolean sendVerificationEmail(Id leadId, Integer generatedCode ) {
            
        Lead lead = [SELECT Id, Name, Email, verificationCode__c FROM Lead WHERE Id = :leadId];
        lead.verificationCode__c = generatedCode;
        update lead;

        String emailAddress = lead.Email;
        System.debug('Email Address: ' + emailAddress);

        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setToAddresses(new List<String>{emailAddress});
        email.setSubject('Email Verification');
        
        String emailBody = 'Dear ' + lead.Name + ',\n\n';
        emailBody += 'Thank you for signing up! Please verify your email address using the verification code below:\n\n';
        emailBody += 'Verification Code: ' + String.valueOf(generatedCode) + '\n\n';
        emailBody += 'Please enter this verification code on the verification page to complete the process.\n\n';
        emailBody += 'If you did not request this verification, please ignore this email.\n\n';
        emailBody += 'Best Regards,\nYour Company Name\n';
        
        email.setPlainTextBody(emailBody);
        
        try {
            Messaging.SendEmailResult[] sendResults = Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{email});
            if (sendResults[0].isSuccess()) {
                System.debug('Email sent successfully');
                return true;
            } else {
                System.debug('Email sending failed with error: ' + sendResults[0].getErrors()[0].getMessage());
                return false;
            }
        } catch (Exception ex) {
            System.debug('Email sending failed: ' + ex.getMessage());
            return false;
        }
    }
}