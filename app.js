require('dotenv').config();

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var fileUpload = require('express-fileupload');
var { engine } = require('express-handlebars');
var db = require('./config/connection'); // Database connection
var adminRouter = require('./routes/admin');
var userRouter = require('./routes/user');

var app = express();

// Handlebars setup
app.engine('hbs', engine({
    extname: 'hbs',
    defaultLayout: 'layout',
    layoutsDir: path.join(__dirname, 'views', 'layouts'),
    partialsDir: path.join(__dirname, 'views', 'partials'),
    helpers: {
        eq: (a, b) => a === b,
        multiply: (a, b) => a * b,
        add: (a, b) => a + b,
        subtract: (a, b) => a - b,
        gt: (a, b) => a > b
    }
})); 

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// Middleware
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());
app.use(session({
  secret: 'Key',
  cookie: { maxAge: 60000000 },
  resave: false,
  saveUninitialized: false
}));

// Database connection
db.connect((err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  } else {
    console.log('Database connected');
  }
});

// Routes
app.use('/admin', adminRouter);
app.use('/', userRouter);

// 404 Error handler
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page Not Found', error: {} });
});

// Global error handler
app.use((err, req, res, next) => {
  res.status(err.status || 500).render('error', { message: err.message, error: {} });
});

module.exports = app;

