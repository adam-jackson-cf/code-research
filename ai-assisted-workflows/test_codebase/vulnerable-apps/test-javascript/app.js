const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: 'another-weak-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: false,
        maxAge: null
    }
}));

const contributionsRouter = require('./app/routes/contributions');
const allocationsRouter = require('./app/routes/allocations');
const sessionRouter = require('./app/routes/session');
const researchRouter = require('./app/routes/research');

app.use('/api/contributions', contributionsRouter);
app.use('/api/allocations', allocationsRouter);
app.use('/api/auth', sessionRouter);
app.use('/api/research', researchRouter);

app.get('/', (req, res) => {
    res.json({ 
        message: 'NodeGoat Test Application',
        note: 'Test application'
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: err.message,
        stack: err.stack
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`NodeGoat Test Application running on port ${PORT}`);
});

module.exports = app;