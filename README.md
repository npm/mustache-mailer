# Mustache-Mailer

[![Build Status](https://travis-ci.org/npm/mustache-mailer.png)](https://travis-ci.org/npm/mustache-mailer)
[![Coverage Status](https://coveralls.io/repos/npm/mustache-mailer/badge.svg?branch=)](https://coveralls.io/r/npm/mustache-mailer?branch=)

A mustache-template-backed mailer. Built with [handlebars](https://www.npmjs.com/package/handlebars#readme),
and [nodemailer](https://www.npmjs.com/package/nodemailer), inspired by ActionMailer.

# Usage

1. create a templates directory with the following naming convention:
  * `foo.text.mustache`, for text email templates.
  * `foo.html.mustache`, for html email templates.

2. instantiate `MustacheMailer` with:
  * `transport`: the transport module you wish to use, e.g., SES.
  * `templateDir`: the path to the template directory.

```js
var mm = new MustacheMailer({
  transport: require('nodemailer-ses-transport')({
      accessKeyId: 'AWSACCESSKEY',
      secretAccessKey: 'AWS/Secret/key'
  }),
  templateDir: './mail-templates'
});
```

3. use the `MessageMailer` instance to grab a template:
  * if it sees an `html`, and a `text` template both will be sent.
  * any variable passed to `sendMail` are sent to `nodemailer`, and
    to the mustache templates.

```js
var msg = mm.message('confirmation').sendMail({
  to: 'bencoe@gmail.com',
  name: 'Ben',
  id: 'adfasdfadsfasdf'
});
```
