var _ = require('lodash'),
  fs = require('fs'),
  Handlebars = require('handlebars'),
  handlebarsAsync = require('handlebars-async'),
  nodemailer = require('nodemailer'),
  path = require('path'),
  Promise = require('bluebird');

handlebarsAsync(Handlebars);

// the message objects returned by
// .message()
function Message(transporter, templates) {
  this.transporter = transporter;
  this.templates = templates;
}

Message.prototype.sendMail = function(data, cb) {
  var _this = this,
    content = {};

  this._expandTemplate(data, _this.templates.html)
    .then(function(rendered) {
      if (rendered) content.html = rendered;
      return _this._expandTemplate(data, _this.templates.text)
    })
    .then(function(rendered) {
      if (rendered) content.text = rendered;
      return _this._expandTemplate(data, _this.templates.meta)
    })
    .then(function(meta) {
      if (meta) return JSON.parse(meta);
      else return {};
    })
    .then(function(meta) {
      return new Promise(function(resolve, reject) {
        _this.transporter.sendMail(_.extend({}, content, meta, data), function(err, info) {
          if (err) reject(err);
          else resolve(info);
        });
      });
    })
    .nodeify(cb);
};

Message.prototype._expandTemplate = function(data, template) {
  if (!template) return Promise.cast(null);

  return new Promise(function(resolve, reject) {
    template(data, function(err, content) {
      if (err) reject(err);
      else resolve(content);
    });
  });
};

function MustacheMailer(opts) {
  var _this = this;

  _.extend(this, {
    nodemailer: {}, // node-mailer initialization options.
    transport: null, // the transport method, e.g., SES.
    templateDir: './templates',
    cache: {}
  }, opts);

  this.transporter = nodemailer.createTransport(this.transport);

  // if we provide a helper for generating tokens, e.g.,
  // email signup tokens, register the async helper.
  if (this.tokenFacilitator) {
    Handlebars.registerHelper('tokenHelper', function(data) {
      var done = this.async();
      _this.tokenFacilitator.generate(
        _.omit(data.hash, ['prefix', 'ttl']),
        _.pick(data.hash, ['prefix', 'ttl']),
        function(err, token) {
          if (err) return done(err);
          else return done(null, token);
        }
      );
    });
  }
}

MustacheMailer.prototype.message = function(name, cb) {
  var _this = this,
    templates = {},
    htmlPath,
    metaPath,
    textPath;

  if (_this.cache[name]) {
    return Promise.cast(_this.cache[name])
      .nodeify(cb);
  } else {
    return this._templateList()
      .then(function(files) {
        htmlPath = _this._resolveTemplateFile(name + '.html.hbs', files);
        textPath = _this._resolveTemplateFile(name + '.text.hbs', files);
        metaPath = _this._resolveTemplateFile(name + '.meta.hbs', files);

        if (textPath) return _this._loadTemplate(textPath);
      })
      .then(function(textTemplate) {
        if (textTemplate) templates.text = textTemplate;
        if (htmlPath) return _this._loadTemplate(htmlPath);
      })
      .then(function(htmlTemplate) {
        if (htmlTemplate) templates.html = htmlTemplate;
        if (metaPath) return _this._loadTemplate(metaPath);
      })
      .then(function(metaTemplate) {
        if (metaTemplate) templates.meta = metaTemplate;
      })
      .then(function() {
        var message = new Message(_this.transporter, templates);
        _this.cache[name] = message;
        return message;
      })
      .nodeify(cb);
  }
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
          return f.match(/\.hbs$/);
        })
      );
    });
  });
};

module.exports = MustacheMailer;
