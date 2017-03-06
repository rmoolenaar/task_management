var nodemailer = require('nodemailer');
var cfg = require("../config.js");

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: cfg.gmail_user,
        pass: cfg.gmail_password
    }
});


// Send e-mail
exports.sendmail = function(to_email, subject, text) {
    var mailOptions = {
        from: 'Task management application <' + cfg.gmail_user + '>', // sender address
        to: to_email, // list of receivers
        subject: subject, // Subject line
        text: text, // plaintext body
        html: text.replace(/(?:\r\n|\r|\n)/g, '<br />') // html body
    };
    // send mail with defined transport object
    transporter.sendMail(mailOptions, function(error, info){
        if(error){
            return console.log(error);
        }
        console.log('Message sent: ' + info.response);
    });
};
