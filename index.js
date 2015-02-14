var _ = require('lodash'),
  fs = require('fs'),
  Handlebars = require('handlebars'),
  nodemailer = require('nodemailer'),
  path = require('path'),
  Promise = require('bluebird');

// the message objects returned by
// .message()
function Message(transporter, templates) {
  this.transporter = transporter;
  this.templates = templates;
}

Message.prototype.sendMail = function(data, cb) {
  var _this = this,
    content = {};

  return new Promise(function(resolve, reject) {
    if (_this.templates.html) content.html = _this.templates.html(data);
    if (_this.templates.text) content.text = _this.templates.text(data);

    _this.transporter.sendMail(_.extend({}, content, data), function(err, info) {
      if (err) reject(err);
      else resolve(info);
    });
  }).nodeify(cb);
};

function MustacheMailer(opts) {
  _.extend(this, {
    nodemailer: {}, // node-mailer initialization options.
    transport: null, // the transport method, e.g., SES.
    templateDir: './templates',
    templateCache: {}
  }, opts);

  this.transporter = nodemailer.createTransport(this.transport);
}

MustacheMailer.prototype.message = function(name, cb) {
  var _this = this,
    templates = {},
    htmlPath,
    textPath;

  return this._templateList()
    .then(function(files) {
      htmlPath = _this._resolveTemplateFile(name + '.html.mustache', files);
      textPath = _this._resolveTemplateFile(name + '.text.mustache', files);

      if (textPath) return _this._loadTemplate(textPath);
    })
    .then(function(textTemplate) {
      if (textTemplate) templates.text = textTemplate;
      if (htmlPath) return _this._loadTemplate(htmlPath);
    })
    .then(function(htmlTemplate) {
      if (htmlTemplate) templates.html = htmlTemplate;
    })
    .then(function() {
      _this.templateCache[name] = templates;
      return new Message(_this.transporter, templates);
    })
    .nodeify(cb);
};

MustacheMailer.prototype._resolveTemplateFile = function(name, files) {
  return files.indexOf(name) > -1 ? path.resolve(this.templateDir, name) : null;
};

MustacheMailer.prototype._loadTemplate = function(path) {
  var _this = this;

  return new Promise(function(resolve, reject) {
    fs.readFile(path, 'utf-8', function(err, source) {
      if (err) reject(err);
      else resolve(Handlebars.compile(source));
    });
  });
};

MustacheMailer.prototype._templateList = function() {
  var _this = this;

  return new Promise(function(resolve, reject) {
    fs.readdir(_this.templateDir, function(err, files) {
      if (err) reject(err);
      else resolve(
        _.filter(files, function(f) {
          return f.match(/\.mustache$/);
        })
      );
    });
  });
};

module.exports = MustacheMailer;
