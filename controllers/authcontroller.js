const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const signup = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUserResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const existingUser = existingUserResult.rows[0];

    if (existingUser) {
      if (existingUser.is_verified) {
        return res.status(400).json({ error: 'Email already registered and verified.' });
      } else {
        // User exists but not verified: resend verification email with new token
        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });
        await db.query('UPDATE users SET verification_token=$1 WHERE email=$2', [token, email]);

        const verificationLink = `http://localhost:3000/api/auth/verify/${token}`;
        await transporter.sendMail({
          from: `"No Reply" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Verify your email - Resent',
          html: `<p>Hello ${existingUser.name}, please verify your email by clicking 
                 <a href="${verificationLink}">here</a>.</p>`
        });

        return res.status(200).json({ message: 'Email already registered but not verified. Verification email resent.' });
      }
    }

    // New user signup
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });

    await db.query(
      `INSERT INTO users (name, email, password_hash, verification_token, is_verified) 
       VALUES ($1, $2, $3, $4, false)`,
      [name, email, passwordHash, token]
    );

    const verificationLink = `http://localhost:3000/api/auth/verify/${token}`;
    await transporter.sendMail({
      from: `"No Reply" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your email',
      html: `<p>Hello ${name}, please verify your email by clicking 
             <a href="${verificationLink}">here</a>.</p>`
    });

    res.status(201).json({ message: 'Signup successful, please check your email to verify your account.' });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await db.query('SELECT * FROM users WHERE email=$1 AND verification_token=$2', [decoded.email, token]);
    if (user.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    await db.query('UPDATE users SET is_verified=true, verification_token=NULL WHERE email=$1', [decoded.email]);

    res.send('Email verified successfully! You can now log in.');

  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Invalid or expired token' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const user = result.rows[0];

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Please verify your email before logging in.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // Create JWT token for session auth (different from verification token)
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      }
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
    signup,
    verifyEmail,
    login
}
