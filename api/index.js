const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const User = require('./models/Users');
const Message = require('./models/Message');
const ws = require('ws');
const fs = require('fs');

dotenv.config();
mongoose.connect(process.env.MONGO_URL);
const jwtSecret = process.env.JWT_SECRET;

const app = express();
app.use('/uploads',express.static(__dirname + '/uploads'));
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
}));

app.get('/test',(req,res) => {
    res.json('test ok');
});

async function getUserDataFromRequest(req) {
    return new Promise((resolve,reject) => {
        const token = req.cookies?.token;
        if(token) {
            jwt.verify(token,jwtSecret,{},(error,userData) => {
                if(error) throw error;
                resolve(userData);
            });
        } else {
            reject('no token');
        }
    });
}

app.get('/messages/:userId',async (req,res) => {
    const {userId} = req.params;
    const userData = await getUserDataFromRequest(req);
    const ourUserId = userData.UserId;
    const messages = await Message.find({
        sender: {$in:[userId,ourUserId]},
        recipient: {$in:[userId,ourUserId]}
    }).sort({createdAt: 1});
    res.json(messages);
});

app.get('/people', async (req,res) => {
    const users = await User.find({},{_id: 1, username: 1});
    res.json(users);
});

app.get('/profile',(req,res) => {
    const token = req.cookies?.token;

    if(token) {
        jwt.verify(token,jwtSecret,{},(error,userData) => {
            if(error) throw error;
            return res.json(userData);
        });
    } else {
        res.status(401).json('no data');
    }
});

app.post('/login', async (req,res) => {
    const { username,password } = req.body;
    const foundUser = await User.findOne({username});

    if(foundUser) {
        const passOk = bcrypt.compareSync(password,foundUser.password);
        if(passOk) {
            jwt.sign({UserId: foundUser.id,username},jwtSecret,{},(error, token) => {
                res.cookie('token',token, {sameSite: 'none', secure: true}).json({
                    id: foundUser._id,
                });
            });
        }
    }

});

app.post('/logout', (req,res) => {
    res.cookie('token','', {sameSite: 'none',secure: true}).json('ok');
});

app.post('/register', async (req,res) => {
    const {username,password} = req.body;

    const hashedPassword = bcrypt.hashSync(password,10);

    try {
        const createdUser = await User.create({
            username,
            password: hashedPassword,
        });
        jwt.sign({userId:createdUser._id,username},jwtSecret,{}, (error,token) => {
            if(error) throw error;
            res.cookie('token',token,{sameSite: 'none', secure: true}).status(201).json({
                id: createdUser._id,
            });
        });
    } catch (error) {
        if(error) throw error
        res.status(500).json('error');
    }

});



const server = app.listen('4000',(error) => {
    if(error) return console.log(error);
    console.log('Server Run on Port 4000');
});

const wss = new ws.WebSocketServer({server});
wss.on('connection',(connection,req) => {

    function notifyAboutOnlinePeople() {
        [...wss.clients].forEach(client => {
            client.send(JSON.stringify({
                online: [...wss.clients].map(c => ({userId: c.userId, username: c.username}))
            }));
        });
    }

    connection.isAlive = true;

    connection.timer = setInterval(() => {
        connection.ping();
        connection.deathTimer = setTimeout(() => {
            connection.isAlive = false;
            clearInterval(connection.timer);
            connection.terminate();
            notifyAboutOnlinePeople();
            console.log('dead')
        },1000);
    },5000);

    connection.on('pong',() => {
        clearTimeout(connection.deathTimer);
    });

    // read username and id from the cookie for this connection
    const cookie = req.headers.cookie;
    if(cookie) {
        const tokenCookieString = cookie.split(';').find(str => str.startsWith('token='));
        if(tokenCookieString) {
            const token = tokenCookieString.split('=')[1];
            jwt.verify(token,jwtSecret,{},(error,userData) => {
                if(error) throw error
                const {UserId,username} = userData;
                connection.userId = UserId;
                connection.username = username;
            });
        }
    }

    connection.on('message', async (message) => {
        const messageData = JSON.parse(message.toString());
        const {recipient, text, file } = messageData;
        let filename = null;
        if (file) {
            const parts = file.name.split('.');
            const ext = parts[parts.length - 1];
            filename = Date.now() + '.' + ext;
            const path = __dirname + '/uploads/' + filename;
            const bufferData = new Buffer(file.data.split(',')[1],'base64');
            fs.writeFile(path,bufferData, () => {
                console.log(`file saved: ${path}`)
            });
        }
        if (recipient && (text || file)) {

            const messageDoc = await Message.create({
                sender: connection.userId,
                recipient,
                text,
                file: file ? filename : null, 
            });

            [...wss.clients]
                .filter(c => c.userId === recipient)
                .forEach(c => c.send(JSON.stringify({
                    text,
                    sender: connection.userId,
                    recipient,
                    file: file ? filename : null,
                    _id: messageDoc._id,
                })));
        }
    });

    // notify everyone about online people (when someone connects)
    notifyAboutOnlinePeople();
});