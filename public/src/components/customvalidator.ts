import {FormControl} from '@angular/forms';


export class CustomValidators {

    static emailValidator(control: FormControl) {
        if (!control.value.match(/[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/)) {

            return { 'invalidEmailAddress': true };
        }
    }

    static integerValidator(control: FormControl) {
        var value = '' + control.value;
        if (value != '' && !value.match(/[0-9]+/)) {

            return { 'invalidInteger': true };
        }
    }
}
