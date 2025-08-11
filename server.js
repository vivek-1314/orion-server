const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
require('./db'); 

app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
  res.send('Orion backend server is running good 🫡!');
});
app.use('/api/auth', require('./routes/authroutes'));

// const PORT = process.env.PORT || 5000;
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Orion backend server running on port ${PORT}`);
});