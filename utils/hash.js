const crypto = require('crypto');

exports.sha256 = (str) => {
    return crypto.createHash('sha256').update(str).digest('hex');
};
