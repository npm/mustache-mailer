var chai = require('chai').should(),
  expect = require('chai').expect,
  path = require('path'),
  MustacheMailer = require('../'),
  MockTransport = require('nodemailer-mock-transport');

describe('MustacheMailer', function() {

  describe('message', function() {
    var mm = null;

    beforeEach(function(done) {
      mm = new MustacheMailer({
        transport: {},
        templateDir: path.resolve(__dirname, './fixtures')
      });
      return done();
    });

    it("returns message with 'text' contents populated, if text template is found", function(done) {
      mm.message('bar', function(err, msg) {
        msg.templates.text().should.match(/glad to meet you.\n/);
        return done();
      });
    });

    it("does not populate 'html' contents, if no template is found", function(done) {
      mm.message('bar', function(err, msg) {
        expect(msg.templates.html).to.equal(undefined);
        return done();
      });
    });

    it("populates both 'html' and 'text' templates if both templates are found", function(done) {
      mm.message('foo', function(err, msg) {
        msg.templates.text().should.match(/great to meet you.\n/);
        msg.templates.html().should.match(/great to meet you.<br\/>/);
        return done();
      });
    });
  });

  describe('cache', function() {
    var mm = null;

    beforeEach(function(done) {
      mm = new MustacheMailer({
        transport: {},
        templateDir: path.resolve(__dirname, './fixtures')
      });
      return done();
    });

    it('should place templates in the cache the first time they are used', function(done) {
      mm.message('foo', function(err, msg) {
        (typeof mm.cache.foo).should.equal('object');
        return done();
      });
    });

    it('should serve template from cache if entry already exists', function(done) {
      mm.cache.blarg = 'cached message';
      mm.message('blarg', function(err, msg) {
        msg.should.equal('cached message');
        return done();
      });
    });
  });

  describe('message.sendMail()', function() {
    it('expands templates with data, and includes them in sent message', function(done) {
      var mock = MockTransport();

      var mm = new MustacheMailer({
        transport: mock,
        templateDir: path.resolve(__dirname, './fixtures')
      });

      mm.message('foo')
        .then(function(msg) {
          msg.sendMail({
            to: 'zeke@example.com',
            fname: 'Zeke'
          });
          mock.sentMail.length.should.equal(1);
          mock.sentMail[0].data.to.should.eql('zeke@example.com');
          mock.sentMail[0].data.html.should.match(/Hello Zeke great to meet you.<br\/>/);
          mock.sentMail[0].data.text.should.match(/Hello Zeke great to meet you.\n/);
          return done();
        });
    });

    it('handles sending message from cache', function(done) {
      var mock = MockTransport();

      var mm = new MustacheMailer({
        transport: mock,
        templateDir: path.resolve(__dirname, './fixtures')
      });

      mm.message('foo')
        .then(function(msg) {
          (typeof mm.cache.foo).should.equal('object');
          return mm.message('foo')
        })
        .then(function(msg) {
          msg.sendMail({
            to: 'zeke@example.com',
            fname: 'Zeke'
          });
          mock.sentMail.length.should.equal(1);
          mock.sentMail[0].data.to.should.eql('zeke@example.com');
          mock.sentMail[0].data.html.should.match(/Hello Zeke great to meet you.<br\/>/);
          mock.sentMail[0].data.text.should.match(/Hello Zeke great to meet you.\n/);
          return done();
        });
    });

    it('handles malformed templates', function(done) {
      var mock = MockTransport();

      var mm = new MustacheMailer({
        transport: mock,
        templateDir: path.resolve(__dirname, './fixtures')
      });

      mm.message('invalid', function(err, msg) {
        msg.sendMail({
          fname: 'Zeke'
        }, function(err) {
          err.message.should.match(/Parse error/);
          return done();
        });
      });
    });

  });

});
