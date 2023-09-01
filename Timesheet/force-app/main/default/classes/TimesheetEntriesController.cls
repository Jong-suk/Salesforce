public with sharing class TimesheetEntriesController {
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getTimesheetEntries(Id userId, Date weekStartDate) {
        List<Map<String, Object>> entries = new List<Map<String, Object>>();

        Date weekEndDate = weekStartDate.addDays(6);

        List<Timesheet_Entry__c> timesheetEntries = [
            SELECT Id, CustomTask__r.Project__r.Name, CustomTask__r.Name, CustomTask__r.Total_Hours__c, Date__c, Hours_Worked__c, 
            CustomTask__r.Start_Date__c, CustomTask__r.Due_Date__c, CustomTask__r.Overall_Hours_Worked__c, CustomTask__r.Remaining_Hours__c
            FROM Timesheet_Entry__c
            WHERE CustomTask__r.User__c = :userId
            AND CustomTask__r.Start_Date__c <= :weekEndDate
            AND CustomTask__r.Due_Date__c >= :weekStartDate
        ];

        Map<Id, List<Timesheet_Entry__c>> taskEntriesMap = new Map<Id, List<Timesheet_Entry__c>>();
        for (Timesheet_Entry__c entry : timesheetEntries) {
            if (!taskEntriesMap.containsKey(entry.CustomTask__c)) {
                taskEntriesMap.put(entry.CustomTask__c, new List<Timesheet_Entry__c>());
            }
            taskEntriesMap.get(entry.CustomTask__c).add(entry);
        }

        for (Id taskId : taskEntriesMap.keySet()) {
            List<Timesheet_Entry__c> taskEntries = taskEntriesMap.get(taskId);
            Map<String, Object> entryMap = new Map<String, Object>();
            entryMap.put('Id', taskEntries[0].Id);
            entryMap.put('ProjectId', taskEntries[0].CustomTask__r.Project__c);
            entryMap.put('ProjectName', taskEntries[0].CustomTask__r.Project__r.Name);
            entryMap.put('TaskId', taskEntries[0].CustomTask__c);
            entryMap.put('TaskName', taskEntries[0].CustomTask__r.Name);
            entryMap.put('Start_Date', taskEntries[0].CustomTask__r.Start_Date__c);
            entryMap.put('End_Date', taskEntries[0].CustomTask__r.Due_Date__c);
            entryMap.put('TotalHours', taskEntries[0].CustomTask__r.Total_Hours__c);
            entryMap.put('HoursWorked', taskEntries[0].CustomTask__r.Overall_Hours_Worked__c);
            entryMap.put('RemainingHours', taskEntries[0].CustomTask__r.Remaining_Hours__c);

            Set<String> dates = new Set<String>();
            for (Timesheet_Entry__c entry : taskEntries) {
                String dateString = String.valueOf(entry.Date__c);
                dates.add(dateString);
                entryMap.put(dateString, entry.Hours_Worked__c);
            }
            entryMap.put('Dates', new List<String>(dates));

            entries.add(entryMap);
        }

        return entries;
    }

    @AuraEnabled(cacheable=true)
    public static List<User> getUsers() {
        return [SELECT Id, Name FROM User];
    }

    @AuraEnabled(cacheable=true)
    public static List<Project__c> getProjects() {
        return [SELECT Id, Name FROM Project__c];
    }

    @AuraEnabled(cacheable=true)
    public static List<CustomTask__c> getTasksByProject(Id projectId, Id userId) {
        return [SELECT Id, Name FROM CustomTask__c WHERE Project__c = :projectId AND User__c = :userId];
    }

    @AuraEnabled
    public static void createTimesheetEntry(Id projectId, Id taskId) {
        try {
            Timesheet_Entry__c timesheetEntry = new Timesheet_Entry__c();
            timesheetEntry.CustomTask__c = taskId;
            System.debug(timesheetEntry);
            
            insert timesheetEntry;
            
        } catch (Exception ex) {
            System.debug('Error creating timesheet entry: ' + ex.getMessage());
        }
    }

    // @AuraEnabled
    // public static void saveData(String jsonData) {
    //     List<Timesheet_Entry__c> recordsToUpdate = new List<Timesheet_Entry__c>();

    //     List<TimesheetEntryWrapper> entries = (List<TimesheetEntryWrapper>) JSON.deserialize(jsonData, List<TimesheetEntryWrapper>.class);

    //     for (TimesheetEntryWrapper entry : entries) {
    //         System.debug(entry);
    //         Timesheet_Entry__c timesheetEntry;

    //         List<Timesheet_Entry__c> existingEntries = [
    //             SELECT Id, CustomTask__c, Date__c, Hours_Worked__c
    //             FROM Timesheet_Entry__c
    //             WHERE CustomTask__c = :entry.taskId AND Date__c = :Date.valueOf(entry.tDate)
    //             LIMIT 1
    //         ];

    //         System.debug(existingEntries);

    //         if (!existingEntries.isEmpty()) {
    //             timesheetEntry = existingEntries[0];
    //         } else {
    //             timesheetEntry = new Timesheet_Entry__c();
    //             timesheetEntry.CustomTask__c = entry.taskId != null ? entry.taskId.split('-')[0] : null;
    //             timesheetEntry.Date__c = Date.valueOf(entry.tDate);
    //         }

    //         timesheetEntry.Hours_Worked__c = entry.HoursWorked;

    //         System.debug(timesheetEntry);

    //         recordsToUpdate.add(timesheetEntry);
    //     }

    //     if (!recordsToUpdate.isEmpty()) {
    //         upsert recordsToUpdate;
    //     }
    // }

    @AuraEnabled
    public static void saveData(String jsonData) {
        List<Timesheet_Entry__c> recordsToUpdate = new List<Timesheet_Entry__c>();

        List<TimesheetEntryWrapper> entries = (List<TimesheetEntryWrapper>) JSON.deserialize(jsonData, List<TimesheetEntryWrapper>.class);

        Set<String> taskIds = new Set<String>();
        Set<Date> dates = new Set<Date>();

        // Collect unique taskIds and dates from the entries
        for (TimesheetEntryWrapper entry : entries) {
            taskIds.add(entry.taskId != null ? entry.taskId.split('-')[0] : null);
            dates.add(Date.valueOf(entry.tDate));
        }

        // Map to hold the existing Timesheet_Entry__c records by taskId and date
        Map<String, Map<Date, Timesheet_Entry__c>> existingEntriesMap = new Map<String, Map<Date, Timesheet_Entry__c>>();

        // Retrieve existing Timesheet_Entry__c records based on taskIds and dates
        List<Timesheet_Entry__c> existingEntries = [
            SELECT Id, CustomTask__c, Date__c, Hours_Worked__c
            FROM Timesheet_Entry__c
            WHERE CustomTask__c IN :taskIds AND Date__c IN :dates
        ];

        // Populate existingEntriesMap with the retrieved records
        for (Timesheet_Entry__c entry : existingEntries) {
            if (!existingEntriesMap.containsKey(entry.CustomTask__c)) {
                existingEntriesMap.put(entry.CustomTask__c, new Map<Date, Timesheet_Entry__c>());
            }
            existingEntriesMap.get(entry.CustomTask__c).put(entry.Date__c, entry);
        }

        // Process the entries and create/update Timesheet_Entry__c records
        for (TimesheetEntryWrapper entry : entries) {
            Timesheet_Entry__c timesheetEntry;

            Map<Date, Timesheet_Entry__c> taskEntriesMap = existingEntriesMap.get(entry.taskId != null ? entry.taskId.split('-')[0] : null);
            if (taskEntriesMap != null) {
                timesheetEntry = taskEntriesMap.get(Date.valueOf(entry.tDate));
            } else {
                timesheetEntry = new Timesheet_Entry__c();
                timesheetEntry.CustomTask__c = entry.taskId != null ? entry.taskId.split('-')[0] : null;
                timesheetEntry.Date__c = Date.valueOf(entry.tDate);
            }

            timesheetEntry.Hours_Worked__c = entry.HoursWorked;

            recordsToUpdate.add(timesheetEntry);
        }

        if (!recordsToUpdate.isEmpty()) {
            upsert recordsToUpdate;
        }
    }
    
    public class TimesheetEntryWrapper {
        public String Id { get; set; }
        public String taskId { get; set; }
        public String tDate { get; set; }
        public Decimal HoursWorked { get; set; }
    }

    @AuraEnabled(cacheable=true)
    public static List<PicklistOption> getLeaveReasons() {
        List<PicklistOption> options = new List<PicklistOption>();
        
        Schema.DescribeFieldResult fieldResult = Leave_Request__c.Reason__c.getDescribe();
        
        if (fieldResult != null && fieldResult.getType() == Schema.DisplayType.PICKLIST) {
            List<Schema.PicklistEntry> picklistValues = fieldResult.getPicklistValues();
            
            for (Schema.PicklistEntry picklistEntry : picklistValues) {
                options.add(new PicklistOption(picklistEntry.getValue(), picklistEntry.getLabel()));
            }
        }
        
        return options;
    }

    public class PicklistOption {
        @AuraEnabled
        public String value { get; set; }
        @AuraEnabled
        public String label { get; set; }
        
        public PicklistOption(String value, String label) {
            this.value = value;
            this.label = label;
        }
    }

    @AuraEnabled
    public static void createLeaveRecord(String userId, String reason, Date startDate, Date endDate) {
        Leave_Request__c newLeaveRecord = new Leave_Request__c();
        newLeaveRecord.User__c = userId;
        newLeaveRecord.Reason__c = reason;
        newLeaveRecord.Start_Date__c = startDate;
        newLeaveRecord.End_Date__c = endDate;

        try {
            insert newLeaveRecord;
            System.debug('Leave record created successfully: ' + newLeaveRecord);
        } catch (Exception e) {
            System.debug('Error creating leave record: ' + e.getMessage());
            throw new AuraHandledException('Error creating leave record: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Leave_Request__c> getLeaveObject(Id userId, Date weekStartDate) {
        return [
            SELECT Id, User__c, Start_Date__c, End_Date__c, Reason__c FROM Leave_Request__c 
            WHERE User__c = :userId AND Start_Date__c >= :weekStartDate AND End_Date__c <= :weekStartDate.addDays(6)
        ];
    }

    @AuraEnabled
    public static void updateCustomTask(String taskId, Integer fieldValue) {
        CustomTask__c task = [SELECT Id, Total_Hours_Worked__c FROM CustomTask__c WHERE Id = :taskId LIMIT 1];
        if (task != null) {
            task.Total_Hours_Worked__c = fieldValue;
            update task;
        }
    }

    @AuraEnabled(cacheable = false)
    public static List<Timesheet__c> createTSRecord(Id userId, Date startDate) {
        List<Timesheet__c> existingTimesheets = [
            SELECT Id FROM Timesheet__c WHERE User__c = :userId AND Week_Start_Date__c = :startDate LIMIT 1
        ];

        if (!existingTimesheets.isEmpty()) {
            return null;
        } else {
            Timesheet__c ts = new Timesheet__c();
            ts.User__c = userId;
            ts.Week_Start_Date__c = startDate;

            List<Timesheet__c> timesheetsToInsert = new List<Timesheet__c>{ts};
            return timesheetsToInsert;
        }
    }

    @AuraEnabled
    public static String createTimesheets(List<Timesheet__c> timesheets) {
        try {
            insert timesheets;
            return 'Timesheets saved.';
        } catch (DmlException ex) {
            throw new AuraHandledException('Error creating timesheets: ' + ex.getMessage());
        }
    }
}