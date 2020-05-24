const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const pg = require('pg');
const fs = require('fs');
const { check, validationResult} = require('express-validator');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');

const multipart = require('connect-multiparty');
const multipartMiddleware = multipart({
  uploadDir: './src/assets/img'
});
const app = express();

app.use(cors());

//connection avec la db
let pool = new pg.Pool({
  user: 'lucaspasto',
  host: '51.178.40.75',
  database: 'ValouKervyn',
  password: 'Magnetique',
  port: '5432'
});
pool.connect(function (err) {
  if (err) throw err;
  console.log("Connected!");
});

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(session({
  secret: 'azefrgtbdiu',
  store: new pgSession({
      pool: pool,
      tableName: 'session'}),
  resave: false,
  saveUninitialized: false,
  cookie: {secure : true, maxAge: 30 * 24 * 60 * 1000, SameSite:'None'} //30 days
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy('local',
  async (username, password, done) => {
    await pool.query('SELECT * FROM users WHERE mail = \''+ username + '\'', (err, rows) => {
      if (rows.rowCount < 1) {
        return done(null, false, { message : 'User not found'});
      }
      bcrypt.compare(password, rows.rows[0].password, (err, res) => {
        if(err) return err;
        if(res) {
          console.log(rows.rows[0]);
          return( done(null, rows.rows[0]));
        }
        return done(null, false, { message : 'Verify password'});
      });
    })
}));

app.all("/api/*", function(req, res, next){
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  next();
});

// Password encryption for DB
const bcrypt = require('bcrypt');
const saltRounds = 5;

///////////////////// ROUTAGE /////////////////////

app.post('/api/login',function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err) { return next(err); }
    if (!user) { return res.send(info); }
    req.logIn(user, function(err) {
      if (err) { return next(err); }
      return res.send(user);
    });
  })(req, res, next);
});

app.get('/api/logout', (req, res) => {
  console.log(req, res);
  req.logout();
  return res.send(true);
});

app.get('/api/evenement', async (req, res) => {
  // recupere les valeurs du formulaire
  let sql = 'SELECT "eventId" , name, to_char("begin", \'DD/MM/YYYY\') as "begin", to_char("end", \'DD/MM/YYYY\') as "end", place, description, image from events ORDER BY "events"."begin" DESC';
  await pool.query(sql, (err, rows) => {
    return res.json(rows.rows);
  });
});

app.get('/api/galerie/:style', async (req, res) => {
  let style = req.url.split('/galerie/').pop();
  let sql = 'SELECT "paintingId", name, size, to_char(creationdate, \'DD/MM/YYYY\') as creationdate, image, likes FROM paintings WHERE category = \'' + style + '\' ORDER BY "paintingId"';
  await pool.query(sql, (err, rows) => {
    if (err) throw err;
    return res.json(rows.rows);
  });
});

app.post('/api/test', async (req, res) => {
  let sql = 'SELECT * FROM users WHERE mail=\''+ req.query.email + '\'';
  await pool.query(sql, (err,rows) => {
    if(rows.rows.length > 0) {
      bcrypt.compare(req.query.password, rows.rows[0].password, (err, match) => {
        if (match){
          req.login(rows.rows[0].id, function () {
            return res.end(true);
          });
        }
        return res.end(false);
      });
    }
    return res.end(false);
  });
});

app.post('/api/users', [
  check('firstname', 'Firstname cannot be empty').notEmpty(),
  check('firstname', 'Firstname must only include MAJ and low').isAlpha(),
  check('lastname', 'Lastname cannot be empty').notEmpty(),
  check('lastname', 'Lastname must only include MAJ and low').isAlpha(),
  check('email', 'Email must have @ and . ').isEmail(),
  check('password', 'Password length must be between 8 and 50').isLength({min: 8, max : 50}),
  check('password', 'Password must include spécial (@$.!%*#?&), number, Maj and Low').matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$.!%*#?&])[A-Za-z\d@$.!%*#?&]{8,}$/, 'i')
], (req, res) =>{
  const errors = validationResult(req);
  if(!errors.isEmpty()){
    return res.send(errors);
  } else {
    const query = "INSERT INTO users (firstname, lastname, mail, password, notifications) VALUES ($1,$2,$3,$4,$5)";
    let notification = false;
    if (req.query.notification === 'yes') notification = true;
    bcrypt.genSalt(saltRounds, function(err, salt) {
      bcrypt.hash(req.query.password, salt, async (err, hash) => {
        let valeur = [req.query.firstname, req.query.lastname, req.query.email, hash, notification];
        await pool.query(query, valeur, (err) => {
          if (err) return res.send(false);
          return res.send(true);
        });
      });
    })
  }
});

app.post('/api/like', async (req) => {
  console.log(req.query);
  await pool.query(
    'update paintings set likes = likes + 1 where "paintingId" = '+ req.query.painting + ';' +
    'UPDATE users SET likes = \'{' + req.query.likes + '}\' WHERE "userId" = ' + req.query.user, (err, res) => {
      if (err) throw err;
      return res;
    });
});

app.post('/api/dislike', async (req) => {
  console.log(req.query);
  await pool.query(
    'UPDATE paintings SET likes = likes - 1 WHERE "paintingId" = '+ req.query.painting + ';' +
    'UPDATE users SET likes = \'{' + req.query.likes + '}\' WHERE "userId" = ' + req.query.user, (err, res) => {
      if (err) throw err;
      return res;
    });
});

app.post('/api/adminPainting', multipartMiddleware, (req, res) => {
  res.json({
    'message': 'File uploaded succesfully.'
  });
  let file = '../../assets/img/' + req.query.galleryFile;
  pool.query("INSERT INTO paintings (name, size, creationdate, image, category) VALUES ('" + req.query.galleryName + "', '" + req.query.gallerySize + "', current_date, '" + file + "', '"+ req.query.category +"')",
    (err) => {
    if (err) throw err;
    return res.end(true);
  })
});

app.post('/api/adminEvent', multipartMiddleware, (req, res) => {
  res.json({
    'message': 'File uploaded succesfully.'
  });
  let file = '../../assets/img/' + req.query.eventFile;
  console.log(req.query.dateBegin);
  let sql = 'INSERT INTO events ("name", "begin", "end", "place", "description", "image") ' +
    "VALUES ('"+req.query.eventName+"', '"+req.query.eventBegin+"', '"+ req.query.eventEnd +"', '"+ req.query.eventPlace+"', '"+ req.query.eventDescription +"', '" +file+"')";
  pool.query(sql, (err, rows) => {
    if (err) {return err}
    return rows;
  })
});

app.post('/api/commentsgallery', async (req, res) => {
  let query = req.query;
  let sql = 'INSERT INTO commentsGallery ("userId", comment, "paintingId") VALUES ('+parseInt(query.user)+", '"+query.comment+"', "+parseInt(query.painting)+")";
  pool.query(sql, (err) => {
    if (err) throw err;
    return res.send(true);
  })
});

app.get('/api/commentsgallery/:id', async (req, res) => {
  let sql = 'select users.lastname, users.firstname, commentsGallery.comment FROM commentsGallery JOIN users on commentsGallery."userId" = users."userId" where "paintingId" = ' + req.params.id;
  pool.query(sql, (err, rows) => {
    if (err) throw err;
    return res.send(rows.rows);
  })
});

app.post('/api/commentsevent', async (req, res) => {
  let query = req.query;
  let sql = 'INSERT INTO commentsEvent ("userId", comment, "eventId") VALUES ('+parseInt(query.user)+", '"+query.comment+"', "+parseInt(query.event)+")";
  pool.query(sql, (err) => {
    if (err) throw err;
    return res.send(true);
  })
});

app.get('/api/commentsevent/:id', async (req, res) => {
  let sql = 'select users.lastname, users.firstname, commentsEvent.comment FROM commentsEvent JOIN users on commentsEvent."userId" = users."userId" where "eventId" = ' + req.params.id;
  pool.query(sql, (err, rows) => {
    if (err) throw err;
    return res.send(rows.rows);
  })
});


app.post('/api/admin', async (req, res) => {
  pool.query('SELECT * FROM users WHERE "userId" = '+ parseInt(req.query.id), (err, rows) => {
    if (err) throw err;
    if (rows.rows.firstname === 'Valou' && rows.rows.lastname === 'Kervyn' && rows.rows.mail === 'valoukervyn@gmail.com' && rows.rows.id === 1) {
      return res.send(true);
    }
    return res.send(false);
  })
});

passport.serializeUser(function (user_id, done) {
  done(null, user_id);
});
passport.deserializeUser(function (user_id, done) {
  done(null, user_id);
});

//ecoute sur le port 8888
app.listen(8888);

