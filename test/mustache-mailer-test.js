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
        msg.templates.text(function(err, data) {
          data.should.match(/glad to meet you.\n/);
          return done();
        });
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
        msg.templates.text(function(err, data) {
          data.should.match(/great to meet you.\n/);

          msg.templates.html(function(err, data) {
            data.should.match(/great to meet you.<br\/>/);
            return done();
          });
        });
      });
    });
  });

  describe('meta', function() {
    it('expands meta information template, and parses it as JSON', function(done) {
      var mock = MockTransport();

      var mm = new MustacheMailer({
        transport: mock,
        templateDir: path.resolve(__dirname, './fixtures')
      });

      mm.message('bar')
        .then(function(msg) {
          msg.sendMail({
            to: 'zeke@example.com',
            name: 'Zeke'
          }, function(err) {
            mock.sentMail.length.should.equal(1);
            mock.sentMail[0].data.subject.should.eql('my awesome subject');
            mock.sentMail[0].data.awesomeName.should.eql('Awesome Zeke');
            return done();
          });
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
          }, function(err) {
            mock.sentMail.length.should.equal(1);
            mock.sentMail[0].data.to.should.eql('zeke@example.com');
            mock.sentMail[0].data.html.should.match(/Hello Zeke great to meet you.<br\/>/);
            mock.sentMail[0].data.text.should.match(/Hello Zeke great to meet you.\n/);
            return done();
          });
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
          }, function() {
            mock.sentMail.length.should.equal(1);
            mock.sentMail[0].data.to.should.eql('zeke@example.com');
            mock.sentMail[0].data.html.should.match(/Hello Zeke great to meet you.<br\/>/);
            mock.sentMail[0].data.text.should.match(/Hello Zeke great to meet you.\n/);
            return done();
          });
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

  describe('tokenHelper', function() {
    it('if tokenFacilitator is not provided, templates still work', function(done) {
      var mock = MockTransport();
      var mm = new MustacheMailer({
        transport: mock,
        templateDir: path.resolve(__dirname, './fixtures')
      });

      mm.message('bar')
        .then(function(msg) {
          msg.sendMail({
            to: 'zeke@example.com',
            name: 'Zeke',
            email: 'zeke@example.com'
          }, function(err, data) {
            mock.sentMail[0].data.text.should.match(/http:\/\/example.com\/\n/);
            return done();
          });
        });
    });

    it('if tokenFacilitator is provided, templates have access to helper', function(done) {
      var mock = MockTransport();
      var mm = new MustacheMailer({
        transport: mock,
        templateDir: path.resolve(__dirname, './fixtures'),
        // a fake token facilitator.
        tokenFacilitator: {
          generate: function(data, cb) {
            setTimeout(function() {
              data.email.should.eql('zeke@example.com');
              data.name.should.eql('Zeke');
              return cb(null, parseInt(Math.random() * 256));
            }, 20);
          }
        }
      });

      mm.message('bar')
        .then(function(msg) {
          msg.sendMail({
            to: 'zeke@example.com',
            name: 'Zeke',
            email: 'zeke@example.com'
          }, function(err, data) {
            mock.sentMail[0].data.text.should.match(/http:\/\/example.com\/[0-9]{1,3}/);
            return done();
          });
        });
    });
  });
});
