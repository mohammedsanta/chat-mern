const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    sender: {type: mongoose.Schema.ObjectId, ref: 'User'},
    recipient: {type: mongoose.Schema.ObjectId, ref: 'User'},
    text: String,
    file: String,
},{timestamps: true});

const MessageModel = mongoose.model('Message',MessageSchema);

module.exports = MessageModel;