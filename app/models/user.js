var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');



var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: false,

  initialize: function() {
    this.on('creating', function(model, attrs, options) {
      var salt = bcrypt.genSaltSync(10);
      var hash = bcrypt.hashSync(model.get('password'), salt);
      model.set('password', hash);
      model.set('salt', salt);
    });
  },

  checkPassword: function(inputPassword) {
    var salt = this.get('salt');
    var hash = bcrypt.hashSync(inputPassword, salt);
    if (hash === this.get('password')) {
      return true;
    } else {
      return false;
    }
  }

});

module.exports = User;