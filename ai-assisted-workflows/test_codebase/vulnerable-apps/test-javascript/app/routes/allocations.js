const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/allocations/:username', (req, res) => {
    const username = req.params.username;
    const query = "SELECT * FROM allocations WHERE user = '" + username + "'";
    db.query(query, (err, result) => {
        res.json(result);
    });
});

router.get('/allocation/:id', (req, res) => {
    const allocationId = req.params.id;
    const allocation = db.getAllocation(allocationId);
    res.json(allocation);
});

module.exports = router;