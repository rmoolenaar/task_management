import {Headers, Request, RequestOptions, RequestMethod} from '@angular/http'
import {Injectable} from '@angular/core'
import {AuthHttp} from 'angular2-jwt';

@Injectable()
export class ApiService {

    public baseURL: string = '/api/v1/';

    constructor(private authHttp: AuthHttp){
    }

    myprofile() {
        return this.getCommand('me');
    }

    // Task API calls
    getTasks() {
        return this.getCommand('tasks');
    }

    searchTasksByEndDate(startDate: Date, endDate: Date) {
        return this.getCommand('tasks?gte-endDate=' + startDate + '&lte-endDate=' + endDate);
    }

    postTasks(id: number, name: string, endDate: Date, description: string, user_id: number) {
        var updRecord: any = {
            name: name,
            endDate: endDate,
            description: description,
            user_id: user_id
        }
        if (id) {
            return this.postCommand('tasks/' + id, updRecord);
        } else {
            return this.postCommand('tasks', updRecord);
        }
    }

    deleteTasks(id: number) {
        return this.deleteCommand('tasks/' + id);
    }

    getCommand(cmd: string) {
        // don't have the data yet
        return new Promise(resolve => {
            // We're using Angular Http provider to request the data,
            // then on the response it'll map the JSON data to a parsed JS object.
            // Next we process the data and resolve the promise with the new data.
            this.authHttp.get(this.baseURL + cmd).subscribe(
                data => resolve(data.json()),
                err  => resolve({error: true, msg: err})
            );
        });
    }

    postCommand(cmd: string, body: any) {
        return this.sendData(cmd, body, RequestMethod.Post);
    }

    putCommand(cmd: string, body: any) {
        return this.sendData(cmd, body, RequestMethod.Put);
    }

    deleteCommand(cmd: string) {
        return this.sendData(cmd, {}, RequestMethod.Delete);
    }

    sendData(cmd: string, body: any, requestmethod: RequestMethod) {
        let strBody = JSON.stringify(body);
        // don't have the data yet
        let headers = new Headers({ 'Content-Type': 'application/json;charset=utf-8' });

        let requestoptions: RequestOptions = new RequestOptions({
            method: requestmethod,
            url: this.baseURL + cmd,
            headers: headers,
            body: strBody
        });
        return new Promise(resolve => {
            // We're using Angular Http provider to request the data,
            // then on the response it'll map the JSON data to a parsed JS object.
            // Next we process the data and resolve the promise with the new data.
            this.authHttp.request(new Request(requestoptions)).subscribe(
                data => resolve(data.json()),
                err  => resolve({error: true, msg: err})
            );
        });
    }

    setBaseURL(url: string) {
        this.baseURL = url;
    }
}
