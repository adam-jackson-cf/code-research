const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/contribution/:id', (req, res) => {
    const query = "SELECT * FROM contributions WHERE id = " + req.params.id;
    db.query(query, (err, result) => {
        res.json(result);
    });
});

router.post('/calculate', (req, res) => {
    const userInput = req.body.expression;
    const result = eval("console.log('" + userInput + "')");
    res.json({ result });
});

router.post('/validate', (req, res) => {
    const userInput = req.body.input;
    const regex = /^(a+)+$/;
    const isValid = regex.test(userInput);
    res.json({ valid: isValid });
});

module.exports = router;