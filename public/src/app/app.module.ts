import { NgModule, ErrorHandler } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicApp, IonicModule, IonicErrorHandler } from 'ionic-angular';
import { Http, HttpModule, RequestOptions } from '@angular/http'
import { AuthHttp, AuthConfig } from 'angular2-jwt';
import { TaskManagementApp } from './app.component';
import { StartPage } from '../pages/start/start';
import { TasksPage } from '../pages/tasks/tasks';
import { ApiService } from '../services/private_api';
import { PublicApiService } from '../services/public_api';

export function authFactory(http: Http, options: RequestOptions) {
    return new AuthHttp(new AuthConfig({
        // Config options if you want
    }), http, options);
};

// Include this in your ngModule providers
export const authProvider = {
    provide: AuthHttp,
    deps: [Http, RequestOptions],
    useFactory: authFactory
};

@NgModule({
  declarations: [
    TaskManagementApp,
    StartPage,
    TasksPage
  ],
  imports: [
    HttpModule,
    FormsModule,
    IonicModule.forRoot(TaskManagementApp)
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    TaskManagementApp,
    StartPage,
    TasksPage
  ],
  providers: [ApiService, PublicApiService, authProvider, {provide: ErrorHandler, useClass: IonicErrorHandler}]
})
export class AppModule {}
