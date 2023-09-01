import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getRecord, updateRecord } from 'lightning/uiRecordApi';
import { loadScript } from 'lightning/platformResourceLoader';
import jsPDFResource from '@salesforce/resourceUrl/jsPDFResource';
import USER_ID from '@salesforce/user/Id';
import getTimesheetEntries from '@salesforce/apex/TimesheetEntriesController.getTimesheetEntries';
import getUsers from '@salesforce/apex/TimesheetEntriesController.getUsers';
import createTimesheetEntry from '@salesforce/apex/TimesheetEntriesController.createTimesheetEntry';
import getProjects from '@salesforce/apex/TimesheetEntriesController.getProjects';
import saveData from '@salesforce/apex/TimesheetEntriesController.saveData';
import getTasksByProject from '@salesforce/apex/TimesheetEntriesController.getTasksByProject';
import createLeaveRecord from '@salesforce/apex/TimesheetEntriesController.createLeaveRecord';
import getLeaveObject from '@salesforce/apex/TimesheetEntriesController.getLeaveObject';
import updateCustomTask from '@salesforce/apex/TimesheetEntriesController.updateCustomTask';
import createTSRecord from '@salesforce/apex/TimesheetEntriesController.createTSRecord';
import createTimesheets from '@salesforce/apex/TimesheetEntriesController.createTimesheets';
import getLeaveReasons from '@salesforce/apex/TimesheetEntriesController.getLeaveReasons';

const columns = [
    { 
        label: 'Project Name',
        fieldName: 'ProjectNameURL',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'ProjectName' },
            target: '_blank',
            tooltip: 'Go to Project'
        }
    },
    {
        label: 'Task Name',
        fieldName: 'TaskNameURL',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'TaskName' },
            target: '_blank',
            tooltip: 'Go to Task'
        }
    },
    {
        label: 'Hours',
        fieldName: 'Hours',
        type: 'text',
        typeAttributes: {
            class: 'datatable-tooltip',
            dataTooltip: { fieldName: 'Tooltip' }
        }
    }
];

export default class TimesheetEntries extends LightningElement {
    @track selectedUser;
    @track selectedUserName;
    @track selectedWeek = '';
    userProfileImageUrl;

    @track timesheetEntries = [];
    wiredTimesheetEntries;
    wiredleaveObject;
    @track newTimeSheet = [];
    @track columns = columns;
    @track userOptions = [];
    @track leaveObject = [];

    @track formattedDate;
    @track reportChartVisible = false;

    @track projectOptions = [];
    @track taskOptions = [];
    @track startDate = '';
    @track totalHours = '';
    @track showAddEntryModal = false;

    leaveDates = [];

    @track leaveReason;
    @track leaveReasonOptions = [];
    @track leaveStartDate;
    @track leaveEndDate;
    @track showLeaveEntryModal = false;

    @track isDropdownOpen = false;

    connectedCallback() {
        this.initializeSelectedWeek();
    }

    initializeSelectedWeek() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const week = this.getISOWeek(today);

        this.selectedWeek = `${year}-W${week}`;
        this.fetchTimesheetEntries();
    }

    getISOWeek(date) {
        const dayOfWeek = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const weekNumber = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);

        return weekNumber;
    }

    @wire(getUsers)
    wiredUsers({ error, data }) {
        if (data) {
            this.userOptions = data.map(user => ({
                label: user.Name,
                value: user.Id
            }));
        } else if (error) {
            console.error('Error retrieving User records', error);
            this.showToast('Error', 'Failed to fetch User records', 'error');
        }
    }

    @wire(getRecord, { recordId: USER_ID, fields: ['User.Id','User.Name', 'User.SmallPhotoUrl'] })
    wiredUser({ error, data }) {
        if (data) {
            this.selectedUser = data.fields.Id.value;
            this.selectedUserName = data.fields.Name.value;
            this.userProfileImageUrl = data.fields.SmallPhotoUrl.value;
            
            //this.fetchLeaveData();
        } else if (error) {
            console.error('Error retrieving current user', error);
        }
    }

    @wire(getProjects)
    wiredProjects({ error, data }) {
        if (data) {
        this.projectOptions = data.map((project) => ({
            label: project.Name,
            value: project.Id
        }));
        } else if (error) {
        // Handle the error
        }
    }

    handleUserChange(event) {
        this.selectedUser = event.target.value;
    }

    handleWeekChange(event) {
        this.selectedWeek = event.target.value;
    }

    handleSearchClick() {
        if (this.selectedUser && this.selectedWeek) {
            this.fetchTimesheetEntries();
        } else {
            this.showToast('Error', 'Please select both User and Week', 'error');
        }
    }

    @wire(getTimesheetEntries, { userId: '$selectedUser', weekStartDate: '$startDate' })
    timesheetEntriesWire(result) {
        this.wiredTimesheetEntries = result;
        if (result.data) {
            this.timesheetEntries = result.data.map(row => {
                const projectUrl = `/lightning/r/Project__c/${row.ProjectId}/view`;
                const taskUrl = `/lightning/r/CustomTask__c/${row.TaskId}/view`;
                return { ...row, ProjectNameURL: projectUrl, TaskNameURL: taskUrl };
            });

            this.timesheetEntries = this.timesheetEntries.map(row => {
                const { HoursWorked, RemainingHours, TotalHours } = row;
                const tooltip = `Total Hours: ${TotalHours} / Hours Worked: ${HoursWorked} / Remaining Hours: ${RemainingHours}`;
                row.Hours = `${TotalHours} / ${HoursWorked} / ${RemainingHours}`;
                row.Tooltip = tooltip;
                return row;
            });
   
            //this.fetchLeaveData();
        } else if (result.error) {
            console.error('Error retrieving timesheet entries', error);
            this.showToast('Error', 'Failed to fetch timesheet entries', 'error');
        }
    }

    fetchTimesheetEntries() {
        const [year, weekNumber] = this.selectedWeek.split('-W');
        const firstDayOfWeek = 1 + (weekNumber - 1) * 7;
        const weekStartDate = new Date(year, 0, firstDayOfWeek);
        this.startDate = weekStartDate;
        this.formattedDate = this.startDate.toISOString().split('T')[0];
        refreshApex(this.wiredTimesheetEntries);
        refreshApex(this.wiredleaveObject);
    }

    @wire(getLeaveObject, { userId: '$selectedUser', weekStartDate: '$formattedDate' })
    leaveWire(result) {
        this.wiredleaveObject = result;
        if(result.data) {
            this.leaveObject = result.data;
            this.updateColumns();
        }
    }

    @wire(getLeaveReasons)
    wiredLeaveReasons(result) {
        const { data, error } = result;
        if (data) {
            this.leaveReasonOptions = data.map(option => ({ label: option.label, value: option.value }));
        } else if (error) {
            console.error('Error retrieving leave reasons', error);
            this.showToast('Error', 'Failed to fetch leave reasons', 'error');
        }
    }

    updateColumns() {
        const distinctDates = new Set();
        this.timesheetEntries.forEach(entry => {
            entry.Dates.forEach(date => distinctDates.add(date));
        });
        const datesArray = Array.from(distinctDates);
        datesArray.sort();

        const editableMap = new Map();
    
        const [year, weekNumber] = this.selectedWeek.split('-W');
        const firstDayOfWeek = new Date(year, 0, (weekNumber) * 7);
        const dayOfWeek = firstDayOfWeek.getDay();
        const startOffset = (dayOfWeek === 1) ? -5 : 2 - dayOfWeek;
        firstDayOfWeek.setDate(firstDayOfWeek.getDate() + startOffset);
        
        const columnDates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(firstDayOfWeek);
            date.setDate(firstDayOfWeek.getDate() + i);
            const formattedDate = date.toISOString().split('T')[0];
            columnDates.push(formattedDate);    
        }
    
        const dynamicColumns = columnDates.map((date) => {
            const formattedDate = new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

            const isSunday = new Date(date).getDay() === 0;
            const isSaturday = new Date(date).getDay() === 6;
            let editable = true;
            let cellAttributes = !(isSunday || isSaturday) ? { alignment: 'center' } : { alignment: 'center', style: 'background-color: #C6C6C6;'  };
                    
            const leave = this.leaveObject.find(item => {
                const startDate = new Date(item.Start_Date__c);
                const endDate = new Date(item.End_Date__c);
                const currentDate = new Date(date);
            
                return currentDate >= startDate && currentDate <= endDate && item.User__c === this.selectedUser;
            });

            const sWithin = this.timesheetEntries.find(entry => {
                const cellDate = new Date(Date.parse(date));
                const taskStartDate = new Date(entry.Start_Date);

                return cellDate < taskStartDate;
            });

            const eWithin = this.timesheetEntries.find(entry => {
                const cellDate = new Date(Date.parse(date));
                const taskEndDate = new Date(entry.End_Date);

                return cellDate > taskEndDate;
            });

            if (leave) {
                editable = false;
                cellAttributes = { alignment: 'center', style: 'background-color: #878787; color: white' };
                this.leaveDates.push(date);
            }

            if(sWithin || eWithin) {
                editable = false;
                editableMap.set(date, editable);
            }

            return {
                label: formattedDate,
                fieldName: date,
                type: 'number',
                editable: editable,
                cellAttributes: cellAttributes
            };
        });

        this.leaveDates = Array.from(new Set(this.leaveDates));

        const updatedTimesheetEntries = this.timesheetEntries.map(entry => {
            const totalHours = this.calculateTotalHours(entry, columnDates);

            updateCustomTask({ taskId: entry.TaskId, fieldValue: totalHours })
            .then(() => {
                //this.showToast('Success', 'Custom task object record updated successfully', 'success');
            })
            .catch(error => {
            });

            
            return { ...entry, totalHours };
        });

        const updatedDynamicColumns = dynamicColumns.map((column) => ({
            ...column,
            editable: column.editable
        }));

        this.columns = [...columns, ...updatedDynamicColumns];
        this.timesheetEntries = updatedTimesheetEntries;
    
        this.timesheetEntries.forEach(entry => {
            entry.Dates.forEach(date => {
                const column = this.columns.find(col => col.fieldName === date);
                
                if (column) {
                    const fieldName = column.fieldName;
                    entry[fieldName] = entry[date];
                }
            });
        });

        this.getTimesheets();
    } 

    getTimesheets () {
        const formattedDate = this.startDate.toISOString().split('T')[0];

        createTSRecord({ userId: this.selectedUser, startDate: formattedDate })
        .then(result => {
            if(result === null){
                this.columns = this.columns.map(column => {
                    return { ...column, editable: false };
                });
            }
        });
    }

    calculateTotalHoursForDate(date) {
        let totalHours = 0;

        this.timesheetEntries.forEach(entry => {
            const hours = entry[date];
            if (hours && !isNaN(hours)) {
                totalHours += parseFloat(hours);
            }
        });

        return totalHours;
    }

    calculateTotalHours(entry, columnDates) {
        let total = 0;
        columnDates.forEach(date => {
            total += entry[date] || 0;
        });
        return total;
    }   
    
    calculateTotalHoursForEachDate(timesheetEntries, dateColumns) {
        const totals = {};
        
        dateColumns.forEach((dateColumn) => {
            totals[dateColumn] = 0;
        });

        timesheetEntries.forEach((entry) => {
            dateColumns.forEach((dateColumn) => {
                totals[dateColumn] += entry[dateColumn] || 0;
            });
        });
        
        return totals;
    } 
    
    handleSaveClick(event) {
        try {
            const editedRow = event.detail.draftValues[0];
        
            if (editedRow && editedRow.Id) {
                const fieldName = Object.keys(editedRow)[0];
                const fieldValue = editedRow[fieldName];
                let taskId;

                if(fieldValue > 24){
                    this.showToast('Error', 'Value entered is greater than 24 hrs', 'error');
                } else {
                    this.timesheetEntries.forEach(entry => {
                        if(entry.Id == editedRow.Id){
                            taskId = entry.TaskId;

                            const dateColumns = Object.keys(entry).filter((key) => key !== 'Id' && key !== 'taskId' && key !== 'tDate' && key !== 'HoursWorked');

                            const filteredEntries = this.timesheetEntries.filter(item => item.Id !== editedRow.Id);

                            const columnTotals = this.calculateTotalHoursForEachDate(filteredEntries, dateColumns);

                            const columnTotal = columnTotals[fieldName];

                            const totalValue = parseInt(columnTotal, 10) + parseInt(fieldValue, 10);
                            
                            if (totalValue > 24) {
                                this.showToast('Error', 'Total value for the column exceeds 24 hours', 'error');
                                return;
                            } else {
                                const rowData = {
                                    Id: editedRow.Id,
                                    taskId: taskId,
                                    tDate: fieldName,
                                    HoursWorked: fieldValue
                                };

                                const dataToSave = JSON.stringify([rowData]);
                        
                                saveData({ jsonData: dataToSave })
                                .then(result => {
                                    this.showToast('Success', 'Data saved successfully', 'success');
                                    this.fetchTimesheetEntries();
                                    this.template.querySelector('lightning-datatable').draftValues = [];
                                })
                                .catch(error => {
                                    this.showToast('Error', error.message, 'error');
                                    console.error('Error saving data:', error);
                                });
                            }
                        }
                    });
                }
            } else {
                console.warn('Invalid edited row data. Skipping save operation.');
            }
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }
    
    handleAddEntryClick() {
        this.showAddEntryModal = true;
        this.projectName = '';
        this.taskName = '';
    }

    handleReportClick() {
        this.reportChartVisible = true;
        this.chartUrl = 'https://resourceful-koala-2ewx53-dev-ed.trailblaze.my.salesforce.com/analytics/wave/lightningDashboard?assetId=01Z5i0000011XldEAE&orgId=00D5i00000EUPlf&loginHost=ap26.salesforce.com&urlType=sharing&analyticsContext=analyticsTab'; 

        let popup = window.open(reportUrl, 'Report Image', 'width=1200,height=800');
        popup.focus();
    }

    handleModalClose() {
        this.showAddEntryModal = false;
        this.showLeaveEntryModal = false;
    }

    handleProjectChange(event) {
        this.selectedProjectId = event.detail.value;
        this.taskOptions = [];
        getTasksByProject({ projectId: this.selectedProjectId, userId: this.selectedUser })
        .then((result) => {
            this.taskOptions = result.map((task) => ({
                label: task.Name,
                value: task.Id
            }));
        })
        .catch((error) => {
            console.error(error);
        });
    }

    handleTaskChange(event) {
        this.selectedTaskId = event.detail.value;
    }

    handleCreateEntry() {
        if (this.selectedProjectId && this.selectedTaskId && this.selectedUser) {
            createTimesheetEntry({ userId: this.selectedUser, projectId: this.selectedProjectId, taskId: this.selectedTaskId })
                .then(() => {
                    this.showToast('Success', 'Timesheet entry created successfully', 'success');
                    this.showAddEntryModal = false;
                    this.fetchTimesheetEntries();
                })
                .catch(error => {
                    console.error('Error creating timesheet entry', error);
                    this.showToast('Error', 'Failed to create timesheet entry', 'error');
                });
        } else {
            this.showToast('Error', 'Please enter project name, task name, and select a user', 'error');
        }
    } 
    
    handleLeaveEntryClick() {
        this.showLeaveEntryModal = true;
    }

    handleLeaveReasonChange(event) {
        this.leaveReason = event.detail.value;
    }

    handleLeaveStartDateChange(event) {
        this.leaveStartDate = event.detail.value;
    }

    handleLeaveEndDateChange(event) {
        this.leaveEndDate = event.detail.value;
    }

    handleCreateLeave() {
        const fields = {
            userId: this.selectedUser,
            reason: this.leaveReason,
            startDate: this.leaveStartDate,
            endDate: this.leaveEndDate
        };

        createLeaveRecord({ ...fields })
        .then(() => {
            this.showToast('Success', 'Leave record created successfully', 'success');
            this.leaveReason = '';
            this.leaveStartDate = '';
            this.leaveEndDate = '';
            this.showLeaveEntryModal = false;
            this.fetchTimesheetEntries();
        })
        .catch(error => {
            console.error('Error creating leave record', error);
        });
    }

    submitTimesheet() {
        const formattedDate = this.startDate.toISOString().split('T')[0];

        createTSRecord({ userId: this.selectedUser, startDate: formattedDate })
        .then(timesheetsToInsert => {
            if (timesheetsToInsert === null) {
                this.showToast('Warning', 'Timesheet already saved.', 'warning');
            } else {
                createTimesheets({ timesheets: timesheetsToInsert })
                .then(result => {
                    this.showToast('Success', 'Timesheet saved.', 'success');
                    this.columns = this.columns.map(column => {
                        return { ...column, editable: false };
                    });
                    return refreshApex(this.wiredTimesheetEntries);
                })
                .catch(error => {
                    this.showToast('Error', error, 'error');
                    console.error('Error creating timesheet: ', error);
                });
            }
        })
        .catch(error => {
            this.showToast('Error', error, 'error');
            console.error('Error checking existing timesheets: ', error);
        });
    }

    toggleDropdown() {
        this.isDropdownOpen = !this.isDropdownOpen;
    }

    @track csv = '';

    downloadCSVFile() {
        let rowEnd = '\n';
        let csvString = '';

        let columnsToInclude = ['ProjectName', 'TaskName', 'Hours'];

        let dateColumns = this.columns
        .filter(column => column.fieldName !== 'ProjectNameURL' && column.fieldName !== 'TaskNameURL' && column.fieldName !== 'Hours')
        .map(column => {
            const date = new Date(column.fieldName);
            const day = date.toLocaleDateString(undefined, { day: '2-digit' });
            const month = date.toLocaleDateString(undefined, { month: 'long' });
            const year = date.toLocaleDateString(undefined, { year: 'numeric' });
            return { fieldName: column.fieldName, label: `${day}-${month}-${year}` };
        });

        let columnHeaders = [...columnsToInclude, ...dateColumns.map(column => column.label)];
        let rowData = columnHeaders.map(header => header.replace(/\s/g, ''));

        csvString += rowData.join(',');
        csvString += rowEnd;

        for (let i = 0; i < this.timesheetEntries.length; i++) {
            let colValue = 0;

            for (let header of columnHeaders) {
                if (colValue > 0) {
                    csvString += ',';
                }
                let value;
                if (header === 'ProjectName') {
                    value = this.timesheetEntries[i].ProjectName;
                } else if (header === 'TaskName') {
                    value = this.timesheetEntries[i].TaskName;
                } else if (header === 'Hours') {
                    value = this.timesheetEntries[i].Hours;
                } else {
                    const fieldName = dateColumns.find(column => column.label === header).fieldName;
                    value = this.leaveDates.includes(fieldName) ? 'Leave' : this.timesheetEntries[i][fieldName];
                }

                csvString += '"' + (value || '') + '"';
                colValue++;
            }
            csvString += rowEnd;
        }

        let downloadElement = document.createElement('a');

        this.csv = csvString; 
        
        downloadElement.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvString);
        downloadElement.target = '_self';
        downloadElement.download = `${this.selectedWeek}.csv`;
        document.body.appendChild(downloadElement);
        downloadElement.click();
    }

    downloadPDFFile() {
        loadScript(this, jsPDFResource)
            .then(() => {
                const doc = new window.jsPDF('landscape');

                doc.setFontSize(10);

                const startX = 10;
                const startY = 10;
                const rowHeight = 10;
                const columnWidth = 28;

                const tableHeaders = ['Project Name', 'Task Name', 'Hours'];

                const dateColumns = this.columns
                    .filter(
                        (column) =>
                            column.fieldName !== 'ProjectNameURL' &&
                            column.fieldName !== 'TaskNameURL' &&
                            column.fieldName !== 'Hours'
                    )
                    .map((column) => {
                        const date = new Date(column.fieldName);
                        return {
                            fieldName: column.fieldName,
                            label: date.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' }),
                        };
                    });

                const fullTableHeaders = [...tableHeaders, ...dateColumns.map((column) => column.label)];

                const tableData = this.timesheetEntries.map((entry) => {
                    const rowData = [entry.ProjectName, entry.TaskName, entry.Hours];
                    dateColumns.forEach(column => {
                        const fieldName = column.fieldName;
                        const value = this.leaveDates.includes(fieldName) ? 'Leave' : entry[fieldName] || '';
                        rowData.push(value);
                    });
                    return rowData;
                });

                for (let i = 0; i < fullTableHeaders.length; i++) {
                    const xPos = startX + i * columnWidth;
                    const yPos = startY;

                    doc.rect(xPos, yPos, columnWidth, rowHeight, 'S');
                    doc.text(fullTableHeaders[i], xPos + 2, yPos + rowHeight / 2);
                }

                for (let i = 0; i < tableData.length; i++) {
                    const row = tableData[i];
                    const yPos = startY + (i + 1) * rowHeight;

                    for (let j = 0; j < row.length; j++) {
                        const cellValue = row[j];
                        const xPos = startX + j * columnWidth;

                        doc.rect(xPos, yPos, columnWidth, rowHeight, 'S');
                        doc.text(String(cellValue), xPos + 2, yPos + rowHeight / 2);
                    }
                }
                doc.save(`${this.selectedWeek}.pdf`);
            })
            .catch((error) => {
                console.error('Error loading jsPDF library:', error);
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