var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var session = require('express-session');

var passport = require('passport'); 
var GithubStrategy = require('passport-github2').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;

var app = express();
app.use(session({
  secret: 'ASDF',
  resave: true,
  saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(new GithubStrategy({
  clientID: 'GET YOUR OWN',
  clientSecret: 'GET YOUR OWN',
  callbackURL: 'http://127.0.0.1:4568/auth/github/callback'
}, function(accessToken, refreshToken, profile, done) {
  // console.log(profile);
  return done(null, profile);
}));    

passport.use(new FacebookStrategy({
  clientID: 'GET YOUR OWN',
  clientSecret: 'GET YOUR OWN',
  callbackURL: 'http://127.0.0.1:4568/auth/facebook/callback'
},
  function(accessToken, refreshToken, profile, done) {
    return done(null, profile);
  }
));

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

// authentication and authorization middleware
var auth = function(req, res, next) {
  // if (req.session && req.session.loggedIn === true) {
  if (req.isAuthenticated() || (req.session && req.session.loggedIn === true)) {
    return next();
  } else {
    res.writeHead(302, {'Location': '/login'});
    return res.end();
  }
};

app.get('/', auth, function(req, res) {
  res.render('index');
});

app.get('/create', auth, function(req, res) {
  res.render('index');
});

app.get('/links', auth, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', auth, function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] })
);

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login?autherror=true&github=true' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  }
);

app.get('/auth/facebook',
  passport.authenticate('facebook')
);

app.get('/auth/facebook/callback', 
  passport.authenticate('facebook', { failureRedirect: '/login?autherror=true&facebook=true' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  }
);

app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res) {
  if (req.body.username && req.body.password) {
    new User({username: req.body.username}).fetch().then(function (model) {
      if (model && (model.checkPassword(req.body.password))) {
        req.session.loggedIn = true;
        res.writeHead(302, {'Location': '/'});
        res.end();
      } else {
        res.writeHead(302, {'Location': '/login?autherror=true'});
        res.end();
      }
    });
  } else {
    res.end();
  }
});

app.get('/logout', function(req, res) {
  req.logout();
  if (req.session.loggedIn === true) {
    req.session.loggedIn = false;
  }
  res.redirect('/login');
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res) {
  if (req.body.username && req.body.password) {
    // TODO: check if username already exists in table
    Users.create({
      username: req.body.username,
      password: req.body.password
    })
    .then(function() {
      req.session.loggedIn = true;
      res.writeHead(302, {'Location': '/'});
      return res.end();
    });
  } else {
    res.send('invalid username/password');
    res.end();
  }
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
