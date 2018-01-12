const _ = require('lodash')
const fs = require('fs')
const Handlebars = require('handlebars')
const handlebarsAsync = require('handlebars-async')
const nodemailer = require('nodemailer')
const path = require('path')
const P = require('bluebird')

handlebarsAsync(Handlebars)

// the message objects returned by .message()
function Message (transporter, templates) {
  this.transporter = transporter
  this.templates = templates
}

Message.prototype.sendMail = function sendMail (data, callback) {
  const content = {}

  const getRendered = this._expandTemplate(data, this.templates.html)
  const getText = this._expandTemplate(data, this.templates.text)

  const getMeta = this._expandTemplate(data, this.templates.meta)
  .then((meta) => {
    meta = meta ? JSON.parse(meta) : {}
    Object.keys(meta).forEach(k => {
      if (!meta[k]) delete meta[k]
    })
    return meta
  })

  return P.join(getRendered, getMeta, getText, (rendered, meta, text) => {
    content.text = text
    content.html = rendered
    var mail = Object.assign({}, content, data, meta)

    var deferred = new P((resolve, reject) => {
      this.transporter.sendMail(mail, (err, info) => {
        if (err) reject(err)
        else resolve(info)
      })
    })

    return deferred
  })
  .nodeify(callback)
}

Message.prototype._expandTemplate = function (data, template) {
  if (!template) return P.cast(null)

  return new P((resolve, reject) => {
    template(data, (err, content) => {
      if (err) reject(err)
      else resolve(content)
    })
  })
}

function MustacheMailer (opts) {
  Object.assign(this, {
    nodemailer: {}, // node-mailer initialization options.
    transport: null, // the transport method, e.g., SES.
    templateDir: './templates',
    cache: {}
  }, opts)

  this.transporter = nodemailer.createTransport(this.transport)

  // if we provide a helper for generating tokens, e.g.,
  // email signup tokens, register the async helper.
  if (!this.tokenFacilitator) return

  Handlebars.registerHelper('tokenHelper', (data) => {
    var done = this.async()
    this.tokenFacilitator.generate(
      _.omit(data.hash, ['prefix', 'ttl']),
      _.pick(data.hash, ['prefix', 'ttl']),
      done
    )
  })
}

MustacheMailer.prototype.message = function (name, cb) {
  let templates = {}
  let htmlPath
  let metaPath
  let textPath

  if (this.cache[name]) {
    return P.cast(this.cache[name]).nodeify(cb)
  }

  return this._templateList()
  .then(files => {
    htmlPath = this._resolveTemplateFile(name + '.html.hbs', files)
    textPath = this._resolveTemplateFile(name + '.text.hbs', files)
    metaPath = this._resolveTemplateFile(name + '.meta.hbs', files)

    const loadText = this._loadTemplate(textPath)
    const loadHTML = this._loadTemplate(htmlPath)
    const loadMeta = this._loadTemplate(metaPath)

    return P.join(loadText, loadHTML, loadMeta)
  })
  .spread((textT, htmlT, metaT) => {
    if (textT) templates.text = textT
    if (htmlT) templates.html = htmlT
    if (metaT) templates.meta = metaT

    if (!templates.text && !templates.html) {
      throw new Error('template not found')
    }

    var message = new Message(this.transporter, templates)
    this.cache[name] = message
    return message
  })
  .nodeify(cb)
}

MustacheMailer.prototype._resolveTemplateFile = function (name, files) {
  return files.indexOf(name) > -1 ? path.resolve(this.templateDir, name) : null
}

MustacheMailer.prototype._loadTemplate = function (path) {
  if (!path) return P.cast(null)

  return new P((resolve, reject) => {
    fs.readFile(path, 'utf-8', (err, source) => {
      if (err) reject(err)
      else resolve(Handlebars.compile(source))
    })
  })
}

MustacheMailer.prototype._templateList = function () {
  var _this = this

  return new P((resolve, reject) => {
    fs.readdir(_this.templateDir, function (err, files) {
      if (err) reject(err)
      else {
        resolve(
        _.filter(files, function (f) {
          return f.match(/\.hbs$/)
        })
      )
      }
    })
  })
}

module.exports = MustacheMailer
