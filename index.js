var _ = require('lodash'),
  fs = require('fs'),
  Handlebars = require('handlebars'),
  handlebarsAsync = require('handlebars-async'),
  nodemailer = require('nodemailer'),
  path = require('path'),
  P = require('bluebird');

handlebarsAsync(Handlebars);

// the message objects returned by .message()
function Message(transporter, templates) {
  this.transporter = transporter;
  this.templates = templates;
}

Message.prototype.sendMail = function sendMail(data, callback) {
  var content = {},
    self = this;

  const getRendered = this._expandTemplate(data, this.templates.html);
  const getText = this._expandTemplate(data, this.templates.text);

  const getMeta = this._expandTemplate(data, this.templates.meta)
  .then(function(meta) {
      meta = meta ? JSON.parse(meta) : {};
      Object.keys(meta).forEach(k => {
        if (!meta[k]) delete meta[k];
      });
      return meta;
  });

  return P.join(getRendered, getMeta, getText, function renderTmpl(rendered, meta, text) {

    content.text = text;
    content.html = rendered;
    var mail = Object.assign({}, content, data, meta);

    var deferred = P.defer();
    self.transporter.sendMail(mail, function(err, info) {
      if (err) deferred.reject(err);
      else deferred.resolve(info);
    });

    return deferred.promise;
  })
  .nodeify(callback);
}

Message.prototype._expandTemplate = function(data, template) {
  if (!template) return P.cast(null);

  return new P(function(resolve, reject) {
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
          return done(null, token);
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
    return P.cast(_this.cache[name]).nodeify(cb);
  }

  return this._templateList()
  .then(function(files) {
    htmlPath = _this._resolveTemplateFile(name + '.html.hbs', files);
    textPath = _this._resolveTemplateFile(name + '.text.hbs', files);
    metaPath = _this._resolveTemplateFile(name + '.meta.hbs', files);

    const loadText = _this._loadTemplate(textPath);
    const loadHTML = _this._loadTemplate(htmlPath);
    const loadMeta = _this._loadTemplate(metaPath);

    return P.join(loadText, loadHTML, loadMeta);
  })
  .spread(function(textT, htmlT, metaT) {
    if (textT) templates.text = textT;
    if (htmlT) templates.html = htmlT;
    if (metaT) templates.meta = metaT;

    if (!templates.text && !templates.html) {
      throw new Error('template not found');
    }

    var message = new Message(_this.transporter, templates);
    _this.cache[name] = message;
    return message;
  })
  .nodeify(cb);
};

MustacheMailer.prototype._resolveTemplateFile = function(name, files) {
  return files.indexOf(name) > -1 ? path.resolve(this.templateDir, name) : null;
};

MustacheMailer.prototype._loadTemplate = function(path) {
  if (!path) return P.cast(null);

  return new P(function(resolve, reject) {
    fs.readFile(path, 'utf-8', function(err, source) {
      if (err) reject(err);
      else resolve(Handlebars.compile(source));
    });
  });
};

MustacheMailer.prototype._templateList = function() {
  var _this = this;

  return new P(function(resolve, reject) {
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
