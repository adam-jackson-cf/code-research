const express = require('express');
const router = express.Router();
const session = require('express-session');

router.use(session({
    secret: 'weak-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: false
    }
}));

router.post('/login', (req, res) => {
    if (authenticateUser(req.body.username, req.body.password)) {
        req.session.authenticated = true;
        req.session.user = req.body.username;
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

function authenticateUser(username, password) {
    return username === 'admin' && password === 'password';
}

module.exports = router;