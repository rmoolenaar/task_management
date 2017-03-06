import { Component } from '@angular/core';
import { NavController, MenuController, AlertController } from 'ionic-angular';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { ApiService } from '../../services/private_api';
import { PublicApiService } from '../../services/public_api';
import { CustomValidators } from '../../components/customvalidator';
import { TasksPage } from '../tasks/tasks';


@Component({
    selector: 'page-start',
    templateUrl: 'start.html'
})
export class StartPage {

    static idTokenName: string = 'id_token';

    registerForm: FormGroup;
    username: AbstractControl;
    fullname: AbstractControl;
    password: AbstractControl;
    password2: AbstractControl;

    loginForm: FormGroup;
    l_username: AbstractControl;
    l_password: AbstractControl;

    constructor(private publicApiService: PublicApiService,
                private apiService: ApiService,
                fb: FormBuilder,
                public navCtrl: NavController,
                public menu: MenuController,
                private alertCtrl: AlertController) {
        this.registerForm = fb.group({
            username: ["", Validators.compose([Validators.required, CustomValidators.emailValidator])],
            fullname: ["", Validators.required],
            password: ["", Validators.required],
            password2: ["", Validators.required],
        });
        this.username = this.registerForm.controls['username'];
        this.fullname = this.registerForm.controls['fullname'];
        this.password = this.registerForm.controls['password'];
        this.password2 = this.registerForm.controls['password2'];
        //
        this.loginForm = fb.group({
            l_username: ["", Validators.compose([Validators.required, CustomValidators.emailValidator])],
            l_password: ["", Validators.required],
        });
        this.l_username = this.loginForm.controls['l_username'];
        this.l_password = this.loginForm.controls['l_password'];
    }

    ionViewWillEnter() {
        // Get current token and if not exists or unable to do a API call --> login screen else --> DashboardPage
        var currentToken = localStorage.getItem(StartPage.idTokenName);
        if (currentToken) {
            this.apiService.myprofile().then(data => {
                if ((data as any).error) {
                    // Invalid token --> stay at login pages
                    this.showLoginAlert(data);
                } else {
                    // API call succeeded --> go to tasks page
                    this.navCtrl.setRoot(TasksPage);
                }
            });
        }
    }

    register() {
        if (this.password.value != this.password2.value) {
            let errorAlert = this.alertCtrl.create({
                title: 'Register',
                message: 'Passwords need to be identical',
                buttons: [{ text: 'Ok' }]
            });
            errorAlert.present();
        } else {
            this.publicApiService.register(this.username.value, this.password.value, this.fullname.value).then(data => {
                if ((data as any).error) {
                    this.showLoginAlert(data);
                } else  {
                    // Immediately --> Log in
                    this.publicApiService.login(this.username.value, this.password.value).then(data => {
                        if ((data as any).error) {
                            this.navCtrl.setRoot(StartPage);
                        } else {
                            var token = (data as any).token;
                            localStorage.setItem(StartPage.idTokenName, token);
                            // Redirect to first page
                            this.navCtrl.setRoot(StartPage);
                        }
                    });
                }
            });
        }
    }

    login() {
        this.publicApiService.login(this.l_username.value, this.l_password.value).then(data => {
            if ((data as any).error) {
                this.showLoginAlert(data);
            } else {
                var token = (data as any).token;
                localStorage.setItem(StartPage.idTokenName, token);
                // Redirect to first page
                this.navCtrl.setRoot(StartPage);
            }
        });
    }

    sendpassword() {
        this.publicApiService.sendpassword(this.l_username.value).then(data => {
            if ((data as any).error) {
                this.showLoginAlert(data);
            } else {
                let alert = this.alertCtrl.create({
                    title: 'Login',
                    message: 'An e-mail is sent to you e-mail address. Please check your mailbox.',
                    buttons: [{ text: 'Ok' }]
                });
                alert.present();
            }
        });
    }

    showLoginAlert(data) {
        var msg = (data as any).msg;
        var errorText;
        if (msg.status == 401) {
            localStorage.removeItem(StartPage.idTokenName);
            errorText = 'Username / password combination invalid. Please try again!';
        } else {
            if (msg.status == 400) {
                errorText = 'Incomplete information';
            } else {
                if (msg.status == 409) {
                    errorText = 'User already exists';
                } else {
                    errorText = 'We encountered problems connecting to the server. Please check if you have an active internet connection.';
                }
            }
        }
        let errorAlert = this.alertCtrl.create({
            title: 'Login',
            message: errorText,
            buttons: [{ text: 'Ok' }]
        });
        errorAlert.present();
    }
}
