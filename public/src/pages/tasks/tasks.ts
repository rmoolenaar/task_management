import { Component } from '@angular/core';
import { AlertController, NavController, NavParams } from 'ionic-angular';
import { FormBuilder, FormGroup, FormControl, Validators, AbstractControl } from '@angular/forms';
import { ApiService } from '../../services/private_api';

/*
  Generated class for the Tasks page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
    selector: 'page-tasks',
    templateUrl: 'tasks.html'
})
export class TasksPage {

    taskForm: FormGroup;
    name: AbstractControl;
    endDate: AbstractControl;
    description: AbstractControl;
    user_id: AbstractControl;

    filterForm: FormGroup;
    endDateStart: AbstractControl;
    endDateEnd: AbstractControl;

    currentTask: any = {};
    tasks: Array<any> = [];
    currentUser: any = {};

    constructor(private apiService: ApiService,
                fb: FormBuilder,
                public navCtrl: NavController,
                public navParams: NavParams,
                private alertCtrl: AlertController) {
        this.taskForm = fb.group({
            name: ["", Validators.required],
            endDate: ["", Validators.required],
            description: ["", Validators.required],
            user_id: [""],
        });
        this.name = this.taskForm.controls['name'];
        this.endDate = this.taskForm.controls['endDate'];
        this.description = this.taskForm.controls['description'];
        this.user_id = this.taskForm.controls['user_id'];
        //
        this.filterForm = fb.group({
            endDateStart: ["", Validators.required],
            endDateEnd: ["", Validators.required],
        });
        this.endDateStart = this.filterForm.controls['endDateStart'];
        this.endDateEnd = this.filterForm.controls['endDateEnd'];
        //
        this.apiService.myprofile().then(data => {
            this.currentUser = data;
        });
    }

    ionViewDidEnter() {
        this.loadData();
    }

    loadData() {
        this.currentTask = {};
        // Load task data
        this.apiService.getTasks().then((data: any) => {
            this.tasks = (data.items) ? data.items : [];
        });
    }

    searchTask() {
        this.apiService.searchTasksByEndDate(this.endDateStart.value, this.endDateEnd.value).then((data: any) => {
            this.tasks = (data.items) ? data.items : [];
        });
    }

    newTask() {
        var newDate = new Date();
        (<FormControl>this.name).setValue('');
        (<FormControl>this.endDate).setValue(newDate.toISOString());
        (<FormControl>this.description).setValue('');
        (<FormControl>this.user_id).setValue(this.currentUser.id);
        //
        this.currentTask = {
            user_id: this.currentUser.id
        };
    }

    openTask(task) {
        this.currentTask = task;
        (<FormControl>this.name).setValue(task.name);
        (<FormControl>this.endDate).setValue(task.endDate);
        (<FormControl>this.description).setValue(task.description);
        (<FormControl>this.user_id).setValue(task.user_id);
    }

    editTask() {
        this.apiService.postTasks(this.currentTask.id, this.name.value, this.endDate.value, this.description.value, this.currentTask.user_id)
        .then((data) => {
            this.showUpdateAlert(data);
            // Re-load data
            this.loadData();
        });
    }

    deleteTask() {
        this.apiService.deleteTasks(this.currentTask.id)
        .then((data) => {
            this.showUpdateAlert(data);
            // Re-load data
            this.loadData();
        });
    }

    showUpdateAlert(data) {
        var msg = (data as any);
        var text;
        if (msg && msg.error) {
            text = 'Error saving task: ' + msg.error;
        } else {
            text = 'Saved';
        }
        let alert = this.alertCtrl.create({
            title: 'Edit task',
            message: text,
            buttons: [{ text: 'Ok' }]
        });
        alert.present();
    }
}
