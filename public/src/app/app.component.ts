import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { StatusBar, Splashscreen } from 'ionic-native';

import { ApiService } from '../services/private_api';
import { StartPage } from '../pages/start/start';
import { TasksPage } from '../pages/tasks/tasks';


@Component({
    templateUrl: 'app.html'
})
export class TaskManagementApp {
    rootPage = null;

    constructor(private apiService: ApiService, platform: Platform) {
        platform.ready().then(() => {
            // Okay, so the platform is ready and our plugins are available.
            // Here you can do any higher level native things you might need.
            StatusBar.styleDefault();
            Splashscreen.hide();

            // Get current token and if not exists or unable to do a API call --> login screen else --> DashboardPage
            var currentToken = localStorage.getItem(StartPage.idTokenName);
            if (currentToken) {
                this.apiService.myprofile().then(data => {
                    if ((data as any).error) {
                        // Invalid token --> stay at login pages
                        localStorage.removeItem(StartPage.idTokenName);
                        this.rootPage = StartPage;
                    } else {
                        // API call succeeded --> go to tasks page
                        this.rootPage = TasksPage;
                    }
                });
            } else {
                // No token --> stay at login pages
                this.rootPage = StartPage;
            }
        });
    }
}
