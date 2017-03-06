import {Http, Headers, Request, RequestOptions, RequestMethod} from '@angular/http'
import {Injectable} from '@angular/core'

@Injectable()
export class PublicApiService {

    public baseURL: string = '/apipublic/v1/';

    constructor(private http: Http){
    }

    login(username: string, password: string) {
        var loginObject: any = {};
        loginObject.username = username;
        loginObject.password = password;
        return this.postCommand('login', loginObject);
    }

    sendpassword(username: string) {
        var resetObject: any = {};
        resetObject.username = username;
        return this.postCommand('resetpassword', resetObject);
    }

    register(username: string, password: string, fullname: string) {
        var registerObject: any = {};
        registerObject.username = username;
        registerObject.password = password;
        registerObject.name = fullname;
        return this.postCommand('register', registerObject);
    }

    getCommand(cmd: string) {
        // don't have the data yet
        return new Promise(resolve => {
            // We're using Angular Http provider to request the data,
            // then on the response it'll map the JSON data to a parsed JS object.
            // Next we process the data and resolve the promise with the new data.
            this.http.get(this.baseURL + cmd).subscribe(
                data => resolve(data.json()),
                err  => resolve({error: true, msg: err})
            );
        });
    }

    postCommand(cmd: string, body: any) {
        let strBody = JSON.stringify(body);
        // don't have the data yet
        let headers = new Headers({ 'Content-Type': 'application/json;charset=utf-8' });

        let requestoptions: RequestOptions = new RequestOptions({
            method: RequestMethod.Post,
            url: this.baseURL + cmd,
            headers: headers,
            body: strBody
        });
        return new Promise(resolve => {
            // We're using Angular Http provider to request the data,
            // then on the response it'll map the JSON data to a parsed JS object.
            // Next we process the data and resolve the promise with the new data.
            this.http.request(new Request(requestoptions)).subscribe(
                data => resolve(data.json()),
                err  => resolve({error: true, msg: err})
            );
        });
    }

    setBaseURL(url: string) {
        this.baseURL = url;
    }
}
