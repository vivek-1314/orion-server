const express = require('express');
const { signup , verifyEmail , login } = require('../controllers/authcontroller');


const router = express.Router();

router.post('/signup', signup);
router.get('/verify/:token', verifyEmail);
router.get('/login', login) ;

module.exports = router;